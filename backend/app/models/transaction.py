from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Transaction(Base):
    __tablename__ = "transactions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    transaction_id: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    timestamp: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)
    amount: Mapped[float] = mapped_column(Float, nullable=False, index=True)
    currency: Mapped[str] = mapped_column(String(8), default="INR")
    transaction_type: Mapped[str] = mapped_column(String(32), default="pay", index=True)  # pay, collect, refund, transfer
    status: Mapped[str] = mapped_column(String(32), default="completed", index=True)  # completed, pending, failed, reversed
    
    sender_account_id: Mapped[str] = mapped_column(String(64), index=True)
    receiver_account_id: Mapped[str] = mapped_column(String(64), index=True)
    sender_upi_handle: Mapped[str] = mapped_column(String(128), index=True)
    receiver_upi_handle: Mapped[str] = mapped_column(String(128), index=True)
    
    merchant_id: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    device_id: Mapped[str] = mapped_column(String(64), index=True)
    synthetic_ip: Mapped[str] = mapped_column(String(45), index=True)
    synthetic_geo_region: Mapped[str] = mapped_column(String(128), index=True)
    channel: Mapped[str] = mapped_column(String(32), default="upi_app")  # upi_app, web_portal, qr_code, collect_request
    reference_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_synthetic: Mapped[bool] = mapped_column(Boolean, default=True)

    # Risk & Anomaly scoring attributes
    anomaly_score: Mapped[float] = mapped_column(Float, default=0.0)  # -1.0 to 1.0 or normalized 0-1
    risk_score: Mapped[int] = mapped_column(Integer, default=0, index=True)  # 0 to 100 triage score
    risk_category: Mapped[str] = mapped_column(String(16), default="LOW", index=True)  # LOW, MEDIUM, HIGH, CRITICAL
    review_status: Mapped[str] = mapped_column(String(32), default="unreviewed", index=True)  # unreviewed, under_review, escalated, closed

    # Relationships
    assessment: Mapped[RiskAssessment | None] = relationship(
        "RiskAssessment", back_populates="transaction", uselist=False, cascade="all, delete-orphan"
    )
    alerts: Mapped[list[Alert]] = relationship(
        "Alert", back_populates="transaction", cascade="all, delete-orphan"
    )
    notes: Mapped[list[AnalystNote]] = relationship(
        "AnalystNote", back_populates="transaction", cascade="all, delete-orphan"
    )

