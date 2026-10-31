from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.advertisement import Advertisement
    from app.models.transaction import Transaction


class Alert(Base):
    __tablename__ = "alerts"
    __table_args__ = (
        UniqueConstraint("idempotency_key", name="uq_alert_idempotency"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    idempotency_key: Mapped[str] = mapped_column(String(255), index=True)
    alert_type: Mapped[str] = mapped_column(String(80), index=True)
    severity: Mapped[str] = mapped_column(String(20), index=True)
    
    transaction_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("transactions.id", ondelete="CASCADE"), nullable=True, index=True
    )
    account_id: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    advertisement_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("advertisements.id", ondelete="CASCADE"), nullable=True, index=True
    )
    campaign_id: Mapped[str | None] = mapped_column(String(80), nullable=True, index=True)
    
    reason: Mapped[str] = mapped_column(Text)
    is_read: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True
    )

    transaction: Mapped[Transaction | None] = relationship("Transaction", back_populates="alerts")
    advertisement: Mapped[Advertisement | None] = relationship("Advertisement", back_populates="alerts")
