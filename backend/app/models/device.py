from __future__ import annotations

from datetime import datetime
from sqlalchemy import DateTime, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class DeviceFingerprint(Base):
    __tablename__ = "device_fingerprints"

    device_id: Mapped[str] = mapped_column(String(64), primary_key=True, index=True)
    device_model: Mapped[str] = mapped_column(String(64), default="Samsung Galaxy S23")
    os_version: Mapped[str] = mapped_column(String(32), default="Android 14")
    app_version: Mapped[str] = mapped_column(String(32), default="v4.8.2")
    associated_accounts_count: Mapped[int] = mapped_column(Integer, default=1)
    first_seen: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    last_seen: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

