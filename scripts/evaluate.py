#!/usr/bin/env python3
"""Evaluate retrieval quality from a JSONL fixture.

Each line: {"query": "...", "expected_chunk_ids": ["..."]}
The script intentionally keeps the retrieval call injectable so it can be used
against a local repository or an API-backed evaluator later.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Callable


def evaluate(records: list[dict], retrieve: Callable[[str], list[str]], k: int) -> dict[str, float]:
    if not records:
        return {"queries": 0.0, "hit_rate": 0.0, "mrr": 0.0}
    hits = 0
    reciprocal_rank = 0.0
    for record in records:
        expected = set(record.get("expected_chunk_ids", []))
        results = retrieve(str(record["query"]))[:k]
        for rank, chunk_id in enumerate(results, start=1):
            if chunk_id in expected:
                hits += 1
                reciprocal_rank += 1 / rank
                break
    return {
        "queries": float(len(records)),
        "hit_rate": hits / len(records),
        "mrr": reciprocal_rank / len(records),
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("fixture", type=Path)
    parser.add_argument("--k", type=int, default=5)
    args = parser.parse_args()
    records = [json.loads(line) for line in args.fixture.read_text(encoding="utf-8").splitlines() if line.strip()]
    # Replace this with a real retriever integration when running evaluation.
    result = evaluate(records, lambda _query: [], args.k)
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
