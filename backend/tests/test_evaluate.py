from scripts.evaluate import evaluate


def test_evaluate_hit_rate_and_mrr():
    records = [
        {"query": "a", "expected_chunk_ids": ["c2"]},
        {"query": "b", "expected_chunk_ids": ["missing"]},
    ]
    result = evaluate(records, lambda query: ["c2", "c1"] if query == "a" else [], k=2)
    assert result["hit_rate"] == 0.5
    assert result["mrr"] == 0.5
