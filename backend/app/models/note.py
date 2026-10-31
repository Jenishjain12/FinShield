from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.advertisement import Advertisement
    from app.models.transaction import Transaction


class AnalystNote(Base):
    __tablename__ = "analyst_notes"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    transaction_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("transactions.id", ondelete="CASCADE"), nullable=True, index=True
    )
    advertisement_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("advertisements.id", ondelete="CASCADE"), nullable=True, index=True
    )
    author: Mapped[str] = mapped_column(String(64), default="Analyst")
    content: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    transaction: Mapped[Transaction | None] = relationship("Transaction", back_populates="notes")
    advertisement: Mapped[Advertisement | None] = relationship("Advertisement", back_populates="notes")
