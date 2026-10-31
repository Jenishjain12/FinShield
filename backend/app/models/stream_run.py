from __future__ import annotations

import uuid
from datetime import datetime
from sqlalchemy import DateTime, Float, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class StreamRun(Base):
    __tablename__ = "stream_runs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    status: Mapped[str] = mapped_column(String(32), default="stopped")  # stopped, running, paused
    transactions_emitted: Mapped[int] = mapped_column(Integer, default=0)
    anomalies_detected: Mapped[int] = mapped_column(Integer, default=0)
    rate_per_second: Mapped[float] = mapped_column(Float, default=2.0)
    started_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

