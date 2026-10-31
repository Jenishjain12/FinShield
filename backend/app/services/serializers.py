from sqlalchemy.orm import Session

from app.models import Advertisement, AdvertisementRelationship
from app.schemas.common import AdvertisementDetail, AdvertisementSummary, RelationshipOut
from app.services.campaigns import related_ids


def summarize(db: Session, ad: Advertisement) -> AdvertisementSummary:
    preview = (ad.text or "").strip().replace("\n", " ")
    if len(preview) > 220:
        preview = preview[:217] + "..."
    return AdvertisementSummary(
        id=ad.id,
        is_seed=ad.is_seed,
        text=preview or "(image or URL submission without text)",
        source=ad.source,
        source_url=ad.source_url,
        analysis_status=ad.analysis_status,
        review_status=ad.review_status,
        risk_score=ad.risk_score,
        risk_category=ad.risk_category,
        created_at=ad.created_at,
        entity_count=len(ad.entities),
        related_count=len(related_ids(db, ad.id)),
    )


def relationships_for(db: Session, ad_id: str) -> list[RelationshipOut]:
    rels = (
        db.query(AdvertisementRelationship)
        .filter(
            (AdvertisementRelationship.source_ad_id == ad_id)
            | (AdvertisementRelationship.target_ad_id == ad_id)
        )
        .all()
    )
    return [RelationshipOut.model_validate(rel) for rel in rels]


def detail(db: Session, ad: Advertisement) -> AdvertisementDetail:
    base = summarize(db, ad)
    base_data = base.model_dump()
    base_data.pop("text", None)  # detail overrides with full text; summary carries a truncated preview
    return AdvertisementDetail(
        **base_data,
        text=ad.text,
        image_filename=ad.image_filename,
        ocr_text=ad.ocr_text,
        ocr_status=ad.ocr_status,
        limitations=ad.limitations,
        recommendation=ad.recommendation,
        analyzed_at=ad.analyzed_at,
        entities=ad.entities,
        signals=ad.signals,
        notes=ad.notes,
        relationships=relationships_for(db, ad.id),
    )
