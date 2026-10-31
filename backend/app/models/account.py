from __future__ import annotations

from datetime import datetime
from sqlalchemy import DateTime, Float, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class CustomerAccount(Base):
    __tablename__ = "customer_accounts"

    account_id: Mapped[str] = mapped_column(String(64), primary_key=True, index=True)
    holder_name: Mapped[str] = mapped_column(String(128), nullable=False)
    account_number_masked: Mapped[str] = mapped_column(String(32), nullable=False)
    bank_name: Mapped[str] = mapped_column(String(64), default="State Bank of India", index=True)
    primary_upi_handle: Mapped[str] = mapped_column(String(128), index=True)
    primary_device_id: Mapped[str] = mapped_column(String(64), index=True)
    primary_geo_region: Mapped[str] = mapped_column(String(128), default="Mumbai, MH")
    baseline_avg_amount: Mapped[float] = mapped_column(Float, default=2500.0)
    baseline_daily_velocity: Mapped[float] = mapped_column(Float, default=3.5)
    risk_tier: Mapped[str] = mapped_column(String(32), default="STANDARD")  # STANDARD, ELEVATED, RESTRICTED
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

