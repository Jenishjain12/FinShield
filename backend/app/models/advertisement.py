import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Advertisement(Base):
    __tablename__ = "advertisements"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    seed_key: Mapped[str | None] = mapped_column(String(120), unique=True, nullable=True, index=True)
    is_seed: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    text: Mapped[str] = mapped_column(Text, default="")
    source: Mapped[str | None] = mapped_column(String(120), nullable=True)
    source_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    image_filename: Mapped[str | None] = mapped_column(String(255), nullable=True)
    ocr_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    ocr_status: Mapped[str] = mapped_column(String(40), default="not_requested")
    analysis_status: Mapped[str] = mapped_column(String(40), default="pending", index=True)
    review_status: Mapped[str] = mapped_column(String(40), default="unreviewed", index=True)
    risk_score: Mapped[int] = mapped_column(Integer, default=0, index=True)
    risk_category: Mapped[str] = mapped_column(String(20), default="LOW", index=True)
    limitations: Mapped[str | None] = mapped_column(Text, nullable=True)
    recommendation: Mapped[str | None] = mapped_column(Text, nullable=True)
    analyzed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)

    entities = relationship("ExtractedEntity", back_populates="advertisement", cascade="all, delete-orphan")
    signals = relationship("RiskSignal", back_populates="advertisement", cascade="all, delete-orphan")
    notes = relationship("AnalystNote", back_populates="advertisement", cascade="all, delete-orphan")
    alerts = relationship("Alert", back_populates="advertisement", cascade="all, delete-orphan")
