from __future__ import annotations

import os
from datetime import datetime
from pathlib import Path
from typing import Any

import joblib
import numpy as np
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import RobustScaler

MODEL_DIR = Path(__file__).resolve().parent.parent.parent / "data"
MODEL_PATH = MODEL_DIR / "isolation_forest.joblib"

FEATURE_NAMES = [
    "amount",
    "hour_of_day",
    "is_night",
    "is_weekend",
    "sender_velocity_1h",
    "sender_velocity_24h",
    "receiver_velocity_1h",
    "receiver_velocity_24h",
    "amount_deviation_from_baseline",
    "is_new_beneficiary",
    "device_reuse_count",
    "ip_reuse_count",
    "is_collect_request",
    "rapid_in_out_flag",
    "is_round_number",
    "geo_discrepancy_flag",
    "failed_attempts_1h",
]

# In-memory cached model instance
_CACHED_MODEL_BUNDLE: dict[str, Any] | None = None


def get_model_bundle() -> dict[str, Any] | None:
    global _CACHED_MODEL_BUNDLE
    if _CACHED_MODEL_BUNDLE is not None:
        return _CACHED_MODEL_BUNDLE
    if MODEL_PATH.exists():
        try:
            _CACHED_MODEL_BUNDLE = joblib.load(MODEL_PATH)
            return _CACHED_MODEL_BUNDLE
        except Exception:
            return None
    return None


def train_anomaly_model(
    feature_matrix: list[list[float]],
    version: str = "isolation_forest_v1.0",
) -> dict[str, Any]:
    """
    Train an unsupervised Isolation Forest on synthetic baseline feature vectors.
    """
    global _CACHED_MODEL_BUNDLE
    X = np.array(feature_matrix, dtype=np.float64)
    if len(X) < 10:
        raise ValueError("At least 10 sample vectors required to train Isolation Forest.")

    scaler = RobustScaler()
    X_scaled = scaler.fit_transform(X)

    model = IsolationForest(
        n_estimators=100,
        contamination=0.08,  # Expect ~8% anomaly baseline in synthetic population
        max_samples="auto",
        random_state=42,
    )
    model.fit(X_scaled)

    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    bundle = {
        "model": model,
        "scaler": scaler,
        "version": version,
        "trained_at": datetime.utcnow().isoformat(),
        "n_samples": len(X),
        "features": FEATURE_NAMES,
    }
    joblib.dump(bundle, MODEL_PATH)
    _CACHED_MODEL_BUNDLE = bundle

    return {
        "status": "success",
        "version": version,
        "n_samples": len(X),
        "trained_at": bundle["trained_at"],
        "features": FEATURE_NAMES,
    }


def score_transaction_ml(feature_vector: list[float]) -> tuple[float, str]:
    """
    Produce continuous anomaly score (0.0 to 100.0) and model version.
    Falls back to baseline if model is uninitialized.
    """
    bundle = get_model_bundle()
    if not bundle or "model" not in bundle or "scaler" not in bundle:
        return 0.0, "rules_only_fallback"

    try:
        model: IsolationForest = bundle["model"]
        scaler: RobustScaler = bundle["scaler"]

        X = np.array([feature_vector], dtype=np.float64)
        X_scaled = scaler.transform(X)

        # score_samples returns opposite of anomaly score (lower means more anomalous)
        raw_score = float(model.score_samples(X_scaled)[0])
        # Map raw score [-1.0, 0.5] to [0.0, 100.0]
        # In scikit-learn, normal points typically have scores around -0.4 to 0.0,
        # while outliers have scores below -0.6.
        normalized = max(0.0, min(100.0, (-raw_score - 0.35) * 160.0))
        return round(normalized, 1), bundle.get("version", "isolation_forest_v1.0")
    except Exception:
        return 0.0, "rules_only_fallback"


def compute_triage_score(
    ml_anomaly_score: float,
    rule_hits: list[dict[str, Any]],
) -> tuple[int, str]:
    """
    Compose final normalized triage score (0–100) and risk category.
    Blends unsupervised anomaly signal with deterministic rule evidence.
    """
    rule_points = sum(r.get("contribution", r.get("score_contribution", 0)) for r in rule_hits)

    if ml_anomaly_score > 0:
        # Balanced blend: 40% ML anomaly score + 60% transparent rule hits
        raw_triage = 0.40 * ml_anomaly_score + 0.60 * min(rule_points, 100)
    else:
        # Fallback entirely on rule points
        raw_triage = float(min(rule_points, 100))

    triage_score = int(round(max(0.0, min(100.0, raw_triage))))

    if triage_score >= 75:
        category = "CRITICAL"
    elif triage_score >= 50:
        category = "HIGH"
    elif triage_score >= 25:
        category = "MEDIUM"
    else:
        category = "LOW"

    return triage_score, category

