// 业务查询：构建今日队列、记录评分、读写设置、取词库/单词。
// 复习候选池 = 拥有标签且 mastered=0 的词（见 对抗式审查 C1 结论）。
import { getDb } from './Database';
import { dateKey } from '../lib/date';
import { gradeCard, gradeNewCard, schedToDb, type DbCard } from '../srs/fsrs';
import type { Grade } from 'ts-fsrs';

export interface QueueItem {
  word_id: number;
  word: string;
  phonetic_uk: string | null;
  phonetic_us: string | null;
  definition_zh: string | null;
  definition_en: string | null;
  pos: string | null; // 词性，如 "v." / "n."
  root_affix: string | null;
  state: string; // 'new' | 'review' ...
  isNew: boolean;
}

export interface Settings {
  daily_new_limit: number;
  daily_review_limit: number;
  desired_retention: number;
  day_cutoff_hour: number;
  study_tag: number | null; // 学习范围：限定只背某标签；null = 全部词库
}

const BASE_SELECT = `
  SELECT w.id AS word_id, w.word, w.phonetic_uk, w.phonetic_us,
         w.definition_zh, w.definition_en, w.pos, w.root_affix, c.state
  FROM cards c JOIN words w ON w.id = c.word_id
  WHERE c.mastered = 0 `;

function rowToItem(r: any, isNew: boolean): QueueItem {
  return {
    word_id: r.word_id,
    word: r.word,
    phonetic_uk: r.phonetic_uk,
    phonetic_us: r.phonetic_us,
    definition_zh: r.definition_zh,
    definition_en: r.definition_en,
    pos: r.pos,
    root_affix: r.root_affix,
    state: r.state,
    isNew,
  };
}

// 为所有「有标签」的单词补齐 cards 行（state='new'），随后今日队列只从 cards 取。
export function ensureCards(): void {
  getDb().execSync(`
    INSERT INTO cards (word_id, state, due, stability, difficulty, retrievability,
                       reps, lapses, elapsed_days, scheduled_days, last_review_at, mastered)
    SELECT w.id, 'new', 0, 0, 0, 0, 0, 0, 0, 0, NULL, 0
    FROM words w
    WHERE EXISTS (SELECT 1 FROM word_tags wt WHERE wt.word_id = w.id)
      AND NOT EXISTS (SELECT 1 FROM cards c WHERE c.word_id = w.id)
  `);
}

export function getSettings(): Settings {
  const rows = getDb().getAllSync<{ key: string; value: string }>(
    'SELECT key, value FROM settings'
  );
  const map: Record<string, string> = {};
  rows.forEach((r) => (map[r.key] = r.value));
  return {
    daily_new_limit: parseInt(map.daily_new_limit ?? '20', 10),
    daily_review_limit: parseInt(map.daily_review_limit ?? '200', 10),
    desired_retention: parseFloat(map.desired_retention ?? '0.9'),
    day_cutoff_hour: parseInt(map.day_cutoff_hour ?? '4', 10),
    study_tag:
      map.study_tag !== undefined && map.study_tag !== '' && !Number.isNaN(Number(map.study_tag))
        ? Number(map.study_tag)
        : null,
  };
}

export function getTodayCounts(): { newDone: number; reviewDone: number } {
  const k = dateKey(Date.now(), getSettings().day_cutoff_hour);
  const row = getDb().getFirstSync<{ new_count: number; review_count: number }>(
    'SELECT new_count, review_count FROM daily_stats WHERE date = ?',
    [k]
  );
  return { newDone: row?.new_count ?? 0, reviewDone: row?.review_count ?? 0 };
}

// 构建今日会话：先到期的复习 + 当日新词预算（受 daily_new_limit 约束）。
// 若设置了 study_tag，则只在该标签范围内选词（只背某一纲）。
export function planSession(): { reviews: QueueItem[]; news: QueueItem[] } {
  const s = getSettings();
  const scope = getStudyScope();
  const now = Date.now();
  const { newDone } = getTodayCounts();
  const newBudget = Math.max(0, s.daily_new_limit - newDone);
  const tagFilter = scope.tagId != null ? ' AND w.id IN (SELECT word_id FROM word_tags WHERE tag_id = ?)' : '';
  const tagArgs: number[] = scope.tagId != null ? [scope.tagId] : [];

  const revRows = getDb().getAllSync<any>(
    BASE_SELECT + ` AND c.state <> 'new' AND c.due <= ? ${tagFilter} ORDER BY c.due ASC LIMIT ?`,
    [now, ...tagArgs, s.daily_review_limit]
  );
  const newRows = getDb().getAllSync<any>(
    BASE_SELECT + ` AND c.state = 'new' ${tagFilter} ORDER BY w.frq ASC LIMIT ?`,
    [...tagArgs, newBudget]
  );
  return {
    reviews: revRows.map((r) => rowToItem(r, false)),
    news: newRows.map((r) => rowToItem(r, true)),
  };
}

// 当前学习范围：返回限定标签 id（null=全部）及展示名。
export function getStudyScope(): { tagId: number | null; name: string } {
  const s = getSettings();
  if (s.study_tag == null) return { tagId: null, name: '全部词库' };
  const t = getDb().getFirstSync<{ name: string }>('SELECT name FROM tags WHERE id = ?', [s.study_tag]);
  return { tagId: s.study_tag, name: t?.name ?? '自定义词库' };
}

// 设置学习范围：tagId=null 表示背全部词库。
export function setStudyScope(tagId: number | null): void {
  if (tagId == null) {
    getDb().runSync('DELETE FROM settings WHERE key = ?', ['study_tag']);
  } else {
    getDb().runSync(
      'INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=?',
      ['study_tag', String(tagId), String(tagId)]
    );
  }
}

// 记录一次评分：更新 cards、写入 review_logs、累计 daily_stats。
// 新卡首次评分从空卡开始（首评决定首次 due）。
export function recordGrade(item: QueueItem, rating: Grade): void {
  const now = Date.now();
  const prev = getDb().getFirstSync<DbCard>(
    'SELECT * FROM cards WHERE word_id = ?',
    [item.word_id]
  );
  if (!prev) return;

  const wasNew = prev.state === 'new';
  const sched = wasNew
    ? gradeNewCard(rating, now)
    : gradeCard(prev, rating, now);
  const next = schedToDb(sched, item.word_id, prev.mastered, now);

  getDb().runSync(
    `UPDATE cards SET state=?, due=?, stability=?, difficulty=?, retrievability=?,
       reps=?, lapses=?, elapsed_days=?, scheduled_days=?, last_review_at=?
     WHERE word_id=?`,
    [
      next.state, next.due, next.stability, next.difficulty, next.retrievability,
      next.reps, next.lapses, next.elapsed_days, next.scheduled_days,
      next.last_review_at, item.word_id,
    ]
  );
  getDb().runSync(
    'INSERT INTO review_logs (card_id, reviewed_at, rating, state) VALUES (?,?,?,?)',
    [item.word_id, now, rating, next.state]
  );

  const k = dateKey(now, getSettings().day_cutoff_hour);
  getDb().runSync(
    `INSERT INTO daily_stats (date, new_count, review_count, correct_count, elapsed_ms)
     VALUES (?, ?, ?, 0, 0)
     ON CONFLICT(date) DO UPDATE SET
       new_count = new_count + ?, review_count = review_count + ?`,
    [k, wasNew ? 1 : 0, wasNew ? 0 : 1, wasNew ? 1 : 0, wasNew ? 0 : 1]
  );
}

// 标记一个词为「已掌握」：从学习计划中移除（mastered=1）。用于熟词校准与详情页。
export function markMastered(wordId: number): void {
  getDb().runSync('UPDATE cards SET mastered = 1 WHERE word_id = ?', [wordId]);
}

// 词库（标签）列表，含词数。
export interface TagRow {
  id: number;
  name: string;
  kind: string;
  color: string | null;
  count: number;
}
export function getTags(): TagRow[] {
  return getDb().getAllSync<TagRow>(
    `SELECT t.id, t.name, t.kind, t.color, COUNT(wt.word_id) AS count
     FROM tags t LEFT JOIN word_tags wt ON wt.tag_id = t.id
     GROUP BY t.id, t.name, t.kind, t.color ORDER BY t.sort, t.id`
  );
}

export function getWord(wordId: number): QueueItem | null {
  const r = getDb().getFirstSync<any>(BASE_SELECT + ' AND w.id = ?', [wordId]);
  return r ? rowToItem(r, r.state === 'new') : null;
}

// 词行（词库浏览 / 搜索 / 详情通用）。definition_en 仅详情页使用，列表/搜索可不返回。
export interface WordRow {
  word_id: number;
  word: string;
  phonetic_uk: string | null;
  phonetic_us: string | null;
  definition_zh: string | null;
  definition_en?: string | null;
  pos: string | null;
  root_affix: string | null;
  exam_tags: string | null;
}

// 某标签下的词列表（按词频升序分页）。
export function getTagWords(tagId: number, limit = 200, offset = 0): WordRow[] {
  return getDb().getAllSync<WordRow>(
    `SELECT w.id AS word_id, w.word, w.phonetic_uk, w.phonetic_us,
            w.definition_zh, w.pos, w.root_affix, w.exam_tags
     FROM words w JOIN word_tags wt ON wt.word_id = w.id
     WHERE wt.tag_id = ?
     ORDER BY w.frq ASC LIMIT ? OFFSET ?`,
    [tagId, limit, offset]
  );
}

// 某标签的词数（用于页头展示）。
export function getTagWordCount(tagId: number): number {
  const r = getDb().getFirstSync<{ c: number }>(
    'SELECT COUNT(*) AS c FROM word_tags WHERE tag_id = ?',
    [tagId]
  );
  return r?.c ?? 0;
}

// 全局搜词：子串匹配（已 lower），按词频升序。
export function searchWords(q: string, limit = 60): WordRow[] {
  const like = `%${q.trim().toLowerCase()}%`;
  if (!q.trim()) return [];
  return getDb().getAllSync<WordRow>(
    `SELECT w.id AS word_id, w.word, w.phonetic_uk, w.phonetic_us,
            w.definition_zh, w.pos, w.root_affix, w.exam_tags
     FROM words w
     WHERE lower(w.word) LIKE ?
     ORDER BY w.frq ASC LIMIT ?`,
    [like, limit]
  );
}

// 单词详情（含掌握态），用于详情页。
export function getWordDetail(
  wordId: number
): (WordRow & { mastered: boolean; state: string }) | null {
  const r = getDb().getFirstSync<any>(
    `SELECT w.id AS word_id, w.word, w.phonetic_uk, w.phonetic_us,
            w.definition_zh, w.definition_en, w.pos, w.root_affix, w.exam_tags,
            c.mastered AS mastered, c.state AS state
     FROM words w LEFT JOIN cards c ON c.word_id = w.id
     WHERE w.id = ?`,
    [wordId]
  );
  if (!r) return null;
  return { ...r, mastered: (r.mastered ?? 0) === 1 };
}

export interface ExampleRow {
  sentence_en: string;
  sentence_zh: string | null;
}

// 单词例句（Tatoeba 英中句对，M3.2 离线打包）。按 ord 升序。
// 防御性 try/catch：若本地库尚未换到 v3（缺 examples 表），返回空数组而非崩溃。
export function getExamples(wordId: number, limit = 8): ExampleRow[] {
  try {
    return getDb().getAllSync<ExampleRow>(
      `SELECT sentence_en, sentence_zh FROM examples WHERE word_id = ? ORDER BY ord ASC LIMIT ?`,
      [wordId, limit]
    );
  } catch {
    return [];
  }
}

// 今日首页摘要：新词配额 / 已完成新词 / 待复习数 / 可用新词数 / 当前学习范围。
export function getHomeSummary(): {
  dailyNewLimit: number;
  newDone: number;
  reviewDue: number;
  newAvailable: number;
  scopeName: string;
  isScoped: boolean;
} {
  const s = getSettings();
  const { newDone } = getTodayCounts();
  const { reviews, news } = planSession();
  const scope = getStudyScope();
  return {
    dailyNewLimit: s.daily_new_limit,
    newDone,
    reviewDue: reviews.length,
    newAvailable: news.length,
    scopeName: scope.name,
    isScoped: scope.tagId != null,
  };
}

// 累计已掌握词数（mastered=1）。
export function getMasteredCount(): number {
  const r = getDb().getFirstSync<{ c: number }>(
    'SELECT COUNT(*) AS c FROM cards WHERE mastered = 1'
  );
  return r?.c ?? 0;
}

// 校准样本：从有标签的词里抽 n 个，分层抽样（按词频大致分层）。
export function getCalibrationSample(n: number): QueueItem[] {
  const rows = getDb().getAllSync<any>(
    `SELECT w.id AS word_id, w.word, w.phonetic_uk, w.phonetic_us,
            w.definition_zh, w.definition_en, w.pos, w.root_affix, 'new' AS state
     FROM words w
     WHERE EXISTS (SELECT 1 FROM word_tags wt WHERE wt.word_id = w.id)
     ORDER BY RANDOM() LIMIT ?`,
    [n]
  );
  return rows.map((r) => rowToItem(r, true));
}

// ── 设置：保存部分配置 / 重置已掌握 ──────────────────────────────────────
export function saveSettings(p: Partial<Settings>): void {
  for (const [k, v] of Object.entries(p)) {
    if (v === undefined) continue;
    getDb().runSync('UPDATE settings SET value=? WHERE key=?', [String(v), k]);
  }
}

// 重置「已掌握」：把所有 mastered=1 的词放回学习池（保留原有 FSRS 状态）。
export function resetMastered(): void {
  getDb().runSync('UPDATE cards SET mastered=0 WHERE mastered=1');
}

// ── 自定义词库导入 ───────────────────────────────────────────────────────
// 解析纯文本（换行/空格/逗号/顿号/分号分隔、小写归一）为单词集合，
// 在 words 表精确匹配；匹配到的建（或复用）自定义 tag 并关联、补建 cards。
// 返回命中数、未收录词、tag 信息，供页面反馈。
export function importCustomList(
  name: string,
  raw: string
): { found: number; missing: string[]; tagId: number; tagName: string } {
  const words = Array.from(
    new Set(
      raw
        .split(/[\s,，、;；]+/)
        .map((w) => w.trim().toLowerCase())
        .filter((w) => /^[a-z][a-z'’\-]*$/.test(w))
    )
  );
  const tagName = name.trim() || '自定义词库';
  const exist = getDb().getFirstSync<{ id: number }>(
    'SELECT id FROM tags WHERE name=? AND kind=?',
    [tagName, 'custom']
  );
  let tagId: number;
  if (exist) {
    tagId = exist.id;
  } else {
    getDb().runSync('INSERT INTO tags(name,kind,color,sort) VALUES(?,?,?,?)', [
      tagName,
      'custom',
      '#C0452F',
      90,
    ]);
    tagId = getDb().getFirstSync<{ id: number }>(
      'SELECT id FROM tags WHERE name=? AND kind=? ORDER BY id DESC LIMIT 1',
      [tagName, 'custom']
    )!.id;
  }

  let found = 0;
  const missing: string[] = [];
  for (const w of words) {
    const row = getDb().getFirstSync<{ id: number }>('SELECT id FROM words WHERE word=?', [w]);
    if (!row) {
      missing.push(w);
      continue;
    }
    found++;
    getDb().runSync('INSERT OR IGNORE INTO word_tags(word_id,tag_id) VALUES(?,?)', [row.id, tagId]);
    getDb().runSync(
      `INSERT OR IGNORE INTO cards
        (word_id,state,due,stability,difficulty,retrievability,reps,lapses,elapsed_days,scheduled_days,last_review_at,mastered)
       VALUES (?, 'new', 0, 0,0,0, 0,0,0,0, NULL, 0)`,
      [row.id]
    );
  }
  return { found, missing, tagId, tagName };
}

// ── 全局词汇量测试（分层抽样 + 估算）─────────────────────────────────────
export interface VocabTestItem extends QueueItem {
  band: number; // 频率分层编号（0=最高频）
}
function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
// 按词频排名等分 bands 段，每段随机取 perBand 个，得到分层抽样样本 + 各段词数（用于外推估算）。
export function getVocabTestSample(perBand = 3, bands = 12): {
  items: VocabTestItem[];
  bandSizes: number[];
} {
  const rows = getDb().getAllSync<any>(
    `SELECT w.id AS word_id, w.word, w.phonetic_uk, w.phonetic_us,
            w.definition_zh, w.definition_en, w.pos, w.root_affix, 'new' AS state
     FROM words w ORDER BY w.frq ASC`
  );
  const total = rows.length;
  const bandSize = Math.ceil(total / bands);
  const bandSizes: number[] = [];
  const items: VocabTestItem[] = [];
  for (let i = 0; i < bands; i++) {
    const start = i * bandSize;
    const end = Math.min(total, start + bandSize);
    const seg = rows.slice(start, end);
    bandSizes.push(seg.length);
    const picked = shuffle(seg).slice(0, perBand);
    for (const r of picked) items.push({ ...rowToItem(r, true), band: i });
  }
  return { items, bandSizes };
}
