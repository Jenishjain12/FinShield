from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Any

from sqlalchemy import DateTime, Float, ForeignKey, Integer, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.transaction import Transaction


class RiskAssessment(Base):
    __tablename__ = "risk_assessments"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    transaction_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("transactions.id", ondelete="CASCADE"), unique=True, index=True
    )
    anomaly_score: Mapped[float] = mapped_column(Float, default=0.0)
    triage_score: Mapped[int] = mapped_column(Integer, default=0)
    risk_category: Mapped[str] = mapped_column(String(16), default="LOW")
    model_version: Mapped[str] = mapped_column(String(64), default="isolation_forest_v1.0")
    
    # Explainable feature vector and rule contributions stored as structured JSON
    feature_snapshot: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    rule_hits: Mapped[list[dict[str, Any]]] = mapped_column(JSON, default=list)
    
    recommendation: Mapped[str] = mapped_column(
        Text,
        default="Review transaction context, beneficiary relationship, and velocity baseline before approval.",
    )
    limitations: Mapped[str] = mapped_column(
        Text,
        default=(
            "Anomaly scores represent multivariate distance from synthetic training baselines. "
            "Rule hits indicate heuristic risk signals and do not constitute proof of fraudulent or criminal intent."
        ),
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    transaction: Mapped[Transaction] = relationship("Transaction", back_populates="assessment")

