#!/usr/bin/env python3
"""
extract_translations.py — 从 dictionary.db 提取待翻译例句，按词频排序，分批导出 JSON

用法：
    python3 tools/extract_translations.py [--batch-size N] [--freq-max N] [--output-dir DIR]

默认：batch_size=100, freq_max=1000, output-dir=tools/cache/translate_batches
"""
import argparse
import json
import os
import sqlite3
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
DB = os.path.join(HERE, "..", "assets", "db", "dictionary.db")
DEFAULT_OUT = os.path.join(HERE, "cache", "translate_batches")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--batch-size", type=int, default=100)
    parser.add_argument("--freq-max", type=int, default=1000)
    parser.add_argument("--output-dir", default=DEFAULT_OUT)
    args = parser.parse_args()

    if not os.path.exists(DB):
        sys.exit(f"DB not found: {DB}")

    os.makedirs(args.output_dir, exist_ok=True)

    con = sqlite3.connect(DB)
    con.row_factory = sqlite3.Row

    # 提取待翻译句子：按词频升序，每个唯一 sentence_en 只取一次（取词频最低的那个 word）
    rows = con.execute("""
        SELECT DISTINCT
            e.sentence_en,
            w.word,
            w.frq,
            e.word_id,
            e.ord
        FROM examples e
        JOIN words w ON e.word_id = w.id
        WHERE e.sentence_zh IS NULL
          AND w.frq <= ?
        ORDER BY w.frq ASC, e.sentence_en
    """, (args.freq_max,)).fetchall()

    total = len(rows)
    print(f"Found {total} unique sentences with frq <= {args.freq_max}")

    # 按 batch_size 分批写 JSON
    batches = []
    for i in range(0, total, args.batch_size):
        batch = rows[i:i + args.batch_size]
        batch_num = i // args.batch_size + 1
        batch_file = os.path.join(args.output_dir, f"batch_{batch_num:04d}.json")

        data = []
        for row in batch:
            data.append({
                "word": row["word"],
                "sentence_en": row["sentence_en"],
                "frq": row["frq"],
                "word_id": row["word_id"],
                "ord": row["ord"],
                "sentence_zh": None  # 待填
            })

        with open(batch_file, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

        batches.append({
            "batch": batch_num,
            "file": batch_file,
            "count": len(data),
            "frq_range": f"{data[0]['frq']}-{data[-1]['frq']}"
        })

    # 写索引
    index_file = os.path.join(args.output_dir, "index.json")
    with open(index_file, "w", encoding="utf-8") as f:
        json.dump({
            "total_sentences": total,
            "batch_size": args.batch_size,
            "freq_max": args.freq_max,
            "total_batches": len(batches),
            "batches": batches
        }, f, ensure_ascii=False, indent=2)

    con.close()

    print(f"Exported {len(batches)} batches to {args.output_dir}")
    print(f"Index: {index_file}")
    for b in batches[:5]:
        print(f"  batch {b['batch']:4d}: {b['count']:3d} sentences, frq {b['frq_range']}")
    if len(batches) > 5:
        print(f"  ... and {len(batches) - 5} more batches")


if __name__ == "__main__":
    main()
