from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models import Advertisement, AdvertisementRelationship
from app.schemas.common import CampaignSummary, RelationshipOut
from app.services.campaigns import get_campaign, list_campaigns
from app.services.serializers import summarize

router = APIRouter()


@router.get("/campaigns", response_model=list[CampaignSummary])
def campaigns(db: Session = Depends(get_db)) -> list[CampaignSummary]:
    return [CampaignSummary(**item) for item in list_campaigns(db)]


@router.get("/campaigns/{campaign_id}")
def campaign_detail(campaign_id: str, db: Session = Depends(get_db)):
    campaign = get_campaign(db, campaign_id)
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign cluster not found")
    ads = db.query(Advertisement).filter(Advertisement.id.in_(campaign["member_ids"])).all()
    rels = (
        db.query(AdvertisementRelationship)
        .filter(
            AdvertisementRelationship.source_ad_id.in_(campaign["member_ids"]),
            AdvertisementRelationship.target_ad_id.in_(campaign["member_ids"]),
        )
        .all()
    )
    return {
        **campaign,
        "advertisements": [summarize(db, ad) for ad in ads],
        "relationships": [RelationshipOut.model_validate(rel) for rel in rels],
    }
