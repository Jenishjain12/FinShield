import asyncio
from pathlib import Path
import pytest

from app.models.discovery import DiscoveryRun, DiscoveryCandidate
from app.services.source_adapters import (
    registry,
    score_ad_relevance,
)
from app.services.browser_agent import run_discovery
from app.services.discovery import create_run, execute_run


def test_score_ad_relevance():
    # Strong promotion
    promo_text = "Guaranteed 100% returns! Double your money today! Call WhatsApp +919876543210 and pay processing fee."
    score, reason = score_ad_relevance(promo_text, "https://crypto-invest.example.com")
    assert score >= 0.50
    assert "claim" in reason.lower()

    # Educational content
    edu_text = "Wikipedia educational guide on the principles of compound interest and long term bond yields in government securities."
    edu_score, edu_reason = score_ad_relevance(edu_text, "https://en.wikipedia.org/wiki/Compound_interest")
    assert edu_score < 0.20
    assert "not a financial promotion" in edu_reason.lower()

    # Minimal text
    blank_score, _ = score_ad_relevance("Too short")
    assert blank_score == 0.0


def test_source_adapters_registry():
    sources = registry.list_sources()
    source_ids = {s.source_id for s in sources}
    assert "web" in source_ids
    assert "synthetic_testbed" in source_ids
    assert "meta_ad_library" in source_ids
    assert "social_media" in source_ids

    # Unconfigured credentials return auth_required status gracefully
    meta = next(s for s in sources if s.source_id == "meta_ad_library")
    assert meta.requires_credentials is True


def test_discovery_api_sources(client):
    resp = client.get("/api/discovery/sources")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) >= 4
    assert any(s["source_id"] == "synthetic_testbed" for s in data)


def test_discovery_runs_api(client, db):
    # Start a run
    resp = client.post(
        "/api/discovery/runs",
        json={
            "query": "guaranteed wealth scheme",
            "sources": "synthetic_testbed",
            "max_candidates": 2,
            "min_risk_threshold": 50,
        },
    )
    assert resp.status_code == 201
    body = resp.json()
    run_id = body["id"]
    assert body["query"] == "guaranteed wealth scheme"
    assert body["sources"] == "synthetic_testbed"
    assert body["min_risk_threshold"] == 50

    # Rate limiting: second concurrent run should be rejected with 429
    conflict = client.post(
        "/api/discovery/runs",
        json={"query": "second query", "sources": "synthetic_testbed"},
    )
    assert conflict.status_code == 429

    # List runs
    list_resp = client.get("/api/discovery/runs")
    assert list_resp.status_code == 200
    assert any(r["id"] == run_id for r in list_resp.json())

    # Get single run detail
    detail_resp = client.get(f"/api/discovery/runs/{run_id}")
    assert detail_resp.status_code == 200
    assert detail_resp.json()["id"] == run_id


def test_discovery_runs_api_invalid_source(client, db):
    # Clean any active runs
    db.query(DiscoveryRun).filter(DiscoveryRun.status.in_(["pending", "searching", "processing"])).delete()
    db.commit()

    resp = client.post(
        "/api/discovery/runs",
        json={"query": "test query", "sources": "nonexistent_source"},
    )
    assert resp.status_code == 400
    assert "Unsupported discovery source" in resp.json()["detail"]

    resp_empty = client.post(
        "/api/discovery/runs",
        json={"query": "test query", "sources": ""},
    )
    assert resp_empty.status_code == 400


@pytest.mark.anyio
async def test_real_playwright_synthetic_discovery(tmp_path):
    """Test real browser execution on synthetic pages: navigation, scoring, and screenshot capture."""
    events = []
    async for event in run_discovery(
        query="guaranteed returns",
        upload_dir=tmp_path,
        max_candidates=2,
        sources="synthetic_testbed",
        allow_localhost=True,
    ):
        events.append(event)

    event_types = [e.event_type for e in events]
    assert "searching" in event_types
    assert "navigating" in event_types
    assert "candidate_found" in event_types
    assert "captured" in event_types
    assert "done" in event_types

    captured_events = [e for e in events if e.event_type == "captured"]
    assert len(captured_events) >= 1
    first_candidate = captured_events[0].candidate
    assert first_candidate.screenshot_path is not None
    assert (tmp_path / first_candidate.screenshot_path).exists()
    assert (tmp_path / first_candidate.screenshot_path).stat().st_size > 0
    assert first_candidate.screenshot_hash is not None


@pytest.mark.anyio
async def test_end_to_end_discovery_pipeline(db, tmp_path, monkeypatch):
    """Test full pipeline: Browser -> Capture -> OCR -> Extraction -> Risk Engine -> Alerts."""
    from app.core.config import get_settings
    settings = get_settings()
    monkeypatch.setattr(settings, "upload_dir", str(tmp_path))

    # Clean any previous active runs in db fixture
    db.query(DiscoveryRun).filter(DiscoveryRun.status.in_(["pending", "searching", "processing"])).delete()
    db.commit()

    run = create_run(db, query="wealth scheme", sources="synthetic_testbed", max_candidates=1)

    # Execute discovery run asynchronously
    def _db_factory():
        from app.db.session import SessionLocal
        return SessionLocal()

    await execute_run(run.id, _db_factory)

    # Refresh and verify
    db.refresh(run)
    assert run.status == "completed"
    assert run.candidates_found >= 1
    assert run.candidates_analyzed >= 1

    candidate = db.query(DiscoveryCandidate).filter_by(run_id=run.id).first()
    assert candidate is not None
    assert candidate.status == "analyzed"
    assert candidate.advertisement_id is not None

    # Verify advertisement was scored by the existing risk engine
    ad = candidate.advertisement
    assert ad is not None
    assert ad.analysis_status == "completed"
    assert ad.risk_score >= 25
    assert ad.risk_category in {"MEDIUM", "HIGH", "CRITICAL"}
    assert len(ad.entities) > 0
    assert len(ad.signals) > 0
