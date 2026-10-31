from __future__ import annotations

import uuid
from datetime import datetime
from sqlalchemy import DateTime, Float, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class EntityLink(Base):
    __tablename__ = "entity_links"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    source_entity_type: Mapped[str] = mapped_column(String(32), index=True)  # account, upi_handle, device, ip
    source_entity_id: Mapped[str] = mapped_column(String(128), index=True)
    target_entity_type: Mapped[str] = mapped_column(String(32), index=True)
    target_entity_id: Mapped[str] = mapped_column(String(128), index=True)
    relationship_type: Mapped[str] = mapped_column(String(64), index=True)  # shared_device, shared_ip, shared_upi, rapid_flow, mule_link
    evidence: Mapped[str] = mapped_column(Text)
    weight: Mapped[float] = mapped_column(Float, default=1.0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

