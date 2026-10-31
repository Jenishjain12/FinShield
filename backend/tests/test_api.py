from tests.conftest import analyze_text


def test_health(client):
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] in ("ok", "degraded")
    assert "environment" in data
    assert "model_loaded" in data
    assert "model_version" in data
    assert "sklearn_version" in data
    assert "db_ok" in data
    assert data["db_ok"] is True
    assert "copilot_configured" in data


def test_analyze_creates_advertisement(client):
    response = client.post(
        "/api/analyze",
        data={
            "text": "Guaranteed returns of 10% daily. Call 9000012345 and pay the processing fee to profit@okaxis. Visit http://fast-cash-now.example.com",
            "source": "test",
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["risk_score"] >= 50
    assert body["risk_category"] in {"HIGH", "CRITICAL"}
    assert any(entity["entity_type"] == "phone" for entity in body["entities"])
    assert any(entity["entity_type"] == "upi" for entity in body["entities"])


def test_low_risk_advertisement(client):
    response = client.post(
        "/api/analyze",
        data={"text": "Attend our free retirement planning workshop. Past performance is not indicative of future results."},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["risk_score"] < 25
    assert body["risk_category"] == "LOW"


def test_invalid_analyze(client):
    response = client.post("/api/analyze", data={"text": ""})
    assert response.status_code == 400


def test_review_and_notes_do_not_change_score(client, db):
    ad = analyze_text(db, "Learn about index funds. Capital is at risk.")
    original = ad.risk_score
    review = client.patch(f"/api/ads/{ad.id}/review", json={"review_status": "under_review"})
    assert review.status_code == 200
    assert review.json()["review_status"] == "under_review"
    assert review.json()["risk_score"] == original
    note = client.post(f"/api/ads/{ad.id}/notes", json={"content": "Looks like education copy."})
    assert note.status_code == 201
    detail = client.get(f"/api/ads/{ad.id}")
    assert len(detail.json()["notes"]) == 1


def test_alerts_and_read_status(client):
    created = client.post(
        "/api/analyze",
        data={"text": "Share OTP and CVV now to unblock your account. Call 9888877776 immediately."},
    )
    assert created.status_code == 200
    alerts = client.get("/api/alerts").json()
    assert alerts
    alert_id = alerts[0]["id"]
    updated = client.patch(f"/api/alerts/{alert_id}", json={"is_read": True})
    assert updated.json()["is_read"] is True
    again = client.get("/api/alerts").json()
    high_score_alerts = [item for item in again if item["alert_type"] == "high_risk_score" and item["advertisement_id"] == created.json()["id"]]
    assert len(high_score_alerts) == 1


def test_dashboard_uses_database(client, db):
    analyze_text(db, "Open a savings account. Fees are listed in the tariff sheet.")
    summary = client.get("/api/dashboard/summary").json()
    assert summary["total_advertisements"] >= 1
    assert "LOW" in summary["risk_distribution"]


def test_unknown_ad(client):
    response = client.get("/api/ads/not-a-real-id")
    assert response.status_code == 404
