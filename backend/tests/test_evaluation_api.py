from __future__ import annotations


def test_get_model_evaluation_endpoint(client):
    """Verify GET /api/model/evaluation returns valid benchmarking results."""
    res = client.get("/api/model/evaluation")
    assert res.status_code == 200
    data = res.json()
    assert "metadata" in data or "status" in data
    if "metadata" in data:
        assert "model_comparison" in data
        assert "per_typology_recall_at_10" in data
        assert "leave_one_typology_out" in data
        assert len(data["model_comparison"]) >= 3

