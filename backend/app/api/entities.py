from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.account import CustomerAccount
from app.models.device import DeviceFingerprint
from app.models.entity_link import EntityLink
from app.models.transaction import Transaction
from app.schemas.transaction import (
    CustomerAccountOut,
    DeviceFingerprintOut,
    EntityLinkOut,
    TransactionSummary,
)

router = APIRouter()


@router.get("/entities/account/{account_id}")
def get_account_intelligence(account_id: str, db: Session = Depends(get_db)):
    """Fetch profile, baseline metrics, risk tier, and recent activity for a customer account."""
    acc = db.query(CustomerAccount).filter(CustomerAccount.account_id == account_id).first()
    if not acc:
        raise HTTPException(status_code=404, detail="Account not found")

    tx_count = (
        db.query(func.count(Transaction.id))
        .filter(or_(Transaction.sender_account_id == account_id, Transaction.receiver_account_id == account_id))
        .scalar()
        or 0
    )
    total_vol = (
        db.query(func.sum(Transaction.amount))
        .filter(or_(Transaction.sender_account_id == account_id, Transaction.receiver_account_id == account_id))
        .scalar()
        or 0.0
    )

    recent_txs = (
        db.query(Transaction)
        .filter(or_(Transaction.sender_account_id == account_id, Transaction.receiver_account_id == account_id))
        .order_by(Transaction.timestamp.desc())
        .limit(10)
        .all()
    )

    # Associated links
    links = (
        db.query(EntityLink)
        .filter(or_(EntityLink.source_entity_id == account_id, EntityLink.target_entity_id == account_id))
        .all()
    )

    return {
        "account": CustomerAccountOut(
            account_id=acc.account_id,
            holder_name=acc.holder_name,
            account_number_masked=acc.account_number_masked,
            bank_name=acc.bank_name,
            primary_upi_handle=acc.primary_upi_handle,
            primary_device_id=acc.primary_device_id,
            primary_geo_region=acc.primary_geo_region,
            baseline_avg_amount=acc.baseline_avg_amount,
            baseline_daily_velocity=acc.baseline_daily_velocity,
            risk_tier=acc.risk_tier,
            created_at=acc.created_at,
            transaction_count=tx_count,
            total_volume=round(total_vol, 2),
        ),
        "recent_transactions": [
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
            for t in recent_txs
        ],
        "links": [
            EntityLinkOut(
                id=l.id,
                source_entity_type=l.source_entity_type,
                source_entity_id=l.source_entity_id,
                target_entity_type=l.target_entity_type,
                target_entity_id=l.target_entity_id,
                relationship_type=l.relationship_type,
                evidence=l.evidence,
                weight=l.weight,
                created_at=l.created_at,
            )
            for l in links
        ],
    }


@router.get("/entities/device/{device_id}")
def get_device_intelligence(device_id: str, db: Session = Depends(get_db)):
    """Fetch hardware fingerprint intelligence and all associated customer accounts."""
    dev = db.query(DeviceFingerprint).filter(DeviceFingerprint.device_id == device_id).first()
    associated_accounts = (
        db.query(Transaction.sender_account_id)
        .filter(Transaction.device_id == device_id)
        .distinct()
        .all()
    )
    acc_ids = [a[0] for a in associated_accounts]

    return {
        "device_id": device_id,
        "device_model": dev.device_model if dev else "Unknown Device",
        "os_version": dev.os_version if dev else "Android 14",
        "app_version": dev.app_version if dev else "v4.8.2",
        "associated_account_count": len(acc_ids),
        "associated_account_ids": acc_ids,
        "is_shared_ring": len(acc_ids) >= 3,
    }


@router.get("/network/graph")
def get_network_graph(limit: int = Query(default=60, ge=10, le=200), db: Session = Depends(get_db)):
    """
    Generate actual database-driven nodes and edges for React Flow / Three.js
    representing accounts, devices, and observed fund flow paths.
    """
    txs = (
        db.query(Transaction)
        .filter(Transaction.risk_score >= 30)
        .order_by(Transaction.timestamp.desc())
        .limit(limit)
        .all()
    )

    nodes = {}
    edges = []

    for t in txs:
        # Sender Account Node
        if t.sender_account_id not in nodes:
            nodes[t.sender_account_id] = {
                "id": t.sender_account_id,
                "label": t.sender_upi_handle,
                "type": "account",
                "risk_score": t.risk_score,
                "risk_category": t.risk_category,
            }

        # Receiver Account Node
        if t.receiver_account_id not in nodes:
            nodes[t.receiver_account_id] = {
                "id": t.receiver_account_id,
                "label": t.receiver_upi_handle,
                "type": "account",
                "risk_score": t.risk_score,
                "risk_category": t.risk_category,
            }

        # Device Node if high risk
        if t.risk_score >= 50 and t.device_id not in nodes:
            nodes[t.device_id] = {
                "id": t.device_id,
                "label": f"Device {t.device_id[:8]}",
                "type": "device",
                "risk_score": t.risk_score,
                "risk_category": t.risk_category,
            }
            edges.append({
                "id": f"edge_{t.sender_account_id}_{t.device_id}",
                "source": t.sender_account_id,
                "target": t.device_id,
                "label": "shared_device",
                "type": "device_link",
                "weight": 2.0,
            })

        # Transfer Edge
        edges.append({
            "id": f"edge_tx_{t.id}",
            "source": t.sender_account_id,
            "target": t.receiver_account_id,
            "label": f"₹{t.amount}",
            "amount": t.amount,
            "transaction_type": t.transaction_type,
            "risk_score": t.risk_score,
            "risk_category": t.risk_category,
            "type": "transfer",
            "weight": 1.0,
        })

    return {
        "nodes": list(nodes.values()),
        "edges": edges,
    }

