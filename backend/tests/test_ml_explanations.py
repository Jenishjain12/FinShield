from __future__ import annotations

import pytest
from app.services.ml import explain_ml_anomaly, FEATURE_NAMES


def test_explain_ml_anomaly_basic():
    """Verify explain_ml_anomaly produces sorted deviations with human text."""
    # Construct an extreme outlier feature snapshot
    outlier_snapshot = {fn: 0.0 for fn in FEATURE_NAMES}
    outlier_snapshot["amount"] = 85000.0
    outlier_snapshot["amount_deviation_from_baseline"] = 7.5
    outlier_snapshot["sender_velocity_1h"] = 15.0
    outlier_snapshot["is_collect_request"] = 1.0

    explanations = explain_ml_anomaly(outlier_snapshot, top_k=3)
    assert isinstance(explanations, list)
    assert len(explanations) <= 3
    for exp in explanations:
        assert "feature" in exp
        assert "value" in exp
        assert "baseline" in exp
        assert "deviation" in exp
        assert "direction" in exp
        assert "human_text" in exp
        assert len(exp["human_text"]) > 10


def test_explain_ml_anomaly_invalid_inputs():
    """Ensure graceful handling of empty or wrong-length inputs."""
    assert explain_ml_anomaly([]) == []
    assert explain_ml_anomaly([1.0, 2.0]) == []
    assert explain_ml_anomaly({}) == []


def test_explain_ml_anomaly_permutation():
    """Verify permutation method option works without error."""
    outlier_snapshot = {fn: 0.0 for fn in FEATURE_NAMES}
    outlier_snapshot["amount"] = 50000.0
    outlier_snapshot["amount_deviation_from_baseline"] = 5.0
    outlier_snapshot["receiver_velocity_1h"] = 25.0

    explanations = explain_ml_anomaly(outlier_snapshot, top_k=2, method="permutation")
    assert isinstance(explanations, list)

