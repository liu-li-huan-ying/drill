#!/usr/bin/env python3
"""
import_batch.py — 将翻译好的批次 JSON 导入 dictionary.db 的 examples 表
"""
import json
import os
import sqlite3
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
DB = os.path.join(HERE, "..", "assets", "db", "dictionary.db")


def import_batch(batch_file):
    with open(batch_file, "r", encoding="utf-8") as f:
        data = json.load(f)

    con = sqlite3.connect(DB)
    updated = 0
    for item in data:
        zh = item.get("sentence_zh")
        if not zh:
            continue
        en = item["sentence_en"]
        cur = con.execute(
            "UPDATE examples SET sentence_zh = ? WHERE word_id = ? AND sentence_en = ? AND sentence_zh IS NULL",
            (zh, item["word_id"], en)
        )
        updated += cur.rowcount
    con.commit()
    con.close()
    print(f"Imported {updated} translations from {batch_file}")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python import_batch.py <batch.json>")
        sys.exit(1)
    import_batch(sys.argv[1])
