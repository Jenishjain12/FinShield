"""SQLAlchemy models for the advertisement discovery agent.

``DiscoveryRun``  — one investigator-initiated discovery session.
``DiscoveryCandidate`` — one candidate webpage discovered during a run.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class DiscoveryRun(Base):
    __tablename__ = "discovery_runs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    query: Mapped[str] = mapped_column(String(500))
    sources: Mapped[str] = mapped_column(String(200), default="web")  # comma-separated
    max_candidates: Mapped[int] = mapped_column(Integer, default=10)
    min_risk_threshold: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[str] = mapped_column(String(40), default="pending", index=True)
    # status: pending | searching | processing | completed | failed | cancelled
    progress_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    candidates_found: Mapped[int] = mapped_column(Integer, default=0)
    candidates_analyzed: Mapped[int] = mapped_column(Integer, default=0)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, index=True)

    candidates = relationship("DiscoveryCandidate", back_populates="run", cascade="all, delete-orphan")


class DiscoveryCandidate(Base):
    __tablename__ = "discovery_candidates"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    run_id: Mapped[str] = mapped_column(String(36), ForeignKey("discovery_runs.id"), index=True)
    source_type: Mapped[str] = mapped_column(String(50), default="web")
    source_url: Mapped[str] = mapped_column(String(2048))
    page_title: Mapped[str | None] = mapped_column(String(500), nullable=True)
    selection_reason: Mapped[str] = mapped_column(Text, default="")
    screenshot_filename: Mapped[str | None] = mapped_column(String(255), nullable=True)
    ad_relevance_score: Mapped[float] = mapped_column(Float, default=0.0)
    # Capture / analysis status: pending | captured | ocr_done | analyzed | failed | skipped | duplicate
    status: Mapped[str] = mapped_column(String(40), default="pending", index=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    advertisement_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("advertisements.id"), nullable=True)
    is_duplicate: Mapped[bool] = mapped_column(Boolean, default=False)
    captured_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)

    run = relationship("DiscoveryRun", back_populates="candidates")
    advertisement = relationship("Advertisement", foreign_keys=[advertisement_id])
