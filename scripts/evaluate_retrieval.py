#!/usr/bin/env python3
"""
Retrieval Evaluation Script for StudyRAG V2.
Đánh giá Recall@5, MRR và Citation Precision trên bộ câu hỏi data/evaluations/questions.jsonl.
"""
import json
import os
import sys

def main():
    eval_file = "data/evaluations/questions.jsonl"
    if not os.path.exists(eval_file):
        print(f"❌ Không tìm thấy file evaluation: {eval_file}")
        return 1
    
    print("🎯 StudyRAG V2 — Retrieval Evaluation (Milestone 2 Target: Recall@5 >= 0.80)")
    count = 0
    with open(eval_file, "r", encoding="utf-8") as f:
        for line in f:
            if line.strip():
                count += 1
    
    print(f"✅ Đã tải {count} câu hỏi đánh giá từ {eval_file}.")
    print("⚡ Vui lòng hoàn thành Milestone 2 (ChromaDB + Vietnamese Bi-Encoder) để chạy đánh giá điểm Recall@5 thật!")
    return 0

if __name__ == "__main__":
    sys.exit(main())
