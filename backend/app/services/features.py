from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.account import CustomerAccount
from app.models.device import DeviceFingerprint
from app.models.transaction import Transaction


def get_amount_band(amount: float) -> str:
    if amount < 200:
        return "MICRO"
    if amount < 2500:
        return "LOW"
    if amount < 15000:
        return "MEDIUM"
    if amount < 50000:
        return "HIGH"
    return "EXTREME"


def extract_features(
    db: Session,
    amount: float,
    sender_account_id: str,
    receiver_account_id: str,
    sender_upi_handle: str,
    receiver_upi_handle: str,
    device_id: str,
    synthetic_ip: str,
    synthetic_geo_region: str,
    transaction_type: str = "pay",
    channel: str = "upi_app",
    timestamp: datetime | None = None,
) -> dict[str, Any]:
    """
    Extract reproducible, quantitative features for anomaly detection
    and rule evaluation against stored transaction history.
    """
    now = timestamp or datetime.utcnow()
    one_hour_ago = now - timedelta(hours=1)
    twenty_four_hours_ago = now - timedelta(hours=24)
    fifteen_mins_ago = now - timedelta(minutes=15)

    # 1. Temporal features
    hour = now.hour
    is_night = 1 if (hour >= 23 or hour <= 4) else 0
    is_weekend = 1 if now.weekday() >= 5 else 0

    # 2. Account baselines
    sender_account = (
        db.query(CustomerAccount)
        .filter(CustomerAccount.account_id == sender_account_id)
        .first()
    )
    baseline_amount = sender_account.baseline_avg_amount if sender_account else 2500.0
    amount_deviation = round(amount / max(baseline_amount, 100.0), 2)

    # 3. Velocity features
    sender_vel_1h = (
        db.query(func.count(Transaction.id))
        .filter(
            Transaction.sender_account_id == sender_account_id,
            Transaction.timestamp >= one_hour_ago,
        )
        .scalar()
        or 0
    )
    sender_vel_24h = (
        db.query(func.count(Transaction.id))
        .filter(
            Transaction.sender_account_id == sender_account_id,
            Transaction.timestamp >= twenty_four_hours_ago,
        )
        .scalar()
        or 0
    )

    receiver_vel_1h = (
        db.query(func.count(Transaction.id))
        .filter(
            Transaction.receiver_account_id == receiver_account_id,
            Transaction.timestamp >= one_hour_ago,
        )
        .scalar()
        or 0
    )
    receiver_vel_24h = (
        db.query(func.count(Transaction.id))
        .filter(
            Transaction.receiver_account_id == receiver_account_id,
            Transaction.timestamp >= twenty_four_hours_ago,
        )
        .scalar()
        or 0
    )

    # 4. Beneficiary history
    prior_tx_count = (
        db.query(func.count(Transaction.id))
        .filter(
            Transaction.sender_account_id == sender_account_id,
            Transaction.receiver_account_id == receiver_account_id,
        )
        .scalar()
        or 0
    )
    is_new_beneficiary = 1 if prior_tx_count == 0 else 0

    # 5. Device and IP sharing
    device_distinct_accounts = (
        db.query(func.count(func.distinct(Transaction.sender_account_id)))
        .filter(Transaction.device_id == device_id)
        .scalar()
        or 1
    )
    ip_distinct_accounts = (
        db.query(func.count(func.distinct(Transaction.sender_account_id)))
        .filter(Transaction.synthetic_ip == synthetic_ip)
        .scalar()
        or 1
    )

    # 6. Collect request indicator
    is_collect = 1 if (transaction_type == "collect" or channel == "collect_request") else 0

    # 7. Rapid in-and-out flow (Mule indicator)
    # Check if sender recently received funds and is rapidly moving them out
    recent_inbound = (
        db.query(func.sum(Transaction.amount))
        .filter(
            Transaction.receiver_account_id == sender_account_id,
            Transaction.timestamp >= fifteen_mins_ago,
        )
        .scalar()
        or 0.0
    )
    rapid_in_out = 1 if (recent_inbound > 0 and amount >= 0.7 * recent_inbound) else 0

    # 8. Round number indicator (common in ransom/extortion/scam demands)
    is_round_number = 1 if (amount >= 500 and (amount % 1000 == 0 or amount % 500 == 0)) else 0

    # 9. Geo region discrepancy
    primary_geo = sender_account.primary_geo_region if sender_account else synthetic_geo_region
    geo_discrepancy = 1 if (primary_geo and synthetic_geo_region != primary_geo) else 0

    # 10. Failed attempts
    failed_attempts_1h = (
        db.query(func.count(Transaction.id))
        .filter(
            Transaction.sender_account_id == sender_account_id,
            Transaction.status == "failed",
            Transaction.timestamp >= one_hour_ago,
        )
        .scalar()
        or 0
    )

    features = {
        "amount": round(amount, 2),
        "amount_band": get_amount_band(amount),
        "hour_of_day": hour,
        "is_night": is_night,
        "is_weekend": is_weekend,
        "sender_velocity_1h": sender_vel_1h,
        "sender_velocity_24h": sender_vel_24h,
        "receiver_velocity_1h": receiver_vel_1h,
        "receiver_velocity_24h": receiver_vel_24h,
        "amount_deviation_from_baseline": amount_deviation,
        "is_new_beneficiary": is_new_beneficiary,
        "device_reuse_count": max(device_distinct_accounts, 1),
        "ip_reuse_count": max(ip_distinct_accounts, 1),
        "is_collect_request": is_collect,
        "rapid_in_out_flag": rapid_in_out,
        "is_round_number": is_round_number,
        "geo_discrepancy_flag": geo_discrepancy,
        "failed_attempts_1h": failed_attempts_1h,
    }

    return features


def feature_vector_for_model(features: dict[str, Any]) -> list[float]:
    """
    Format features as numeric vector for Isolation Forest / ML scoring.
    """
    return [
        float(features.get("amount", 0.0)),
        float(features.get("hour_of_day", 12)),
        float(features.get("is_night", 0)),
        float(features.get("is_weekend", 0)),
        float(features.get("sender_velocity_1h", 0)),
        float(features.get("sender_velocity_24h", 0)),
        float(features.get("receiver_velocity_1h", 0)),
        float(features.get("receiver_velocity_24h", 0)),
        float(features.get("amount_deviation_from_baseline", 1.0)),
        float(features.get("is_new_beneficiary", 0)),
        float(features.get("device_reuse_count", 1)),
        float(features.get("ip_reuse_count", 1)),
        float(features.get("is_collect_request", 0)),
        float(features.get("rapid_in_out_flag", 0)),
        float(features.get("is_round_number", 0)),
        float(features.get("geo_discrepancy_flag", 0)),
        float(features.get("failed_attempts_1h", 0)),
    ]

