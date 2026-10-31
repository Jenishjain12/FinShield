from app.services.extraction import extract_entities
from app.services.risk import assess_risk, categorize
from app.services.similarity import text_similarity
from tests.conftest import analyze_text


def test_phone_and_url_extraction():
    items = extract_entities("Call +91 98765 43210 or visit https://demo.example.in/join")
    types = {item.entity_type: item.normalized_value for item in items}
    assert types["phone"] == "+919876543210"
    assert "https://demo.example.in/join" in types["url"]
    assert "demo.example.in" in types["domain"]


def test_payment_identifier_extraction():
    items = extract_entities("Send 5000 to merchant@okaxis. Account number 123456789012")
    values = {(item.entity_type, item.normalized_value) for item in items}
    assert ("upi", "merchant@okaxis") in values
    assert any(item.entity_type == "account_like" for item in items)


def test_risk_boundaries_and_normalization():
    assert categorize(0) == "LOW"
    assert categorize(24) == "LOW"
    assert categorize(25) == "MEDIUM"
    assert categorize(49) == "MEDIUM"
    assert categorize(50) == "HIGH"
    assert categorize(74) == "HIGH"
    assert categorize(75) == "CRITICAL"
    assert categorize(100) == "CRITICAL"


def test_low_risk_signal_set():
    entities = extract_entities("A community credit-counseling flyer with office hours on weekdays.")
    assessment = assess_risk("A community credit-counseling flyer with office hours on weekdays.", entities)
    assert assessment.score < 25
    assert assessment.signals == []


def test_suspicious_explanations():
    text = "Guaranteed returns. Act now. Pay the processing fee. Share OTP. Double your money. http://203.0.113.10/login"
    entities = extract_entities(text)
    assessment = assess_risk(text, entities, url_inspected_as_string_only=True)
    assert 0 <= assessment.score <= 100
    assert assessment.score >= 75
    types = {signal.signal_type for signal in assessment.signals}
    assert "guaranteed_return" in types
    assert "credential_solicitation" in types
    for signal in assessment.signals:
        assert signal.explanation
        assert signal.evidence


def test_exact_entity_matching(db):
    first = analyze_text(db, "Promo desk at 9000011111 and funds to sameupi@okhdfc")
    second = analyze_text(db, "Another listing: call 90000 11111 or sameupi@okhdfc today.")
    from app.models import AdvertisementRelationship

    rels = (
        db.query(AdvertisementRelationship)
        .filter(
            (AdvertisementRelationship.source_ad_id.in_([first.id, second.id]))
            & (AdvertisementRelationship.target_ad_id.in_([first.id, second.id]))
        )
        .all()
    )
    types = {rel.relationship_type for rel in rels}
    assert "shared_phone" in types
    assert "shared_upi" in types
    assert all(rel.explanation for rel in rels)


def test_similarity_matching(db):
    text = "Urgent payout window closing tonight. Advance payment required to release profits. Contact 9111122223 and use harvest@okicici for onboarding."
    first = analyze_text(db, text)
    second = analyze_text(db, text + " Desk two can complete the same onboarding.")
    from app.models import AdvertisementRelationship

    rels = (
        db.query(AdvertisementRelationship)
        .filter(
            AdvertisementRelationship.relationship_type == "text_similarity",
            AdvertisementRelationship.source_ad_id.in_([first.id, second.id]),
        )
        .all()
    )
    assert rels
    assert rels[0].similarity_score is not None
    assert rels[0].similarity_score >= 0.72


def test_campaign_retrieval(client, db):
    analyze_text(db, "Cluster phone 9333311111 guaranteed returns via cluster@okaxis")
    analyze_text(db, "Second ad uses 93333 11111 and cluster@okaxis. Act now.")
    campaigns = client.get("/api/campaigns").json()
    assert campaigns
    detail = client.get(f"/api/campaigns/{campaigns[0]['id']}")
    assert detail.status_code == 200
    assert len(detail.json()["relationships"]) >= 1


def test_score_not_probability_language():
    text = "Guaranteed returns, act now."
    assessment = assess_risk(text, extract_entities(text))
    joined = " ".join(assessment.limitations).lower()
    assert "probability" in joined


def test_similarity_function_conservative():
    assert text_similarity("hello bank account offer", "pizza delivery menu special") < 0.4
