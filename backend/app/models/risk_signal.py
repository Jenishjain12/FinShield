import uuid

from sqlalchemy import ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class RiskSignal(Base):
    __tablename__ = "risk_signals"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    advertisement_id: Mapped[str] = mapped_column(String(36), ForeignKey("advertisements.id"), index=True)
    signal_type: Mapped[str] = mapped_column(String(80), index=True)
    title: Mapped[str] = mapped_column(String(160))
    explanation: Mapped[str] = mapped_column(Text)
    evidence: Mapped[str] = mapped_column(Text, default="")
    contribution: Mapped[int] = mapped_column(Integer, default=0)

    advertisement = relationship("Advertisement", back_populates="signals")
