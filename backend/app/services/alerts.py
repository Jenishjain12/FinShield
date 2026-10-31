from __future__ import annotations

from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models import Advertisement, Alert, ExtractedEntity
from app.services.campaigns import campaign_id_for, related_ids


def _create(db: Session, key: str, alert_type: str, severity: str, reason: str, ad_id: str | None, campaign_id: str | None = None) -> None:
    if db.query(Alert).filter_by(idempotency_key=key).one_or_none():
        return
    db.add(
        Alert(
            idempotency_key=key,
            alert_type=alert_type,
            severity=severity,
            advertisement_id=ad_id,
            campaign_id=campaign_id,
            reason=reason,
        )
    )


def generate_alerts_for_advertisement(db: Session, advertisement: Advertisement) -> None:
    settings = get_settings()
    if advertisement.risk_score >= settings.high_risk_min_score:
        severity = "CRITICAL" if advertisement.risk_category == "CRITICAL" else "HIGH"
        _create(
            db,
            f"high-score:{advertisement.id}",
            "high_risk_score",
            severity,
            f"Newly analyzed advertisement received a {advertisement.risk_category} triage score of {advertisement.risk_score}. This is a risk indicator, not a finding of fraud.",
            advertisement.id,
        )

    related = related_ids(db, advertisement.id)
    if len(related) >= 2:
        members = sorted(related | {advertisement.id})
        _create(
            db,
            f"multi-link:{advertisement.id}",
            "multiple_relationships",
            "HIGH",
            f"Advertisement is linked to {len(related)} other advertisements by shared entities or similar text. This may indicate a potentially coordinated campaign.",
            advertisement.id,
            campaign_id_for(members),
        )

    for entity in advertisement.entities:
        if entity.entity_type not in {"phone", "url", "domain", "upi", "email"}:
            continue
        count = (
            db.query(ExtractedEntity.advertisement_id)
            .filter(
                ExtractedEntity.entity_type == entity.entity_type,
                ExtractedEntity.normalized_value == entity.normalized_value,
            )
            .distinct()
            .count()
        )
        if count >= settings.shared_entity_alert_threshold:
            _create(
                db,
                f"shared-entity:{entity.entity_type}:{entity.normalized_value}",
                "repeated_entity",
                "MEDIUM",
                f"The {entity.entity_type} {entity.normalized_value} appears across {count} advertisements. Repeated identifiers are investigative leads, not proof of a crime.",
                advertisement.id,
            )
