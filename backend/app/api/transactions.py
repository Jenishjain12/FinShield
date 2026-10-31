from __future__ import annotations

import math
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, or_
from sqlalchemy.orm import Session, joinedload

from app.db.session import get_db
from app.models.alert import Alert
from app.models.note import AnalystNote
from app.models.risk_assessment import RiskAssessment
from app.models.transaction import Transaction
from app.schemas.transaction import (
    AnalystNoteOut,
    NoteCreate,
    PaginatedTransactions,
    ReviewStatusUpdate,
    RiskAssessmentOut,
    TransactionCreate,
    TransactionDetailOut,
    TransactionSummary,
)
from app.services.scoring import score_and_assess_transaction

router = APIRouter()


@router.get("/transactions", response_model=PaginatedTransactions)
def list_transactions(
    q: str | None = None,
    risk: str | None = Query(default=None),
    transaction_type: str | None = Query(default=None),
    status: str | None = Query(default=None),
    min_amount: float | None = None,
    max_amount: float | None = None,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
) -> PaginatedTransactions:
    query = db.query(Transaction)

    if q:
        like = f"%{q.strip()}%"
        query = query.filter(
            or_(
                Transaction.transaction_id.ilike(like),
                Transaction.sender_upi_handle.ilike(like),
                Transaction.receiver_upi_handle.ilike(like),
                Transaction.sender_account_id.ilike(like),
                Transaction.receiver_account_id.ilike(like),
                Transaction.device_id.ilike(like),
                Transaction.synthetic_geo_region.ilike(like),
                Transaction.reference_note.ilike(like),
            )
        )
    if risk:
        query = query.filter(Transaction.risk_category == risk.upper())
    if transaction_type:
        query = query.filter(Transaction.transaction_type == transaction_type.lower())
    if status:
        query = query.filter(Transaction.status == status.lower())
    if min_amount is not None:
        query = query.filter(Transaction.amount >= min_amount)
    if max_amount is not None:
        query = query.filter(Transaction.amount <= max_amount)

    total = query.count()
    total_pages = max(1, math.ceil(total / page_size))

    rows = (
        query.order_by(Transaction.timestamp.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    items = [
        TransactionSummary(
            id=t.id,
            transaction_id=t.transaction_id,
            timestamp=t.timestamp,
            amount=t.amount,
            currency=t.currency,
            transaction_type=t.transaction_type,
            status=t.status,
            sender_account_id=t.sender_account_id,
            receiver_account_id=t.receiver_account_id,
            sender_upi_handle=t.sender_upi_handle,
            receiver_upi_handle=t.receiver_upi_handle,
            device_id=t.device_id,
            synthetic_geo_region=t.synthetic_geo_region,
            channel=t.channel,
            reference_note=t.reference_note,
            risk_score=t.risk_score,
            risk_category=t.risk_category,
            anomaly_score=t.anomaly_score,
            review_status=t.review_status,
            is_synthetic=t.is_synthetic,
        )
        for t in rows
    ]

    return PaginatedTransactions(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


@router.post("/transactions", response_model=TransactionDetailOut, status_code=201)
@router.post("/transactions/ingest", response_model=TransactionDetailOut, status_code=201)
def ingest_transaction(payload: TransactionCreate, db: Session = Depends(get_db)) -> TransactionDetailOut:
    """Ingest a live digital payment transaction, score it, persist it, and generate alerts."""
    txn, assessment, alerts = score_and_assess_transaction(
        db=db,
        amount=payload.amount,
        sender_account_id=payload.sender_account_id,
        receiver_account_id=payload.receiver_account_id,
        sender_upi_handle=payload.sender_upi_handle,
        receiver_upi_handle=payload.receiver_upi_handle,
        device_id=payload.device_id,
        synthetic_ip=payload.synthetic_ip,
        synthetic_geo_region=payload.synthetic_geo_region,
        transaction_type=payload.transaction_type,
        channel=payload.channel,
        reference_note=payload.reference_note,
        merchant_id=payload.merchant_id,
        persist=True,
    )
    return get_transaction_detail(txn.id, db)


@router.post("/transactions/score")
def score_transaction_only(payload: TransactionCreate, db: Session = Depends(get_db)):
    """Dry-run scoring endpoint: evaluate features, ML anomaly model, and rules without persisting."""
    txn, assessment, alerts = score_and_assess_transaction(
        db=db,
        amount=payload.amount,
        sender_account_id=payload.sender_account_id,
        receiver_account_id=payload.receiver_account_id,
        sender_upi_handle=payload.sender_upi_handle,
        receiver_upi_handle=payload.receiver_upi_handle,
        device_id=payload.device_id,
        synthetic_ip=payload.synthetic_ip,
        synthetic_geo_region=payload.synthetic_geo_region,
        transaction_type=payload.transaction_type,
        channel=payload.channel,
        reference_note=payload.reference_note,
        merchant_id=payload.merchant_id,
        persist=False,
    )
    return {
        "transaction_id": txn.transaction_id,
        "amount": txn.amount,
        "anomaly_score": assessment.anomaly_score,
        "triage_score": assessment.triage_score,
        "risk_category": assessment.risk_category,
        "model_version": assessment.model_version,
        "rule_hits": assessment.rule_hits,
        "recommendation": assessment.recommendation,
        "limitations": assessment.limitations,
        "feature_snapshot": assessment.feature_snapshot,
    }


@router.patch("/transactions/{transaction_id:path}/review", response_model=TransactionDetailOut)
@router.post("/transactions/{transaction_id:path}/review", response_model=TransactionDetailOut)
@router.post("/investigations/{transaction_id:path}/review", response_model=TransactionDetailOut)
def update_review_disposition(
    transaction_id: str,
    payload: ReviewStatusUpdate,
    db: Session = Depends(get_db),
) -> TransactionDetailOut:
    """Update human review disposition stamp (unreviewed, under_review, escalated, closed)."""
    t = (
        db.query(Transaction)
        .filter(or_(Transaction.id == transaction_id, Transaction.transaction_id == transaction_id))
        .first()
    )
    if not t:
        raise HTTPException(status_code=404, detail="Transaction not found")

    t.review_status = payload.get_status()
    db.commit()
    db.refresh(t)
    return get_transaction_detail(t.id, db)


@router.post("/transactions/{transaction_id:path}/notes", response_model=AnalystNoteOut, status_code=201)
@router.post("/investigations/{transaction_id:path}/notes", response_model=AnalystNoteOut, status_code=201)
def add_investigation_note(
    transaction_id: str,
    payload: NoteCreate,
    db: Session = Depends(get_db),
) -> AnalystNoteOut:
    """Attach an investigator annotation to a case record."""
    t = (
        db.query(Transaction)
        .filter(or_(Transaction.id == transaction_id, Transaction.transaction_id == transaction_id))
        .first()
    )
    if not t:
        raise HTTPException(status_code=404, detail="Transaction not found")

    note = AnalystNote(
        transaction_id=t.id,
        author=payload.author or "Senior Risk Analyst",
        content=payload.get_content(),
    )
    db.add(note)
    db.commit()
    db.refresh(note)

    return AnalystNoteOut(
        id=note.id,
        transaction_id=note.transaction_id,
        author=note.author,
        content=note.content,
        created_at=note.created_at,
    )


@router.get("/transactions/{transaction_id:path}", response_model=TransactionDetailOut)
def get_transaction_detail(transaction_id: str, db: Session = Depends(get_db)) -> TransactionDetailOut:
    t = (
        db.query(Transaction)
        .options(
            joinedload(Transaction.assessment),
            joinedload(Transaction.alerts),
            joinedload(Transaction.notes),
        )
        .filter(
            or_(
                Transaction.id == transaction_id,
                Transaction.transaction_id == transaction_id,
            )
        )
        .first()
    )
    if not t:
        raise HTTPException(status_code=404, detail="Transaction record not found")

    assessment_out = None
    if t.assessment:
        a = t.assessment
        assessment_out = RiskAssessmentOut(
            id=a.id,
            transaction_id=a.transaction_id,
            anomaly_score=a.anomaly_score,
            triage_score=a.triage_score,
            risk_category=a.risk_category,
            model_version=a.model_version,
            feature_snapshot=a.feature_snapshot or {},
            rule_hits=a.rule_hits or [],
            recommendation=a.recommendation,
            limitations=a.limitations,
            created_at=a.created_at,
        )

    alerts_out = [
        {
            "id": al.id,
            "alert_type": al.alert_type,
            "severity": al.severity,
            "reason": al.reason,
            "transaction_id": al.transaction_id,
            "account_id": al.account_id,
            "is_read": al.is_read,
            "created_at": al.created_at,
        }
        for al in t.alerts
    ]

    notes_out = [
        AnalystNoteOut(
            id=n.id,
            transaction_id=n.transaction_id,
            author=n.author,
            content=n.content,
            created_at=n.created_at,
        )
        for n in t.notes
    ]

    return TransactionDetailOut(
        id=t.id,
        transaction_id=t.transaction_id,
        timestamp=t.timestamp,
        amount=t.amount,
        currency=t.currency,
        transaction_type=t.transaction_type,
        status=t.status,
        sender_account_id=t.sender_account_id,
        receiver_account_id=t.receiver_account_id,
        sender_upi_handle=t.sender_upi_handle,
        receiver_upi_handle=t.receiver_upi_handle,
        merchant_id=t.merchant_id,
        device_id=t.device_id,
        synthetic_ip=t.synthetic_ip,
        synthetic_geo_region=t.synthetic_geo_region,
        channel=t.channel,
        reference_note=t.reference_note,
        risk_score=t.risk_score,
        risk_category=t.risk_category,
        anomaly_score=t.anomaly_score,
        review_status=t.review_status,
        is_synthetic=t.is_synthetic,
        assessment=assessment_out,
        alerts=alerts_out,
        notes=notes_out,
    )

