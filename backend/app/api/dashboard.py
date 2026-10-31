from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.advertisement import Advertisement
from app.models.alert import Alert
from app.models.risk_assessment import RiskAssessment
from app.models.transaction import Transaction
from app.schemas.transaction import (
    AlertOut,
    DashboardSummaryOut,
    ModelStatusOut,
    PatternSummaryOut,
    StreamStatusOut,
    TransactionSummary,
)
from app.services.ml import FEATURE_NAMES, get_model_bundle
from app.services.simulator import simulator

router = APIRouter()

PATTERN_METADATA = [
    {
        "pattern_id": "FAKE_COLLECT_REQUEST",
        "name": "Deceptive Collect Requests",
        "category": "Social Engineering",
        "description": "Inbound pull requests disguised as rewards, lottery winnings, or bill refunds.",
        "severity": "CRITICAL",
    },
    {
        "pattern_id": "PHISHING_PAYMENT_HANDLE",
        "name": "Brand / Bank Impersonation VPAs",
        "category": "Impersonation",
        "description": "Beneficiary handles imitating trusted bank KYC, utility boards, or gateways.",
        "severity": "CRITICAL",
    },
    {
        "pattern_id": "MULE_ACCOUNT_FAN_OUT",
        "name": "Mule Account Rapid Drain",
        "category": "Money Laundering",
        "description": "Rapid inbound-to-outbound transit of funds within 15 minutes of deposit.",
        "severity": "HIGH",
    },
    {
        "pattern_id": "RAPID_REPEATED_TRANSFERS",
        "name": "Velocity Spikes / Burst Transfers",
        "category": "Account Takeover",
        "description": "Abnormal frequency bursts (4+ transfers/hour) deviating from account baseline.",
        "severity": "HIGH",
    },
    {
        "pattern_id": "DEVICE_SHARING_RING",
        "name": "Multi-Account Device Clustering",
        "category": "Syndicate / Ring",
        "description": "Single hardware device fingerprint operating across 3+ unrelated accounts.",
        "severity": "HIGH",
    },
    {
        "pattern_id": "NEW_PAYEE_HIGH_VALUE",
        "name": "Unverified Beneficiary Outliers",
        "category": "Fraud Risk",
        "description": "High-value transfers (>₹25,000 or >3.5x baseline) to first-time recipients.",
        "severity": "MEDIUM",
    },
]


@router.get("/dashboard/summary", response_model=DashboardSummaryOut)
def get_dashboard_summary(db: Session = Depends(get_db)) -> DashboardSummaryOut:
    """Return live database-driven digital payment risk intelligence metrics."""
    total_txns = db.query(func.count(Transaction.id)).scalar() or 0
    total_ads = db.query(func.count(Advertisement.id)).scalar() or 0
    anomalies = (
        db.query(func.count(Transaction.id))
        .filter(Transaction.risk_score >= 25)
        .scalar()
        or 0
    )
    critical_count = (
        db.query(func.count(Transaction.id))
        .filter(Transaction.risk_category == "CRITICAL")
        .scalar()
        or 0
    )
    high_count = (
        db.query(func.count(Transaction.id))
        .filter(Transaction.risk_category == "HIGH")
        .scalar()
        or 0
    )
    total_volume = db.query(func.sum(Transaction.amount)).scalar() or 0.0

    # Risk Distribution
    distribution = {k: 0 for k in ("CRITICAL", "HIGH", "MEDIUM", "LOW")}
    for cat, cnt in (
        db.query(Transaction.risk_category, func.count(Transaction.id))
        .group_by(Transaction.risk_category)
        .all()
    ):
        if cat in distribution:
            distribution[cat] = cnt

    # Recent high-risk anomalies
    recent_anom_rows = (
        db.query(Transaction)
        .filter(Transaction.risk_score >= 40)
        .order_by(Transaction.timestamp.desc())
        .limit(6)
        .all()
    )
    recent_anomalies = [
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
        for t in recent_anom_rows
    ]

    # Recent alerts
    recent_alert_rows = db.query(Alert).order_by(Alert.created_at.desc()).limit(8).all()
    recent_alerts = [
        AlertOut(
            id=a.id,
            alert_type=a.alert_type,
            severity=a.severity,
            reason=a.reason,
            transaction_id=a.transaction_id,
            account_id=a.account_id,
            is_read=a.is_read,
            created_at=a.created_at,
        )
        for a in recent_alert_rows
    ]

    # Active pattern statistics
    active_patterns: list[PatternSummaryOut] = []
    for pat in PATTERN_METADATA:
        matched_txns = (
            db.query(func.count(Alert.id), func.sum(Transaction.amount))
            .join(Transaction, Alert.transaction_id == Transaction.id)
            .filter(Alert.alert_type == pat["pattern_id"])
            .first()
        )
        count = matched_txns[0] or 0 if matched_txns else 0
        volume = float(matched_txns[1] or 0.0) if matched_txns else 0.0
        active_patterns.append(
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

    # Stream Telemetry
    stream_telemetry = StreamStatusOut(**simulator.get_telemetry())

    # Model Telemetry
    bundle = get_model_bundle()
    is_trained = bundle is not None
    model_telemetry = ModelStatusOut(
        model_name="Isolation Forest Anomaly Detector",
        model_version=bundle.get("version", "uninitialized") if bundle else "uninitialized",
        algorithm="Scikit-Learn IsolationForest (Tree-based Outlier Isolation)",
        is_trained=is_trained,
        trained_at=bundle.get("trained_at") if bundle else None,
        training_sample_count=bundle.get("n_samples", 0) if bundle else 0,
        features_used=bundle.get("features", FEATURE_NAMES) if bundle else FEATURE_NAMES,
        contamination_rate=0.08,
        evaluation_mode="Unsupervised Anomaly Isolation",
    )

    return DashboardSummaryOut(
        total_transactions=total_txns,
        total_advertisements=total_ads,
        anomalies_detected=anomalies,
        critical_risk_count=critical_count,
        high_risk_count=high_count,
        total_volume_processed=round(total_volume, 2),
        anomaly_rate_pct=round((anomalies / max(total_txns, 1)) * 100, 1),
        risk_distribution=distribution,
        recent_anomalies=recent_anomalies,
        recent_alerts=recent_alerts,
        active_patterns=active_patterns,
        stream_telemetry=stream_telemetry,
        model_telemetry=model_telemetry,
        dataset_label="Synthetic Demonstration Data",
    )
