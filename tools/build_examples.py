#!/usr/bin/env python3
"""
build_examples.py — M3.2 例句索引 (Tatoeba 英中平行句对, 离线打包)

输入 (tools/cache/):
  - eng_sentences.tsv.bz2   英语句子  (id \\t lang \\t text)  per_language/eng
  - cmn_sentences.tsv.bz2   普通话句子 (id \\t lang \\t text)  per_language/cmn
  - links.tar.bz2           句对链接  (sentence_id \\t translation_id)，解包得 links.csv

输出:
  - 在 assets/db/dictionary.db 中建 examples 表 (word_id, sentence_en, sentence_zh, ord)
  - PRAGMA user_version = 3

匹配策略 (离线、纯字符串):
  1) 流式扫英语句子，tokenize 后查词典词集合，命中的词挂上该句 (每词最多 CAP 句)
  2) 用 links 把英语句 id 映射到候选翻译 id (仅保留我们保留下来的英语句)
  3) 流式扫中文句子，只保留"被候选"的中文 id，得到 id->zh 文本
  4) 每句取首个有中文译文的候选作为 sentence_zh (无则 NULL)
  5) 写入 examples 表，ord 为词内序号

容错: 缺 links/cmn 时退化为纯英文例句 (sentence_zh 全 NULL)，不中断。
"""
import bz2
import os
import re
import sqlite3
import sys
import tarfile

HERE = os.path.dirname(os.path.abspath(__file__))
CACHE = os.path.join(HERE, "cache")
DB = os.path.join(HERE, "..", "assets", "db", "dictionary.db")

CAP = 5            # 每词最多例句数
MAX_EN = 180       # 英文句截断长度
MAX_ZH = 120       # 中文句截断长度
TOKEN_RE = re.compile(r"[a-z']+")


def load_words(db_path):
    con = sqlite3.connect(db_path)
    rows = con.execute("SELECT id, word FROM words").fetchall()
    con.close()
    word_set = {}
    for wid, w in rows:
        word_set[w.lower()] = wid
    print(f"[words] {len(word_set)} words loaded", flush=True)
    return word_set


def stream_tsv_bz2(path):
    with bz2.open(path, "rt", encoding="utf-8", errors="replace") as f:
        for line in f:
            line = line.rstrip("\n")
            if not line:
                continue
            parts = line.split("\t")
            if len(parts) < 3:
                continue
            yield parts[0], parts[2]


def pass1_english(word_set):
    path = os.path.join(CACHE, "eng_sentences.tsv.bz2")
    if not os.path.exists(path):
        print("[eng] MISSING eng_sentences.tsv.bz2 — 跳过英文例句", flush=True)
        return {}, set()
    eng_examples = {}      # word_id -> [(eng_id, text), ...]
    kept_eng = set()
    n = 0
    with bz2.open(path, "rt", encoding="utf-8", errors="replace") as f:
        for line in f:
            line = line.rstrip("\n")
            if not line:
                continue
            parts = line.split("\t")
            if len(parts) < 3:
                continue
            sid = parts[0]
            text = parts[2]
            low = text.lower()
            found = set()
            for tok in TOKEN_RE.findall(low):
                wid = word_set.get(tok)
                if wid is not None:
                    found.add(wid)
            if not found:
                continue
            # 仅当至少一个词还能再收一句时才保存
            if not any(len(eng_examples.get(w, [])) < CAP for w in found):
                continue
            t = text.strip()
            if len(t) > MAX_EN:
                t = t[:MAX_EN].rstrip() + "…"
            try:
                eid = int(sid)
            except ValueError:
                continue
            kept_eng.add(eid)
            for wid in found:
                lst = eng_examples.setdefault(wid, [])
                if len(lst) < CAP and eid not in (x[0] for x in lst):
                    lst.append((eid, t))
            n += 1
            if n % 100000 == 0:
                print(f"[eng] scanned {n} matched sentences, kept {len(kept_eng)}", flush=True)
    print(f"[eng] done: {n} matched, {len(kept_eng)} kept, {len(eng_examples)} words have examples", flush=True)
    return eng_examples, kept_eng


def pass2_links(kept_eng):
    path = os.path.join(CACHE, "links.tar.bz2")
    if not os.path.exists(path):
        print("[links] MISSING links.tar.bz2 — 跳过中文配对", flush=True)
        return {}
    eng_to_chi = {}
    member_name = None
    try:
        with tarfile.open(path) as tar:
            for m in tar.getmembers():
                if m.name.endswith("links.csv"):
                    member_name = m.name
                    break
            if member_name is None:
                print("[links] links.csv not found in archive — 跳过中文配对", flush=True)
                return {}
            f = tar.extractfile(member_name)
            if f is None:
                return {}
            n = 0
            for raw in f:
                line = raw.decode("utf-8", "replace").rstrip("\n")
                if not line:
                    continue
                parts = line.split("\t")
                if len(parts) < 2:
                    continue
                try:
                    a = int(parts[0])
                    b = int(parts[1])
                except ValueError:
                    continue
                if a in kept_eng:
                    eng_to_chi.setdefault(a, []).append(b)
                n += 1
                if n % 3000000 == 0:
                    print(f"[links] scanned {n} pairs, {len(eng_to_chi)} eng mapped", flush=True)
        print(f"[links] done: {n} pairs, {len(eng_to_chi)} eng sentences mapped to candidates", flush=True)
    except Exception as e:
        print(f"[links] 解析失败 ({type(e).__name__}: {e}) — 退化为纯英文例句", flush=True)
        return {}
    return eng_to_chi


def pass3_chinese(eng_to_chi):
    path = os.path.join(CACHE, "cmn_sentences.tsv.bz2")
    if not os.path.exists(path) or not eng_to_chi:
        print("[cmn] MISSING or no mapping — sentence_zh 将为 NULL", flush=True)
        return {}
    candidate = set()
    for lst in eng_to_chi.values():
        candidate.update(lst)
    print(f"[cmn] {len(candidate)} candidate chinese ids", flush=True)
    chi_text = {}
    n = 0
    with bz2.open(path, "rt", encoding="utf-8", errors="replace") as f:
        for line in f:
            line = line.rstrip("\n")
            if not line:
                continue
            parts = line.split("\t")
            if len(parts) < 3:
                continue
            try:
                cid = int(parts[0])
            except ValueError:
                continue
            if cid in candidate:
                t = parts[2].strip()
                if len(t) > MAX_ZH:
                    t = t[:MAX_ZH].rstrip() + "…"
                chi_text[cid] = t
            n += 1
            if n % 1000000 == 0:
                print(f"[cmn] scanned {n} sentences, {len(chi_text)} matched", flush=True)
    print(f"[cmn] done: {len(chi_text)} chinese sentences resolved", flush=True)
    return chi_text


def build(db_path, eng_examples, eng_to_chi, chi_text):
    rows = []
    for wid, ex_list in eng_examples.items():
        for ord_, (eid, en) in enumerate(ex_list):
            zh = None
            if eng_to_chi:
                for cand in eng_to_chi.get(eid, []):
                    if cand in chi_text:
                        zh = chi_text[cand]
                        break
            rows.append((wid, en, zh, ord_))
    print(f"[build] {len(rows)} example rows to write", flush=True)

    con = sqlite3.connect(db_path)
    con.execute("""CREATE TABLE IF NOT EXISTS examples (
        word_id INTEGER NOT NULL,
        sentence_en TEXT NOT NULL,
        sentence_zh TEXT,
        ord INTEGER NOT NULL
    )""")
    con.execute("CREATE INDEX IF NOT EXISTS idx_examples_word ON examples(word_id)")
    con.execute("DELETE FROM examples")
    con.executemany(
        "INSERT INTO examples (word_id, sentence_en, sentence_zh, ord) VALUES (?,?,?,?)",
        rows,
    )
    con.execute("PRAGMA user_version=3")
    con.commit()
    # stats
    total = con.execute("SELECT COUNT(*) FROM examples").fetchone()[0]
    words_with = con.execute("SELECT COUNT(DISTINCT word_id) FROM examples").fetchone()[0]
    with_zh = con.execute("SELECT COUNT(*) FROM examples WHERE sentence_zh IS NOT NULL").fetchone()[0]
    con.close()
    size = os.path.getsize(db_path)
    print(f"[build] OK total={total} words_with_examples={words_with} with_zh={with_zh} db_size={size/1e6:.1f}MB", flush=True)


def main():
    if not os.path.exists(DB):
        print(f"ERROR: {DB} not found", flush=True)
        sys.exit(1)
    word_set = load_words(DB)
    eng_examples, kept_eng = pass1_english(word_set)
    eng_to_chi = pass2_links(kept_eng)
    chi_text = pass3_chinese(eng_to_chi)
    build(DB, eng_examples, eng_to_chi, chi_text)
    print("DONE", flush=True)


if __name__ == "__main__":
    main()
