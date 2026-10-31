from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models import Advertisement, AnalystNote
from app.schemas.common import (
    AdvertisementDetail,
    NoteCreate,
    NoteOut,
    PaginatedAds,
    RelationshipOut,
    ReviewUpdate,
)
from app.services.serializers import detail, relationships_for, summarize

router = APIRouter()


@router.get("/ads", response_model=PaginatedAds)
def list_ads(
    q: str | None = None,
    risk: str | None = Query(default=None),
    review_status: str | None = None,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
) -> PaginatedAds:
    query = db.query(Advertisement)
    if q:
        like = f"%{q.strip()}%"
        query = query.filter(Advertisement.text.ilike(like))
    if risk:
        query = query.filter(Advertisement.risk_category == risk.upper())
    if review_status:
        query = query.filter(Advertisement.review_status == review_status)
    total = query.count()
    rows = (
        query.order_by(Advertisement.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return PaginatedAds(
        items=[summarize(db, ad) for ad in rows],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/ads/{ad_id}", response_model=AdvertisementDetail)
def get_ad(ad_id: str, db: Session = Depends(get_db)) -> AdvertisementDetail:
    ad = db.get(Advertisement, ad_id)
    if not ad:
        raise HTTPException(status_code=404, detail="Advertisement not found")
    return detail(db, ad)


@router.get("/ads/{ad_id}/relationships", response_model=list[RelationshipOut])
def get_relationships(ad_id: str, db: Session = Depends(get_db)) -> list[RelationshipOut]:
    ad = db.get(Advertisement, ad_id)
    if not ad:
        raise HTTPException(status_code=404, detail="Advertisement not found")
    return relationships_for(db, ad_id)


@router.patch("/ads/{ad_id}/review", response_model=AdvertisementDetail)
def update_review(ad_id: str, payload: ReviewUpdate, db: Session = Depends(get_db)) -> AdvertisementDetail:
    ad = db.get(Advertisement, ad_id)
    if not ad:
        raise HTTPException(status_code=404, detail="Advertisement not found")
    ad.review_status = payload.review_status
    db.commit()
    db.refresh(ad)
    return detail(db, ad)


@router.post("/ads/{ad_id}/notes", response_model=NoteOut, status_code=201)
def add_note(ad_id: str, payload: NoteCreate, db: Session = Depends(get_db)) -> NoteOut:
    ad = db.get(Advertisement, ad_id)
    if not ad:
        raise HTTPException(status_code=404, detail="Advertisement not found")
    note = AnalystNote(advertisement_id=ad.id, content=payload.content.strip())
    db.add(note)
    db.commit()
    db.refresh(note)
    return NoteOut.model_validate(note)
