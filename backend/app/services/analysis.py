from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path

from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models import Advertisement, ExtractedEntity, RiskSignal
from app.services.alerts import generate_alerts_for_advertisement
from app.services.campaigns import related_ids
from app.services.extraction import extract_entities
from app.services.matching import find_entity_matches, find_similarity_matches, persist_matches
from app.services.ocr import extract_text_from_image
from app.services.risk import assess_risk


def combined_text(advertisement: Advertisement) -> str:
    parts = [advertisement.text or ""]
    if advertisement.ocr_text:
        parts.append(advertisement.ocr_text)
    if advertisement.source_url:
        parts.append(advertisement.source_url)
    return "\n".join(part for part in parts if part).strip()


def analyze_advertisement(db: Session, advertisement: Advertisement) -> Advertisement:
    settings = get_settings()
    limitations: list[str] = []

    if advertisement.image_filename:
        image_path = Path(settings.upload_dir) / advertisement.image_filename
        if image_path.exists():
            ocr = extract_text_from_image(image_path)
            advertisement.ocr_status = ocr.status
            advertisement.ocr_text = ocr.text
            if ocr.limitation:
                limitations.append(ocr.limitation)
        else:
            advertisement.ocr_status = "missing_file"
            limitations.append("Uploaded image could not be located for OCR.")
    else:
        advertisement.ocr_status = "not_requested"

    text = combined_text(advertisement)
    entities = extract_entities(text)
    advertisement.entities.clear()
    for item in entities:
        advertisement.entities.append(
            ExtractedEntity(
                entity_type=item.entity_type,
                raw_value=item.raw_value,
                normalized_value=item.normalized_value,
                source_text=item.source_text,
                extraction_method=item.extraction_method,
                confidence=item.confidence,
            )
        )
    db.flush()

    matches = find_entity_matches(db, advertisement) + find_similarity_matches(db, advertisement)
    persist_matches(db, matches)
    db.flush()

    related = related_ids(db, advertisement.id)
    similar_high_risk = False
    from app.models import Advertisement as AdModel
    from app.models import AdvertisementRelationship

    similar_rels = (
        db.query(AdvertisementRelationship)
        .filter(
            AdvertisementRelationship.relationship_type == "text_similarity",
            (AdvertisementRelationship.source_ad_id == advertisement.id)
            | (AdvertisementRelationship.target_ad_id == advertisement.id),
        )
        .all()
    )
    for rel in similar_rels:
        other_id = rel.target_ad_id if rel.source_ad_id == advertisement.id else rel.source_ad_id
        other = db.get(AdModel, other_id)
        if other and other.risk_score >= 50:
            similar_high_risk = True
            break

    assessment = assess_risk(
        text=text,
        entities=entities,
        related_count=len(related),
        similar_high_risk=similar_high_risk,
        ocr_limitation=limitations[0] if limitations else None,
        url_inspected_as_string_only=bool(advertisement.source_url) or any(e.entity_type == "url" for e in entities),
    )

    advertisement.signals.clear()
    for signal in assessment.signals:
        advertisement.signals.append(
            RiskSignal(
                signal_type=signal.signal_type,
                title=signal.title,
                explanation=signal.explanation,
                evidence=signal.evidence,
                contribution=signal.contribution,
            )
        )
    advertisement.risk_score = assessment.score
    advertisement.risk_category = assessment.category
    advertisement.limitations = " ".join(assessment.limitations)
    advertisement.recommendation = assessment.recommendation
    advertisement.analysis_status = "completed"
    advertisement.analyzed_at = datetime.now(timezone.utc)
    db.flush()
    generate_alerts_for_advertisement(db, advertisement)
    return advertisement
