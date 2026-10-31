from __future__ import annotations

from datetime import datetime
from typing import Any
from sqlalchemy.orm import Session

from app.models.alert import Alert
from app.models.entity_link import EntityLink
from app.models.risk_assessment import RiskAssessment
from app.models.transaction import Transaction
from app.services.features import extract_features, feature_vector_for_model
from app.services.ml import compute_triage_score, explain_ml_anomaly, score_transaction_ml
from app.services.rules import evaluate_rules


def score_and_assess_transaction(
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
    reference_note: str | None = None,
    merchant_id: str | None = None,
    timestamp: datetime | None = None,
    persist: bool = True,
    transaction_id_str: str | None = None,
    is_fraud_synthetic: bool = False,
    fraud_typology: str = "normal",
) -> tuple[Transaction, RiskAssessment, list[Alert]]:
    """
    Main evaluation pipeline:
    1. Extract features against historical baseline
    2. Run deterministic UPI risk rules
    3. Run Isolation Forest ML anomaly scoring
    4. Compute composed 0–100 triage score
    5. Generate alerts if high/critical
    6. Persist transaction, risk assessment, entity links, and alerts
    """
    now = timestamp or datetime.utcnow()
    features = extract_features(
        db=db,
        amount=amount,
        sender_account_id=sender_account_id,
        receiver_account_id=receiver_account_id,
        sender_upi_handle=sender_upi_handle,
        receiver_upi_handle=receiver_upi_handle,
        device_id=device_id,
        synthetic_ip=synthetic_ip,
        synthetic_geo_region=synthetic_geo_region,
        transaction_type=transaction_type,
        channel=channel,
        timestamp=now,
    )

    rule_hits = evaluate_rules(
        features=features,
        sender_upi_handle=sender_upi_handle,
        receiver_upi_handle=receiver_upi_handle,
        reference_note=reference_note,
    )

    feature_vec = feature_vector_for_model(features)
    ml_anomaly_score, model_version = score_transaction_ml(feature_vec)
    triage_score, risk_category = compute_triage_score(ml_anomaly_score, rule_hits)

    if not transaction_id_str:
        timestamp_str = now.strftime("%Y%m%d%H%M%S")
        import random
        rand_suffix = random.randint(100000, 999999)
        transaction_id_str = f"UPI/{timestamp_str}/{rand_suffix}"

    if persist and transaction_id_str:
        existing_txn = db.query(Transaction).filter(Transaction.transaction_id == transaction_id_str).first()
        if existing_txn:
            existing_assessment = db.query(RiskAssessment).filter(RiskAssessment.transaction_id == existing_txn.id).first()
            existing_alerts = db.query(Alert).filter(Alert.transaction_id == existing_txn.id).all()
            return existing_txn, existing_assessment, existing_alerts

    # Determine recommendation
    if risk_category in ("CRITICAL", "HIGH"):
        recommendation = "Place temporary hold on transaction settlement. Require stepped-up biometric/OTP re-verification from sender and review counterparty history."
    elif risk_category == "MEDIUM":
        recommendation = "Flag for expedited review in Attention Queue. Monitor sender account for rapid subsequent velocity."
    else:
        recommendation = "Standard clearance. Transaction metrics align with account baseline parameters."

    limitations = (
        "The triage score (0-100) is a composite index of unsupervised statistical distance "
        "(Isolation Forest) and configured UPI rule contributions. "
        "It constitutes a risk indicator for human investigator prioritization and is not definitive proof of fraud."
    )

    transaction = Transaction(
        transaction_id=transaction_id_str,
        timestamp=now,
        amount=amount,
        currency="INR",
        transaction_type=transaction_type,
        status="completed" if risk_category != "CRITICAL" else "pending",
        sender_account_id=sender_account_id,
        receiver_account_id=receiver_account_id,
        sender_upi_handle=sender_upi_handle,
        receiver_upi_handle=receiver_upi_handle,
        merchant_id=merchant_id,
        device_id=device_id,
        synthetic_ip=synthetic_ip,
        synthetic_geo_region=synthetic_geo_region,
        channel=channel,
        reference_note=reference_note,
        is_synthetic=True,
        is_fraud_synthetic=is_fraud_synthetic,
        fraud_typology=fraud_typology,
        anomaly_score=ml_anomaly_score,
        risk_score=triage_score,
        risk_category=risk_category,
        review_status="unreviewed" if triage_score >= 25 else "closed",
    )

    assessment = RiskAssessment(
        transaction=transaction,
        anomaly_score=ml_anomaly_score,
        triage_score=triage_score,
        risk_category=risk_category,
        model_version=model_version,
        feature_snapshot=features,
        rule_hits=rule_hits,
        recommendation=recommendation,
        limitations=limitations,
        created_at=now,
    )

    alerts: list[Alert] = []
    # Trigger alerts for anomalous or rule-hit transactions
    if triage_score >= 50 or any(r.get("severity") in ("CRITICAL", "HIGH") for r in rule_hits):
        if rule_hits:
            primary_reason = rule_hits[0]["explanation"]
            alert_type = rule_hits[0]["rule_id"]
        else:
            ml_exps = explain_ml_anomaly(features, top_k=1)
            primary_reason = ml_exps[0]["human_text"] if ml_exps else f"Unusual multivariate anomaly detected (score {triage_score})"
            alert_type = "MULTIVARIATE_ANOMALY"
        alert = Alert(
            idempotency_key=f"alert_{transaction_id_str}_{alert_type}",
            alert_type=alert_type,
            severity=risk_category,
            transaction=transaction,
            account_id=sender_account_id,
            reason=primary_reason,
            is_read=False,
            created_at=now,
        )
        alerts.append(alert)

    if persist:
        db.add(transaction)
        db.add(assessment)
        for a in alerts:
            db.add(a)

        # Entity Relationship Linking
        # 1. Counterparty link
        counterparty_link = EntityLink(
            source_entity_type="account",
            source_entity_id=sender_account_id,
            target_entity_type="account",
            target_entity_id=receiver_account_id,
            relationship_type="counterparty",
            evidence=f"Transfer ₹{amount} on {now.strftime('%d %b %Y %H:%M')}",
            weight=1.0,
            created_at=now,
        )
        db.add(counterparty_link)

        # 2. Shared device link if device used by multiple accounts
        if features.get("device_reuse_count", 1) > 1:
            device_link = EntityLink(
                source_entity_type="account",
                source_entity_id=sender_account_id,
                target_entity_type="device",
                target_entity_id=device_id,
                relationship_type="shared_device",
                evidence=f"Associated with device {device_id[:12]}...",
                weight=2.0,
                created_at=now,
            )
            db.add(device_link)

        db.commit()
        db.refresh(transaction)
        db.refresh(assessment)

    return transaction, assessment, alerts

