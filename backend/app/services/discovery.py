"""Discovery orchestration — connects the browser agent to the existing
analysis pipeline and manages run lifecycle.

This service is the bridge between ``browser_agent`` (raw browsing) and
``analysis.analyze_advertisement`` (the existing OCR → extraction → risk
pipeline).  It persists candidates, runs analysis, and emits progress.
"""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models import Advertisement
from app.models.discovery import DiscoveryCandidate, DiscoveryRun
from app.services.analysis import analyze_advertisement
from app.services.browser_agent import ProgressEvent, run_discovery

logger = logging.getLogger(__name__)


# ----------------------------------------------------------------------- #
# Run state helpers
# ----------------------------------------------------------------------- #


def create_run(
    db: Session,
    query: str,
    sources: str = "web",
    max_candidates: int = 10,
    min_risk_threshold: int = 0,
) -> DiscoveryRun:
    """Create a new pending discovery run."""
    run = DiscoveryRun(
        query=query.strip(),
        sources=sources.strip() or "web",
        max_candidates=min(max_candidates, 20),  # hard cap
        min_risk_threshold=max(0, min(100, min_risk_threshold)),
        status="pending",
    )
    db.add(run)
    db.commit()
    db.refresh(run)
    return run


def get_run(db: Session, run_id: str) -> DiscoveryRun | None:
    return db.get(DiscoveryRun, run_id)


def list_runs(db: Session, limit: int = 20) -> list[DiscoveryRun]:
    return (
        db.query(DiscoveryRun)
        .order_by(DiscoveryRun.created_at.desc())
        .limit(limit)
        .all()
    )


# ----------------------------------------------------------------------- #
# Async execution — runs in a background thread
# ----------------------------------------------------------------------- #


def _serialize_event(event: ProgressEvent) -> dict[str, Any]:
    """Convert a ProgressEvent to a JSON-safe dict for SSE."""
    data: dict[str, Any] = {
        "event_type": event.event_type,
        "message": event.message,
        "url": event.url,
        "source_id": getattr(event, "source_id", None),
    }
    if event.candidate:
        data["candidate"] = {
            "url": event.candidate.url,
            "page_title": event.candidate.page_title,
            "selection_reason": event.candidate.selection_reason,
            "ad_relevance_score": event.candidate.ad_relevance_score,
            "screenshot_path": event.candidate.screenshot_path,
            "error": event.candidate.error,
            "source_type": getattr(event.candidate, "source_type", "web"),
        }
    return data


async def execute_run(run_id: str, db_factory) -> None:
    """Execute a discovery run end-to-end.

    *db_factory* should be a callable that returns a new SQLAlchemy Session
    (we need a fresh session since this runs in a background thread).
    """
    db: Session = db_factory()
    try:
        run = db.get(DiscoveryRun, run_id)
        if not run:
            logger.error("Discovery run %s not found", run_id)
            return

        settings = get_settings()
        upload_dir = Path(settings.upload_dir)

        run.status = "searching"
        run.started_at = datetime.now(timezone.utc)
        run.progress_message = "Starting browser agent…"
        db.commit()

        # Collect existing screenshot hashes for duplicate detection
        seen_hashes: set[str] = set()

        candidates_found = 0
        candidates_analyzed = 0

        async for event in run_discovery(
            query=run.query,
            upload_dir=upload_dir,
            max_candidates=run.max_candidates,
            sources=run.sources,
            seen_hashes=seen_hashes,
        ):
            # Refresh the run object
            db.refresh(run)
            run.progress_message = event.message

            if event.event_type == "captured" and event.candidate:
                # ── Save candidate + create Advertisement + run analysis ──
                candidate_obj = event.candidate
                run.status = "processing"

                # Create Advertisement record (same as manual upload)
                ad = Advertisement(
                    text=candidate_obj.selection_reason or candidate_obj.page_title or "",
                    source=f"discovery:{candidate_obj.source_type}",
                    source_url=candidate_obj.url,
                    image_filename=candidate_obj.screenshot_path,
                    is_seed=False,
                    analysis_status="processing",
                )
                db.add(ad)
                db.flush()

                # Run the existing analysis pipeline
                try:
                    analyze_advertisement(db, ad)
                    analysis_status = "analyzed"
                    candidates_analyzed += 1
                except Exception as exc:
                    logger.exception("Analysis failed for candidate %s", candidate_obj.url)
                    ad.analysis_status = "failed"
                    analysis_status = "failed"

                # Persist the discovery candidate
                dc = DiscoveryCandidate(
                    run_id=run.id,
                    source_type=candidate_obj.source_type or "web",
                    source_url=candidate_obj.url,
                    page_title=candidate_obj.page_title,
                    selection_reason=candidate_obj.selection_reason,
                    screenshot_filename=candidate_obj.screenshot_path,
                    ad_relevance_score=candidate_obj.ad_relevance_score,
                    status=analysis_status,
                    advertisement_id=ad.id,
                    is_duplicate=False,
                    captured_at=candidate_obj.captured_at,
                )
                db.add(dc)
                candidates_found += 1
                run.candidates_found = candidates_found
                run.candidates_analyzed = candidates_analyzed
                db.commit()

            elif event.event_type == "error" and event.candidate and event.candidate.error:
                # Persist failed/skipped candidate
                c = event.candidate
                dc = DiscoveryCandidate(
                    run_id=run.id,
                    source_type=getattr(c, "source_type", "web"),
                    source_url=c.url,
                    page_title=c.page_title,
                    selection_reason=c.selection_reason,
                    ad_relevance_score=c.ad_relevance_score,
                    screenshot_filename=c.screenshot_path,
                    status="failed",
                    error_message=c.error,
                    is_duplicate="Duplicate" in (c.error or ""),
                )
                db.add(dc)
                db.commit()

            elif event.event_type == "done":
                run.status = "completed"
                run.completed_at = datetime.now(timezone.utc)
                run.candidates_found = candidates_found
                run.candidates_analyzed = candidates_analyzed
                db.commit()

            else:
                db.commit()

        # Ensure run is marked complete even if generator ends without 'done'
        db.refresh(run)
        if run.status not in ("completed", "failed"):
            run.status = "completed"
            run.completed_at = datetime.now(timezone.utc)
            db.commit()

    except Exception as exc:
        logger.exception("Discovery run %s failed", run_id)
        try:
            db.refresh(run)
            run.status = "failed"
            run.error_message = str(exc)[:500]
            run.completed_at = datetime.now(timezone.utc)
            db.commit()
        except Exception:
            pass
    finally:
        db.close()


def start_run_background(run_id: str, db_factory) -> None:
    """Launch execute_run in a background thread with its own event loop."""
    import threading

    def _worker():
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            loop.run_until_complete(execute_run(run_id, db_factory))
        finally:
            loop.close()

    thread = threading.Thread(target=_worker, name=f"discovery-{run_id[:8]}", daemon=True)
    thread.start()
