#!/usr/bin/env python3
"""
build_dict.py — 背呗(drill) 离线数据管线 v2 (M3 全量词库)

从 ECDICT 导出的 ecdict.csv 中筛选词，构建随 App 打包的只读词库
SQLite 数据库 `assets/db/dictionary.db`。

设计原则（与 docs/开发计划.md 第四节「数据模型」一致）：
- words      全局词条，只读
- tags       词库即标签（内置「核心词库」+ 考纲标签）
- word_tags  多对多
- cards / review_logs / user_notes / daily_stats / settings
            用户进度表（空，首次启动拷贝到用户目录后由 App 写入）

M3 选词策略（与 开发计划.md 的「3 万词含 GRE 全覆盖」一致）：
- 核心高频词：按词频(frq) 取前 CORE_LIMIT（默认 30000）作为默认学习池；
- 考纲词并集：把 ECDICT tag 字段里出现的考纲词（zk/gk/ky/cet4/cet6/toefl/ielts/gre/考研）
  也全部并入，保证 GRE/CET/考研等考纲 100% 入库（部分考纲词词频偏低、落在前 CORE_LIMIT 之外）。
- 最终词表 = 核心高频 ∪ 考纲词（约 3 万词），全部打上「核心词库」标签，可学；
  同时按各自考纲标签再链接，供词库页筛选。

数据库既是「随包分发」的只读词库，也是「首次启动拷贝」后的运行时库：
App 拷贝 dictionary.db 到文档目录后直接在其上建/写 cards 等表，
因此本脚本一次性把全部表结构建好（用户表留空），避免运行时再建表。

用法：
    python3 tools/build_dict.py [SRC_CSV] [OUT_DB] [CORE_LIMIT]
默认：SRC=tools/cache/ecdict.csv  OUT=assets/db/dictionary.db  CORE_LIMIT=30000
"""
import csv
import json
import os
import re
import sqlite3
import sys

DEFAULT_SRC = "tools/cache/ecdict.csv"
DEFAULT_OUT = "assets/db/dictionary.db"
DEFAULT_LIMIT = 30000

# 仅收单 token、纯小写字母（含连字符/撇号）的词条，
# 排除专有名词（大写）、缩写、短语、带空格的条目。
WORD_RE = re.compile(r"^[a-z][a-z'’\-]*$")

# ECDICT tag 字段里出现的考纲代号（归一化用小写）。
EXAM_CODES = {"zk", "gk", "ky", "cet4", "cet6", "toefl", "ielts", "gre", "考研"}
# 中文展示名，用于内置标签。
EXAM_LABELS = {
    "zk": "中考", "gk": "高考", "ky": "考研", "cet4": "CET-4",
    "cet6": "CET-6", "toefl": "TOEFL", "ielts": "IELTS", "gre": "GRE", "考研": "考研",
}
TAG_PALETTE = ["#E53935", "#FB8C00", "#FDD835", "#43A047", "#1E88E5",
               "#8E24AA", "#00ACC1", "#6D4C41", "#546E7A", "#D81B60"]


def parse_exchange(raw: str):
    """ECDICT exchange 形如 p:abode/p:abodes/ing:aboding；解析为结构化 dict。"""
    if not raw:
        return None
    out = {}
    for part in raw.split("/"):
        if ":" not in part:
            continue
        k, v = part.split(":", 1)
        out[k] = v
    return out or None


def parse_exam_tags(tag_field: str):
    """把 ECDICT tag 字段拆成已知考纲代号集合。"""
    if not tag_field:
        return set()
    # 分隔符可能是 空格/逗号/分号/斜杠/竖线
    toks = re.split(r"[\s,;/|]+", tag_field.strip().lower())
    return {t for t in toks if t in EXAM_CODES}


def main():
    src = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_SRC
    out = sys.argv[2] if len(sys.argv) > 2 else DEFAULT_OUT
    limit = int(sys.argv[3]) if len(sys.argv) > 3 else DEFAULT_LIMIT

    if not os.path.exists(src):
        sys.exit(
            f"[ERR] 源 CSV 不存在: {src}\n"
            f"请先运行 `bash tools/fetch_ecdict.sh` 下载 ECDICT（MIT 许可）。"
        )

    print(f"[1/4] 读取并筛选 {src} ...")
    candidates = []
    with open(src, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for r in reader:
            word = (r.get("word") or "").strip()
            if not word or not WORD_RE.match(word):
                continue
            frq_raw = (r.get("frq") or "").strip()
            try:
                frq = int(frq_raw)
            except ValueError:
                continue
            if frq <= 0:
                continue
            if not (r.get("translation") or "").strip():
                continue
            candidates.append((frq, r))
    candidates.sort(key=lambda x: x[0])
    # 核心高频词：按词频取前 CORE_LIMIT 作为默认学习池。
    core_ids = {id(r) for _, r in candidates[:limit]}
    # 考纲词并集：保证 GRE/CET/考研等考纲 100% 入库（部分考纲词词频偏低、落在 CORE_LIMIT 之外）。
    exam_ids = set()
    for _, r in candidates:
        if parse_exam_tags(r.get("tag", "")):
            exam_ids.add(id(r))
    selected = [(frq, r) for frq, r in candidates if id(r) in core_ids or id(r) in exam_ids]
    selected.sort(key=lambda x: x[0])
    print(f"      候选 {len(candidates)} 条；核心词频前 {limit} ∪ 考纲词 = {len(selected)} 条（按词频 frq 升序）")

    # 汇总考纲标签分布
    exam_usage = {}
    for _, r in selected:
        for code in parse_exam_tags(r.get("tag", "")):
            exam_usage[code] = exam_usage.get(code, 0) + 1
    print(f"[2/4] 考纲标签分布: {exam_usage}")

    print(f"[3/4] 写入 {out} ...")
    os.makedirs(os.path.dirname(out), exist_ok=True)
    if os.path.exists(out):
        os.remove(out)
    con = sqlite3.connect(out)
    cur = con.cursor()

    cur.executescript(
        """
        CREATE TABLE words (
            id            INTEGER PRIMARY KEY,
            word          TEXT NOT NULL,
            lemma         TEXT,
            phonetic_uk   TEXT,
            phonetic_us   TEXT,
            definition_zh TEXT,
            definition_en TEXT,
            pos           TEXT,
            collins       INTEGER,
            oxford3000    INTEGER,
            bnc           INTEGER,
            frq           INTEGER,
            exam_tags     TEXT,
            exchange      TEXT,
            root_affix    TEXT
        );
        CREATE INDEX idx_words_word ON words(word);
        CREATE INDEX idx_words_frq  ON words(frq);

        CREATE TABLE tags (
            id     INTEGER PRIMARY KEY,
            name   TEXT NOT NULL,
            kind   TEXT NOT NULL DEFAULT 'builtin',
            color  TEXT,
            sort   INTEGER
        );

        CREATE TABLE word_tags (
            word_id INTEGER NOT NULL,
            tag_id  INTEGER NOT NULL,
            PRIMARY KEY (word_id, tag_id)
        );
        CREATE INDEX idx_wt_tag ON word_tags(tag_id);

        CREATE TABLE cards (
            word_id          INTEGER PRIMARY KEY,
            state            TEXT DEFAULT 'new',
            due              INTEGER DEFAULT 0,
            stability        REAL DEFAULT 0,
            difficulty       REAL DEFAULT 0,
            retrievability   REAL DEFAULT 0,
            reps             INTEGER DEFAULT 0,
            lapses           INTEGER DEFAULT 0,
            elapsed_days     INTEGER DEFAULT 0,
            scheduled_days   INTEGER DEFAULT 0,
            last_review_at   INTEGER,
            mastered         INTEGER DEFAULT 0
        );

        CREATE TABLE review_logs (
            id              INTEGER PRIMARY KEY,
            card_id         INTEGER,
            reviewed_at     INTEGER,
            rating          INTEGER,
            state           TEXT,
            taken_ms        INTEGER,
            prev_stability  REAL,
            prev_difficulty REAL
        );

        CREATE TABLE user_notes (
            word_id   INTEGER PRIMARY KEY,
            mnemonic  TEXT,
            note      TEXT,
            updated_at INTEGER
        );

        CREATE TABLE daily_stats (
            date          TEXT PRIMARY KEY,
            new_count     INTEGER DEFAULT 0,
            review_count  INTEGER DEFAULT 0,
            correct_count INTEGER DEFAULT 0,
            elapsed_ms    INTEGER DEFAULT 0
        );

        CREATE TABLE settings (
            key   TEXT PRIMARY KEY,
            value TEXT
        );
        """
    )

    # 内置「核心词库」标签（M3 默认学习池，含全部候选词）
    cur.execute(
        "INSERT INTO tags(id,name,kind,color,sort) VALUES(?,?,?,?,?)",
        (1, "核心词库", "builtin", "#1E88E5", 0),
    )
    # 考纲标签（按出现情况动态创建）
    tag_id_of_code = {}
    for i, code in enumerate(sorted(exam_usage.keys())):
        tid = 100 + i
        cur.execute(
            "INSERT INTO tags(id,name,kind,color,sort) VALUES(?,?,?,?,?)",
            (tid, EXAM_LABELS.get(code, code), "builtin",
             TAG_PALETTE[i % len(TAG_PALETTE)], i + 1),
        )
        tag_id_of_code[code] = tid

    wid = 0
    for frq, r in selected:
        wid += 1
        phonetic = (r.get("phonetic") or "").strip() or None
        collins = (r.get("collins") or "").strip()
        collins = int(collins) if collins.isdigit() else None
        oxford = 1 if (r.get("oxford") or "").strip() == "1" else 0
        bnc = (r.get("bnc") or "").strip()
        bnc = int(bnc) if bnc.isdigit() else None
        codes = parse_exam_tags(r.get("tag", ""))
        exam_tags = ",".join(sorted(codes)) if codes else None
        exchange = parse_exchange(r.get("exchange", ""))
        cur.execute(
            """INSERT INTO words
               (id,word,lemma,phonetic_uk,phonetic_us,definition_zh,definition_en,
                pos,collins,oxford3000,bnc,frq,exam_tags,exchange,root_affix)
               VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
            (
                wid, r["word"].strip(), r["word"].strip(), phonetic, None,
                (r.get("translation") or "").strip() or None,
                (r.get("definition") or "").strip() or None,
                (r.get("pos") or "").strip() or None,
                collins, oxford, bnc, frq,
                exam_tags,
                json.dumps(exchange, ensure_ascii=False) if exchange else None,
                None,
            ),
        )
        # 链接到内置样本标签
        cur.execute("INSERT OR IGNORE INTO word_tags(word_id,tag_id) VALUES(?,?)", (wid, 1))
        # 链接到考纲标签
        for code in codes:
            cur.execute("INSERT OR IGNORE INTO word_tags(word_id,tag_id) VALUES(?,?)",
                        (wid, tag_id_of_code[code]))

    # 默认设置（与 docs/开发计划.md 第九节一致）
    cur.executemany(
        "INSERT INTO settings(key,value) VALUES(?,?)",
        [
            ("daily_new_limit", "20"),
            ("daily_review_limit", "200"),
            ("desired_retention", "0.9"),
            ("day_cutoff_hour", "4"),
        ],
    )

    con.execute("PRAGMA user_version=2")
    con.commit()

    # 校验
    n_words = cur.execute("SELECT COUNT(*) FROM words").fetchone()[0]
    n_wt = cur.execute("SELECT COUNT(*) FROM word_tags").fetchone()[0]
    n_tags = cur.execute("SELECT COUNT(*) FROM tags").fetchone()[0]
    con.close()
    size = os.path.getsize(out)
    print(f"[4/4] 完成 ✓  words={n_words}  tags={n_tags}  word_tags={n_wt}  size={size/1024:.1f}KB")
    if n_words < limit:
        print(f"      [warn] 实际 {n_words} 条，未达 CORE_LIMIT={limit}（候选不足或 CSV 截断）")


if __name__ == "__main__":
    main()
