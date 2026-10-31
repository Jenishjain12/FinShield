from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.api.dashboard import PATTERN_METADATA
from app.db.session import get_db
from app.models.alert import Alert
from app.models.transaction import Transaction
from app.schemas.transaction import PatternSummaryOut, TransactionSummary

router = APIRouter()


@router.get("/patterns", response_model=list[PatternSummaryOut])
def list_patterns(db: Session = Depends(get_db)) -> list[PatternSummaryOut]:
    """List all tracked UPI anomaly & risk patterns with frequency and volume totals."""
    results: list[PatternSummaryOut] = []
    for pat in PATTERN_METADATA:
        matched = (
            db.query(func.count(Alert.id), func.sum(Transaction.amount))
            .join(Transaction, Alert.transaction_id == Transaction.id)
            .filter(Alert.alert_type == pat["pattern_id"])
            .first()
        )
        count = matched[0] or 0 if matched else 0
        volume = float(matched[1] or 0.0) if matched else 0.0
        results.append(
            PatternSummaryOut(
                pattern_id=pat["pattern_id"],
                name=pat["name"],
                category=pat["category"],
                description=pat["description"],
                matched_count=count,
                flagged_volume_inr=round(volume, 2),
                severity_level=pat["severity"],
            )
        )
    return results


@router.get("/patterns/{pattern_id}/transactions", response_model=list[TransactionSummary])
def get_pattern_transactions(pattern_id: str, limit: int = 50, db: Session = Depends(get_db)):
    """Fetch recent transactions triggering a specific UPI risk pattern."""
    matched_alerts = (
        db.query(Alert)
        .filter(Alert.alert_type == pattern_id)
        .order_by(Alert.created_at.desc())
        .limit(limit)
        .all()
    )
    tx_ids = [a.transaction_id for a in matched_alerts if a.transaction_id]
    if not tx_ids:
        return []

    txs = db.query(Transaction).filter(Transaction.id.in_(tx_ids)).all()
    return [
        TransactionSummary(
            id=t.id,
            transaction_id=t.transaction_id,
            timestamp=t.timestamp,
            amount=t.amount,
            currency=t.currency,
            transaction_type=t.transaction_type,
            status=t.status,
            sender_account_id=t.sender_account_id,
            receiver_account_id=t.receiver_account_id,
            sender_upi_handle=t.sender_upi_handle,
            receiver_upi_handle=t.receiver_upi_handle,
            device_id=t.device_id,
            synthetic_geo_region=t.synthetic_geo_region,
            channel=t.channel,
            reference_note=t.reference_note,
            risk_score=t.risk_score,
            risk_category=t.risk_category,
            anomaly_score=t.anomaly_score,
            review_status=t.review_status,
            is_synthetic=t.is_synthetic,
        )
        for t in txs
    ]

