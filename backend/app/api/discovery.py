"""REST API for the advertisement discovery agent.

Endpoints:
    POST   /api/discovery/runs           — Start a new discovery run
    GET    /api/discovery/runs           — List recent runs
    GET    /api/discovery/runs/{id}      — Get run detail with candidates
    GET    /api/discovery/runs/{id}/stream — SSE progress stream
"""

from __future__ import annotations

import asyncio
import json
import logging
from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.db.session import get_db, SessionLocal
from app.models.discovery import DiscoveryCandidate, DiscoveryRun
from app.services.discovery import create_run, get_run, list_runs, start_run_background
from app.services.serializers import detail as ad_detail

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/discovery")


# ----------------------------------------------------------------------- #
# Pydantic schemas
# ----------------------------------------------------------------------- #


class SourceInfo(BaseModel):
    source_id: str
    name: str
    status: str
    description: str
    is_authenticated: bool
    requires_credentials: bool
    notes: str


class RunCreate(BaseModel):
    query: str = Field(min_length=2, max_length=500, description="Search query for financial advertisements")
    sources: str = Field(default="web", max_length=200, description="Comma-separated sources (e.g. web,synthetic_testbed)")
    max_candidates: int = Field(default=10, ge=1, le=20, description="Max candidates to capture (1-20)")
    min_risk_threshold: int = Field(default=0, ge=0, le=100, description="Minimum risk score threshold for prioritization (0-100)")


class CandidateOut(BaseModel):
    id: str
    source_type: str = "web"
    source_url: str
    page_title: str | None
    selection_reason: str
    screenshot_filename: str | None
    ad_relevance_score: float
    status: str
    error_message: str | None
    advertisement_id: str | None
    is_duplicate: bool
    captured_at: datetime | None
    created_at: datetime

    class Config:
        from_attributes = True


class RunOut(BaseModel):
    id: str
    query: str
    sources: str
    max_candidates: int
    min_risk_threshold: int = 0
    status: str
    progress_message: str | None
    candidates_found: int
    candidates_analyzed: int
    error_message: str | None
    started_at: datetime | None
    completed_at: datetime | None
    created_at: datetime

    class Config:
        from_attributes = True


class RunDetailOut(RunOut):
    candidates: list[CandidateOut] = []


class RunWithAnalysis(RunDetailOut):
    """Extended response that includes full advertisement detail for each analyzed candidate."""
    candidate_analyses: list[dict[str, Any]] = []


# ----------------------------------------------------------------------- #
# Endpoints
# ----------------------------------------------------------------------- #


@router.get("/sources", response_model=list[SourceInfo])
def list_available_sources():
    """List all supported discovery source adapters and their operational status."""
    from app.services.source_adapters import registry
    statuses = registry.list_sources()
    return [
        SourceInfo(
            source_id=s.source_id,
            name=s.name,
            status=s.status,
            description=s.description,
            is_authenticated=s.is_authenticated,
            requires_credentials=s.requires_credentials,
            notes=s.notes,
        )
        for s in statuses
    ]


@router.post("/runs", response_model=RunOut, status_code=201)
def start_discovery_run(body: RunCreate, db: Session = Depends(get_db)):
    """Start a new discovery run.  Returns immediately; the agent runs in the background."""
    from app.services.source_adapters import registry

    # Validate selected sources
    selected = [s.strip() for s in body.sources.split(",") if s.strip()]
    if not selected:
        raise HTTPException(status_code=400, detail="At least one discovery source must be selected.")

    for s in selected:
        adapter = registry.get(s)
        if not adapter:
            raise HTTPException(status_code=400, detail=f"Unsupported discovery source: '{s}'.")

    # Check for existing active runs (rate limiting — max 1 concurrent)
    active = (
        db.query(DiscoveryRun)
        .filter(DiscoveryRun.status.in_(["pending", "searching", "processing"]))
        .first()
    )
    if active:
        raise HTTPException(
            status_code=429,
            detail=f"A discovery run is already active (ID: {active.id}). Wait for it to complete.",
        )

    try:
        run = create_run(
            db=db,
            query=body.query,
            sources=body.sources,
            max_candidates=body.max_candidates,
            min_risk_threshold=body.min_risk_threshold,
        )

        # Start background execution
        start_run_background(run.id, SessionLocal)
        return run
    except Exception as exc:
        logger.exception("Failed to initialize discovery run: %s", exc)
        raise HTTPException(status_code=500, detail="Failed to initialize discovery run in the database.")


@router.get("/runs", response_model=list[RunOut])
def list_discovery_runs(
    limit: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    """List recent discovery runs, newest first."""
    return list_runs(db, limit)


@router.get("/runs/{run_id}", response_model=RunWithAnalysis)
def get_discovery_run(run_id: str, db: Session = Depends(get_db)):
    """Get a single discovery run with all candidates and their analysis results."""
    run = get_run(db, run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Discovery run not found.")

    candidates = (
        db.query(DiscoveryCandidate)
        .filter(DiscoveryCandidate.run_id == run_id)
        .order_by(DiscoveryCandidate.created_at)
        .all()
    )

    candidate_analyses = []
    for c in candidates:
        if c.advertisement_id and c.advertisement:
            try:
                analysis = ad_detail(db, c.advertisement)
                candidate_analyses.append({
                    "candidate_id": c.id,
                    "advertisement": analysis.model_dump(mode="json"),
                })
            except Exception:
                pass

    return RunWithAnalysis(
        id=run.id,
        query=run.query,
        sources=run.sources,
        max_candidates=run.max_candidates,
        min_risk_threshold=run.min_risk_threshold,
        status=run.status,
        progress_message=run.progress_message,
        candidates_found=run.candidates_found,
        candidates_analyzed=run.candidates_analyzed,
        error_message=run.error_message,
        started_at=run.started_at,
        completed_at=run.completed_at,
        created_at=run.created_at,
        candidates=[CandidateOut.model_validate(c) for c in candidates],
        candidate_analyses=candidate_analyses,
    )


@router.get("/runs/{run_id}/stream")
async def stream_discovery_progress(run_id: str, db: Session = Depends(get_db)):
    """Server-Sent Events stream for live discovery progress."""
    run = get_run(db, run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Discovery run not found.")

    async def event_generator():
        last_message = ""
        last_candidates = 0
        poll_count = 0
        max_polls = 300  # 5 minutes at 1s intervals

        while poll_count < max_polls:
            poll_count += 1
            # Fresh session for each poll
            poll_db = SessionLocal()
            try:
                current_run = poll_db.get(DiscoveryRun, run_id)
                if not current_run:
                    yield f"data: {json.dumps({'event_type': 'error', 'message': 'Run not found'})}\n\n"
                    break

                # Emit update if state changed
                if current_run.progress_message != last_message or current_run.candidates_found != last_candidates:
                    last_message = current_run.progress_message or ""
                    last_candidates = current_run.candidates_found

                    event_data = {
                        "event_type": "progress",
                        "message": last_message,
                        "status": current_run.status,
                        "candidates_found": current_run.candidates_found,
                        "candidates_analyzed": current_run.candidates_analyzed,
                    }
                    yield f"data: {json.dumps(event_data)}\n\n"

                if current_run.status in ("completed", "failed", "cancelled"):
                    final_data = {
                        "event_type": "done",
                        "message": current_run.progress_message or f"Run {current_run.status}",
                        "status": current_run.status,
                        "candidates_found": current_run.candidates_found,
                        "candidates_analyzed": current_run.candidates_analyzed,
                    }
                    yield f"data: {json.dumps(final_data)}\n\n"
                    break
            finally:
                poll_db.close()

            await asyncio.sleep(1)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
