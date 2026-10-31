from __future__ import annotations

from datetime import datetime
from typing import Any
from pydantic import BaseModel, Field


class TransactionCreate(BaseModel):
    amount: float = Field(..., gt=0, description="Transaction amount in INR")
    sender_account_id: str = Field(..., min_length=3, max_length=64)
    receiver_account_id: str = Field(..., min_length=3, max_length=64)
    sender_upi_handle: str = Field(..., min_length=3, max_length=128)
    receiver_upi_handle: str = Field(..., min_length=3, max_length=128)
    device_id: str = Field(default="DEV_DEFAULT_001", max_length=64)
    synthetic_ip: str = Field(default="103.21.54.12", max_length=45)
    synthetic_geo_region: str = Field(default="Mumbai, MH", max_length=128)
    transaction_type: str = Field(default="pay")  # pay, collect, refund, transfer
    channel: str = Field(default="upi_app")
    reference_note: str | None = None
    merchant_id: str | None = None


class RuleHitOut(BaseModel):
    rule_id: str
    title: str
    severity: str
    explanation: str
    evidence: str
    contribution: int


class ConsumerCheckRequest(BaseModel):
    amount: float = Field(..., gt=0, description="Transaction amount in INR")
    sender_upi_handle: str = Field(default="user@oksbi", max_length=128)
    receiver_upi_handle: str = Field(..., min_length=3, max_length=128)
    sender_account_id: str = Field(default="ACC_DEMO_001", max_length=64)
    receiver_account_id: str = Field(default="ACC_RECEIVER_999", max_length=64)
    device_id: str = Field(default="DEV_MOBILE_001", max_length=64)
    synthetic_ip: str = Field(default="103.21.54.12", max_length=45)
    synthetic_geo_region: str = Field(default="Mumbai, MH", max_length=128)
    transaction_type: str = Field(default="pay")
    channel: str = Field(default="upi_app")
    reference_note: str | None = None
    merchant_id: str | None = None


class ConsumerAdviceEvidence(BaseModel):
    amount: float
    receiver_handle: str
    receiver_account: str
    time: str
    rule_hits_count: int
    triage_score: int
    risk_category: str


class ConsumerAdviceOut(BaseModel):
    verdict: str
    headline: str
    reasons: list[str]
    what_to_do: list[str]
    evidence: ConsumerAdviceEvidence
    disclaimer: str
    lang: str


class RiskAssessmentOut(BaseModel):
    id: str
    transaction_id: str
    anomaly_score: float
    triage_score: int
    risk_category: str
    model_version: str
    feature_snapshot: dict[str, Any]
    rule_hits: list[RuleHitOut]
    recommendation: str
    limitations: str
    created_at: datetime


class AlertOut(BaseModel):
    id: str
    alert_type: str
    severity: str
    reason: str
    transaction_id: str | None = None
    account_id: str | None = None
    advertisement_id: str | None = None
    is_read: bool
    created_at: datetime


class AnalystNoteOut(BaseModel):
    id: str
    transaction_id: str | None = None
    author: str
    content: str
    created_at: datetime


class TransactionSummary(BaseModel):
    id: str
    transaction_id: str
    timestamp: datetime
    amount: float
    currency: str
    transaction_type: str
    status: str
    sender_account_id: str
    receiver_account_id: str
    sender_upi_handle: str
    receiver_upi_handle: str
    device_id: str
    synthetic_geo_region: str
    channel: str
    reference_note: str | None = None
    risk_score: int
    risk_category: str
    anomaly_score: float
    review_status: str
    is_synthetic: bool = True


class TransactionDetailOut(TransactionSummary):
    merchant_id: str | None = None
    synthetic_ip: str
    assessment: RiskAssessmentOut | None = None
    alerts: list[AlertOut] = []
    notes: list[AnalystNoteOut] = []
    ml_explanations: list[dict[str, Any]] = []


class PaginatedTransactions(BaseModel):
    items: list[TransactionSummary]
    total: int
    page: int
    page_size: int
    total_pages: int


class CustomerAccountOut(BaseModel):
    account_id: str
    holder_name: str
    account_number_masked: str
    bank_name: str
    primary_upi_handle: str
    primary_device_id: str
    primary_geo_region: str
    baseline_avg_amount: float
    baseline_daily_velocity: float
    risk_tier: str
    created_at: datetime
    transaction_count: int = 0
    total_volume: float = 0.0


class DeviceFingerprintOut(BaseModel):
    device_id: str
    device_model: str
    os_version: str
    app_version: str
    associated_accounts_count: int
    first_seen: datetime
    last_seen: datetime


class EntityLinkOut(BaseModel):
    id: str
    source_entity_type: str
    source_entity_id: str
    target_entity_type: str
    target_entity_id: str
    relationship_type: str
    evidence: str
    weight: float
    created_at: datetime


class PatternSummaryOut(BaseModel):
    pattern_id: str
    name: str
    category: str
    description: str
    matched_count: int
    flagged_volume_inr: float
    severity_level: str


class StreamControlRequest(BaseModel):
    rate_per_second: float = Field(default=2.0, ge=0.5, le=10.0)


class StreamStatusOut(BaseModel):
    status: str
    engine: str
    kafka_connected: bool
    rate_per_second: float
    transactions_emitted: int
    anomalies_detected: int
    anomaly_rate_pct: float
    started_at: str | None = None


class ModelStatusOut(BaseModel):
    model_name: str
    model_version: str
    algorithm: str
    is_trained: bool
    trained_at: str | None = None
    training_sample_count: int = 0
    features_used: list[str] = []
    contamination_rate: float = 0.08
    evaluation_mode: str = "Unsupervised Anomaly Isolation"


class ReviewStatusUpdate(BaseModel):
    review_status: str | None = None
    status: str | None = None

    def get_status(self) -> str:
        s = self.review_status or self.status or "under_review"
        if s not in ("unreviewed", "under_review", "escalated", "closed"):
            return "under_review"
        return s


class NoteCreate(BaseModel):
    content: str | None = None
    note: str | None = None
    author: str = Field(default="Senior Risk Analyst")

    def get_content(self) -> str:
        return self.content or self.note or ""


class DashboardSummaryOut(BaseModel):
    total_transactions: int
    total_advertisements: int = 0
    anomalies_detected: int
    critical_risk_count: int
    high_risk_count: int
    total_volume_processed: float
    anomaly_rate_pct: float
    risk_distribution: dict[str, int]
    recent_anomalies: list[TransactionSummary]
    recent_alerts: list[AlertOut]
    active_patterns: list[PatternSummaryOut]
    stream_telemetry: StreamStatusOut
    model_telemetry: ModelStatusOut
    dataset_label: str = "Synthetic Demonstration Data"

