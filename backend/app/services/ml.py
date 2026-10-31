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


def _format_explanation_text(feature: str, val: float, base: float, z: float) -> str:
    """Format human-readable plain language explanation for feature deviation."""
    if feature in ("amount", "amount_deviation_from_baseline"):
        if feature == "amount_deviation_from_baseline" or (base > 0 and val > base * 1.5):
            ratio = val if feature == "amount_deviation_from_baseline" else (val / max(base, 1.0))
            return f"Amount is {ratio:.1f}x higher than this account's 30-day typical transfer."
        return f"Transfer amount ₹{val:,.2f} is unusually high compared to typical baseline median (₹{base:,.2f})."
    elif feature == "sender_velocity_1h":
        return f"{int(round(val))} transactions from sender account in the last hour (baseline is ~{int(round(base))})."
    elif feature == "sender_velocity_24h":
        return f"{int(round(val))} transactions in 24 hours (baseline is ~{int(round(base))})."
    elif feature == "receiver_velocity_1h":
        return f"Payee received {int(round(val))} transactions in 1 hour (baseline is ~{int(round(base))})."
    elif feature == "receiver_velocity_24h":
        return f"Payee received {int(round(val))} transactions in 24 hours (baseline is ~{int(round(base))})."
    elif feature in ("hour_of_day", "is_night"):
        if feature == "is_night" or (val >= 23 or val <= 5):
            return "Transfer initiated during off-hours (night) unusual for typical account activity."
        return f"Transfer initiated at {int(round(val)):02d}:00, diverging from usual daytime pattern."
    elif feature == "is_weekend":
        return "Transfer on a weekend, outside typical transaction schedule."
    elif feature == "device_reuse_count":
        return f"Device fingerprint is associated with {int(round(val))} distinct accounts (baseline is ~{int(round(base))})."
    elif feature == "ip_reuse_count":
        return f"IP address has routed transactions across {int(round(val))} accounts (baseline is ~{int(round(base))})."
    elif feature == "is_new_beneficiary":
        return "First-time transfer to an unverified beneficiary."
    elif feature == "is_collect_request":
        return "Inbound collect request requiring user PIN authorization."
    elif feature == "rapid_in_out_flag":
        return "Rapid pass-through: funds moved within 90 seconds of receipt."
    elif feature == "is_round_number":
        return "Exact round-amount transfer commonly seen in mule testing."
    elif feature == "geo_discrepancy_flag":
        return "Geographic discrepancy: transaction location differs from usual profile."
    elif feature == "failed_attempts_1h":
        return f"Multiple failed attempts ({int(round(val))}) recorded in the past hour."
    return f"Feature '{feature}' value ({val}) deviates significantly from normal baseline ({base})."


def explain_ml_anomaly(
    feature_vector: list[float] | dict[str, Any],
    top_k: int = 3,
    method: str = "robust_z",
) -> list[dict[str, Any]]:
    """
    Explain the Isolation Forest anomaly prediction using empirical deviation from baseline.

    NOTE ON METHODOLOGY:
    This function computes statistical deviation from baseline (distance from training set
    median normalized by interquartile range via fitted RobustScaler), not exact Shapley
    attribution values. It provides transparent, human-auditable indicators of which feature
    dimensions diverged most sharply from normal customer operating baselines.

    Parameters:
    - feature_vector: 17-element numeric array or dictionary of extracted feature values.
    - top_k: Maximum number of top deviating features to return.
    - method: "robust_z" (default: (x - median) / IQR) or "permutation" (single-feature median imputation shift).
    """
    if isinstance(feature_vector, dict):
        vec = [float(feature_vector.get(fn, 0.0)) for fn in FEATURE_NAMES]
    else:
        vec = [float(v) for v in feature_vector]

    if len(vec) != len(FEATURE_NAMES):
        return []

    bundle = get_model_bundle()
    if not bundle or "scaler" not in bundle:
        return []

    scaler: RobustScaler = bundle["scaler"]
    center = getattr(scaler, "center_", None)
    scale = getattr(scaler, "scale_", None)
    if center is None or scale is None or len(center) != len(vec):
        return []

    results: list[dict[str, Any]] = []

    if method == "permutation" and "model" in bundle:
        model: IsolationForest = bundle["model"]
        try:
            X_orig = scaler.transform(np.array([vec], dtype=np.float64))
            base_anomaly = -float(model.score_samples(X_orig)[0])
            for i, fname in enumerate(FEATURE_NAMES):
                x_val = vec[i]
                c_val = float(center[i])
                s_val = float(scale[i]) if float(scale[i]) != 0 else 1.0

                vec_perm = list(vec)
                vec_perm[i] = c_val
                X_perm = scaler.transform(np.array([vec_perm], dtype=np.float64))
                perm_anomaly = -float(model.score_samples(X_perm)[0])
                diff = base_anomaly - perm_anomaly
                z = (x_val - c_val) / s_val

                if diff > 0.01 or abs(z) >= 2.0:
                    results.append({
                        "feature": fname,
                        "value": round(float(x_val), 2),
                        "baseline": round(float(c_val), 2),
                        "deviation": round(float(z), 1),
                        "importance_delta": round(float(diff), 4),
                        "direction": "HIGH" if x_val > c_val else ("LOW" if x_val < c_val else "NORMAL"),
                        "human_text": _format_explanation_text(fname, x_val, c_val, z),
                        "_sort_key": abs(diff),
                    })
            results.sort(key=lambda item: item["_sort_key"], reverse=True)
            for r in results:
                r.pop("_sort_key", None)
            return results[:top_k]
        except Exception:
            pass  # Fall back to robust_z

    # Default: method == "robust_z"
    for i, fname in enumerate(FEATURE_NAMES):
        x_val = vec[i]
        c_val = float(center[i])
        s_val = float(scale[i]) if float(scale[i]) != 0 else 1.0

        is_binary = fname in (
            "is_night", "is_weekend", "is_new_beneficiary", "is_collect_request",
            "rapid_in_out_flag", "is_round_number", "geo_discrepancy_flag"
        )
        if is_binary:
            if x_val == 0.0:
                continue
            z = (x_val - c_val) / max(s_val, 0.25)
        else:
            z = (x_val - c_val) / s_val

        if abs(z) >= 1.5 or (is_binary and x_val == 1.0):
            results.append({
                "feature": fname,
                "value": round(float(x_val), 2),
                "baseline": round(float(c_val), 2),
                "deviation": round(float(z), 1),
                "direction": "HIGH" if x_val > c_val else "LOW",
                "human_text": _format_explanation_text(fname, x_val, c_val, z),
            })

    results.sort(key=lambda item: abs(item["deviation"]), reverse=True)
    return results[:top_k]


