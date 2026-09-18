import sqlite3, json, os

DB = r"D:\workbuddy使用数据\背单词软件\drill\assets\db\dictionary.db"
CACHE = r"D:\workbuddy使用数据\背单词软件\drill\tools\cache\translate_batches"
con = sqlite3.connect(DB)
cur = con.cursor()

rows = cur.execute("""
    SELECT e.word_id, w.word, e.sentence_en, w.frq, e.ord
    FROM examples e
    JOIN words w ON w.id = e.word_id
    WHERE e.sentence_zh IS NULL
    ORDER BY w.frq, e.word_id, e.ord
""").fetchall()
print("remaining:", len(rows), "sentences")

batch_size = 500
batches = []
for i in range(0, len(rows), batch_size):
    chunk = rows[i:i+batch_size]
    batch_num = 16 + len(batches)
    fname = "batch_%04d.json" % batch_num
    data = [{"word_id": r[0], "word": r[1], "sentence_en": r[2], "frq": r[3], "ord": r[4]} for r in chunk]
    with open(os.path.join(CACHE, fname), "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    batches.append({"batch": batch_num, "file": fname, "count": len(data), "frq_range": "%s-%s" % (chunk[0][3], chunk[-1][3])})

index = {"total_batches": len(batches), "total_sentences": len(rows), "batches": batches}
with open(os.path.join(CACHE, "remaining_index.json"), "w", encoding="utf-8") as f:
    json.dump(index, f, ensure_ascii=False, indent=2)

print("created %d batches" % len(batches))
for b in batches[:5]:
    print("  batch %d: %d sentences, frq %s" % (b["batch"], b["count"], b["frq_range"]))
print("  ...")
for b in batches[-3:]:
    print("  batch %d: %d sentences, frq %s" % (b["batch"], b["count"], b["frq_range"]))
con.close()
