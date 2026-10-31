from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.risk_assessment import RiskAssessment
from app.schemas.transaction import ModelStatusOut
from app.services.features import feature_vector_for_model
from app.services.generator import generate_synthetic_dataset
from app.services.ml import FEATURE_NAMES, get_model_bundle, train_anomaly_model

router = APIRouter()


@router.get("/model/status", response_model=ModelStatusOut)
def get_model_status():
    """Return model health, Isolation Forest training metadata, and features used."""
    bundle = get_model_bundle()
    is_trained = bundle is not None
    return ModelStatusOut(
        model_name="Isolation Forest Anomaly Detector",
        model_version=bundle.get("version", "uninitialized") if bundle else "uninitialized",
        algorithm="Scikit-Learn IsolationForest (Tree-based Outlier Isolation)",
        is_trained=is_trained,
        trained_at=bundle.get("trained_at") if bundle else None,
        training_sample_count=bundle.get("n_samples", 0) if bundle else 0,
        features_used=bundle.get("features", FEATURE_NAMES) if bundle else FEATURE_NAMES,
        contamination_rate=0.08,
        evaluation_mode="Unsupervised Anomaly Isolation",
    )


@router.post("/model/train")
def train_model(db: Session = Depends(get_db)):
    """
    Train or re-train Isolation Forest on stored synthetic baseline transactions.
    If database has fewer than 20 records, automatically seeds a synthetic dataset.
    """
    assessments = db.query(RiskAssessment).all()
    feature_matrix = []

    for a in assessments:
        if a.feature_snapshot:
            feature_matrix.append(feature_vector_for_model(a.feature_snapshot))

    if len(feature_matrix) < 20:
        # Auto-seed synthetic population
        res = generate_synthetic_dataset(db, account_count=35, transaction_count=100)
        return {
            "status": "success",
            "message": "Generated synthetic transaction baseline and trained Isolation Forest model.",
            "details": res,
        }

    train_res = train_anomaly_model(feature_matrix)
    return {
        "status": "success",
        "message": f"Successfully trained Isolation Forest on {len(feature_matrix)} synthetic transaction vectors.",
        "details": train_res,
    }


@router.post("/dataset/generate")
def generate_dataset(account_count: int = 40, transaction_count: int = 150, db: Session = Depends(get_db)):
    """Generate synthetic accounts, devices, baseline transactions, and embedded UPI fraud patterns."""
    res = generate_synthetic_dataset(db, account_count=account_count, transaction_count=transaction_count)
    return res

