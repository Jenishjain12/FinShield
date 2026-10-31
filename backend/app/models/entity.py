import uuid

from sqlalchemy import Float, ForeignKey, Index, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class ExtractedEntity(Base):
    __tablename__ = "extracted_entities"
    __table_args__ = (
        Index("ix_entities_type_value", "entity_type", "normalized_value"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    advertisement_id: Mapped[str] = mapped_column(String(36), ForeignKey("advertisements.id"), index=True)
    entity_type: Mapped[str] = mapped_column(String(40), index=True)
    raw_value: Mapped[str] = mapped_column(String(500))
    normalized_value: Mapped[str] = mapped_column(String(500), index=True)
    source_text: Mapped[str] = mapped_column(Text, default="")
    extraction_method: Mapped[str] = mapped_column(String(40), default="regex")
    confidence: Mapped[float] = mapped_column(Float, default=1.0)

    advertisement = relationship("Advertisement", back_populates="entities")
