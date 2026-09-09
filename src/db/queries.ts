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
export function planSession(): { reviews: QueueItem[]; news: QueueItem[] } {
  const s = getSettings();
  const now = Date.now();
  const { newDone } = getTodayCounts();
  const newBudget = Math.max(0, s.daily_new_limit - newDone);

  const revRows = getDb().getAllSync<any>(
    BASE_SELECT + ` AND c.state <> 'new' AND c.due <= ? ORDER BY c.due ASC LIMIT ?`,
    [now, s.daily_review_limit]
  );
  const newRows = getDb().getAllSync<any>(
    BASE_SELECT + ` AND c.state = 'new' ORDER BY w.frq ASC LIMIT ?`,
    [newBudget]
  );
  return {
    reviews: revRows.map((r) => rowToItem(r, false)),
    news: newRows.map((r) => rowToItem(r, true)),
  };
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

// 今日首页摘要：新词配额 / 已完成新词 / 待复习数 / 可用新词数。
export function getHomeSummary(): {
  dailyNewLimit: number;
  newDone: number;
  reviewDue: number;
  newAvailable: number;
} {
  const s = getSettings();
  const { newDone } = getTodayCounts();
  const { reviews, news } = planSession();
  return {
    dailyNewLimit: s.daily_new_limit,
    newDone,
    reviewDue: reviews.length,
    newAvailable: news.length,
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
