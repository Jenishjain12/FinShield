from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class EntityOut(ORMModel):
    id: str
    entity_type: str
    raw_value: str
    normalized_value: str
    source_text: str
    extraction_method: str
    confidence: float


class SignalOut(ORMModel):
    id: str
    signal_type: str
    title: str
    explanation: str
    evidence: str
    contribution: int


class NoteOut(ORMModel):
    id: str
    content: str
    created_at: datetime


class NoteCreate(BaseModel):
    content: str = Field(min_length=1, max_length=4000)


class RelationshipOut(ORMModel):
    id: str
    source_ad_id: str
    target_ad_id: str
    relationship_type: str
    evidence: str
    explanation: str
    similarity_score: float | None = None


class AdvertisementSummary(ORMModel):
    id: str
    is_seed: bool
    text: str
    source: str | None
    source_url: str | None
    analysis_status: str
    review_status: str
    risk_score: int
    risk_category: str
    created_at: datetime
    entity_count: int = 0
    related_count: int = 0


class AdvertisementDetail(AdvertisementSummary):
    image_filename: str | None
    ocr_text: str | None
    ocr_status: str
    limitations: str | None
    recommendation: str | None
    analyzed_at: datetime | None
    entities: list[EntityOut] = []
    signals: list[SignalOut] = []
    notes: list[NoteOut] = []
    relationships: list[RelationshipOut] = []


class ReviewUpdate(BaseModel):
    review_status: str = Field(pattern="^(unreviewed|under_review|escalated|closed)$")


class AlertOut(ORMModel):
    id: str
    alert_type: str
    severity: str
    advertisement_id: str | None
    campaign_id: str | None
    reason: str
    is_read: bool
    created_at: datetime


class AlertUpdate(BaseModel):
    is_read: bool


class CampaignSummary(BaseModel):
    id: str
    label: str
    member_count: int
    high_risk_count: int
    max_risk_score: int
    member_ids: list[str]


class DashboardSummary(BaseModel):
    total_advertisements: int
    potentially_suspicious: int
    high_risk: int
    relationship_count: int
    seed_advertisement_count: int
    risk_distribution: dict[str, int]
    recent_advertisements: list[AdvertisementSummary]
    recent_alerts: list[AlertOut]
    campaign_activity: list[CampaignSummary]


class PaginatedAds(BaseModel):
    items: list[AdvertisementSummary]
    total: int
    page: int
    page_size: int


class HealthOut(BaseModel):
    status: str
    service: str
    dataset: str
