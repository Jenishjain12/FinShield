import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, Float, ForeignKey, Index, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class AdvertisementRelationship(Base):
    __tablename__ = "advertisement_relationships"
    __table_args__ = (
        UniqueConstraint(
            "source_ad_id",
            "target_ad_id",
            "relationship_type",
            "evidence_key",
            name="uq_relationship_edge",
        ),
        Index("ix_rel_source", "source_ad_id"),
        Index("ix_rel_target", "target_ad_id"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    source_ad_id: Mapped[str] = mapped_column(String(36), ForeignKey("advertisements.id"))
    target_ad_id: Mapped[str] = mapped_column(String(36), ForeignKey("advertisements.id"))
    relationship_type: Mapped[str] = mapped_column(String(40), index=True)
    evidence_key: Mapped[str] = mapped_column(String(500), default="")
    evidence: Mapped[str] = mapped_column(Text, default="")
    explanation: Mapped[str] = mapped_column(Text, default="")
    similarity_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
