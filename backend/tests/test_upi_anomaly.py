from __future__ import annotations

import os
from pathlib import Path
import pytest
from datetime import datetime, timedelta
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

ROOT = Path(__file__).resolve().parents[1]

from app.models.account import CustomerAccount
from app.models.device import DeviceFingerprint
from app.models.transaction import Transaction
from app.services.features import extract_features, feature_vector_for_model
from app.services.rules import evaluate_rules
from app.services.ml import compute_triage_score, score_transaction_ml, train_anomaly_model
from app.services.scoring import score_and_assess_transaction
from app.services.simulator import InMemoryEventBus, TransactionStreamSimulator


def test_feature_extraction(db: Session):
    # Setup test account
    acc = CustomerAccount(
        account_id="ACC_TEST_001",
        holder_name="Ramesh Patel",
        account_number_masked="••••••••4123",
        bank_name="HDFC Bank",
        primary_upi_handle="ramesh@okhdfcbank",
        primary_device_id="DEV_TEST_001",
        primary_geo_region="Mumbai, MH",
        baseline_avg_amount=1500.0,
        baseline_daily_velocity=3.0,
        risk_tier="STANDARD",
    )
    db.add(acc)
    db.commit()

    features = extract_features(
        db=db,
        amount=6000.0,  # 4x baseline
        sender_account_id="ACC_TEST_001",
        receiver_account_id="ACC_TEST_002",
        sender_upi_handle="ramesh@okhdfcbank",
        receiver_upi_handle="unknown@paytm",
        device_id="DEV_TEST_002",  # Not primary
        synthetic_ip="103.21.10.5",
        synthetic_geo_region="Kolkata, WB",  # Mismatch
        transaction_type="collect",
        channel="upi_app",
        timestamp=datetime(2026, 10, 31, 2, 30, 0),  # night hour
    )

    assert features["amount"] == 6000.0
    assert features["amount_deviation_from_baseline"] > 3.0
    assert features["hour_of_day"] == 2
    assert features["is_weekend"] == 1  # 2026-10-31 is Saturday
    assert features["is_collect_request"] == 1
    assert features["is_new_beneficiary"] == 1
    assert features["geo_discrepancy_flag"] == 1

    vec = feature_vector_for_model(features)
    assert len(vec) == 17
    assert all(isinstance(v, (int, float)) for v in vec)


def test_rules_engine():
    # 1. Fake collect rule
    features = {
        "amount": 25000.0,
        "is_collect_request": 1,
        "is_first_time_counterparty": 1,
        "sender_velocity_1h": 1,
        "device_associated_account_count": 1,
        "rapid_in_out_flag": 0,
        "amount_deviation_sigma": 1.0,
        "is_unusual_geo": 0,
    }
    hits = evaluate_rules(features, "user@okaxis", "scam@okaxis", "Win lottery cashback")
    hit_ids = [h["rule_id"] for h in hits]
    assert "FAKE_COLLECT_REQUEST" in hit_ids

    # 2. Phishing handle rule
    hits_phish = evaluate_rules(features, "user@okaxis", "support-sbi-kyc-update@okaxis")
    assert any(h["rule_id"] == "PHISHING_PAYMENT_HANDLE" for h in hits_phish)

    # 3. Mule fan-out rule
    features_mule = dict(features, rapid_in_out_flag=1, is_collect_request=0)
    hits_mule = evaluate_rules(features_mule, "user@okaxis", "receiver@okaxis")
    assert any(h["rule_id"] == "MULE_ACCOUNT_FAN_OUT" for h in hits_mule)

    # 4. Device sharing ring rule
    features_ring = dict(features, device_reuse_count=5, is_collect_request=0)
    hits_ring = evaluate_rules(features_ring, "user@okaxis", "receiver@okaxis")
    assert any(h["rule_id"] == "DEVICE_SHARING_RING" for h in hits_ring)


def test_composite_triage_scoring():
    # Low anomaly, no rule hits
    score, cat = compute_triage_score(ml_anomaly_score=10.0, rule_hits=[])
    assert score < 25
    assert cat == "LOW"

    # Critical rule hit (e.g. FAKE_COLLECT_REQUEST 45 contribution points)
    fake_rule = [{"rule_id": "FAKE_COLLECT_REQUEST", "contribution": 45, "severity": "CRITICAL", "explanation": "Test"}]
    score_crit, cat_crit = compute_triage_score(ml_anomaly_score=60.0, rule_hits=fake_rule)
    assert score_crit >= 50
    assert cat_crit in ("HIGH", "CRITICAL")


def test_model_training_and_inference():
    # Train dummy feature matrix
    samples = [[1000.0, 1.0, 12, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0] for _ in range(25)]
    # Add a couple outliers
    samples.append([95000.0, 8.0, 3, 1, 1, 1, 8, 4, 1, 1, 1, 1, 1])
    res = train_anomaly_model(samples)
    assert res["status"] == "success"

    # Score sample
    anomaly_score, version = score_transaction_ml(samples[0])
    assert 0.0 <= anomaly_score <= 100.0
    assert version.startswith("isolation_forest")


def test_score_and_assess_transaction_pipeline(db: Session):
    txn, assessment, alerts = score_and_assess_transaction(
        db=db,
        amount=48000.0,
        sender_account_id="ACC_SRC_1",
        receiver_account_id="ACC_DST_1",
        sender_upi_handle="legit@okhdfcbank",
        receiver_upi_handle="refund-claim-lottery@okaxis",
        device_id="DEV_999",
        synthetic_ip="103.22.1.1",
        synthetic_geo_region="Patna, BR",
        transaction_type="collect",
        channel="upi_app",
        reference_note="Claim immediate lottery reward",
        persist=True,
    )

    assert txn.id is not None
    assert txn.risk_score >= 50
    assert assessment.recommendation is not None
    assert len(assessment.rule_hits) >= 1
    assert any("lottery" in r["explanation"].lower() or "collect" in r["explanation"].lower() for r in assessment.rule_hits)


def test_stream_simulator():
    bus = InMemoryEventBus()
    sim = TransactionStreamSimulator(bus=bus)
    telemetry = sim.get_telemetry()
    assert telemetry["status"] == "stopped"
    assert "In-Memory" in telemetry["engine"]


def test_api_transactions_endpoints(client: TestClient, db: Session):
    # 1. Ingest transaction
    payload = {
        "amount": 2500.0,
        "sender_account_id": "ACC_API_1",
        "receiver_account_id": "ACC_API_2",
        "sender_upi_handle": "alice@okicici",
        "receiver_upi_handle": "bob@okhdfcbank",
        "device_id": "DEV_API_1",
        "synthetic_geo_region": "Bengaluru, KA",
        "transaction_type": "pay",
        "reference_note": "Dinner bill",
    }
    resp = client.post("/api/transactions/ingest", json=payload)
    assert resp.status_code in (200, 201)
    data = resp.json()
    assert "transaction_id" in data
    txn_id = data["transaction_id"]

    # 2. List transactions
    resp_list = client.get("/api/transactions")
    assert resp_list.status_code == 200
    list_data = resp_list.json()
    assert list_data["total"] >= 1
    assert any(t["transaction_id"] == txn_id for t in list_data["items"])

    # 3. Score dry-run without persisting
    resp_score = client.post("/api/transactions/score", json=payload)
    assert resp_score.status_code == 200
    score_data = resp_score.json()
    assert "triage_score" in score_data
    assert "rule_hits" in score_data

    # 4. Transaction details
    resp_detail = client.get(f"/api/transactions/{txn_id}")
    assert resp_detail.status_code == 200
    assert resp_detail.json()["transaction_id"] == txn_id

    # 5. Update review status
    resp_review = client.patch(f"/api/transactions/{txn_id}/review", json={"status": "under_review"})
    assert resp_review.status_code == 200
    assert resp_review.json()["review_status"] == "under_review"

    # 6. Add analyst note
    resp_note = client.post(f"/api/transactions/{txn_id}/notes", json={"note": "Investigated counterparty relationship."})
    assert resp_note.status_code in (200, 201)
    assert resp_note.json()["content"] == "Investigated counterparty relationship."


def test_api_dashboard_and_patterns(client: TestClient):
    resp = client.get("/api/dashboard/summary")
    assert resp.status_code == 200
    summary = resp.json()
    assert "total_transactions" in summary
    assert "risk_distribution" in summary
    assert "stream_telemetry" in summary
    assert "model_telemetry" in summary

    resp_patterns = client.get("/api/patterns")
    assert resp_patterns.status_code == 200
    patterns = resp_patterns.json()
    assert len(patterns) >= 6
    assert any(p["pattern_id"] == "FAKE_COLLECT_REQUEST" for p in patterns)


def test_no_exposed_secrets():
    # Verify .env has no committed secret values
    env_path = ROOT / ".env"
    if env_path.exists():
        content = env_path.read_text()
        assert "nvapi-" not in content
        assert "AIzaSy" not in content
