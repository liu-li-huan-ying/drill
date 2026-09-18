#!/usr/bin/env python3
"""import_translations.py — 从翻译Python文件导入到DB"""
import importlib.util
import sqlite3
import sys
import os

DB = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "assets", "db", "dictionary.db")


def import_file(path):
    spec = importlib.util.spec_from_file_location("trans", path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    data = mod.TRANSLATIONS

    con = sqlite3.connect(DB)
    updated = 0
    for word_id, en, zh in data:
        if not zh:
            continue
        cur = con.execute(
            "UPDATE examples SET sentence_zh = ? WHERE word_id = ? AND sentence_en = ? AND sentence_zh IS NULL",
            (zh, word_id, en)
        )
        updated += cur.rowcount
    con.commit()
    con.close()
    print(f"Imported {updated}/{len(data)} from {os.path.basename(path)}")


if __name__ == "__main__":
    for f in sys.argv[1:]:
        import_file(f)
