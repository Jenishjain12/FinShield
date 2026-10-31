from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))

from sqlalchemy.orm import Session  # noqa: E402

from app.core.config import get_settings  # noqa: E402
from app.db.base import Base  # noqa: E402
from app.db.session import SessionLocal, engine  # noqa: E402
from app.main import migrate_schema  # noqa: E402
from app.models import Advertisement  # noqa: E402
from app.services.analysis import analyze_advertisement  # noqa: E402
from app.services.generator import generate_synthetic_dataset  # noqa: E402


def seed_upi_transactions(db: Session) -> dict:
    from app.models.transaction import Transaction
    from app.models.risk_assessment import RiskAssessment
    from app.services.features import feature_vector_for_model
    from app.services.ml import train_anomaly_model

    existing = db.query(Transaction).count()
    if existing >= 50:
        print(f"[*] Found {existing} existing synthetic UPI transactions. Retraining anomaly model...")
        assessments = db.query(RiskAssessment).all()
        matrix = [feature_vector_for_model(a.feature_snapshot) for a in assessments if a.feature_snapshot]
        res = train_anomaly_model(matrix)
        print(f"[*] Anomaly Model Status: {res.get('status')} ({res.get('version')})")
        return {"accounts_created": 0, "transactions_generated": existing, "model_training": res}

    print("[*] Generating synthetic UPI accounts, baseline transactions, and fraud patterns...")
    res = generate_synthetic_dataset(db, account_count=45, transaction_count=180)
    print(f"[*] Generated {res['accounts_created']} accounts and {res['transactions_generated']} transactions.")
    print(f"[*] Anomaly Model Training: {res['model_training'].get('status')} ({res['model_training'].get('version')})")
    return res


def seed_legacy_advertisements(db: Session):
    cluster_a_phone = "+91 90000 11111"
    cluster_a_upi = "quickgain@okaxis"
    cluster_a_url = "http://quick-gain-now.example.com/join"
    cluster_b_phone = "080-4455-7788"
    cluster_b_domain = "kyc-update-secure.example.net"

    ads: list[dict] = []
    for i in range(1, 9):
        ads.append({
            "seed_key": f"cluster-a-{i}",
            "source": "messaging",
            "source_url": cluster_a_url if i % 2 else None,
            "text": f"Guaranteed returns of 8% weekly with QuickGain plan {i}. Call {cluster_a_phone} or send funds to {cluster_a_upi}.",
        })
    for i in range(1, 7):
        ads.append({
            "seed_key": f"cluster-b-{i}",
            "source": "social",
            "text": f"Your bank KYC is pending. Visit https://{cluster_b_domain}/verify-{i} and call {cluster_b_phone}.",
        })

    for row in ads:
        exists = db.query(Advertisement).filter(Advertisement.seed_key == row["seed_key"]).first()
        if exists:
            continue
        ad = Advertisement(
            seed_key=row["seed_key"],
            text=row["text"],
            source=row.get("source"),
            source_url=row.get("source_url"),
            is_seed=True,
            analysis_status="completed",
        )
        db.add(ad)
        db.flush()
        analyze_advertisement(db, ad)
    db.commit()


def main():
    Path(get_settings().upload_dir).mkdir(parents=True, exist_ok=True)
    Base.metadata.create_all(bind=engine)
    migrate_schema(engine)
    db: Session = SessionLocal()
    try:
        seed_upi_transactions(db)
        seed_legacy_advertisements(db)
        print("[+] FIN-SHIELD synthetic seeding and model training complete.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
