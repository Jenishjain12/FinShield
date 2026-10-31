from __future__ import annotations

import pytest
from app.services.consumer_advice import build_consumer_advice, RULE_EXPLANATIONS


def test_consumer_advice_all_rules_en_and_hi():
    """Ensure all 8 rule IDs have deterministic advice in both EN and HI."""
    dummy_txn = {
        "amount": 12500.0,
        "receiver_upi_handle": "support.sbi.refund@upi",
        "receiver_account_id": "ACC_RECEIVER_001",
        "timestamp": "2026-10-31T10:00:00",
        "risk_score": 85,
        "risk_category": "CRITICAL",
    }

    for rule_id in RULE_EXPLANATIONS.keys():
        dummy_assessment = {
            "triage_score": 85,
            "risk_category": "CRITICAL",
            "rule_hits": [
                {
                    "rule_id": rule_id,
                    "explanation": f"Rule {rule_id} triggered",
                    "contribution": 50,
                }
            ],
            "feature_snapshot": {},
        }

        # Test English
        advice_en = build_consumer_advice(dummy_txn, dummy_assessment, lang="en")
        assert advice_en["verdict"] == "DONT_APPROVE"
        assert len(advice_en["reasons"]) >= 1
        assert advice_en["reasons"][0] == RULE_EXPLANATIONS[rule_id]["en"]
        assert len(advice_en["what_to_do"]) >= 1
        assert "1930" in advice_en["what_to_do"][2]
        assert advice_en["lang"] == "en"

        # Test Hindi
        advice_hi = build_consumer_advice(dummy_txn, dummy_assessment, lang="hi")
        assert advice_hi["verdict"] == "DONT_APPROVE"
        assert len(advice_hi["reasons"]) >= 1
        assert advice_hi["reasons"][0] == RULE_EXPLANATIONS[rule_id]["hi"]
        assert advice_hi["lang"] == "hi"


def test_consumer_advice_verdicts():
    """Ensure verdict correctly maps to DONT_APPROVE, BE_CAREFUL, and LOOKS_NORMAL."""
    txn_normal = {"amount": 500.0, "risk_score": 10, "risk_category": "LOW"}
    adv_norm = build_consumer_advice(txn_normal, None, lang="en")
    assert adv_norm["verdict"] == "LOOKS_NORMAL"

    txn_med = {"amount": 5000.0, "risk_score": 35, "risk_category": "MEDIUM"}
    adv_med = build_consumer_advice(txn_med, None, lang="en")
    assert adv_med["verdict"] == "BE_CAREFUL"

    txn_high = {"amount": 50000.0, "risk_score": 75, "risk_category": "CRITICAL"}
    adv_high = build_consumer_advice(txn_high, None, lang="en")
    assert adv_high["verdict"] == "DONT_APPROVE"


def test_consumer_advice_api_endpoints(client):
    """Test GET /transactions/{id}/consumer-advice and POST /consumer/check."""
    # 1. Test POST /api/consumer/check dry-run
    check_payload = {
        "amount": 9999.0,
        "sender_upi_handle": "victim@okhdfcbank",
        "receiver_upi_handle": "sbi.refund.portal@paytm",
        "channel": "collect_request",
        "transaction_type": "collect",
        "reference_note": "Electricity Bill Refund Claim",
    }
    res = client.post("/api/consumer/check?lang=en", json=check_payload)
    assert res.status_code == 200
    data = res.json()
    assert "verdict" in data
    assert data["verdict"] in ("DONT_APPROVE", "BE_CAREFUL")
    assert len(data["reasons"]) > 0
    assert len(data["what_to_do"]) > 0
    assert data["evidence"]["amount"] == 9999.0

    # 2. Test Hindi response
    res_hi = client.post("/api/consumer/check?lang=hi", json=check_payload)
    assert res_hi.status_code == 200
    data_hi = res_hi.json()
    assert data_hi["lang"] == "hi"
    assert "अस्वीकृत" in data_hi["what_to_do"][1] or "1930" in data_hi["what_to_do"][2]

    # 3. Test GET /api/transactions/{id}/consumer-advice with existing transaction
    txns_res = client.get("/api/transactions?limit=1")
    if txns_res.status_code == 200 and txns_res.json()["items"]:
        tx_id = txns_res.json()["items"][0]["transaction_id"]
        advice_res = client.get(f"/api/transactions/{tx_id}/consumer-advice?lang=en")
        assert advice_res.status_code == 200
        advice_data = advice_res.json()
        assert "verdict" in advice_data
        assert "headline" in advice_data

