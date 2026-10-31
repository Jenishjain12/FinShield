from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.alert import Alert
from app.schemas.transaction import AlertOut

router = APIRouter()


class AlertUpdate(BaseModel):
    is_read: bool


@router.get("/alerts", response_model=list[AlertOut])
def list_alerts(
    unread_only: bool = Query(default=False),
    severity: str | None = None,
    db: Session = Depends(get_db),
) -> list[AlertOut]:
    query = db.query(Alert)
    if unread_only:
        query = query.filter(Alert.is_read.is_(False))
    if severity:
        query = query.filter(Alert.severity == severity.upper())

    rows = query.order_by(Alert.created_at.desc()).all()
    return [
        AlertOut(
            id=a.id,
            alert_type=a.alert_type,
            severity=a.severity,
            reason=a.reason,
            transaction_id=a.transaction_id,
            account_id=a.account_id,
            advertisement_id=a.advertisement_id,
            is_read=a.is_read,
            created_at=a.created_at,
        )
        for a in rows
    ]


@router.patch("/alerts/{alert_id}", response_model=AlertOut)
def update_alert(alert_id: str, payload: AlertUpdate, db: Session = Depends(get_db)) -> AlertOut:
    alert = db.get(Alert, alert_id)
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    alert.is_read = payload.is_read
    db.commit()
    db.refresh(alert)
    return AlertOut(
        id=alert.id,
        alert_type=alert.alert_type,
        severity=alert.severity,
        reason=alert.reason,
        transaction_id=alert.transaction_id,
        account_id=alert.account_id,
        advertisement_id=alert.advertisement_id,
        is_read=alert.is_read,
        created_at=alert.created_at,
    )
