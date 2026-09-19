// 业务查询：构建今日队列、记录评分、读写设置、取词库/单词。
// 复习候选池 = 拥有标签且 mastered=0 的词（见 对抗式审查 C1 结论）。
import { getDb } from './Database';
import { dateKey } from '../lib/date';
import { gradeCard, gradeNewCard, schedToDb, type DbCard } from '../srs/fsrs';
import { decompose, type Morphology } from '../lib/morphology';
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
  // 复习方式：0 = 自评四档，1 = 选择题（默认）。
  // 默认选择题的理由见 `ChoiceQuiz`：自评里「我记得了」永远是最省力的那一档，
  // 于是每一张卡都被评成学会 —— 遗忘曲线在数据上跑着，在体验上等于没有。
  quiz_mode: number;
}

const BASE_SELECT = `
  SELECT w.id AS word_id, w.word, w.phonetic_uk, w.phonetic_us,
         w.definition_zh, w.definition_en, w.pos, w.root_affix, c.state
  FROM cards c JOIN words w ON w.id = c.word_id
  WHERE c.mastered = 0 `;

// 新词专用：多取一列 w.frq —— 分层抽样要按词频切档（见 stratifyByFrequency）。
const NEW_SELECT = `
  SELECT w.id AS word_id, w.word, w.phonetic_uk, w.phonetic_us,
         w.definition_zh, w.definition_en, w.pos, w.root_affix, c.state, w.frq
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
    quiz_mode: parseInt(map.quiz_mode ?? '1', 10) === 0 ? 0 : 1,
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

// ── 每日计划的编排 ──────────────────────────────────────────────────────────
// 两条原则：
//   1. 不按难易排成一列 —— 一天之内要难易参杂（分层抽新词 + 新旧交错）。
//   2. 同一天反复打开必须是同一份计划（进度条、重学卡、撤销快照都要对得上）。
//
// 因此所有随机都走「日种子」而不是 SQL 的 RANDOM()：RANDOM() 每次调用都是新结果，
// 刷一次屏就换一份计划，重学卡接回队尾时会对不上号。

// 日种子：日期键 → FNV-1a 哈希。跨过 cutoff 时刻换一天，种子随之改变。
function daySeed(): number {
  const key = dateKey(Date.now(), getSettings().day_cutoff_hour);
  let h = 2166136261 >>> 0;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) % 100003;
}

// mulberry32：由日种子驱动的一串 [0,1)。同一天 → 同一串数 → 同一份计划。
function makeRand(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffleSeeded<T>(a: T[], rand: () => number): T[] {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const t = a[i];
    a[i] = a[j];
    a[j] = t;
  }
  return a;
}

// 新词按词频切 5 档，每档轮流出一张。
// 旧写法 ORDER BY w.frq ASC 会把当天新词全压在最常用那一档：20 张里全是 the/be/and/of，
// 一整筐难度完全同质。分档轮流后实测 20 张铺在 frq 1.2k~27k，常用与生僻交替出现。
const NEW_BANDS = 5;
// 候选池相对预算的倍数：池子要够大，分档后每档才有的可选；再小也要装得下一轮分档。
const NEW_POOL_FACTOR = 6;

function stratifyByFrequency(rows: any[], budget: number, rand: () => number): any[] {
  if (rows.length <= budget) return rows;
  const sorted = rows.slice().sort((a, b) => (a.frq ?? 1e9) - (b.frq ?? 1e9));
  const buckets: any[][] = Array.from({ length: NEW_BANDS }, () => []);
  sorted.forEach((r, i) => {
    const b = Math.min(NEW_BANDS - 1, Math.floor((i * NEW_BANDS) / sorted.length));
    buckets[b].push(r);
  });
  buckets.forEach((b) => shuffleSeeded(b, rand));
  const out: any[] = [];
  for (let k = 0; out.length < budget; k++) {
    let moved = false;
    for (const b of buckets) {
      if (out.length >= budget) break;
      if (k < b.length) {
        out.push(b[k]);
        moved = true;
      }
    }
    if (!moved) break; // 所有档都取空了
  }
  return out;
}

// 新旧交错：每 step 张复习卡插 1 张新词，间距带 ±1 抖动（抖动也走日种子）。
// 旧写法 [...reviews, ...news] 是「先啃完所有复习、再一口气灌 20 个生词」——
// 后半程一整段全是没见过的词。交错后生词分散在整场里。
export function mixSession(reviews: QueueItem[], news: QueueItem[]): QueueItem[] {
  if (!news.length) return reviews;
  if (!reviews.length) return news;
  const rand = makeRand(daySeed());
  const step = Math.max(1, Math.round(reviews.length / news.length));
  const out: QueueItem[] = [];
  let r = 0;
  let n = 0;
  let left = step; // 先垫一张复习卡当热身，别一上来就是生词
  while (r < reviews.length || n < news.length) {
    if (r < reviews.length && (left > 0 || n >= news.length)) {
      out.push(reviews[r++]);
      left -= 1;
    } else if (n < news.length) {
      out.push(news[n++]);
      left = step + (rand() < 0.5 ? 0 : 1);
    } else break;
  }
  return out;
}

// 构建今日会话：到期的复习 + 当日新词预算（受 daily_new_limit 约束）。
// 若设置了 study_tag，则只在该标签范围内选词（只背某一纲）。
export function planSession(): { reviews: QueueItem[]; news: QueueItem[] } {
  const s = getSettings();
  const scope = getStudyScope();
  const now = Date.now();
  const seed = daySeed();
  const { newDone } = getTodayCounts();
  const newBudget = Math.max(0, s.daily_new_limit - newDone);
  const tagFilter = scope.tagId != null ? ' AND w.id IN (SELECT word_id FROM word_tags WHERE tag_id = ?)' : '';
  const tagArgs: number[] = scope.tagId != null ? [scope.tagId] : [];
  // SQL 里的「日种子打乱」：给每个 id 算一个由种子决定的伪随机序号，用它排序 ——
  // 全表一个确定的排列，不写状态。id 连续时序号跳得很开（实测前 20 个铺满 1k~29k）。
  const SEEDED = '((w.id * 2654435761 + ?) % 104729)';

  // 复习：按到期「日」分桶先后（逾期越久越先），同日之内按日种子打乱。
  // 排序键是时间不是难度 —— 紧急度该尊重，但同一批卡不该天天撞见同一个顺序。
  const revRows = getDb().getAllSync<any>(
    BASE_SELECT + ` AND c.state <> 'new' AND c.due <= ? ${tagFilter}
       ORDER BY CAST(c.due / 86400000 AS INTEGER) ASC,
                ((c.word_id * 2654435761 + ?) % 104729) ASC
       LIMIT ?`,
    [now, ...tagArgs, seed, s.daily_review_limit]
  );
  // 新词：先按日种子抽候选池，再分档轮流取（见 stratifyByFrequency）。
  const poolSize = Math.max(NEW_BANDS * 4, newBudget * NEW_POOL_FACTOR);
  const pool =
    newBudget > 0
      ? getDb().getAllSync<any>(
          NEW_SELECT + ` AND c.state = 'new' ${tagFilter} ORDER BY ${SEEDED} ASC LIMIT ?`,
          [...tagArgs, seed, poolSize]
        )
      : [];

  return {
    reviews: revRows.map((r) => rowToItem(r, false)),
    news: stratifyByFrequency(pool, newBudget, makeRand(seed)).map((r) => rowToItem(r, true)),
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
// 返回一份「评分前快照」——撤销要靠它把三张表一起还原（见 undoGrade）。
export interface GradeSnapshot {
  word_id: number;
  cardBefore: DbCard;
  logId: number;
  date: string;
  wasNew: boolean;
}

export function recordGrade(item: QueueItem, rating: Grade): GradeSnapshot | null {
  const now = Date.now();
  const prev = getDb().getFirstSync<DbCard>(
    'SELECT * FROM cards WHERE word_id = ?',
    [item.word_id]
  );
  if (!prev) return null;

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
  const log = getDb().runSync(
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

  return { word_id: item.word_id, cardBefore: prev, logId: log.lastInsertRowId, date: k, wasNew };
}

// 撤销一次评分：把 cards 还原到评分前，删掉刚写的 review_logs，回退 daily_stats 计数。
// 计数归零的当日行必须删掉 —— 否则它会算作「打过卡的一天」，把连续天数灌水。
export function undoGrade(snap: GradeSnapshot): void {
  const db = getDb();
  const c = snap.cardBefore;
  db.runSync(
    `UPDATE cards SET state=?, due=?, stability=?, difficulty=?, retrievability=?,
       reps=?, lapses=?, elapsed_days=?, scheduled_days=?, last_review_at=?
     WHERE word_id=?`,
    [
      c.state, c.due, c.stability, c.difficulty, c.retrievability,
      c.reps, c.lapses, c.elapsed_days, c.scheduled_days,
      c.last_review_at, snap.word_id,
    ]
  );
  db.runSync('DELETE FROM review_logs WHERE id = ?', [snap.logId]);
  db.runSync(
    `UPDATE daily_stats SET
       new_count = MAX(0, new_count - ?),
       review_count = MAX(0, review_count - ?)
     WHERE date = ?`,
    [snap.wasNew ? 1 : 0, snap.wasNew ? 0 : 1, snap.date]
  );
  db.runSync(
    'DELETE FROM daily_stats WHERE date = ? AND new_count <= 0 AND review_count <= 0',
    [snap.date]
  );
}

// 单卡状态（供评分条做四档间隔预览）。
export function getCard(wordId: number): DbCard | null {
  return getDb().getFirstSync<DbCard>('SELECT * FROM cards WHERE word_id = ?', [wordId]) ?? null;
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
// 全局词汇量（去重词数）。词库头部的「已装载 N 词」应使用此值，
// 而非把各标签词数求和（一个词可属于多个标签，求和会重复计数）。
export function getWordCount(): number {
  const r = getDb().getFirstSync<{ c: number }>('SELECT COUNT(*) AS c FROM words');
  return r?.c ?? 0;
}

// 主题模式：跟随系统 / 浅色 / 深色。持久化到 settings 表（key=theme_mode）。
export type ThemeMode = 'system' | 'light' | 'dark';

export function getThemeMode(): ThemeMode {
  const r = getDb().getFirstSync<{ value: string }>(
    "SELECT value FROM settings WHERE key = 'theme_mode'"
  );
  const v = r?.value;
  return v === 'light' || v === 'dark' || v === 'system' ? v : 'system';
}

export function setThemeMode(mode: ThemeMode): void {
  getDb().runSync(
    `INSERT INTO settings(key, value) VALUES('theme_mode', ?)
     ON CONFLICT(key) DO UPDATE SET value = ?`,
    [mode, mode]
  );
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

// ── M5 统计看板 ────────────────────────────────────────────────────────────
// 把 'YYYY-MM-DD' 日期键整体平移 deltaDays 天（本地日历语义，与 dateKey 一致）。
function shiftDateKey(key: string, deltaDays: number): string {
  const [y, m, d] = key.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + deltaDays);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

// 连续打卡：从今天（或昨天，若今天尚未学习）往前数连续有 daily_stats 记录的天数。
export function getStreak(): number {
  const cutoff = getSettings().day_cutoff_hour;
  const rows = getDb().getAllSync<{ date: string }>(
    'SELECT date FROM daily_stats ORDER BY date DESC'
  );
  const dates = new Set(rows.map((r) => r.date));
  if (dates.size === 0) return 0;
  const todayKey = dateKey(Date.now(), cutoff);
  // 今天没学则允许从昨天起算（仍视为连续），但今天若学了则必须包含今天。
  let cursor = dates.has(todayKey) ? todayKey : shiftDateKey(todayKey, -1);
  let streak = 0;
  while (dates.has(cursor)) {
    streak++;
    cursor = shiftDateKey(cursor, -1);
  }
  return streak;
}

// 近 N 日每日新学/复习量（含未学习日的 0 值），用于趋势条。
export function getDailyHistory(days = 7): { date: string; new_count: number; review_count: number }[] {
  const cutoff = getSettings().day_cutoff_hour;
  const todayKey = dateKey(Date.now(), cutoff);
  const byDate = new Map<string, { new_count: number; review_count: number }>();
  getDb()
    .getAllSync<{ date: string; new_count: number; review_count: number }>(
      'SELECT date, new_count, review_count FROM daily_stats ORDER BY date ASC'
    )
    .forEach((r) => byDate.set(r.date, { new_count: r.new_count, review_count: r.review_count }));
  const out: { date: string; new_count: number; review_count: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const k = shiftDateKey(todayKey, -i);
    const v = byDate.get(k);
    out.push({ date: k, new_count: v?.new_count ?? 0, review_count: v?.review_count ?? 0 });
  }
  return out;
}

// ── 日历类统计 ────────────────────────────────────────────────────────────
// 看板要按「周 / 月」做日历运算，集中取一次全部打卡日，避免反复扫表。
function learnedDates(): string[] {
  return getDb()
    .getAllSync<{ date: string }>('SELECT date FROM daily_stats ORDER BY date ASC')
    .map((r) => r.date);
}

// 'YYYY-MM-DD' → 星期几（0=周日）。JS 的 getDay 以周日为 0，而**本 App 的一周从周一算起**
// （P1.6：主人反馈近 7 日柱状图要周一开始）—— 转换只此一处，别在调用点各算各的。
function weekdayOf(key: string): number {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d).getDay();
}

/** 周一为一周之始时的「周内偏移」：周一 0 … 周日 6。 */
function mondayOffset(key: string): number {
  return (weekdayOf(key) + 6) % 7;
}

/**
 * 本周（周一 → 周日）的每日学习量，固定 7 条。
 *
 * 与 `getDailyHistory` 的区别是**窗口的锚点**：后者是「滚动近 N 天」（结尾永远是今天），
 * 前者是「本自然周」（结尾永远是周日，未到的日子给 0）。
 * 柱状图要读的是「这一周走到哪了」，锚点必须是周一 —— 滚动窗口每周会漂一格，
 * 读者永远不知道第一根柱子是星期几（这正是 P1.6 要修的东西）。
 */
export function getWeekHistory(): { date: string; new_count: number; review_count: number }[] {
  const todayKey = dateKey(Date.now(), getSettings().day_cutoff_hour);
  const monday = shiftDateKey(todayKey, -mondayOffset(todayKey));
  const byDate = new Map<string, { new_count: number; review_count: number }>();
  getDb()
    .getAllSync<{ date: string; new_count: number; review_count: number }>(
      'SELECT date, new_count, review_count FROM daily_stats ORDER BY date ASC'
    )
    .forEach((r) => byDate.set(r.date, { new_count: r.new_count, review_count: r.review_count }));
  const out: { date: string; new_count: number; review_count: number }[] = [];
  for (let i = 0; i < 7; i++) {
    const k = shiftDateKey(monday, i);
    const v = byDate.get(k);
    out.push({ date: k, new_count: v?.new_count ?? 0, review_count: v?.review_count ?? 0 });
  }
  return out;
}

// 历史最长连续打卡天数（不只算当前这段）。
export function getLongestStreak(): number {
  let best = 0;
  let run = 0;
  let prev = '';
  for (const d of learnedDates()) {
    run = prev && shiftDateKey(prev, 1) === d ? run + 1 : 1;
    if (run > best) best = run;
    prev = d;
  }
  return best;
}

// 本周打卡进度（**周一**为一周之始，与打卡日历表头 / 近 7 日柱状图同一套）。
// 分母固定 7 —— 「本周」是一整周，还没到的日子就是没打卡。
export function getWeekProgress(): { done: number; total: number } {
  const todayKey = dateKey(Date.now(), getSettings().day_cutoff_hour);
  const dates = new Set(learnedDates());
  const start = shiftDateKey(todayKey, -mondayOffset(todayKey));
  let done = 0;
  for (let i = 0; i < 7; i++) if (dates.has(shiftDateKey(start, i))) done++;
  return { done, total: 7 };
}

// 今日的年 / 月（0 起）/ 日（受每日分界影响），供日历定位「今天」。
export function todayParts(): { year: number; month0: number; day: number } {
  const [y, m, d] = dateKey(Date.now(), getSettings().day_cutoff_hour).split('-').map(Number);
  return { year: y, month0: m - 1, day: d };
}

// 某月的每日学习量（新学 + 复习），0 = 未打卡。用于月度打卡日历。
export function getMonthHistory(year: number, month0: number): { day: number; total: number }[] {
  const days = new Date(year, month0 + 1, 0).getDate();
  const mm = String(month0 + 1).padStart(2, '0');
  const byDay = new Map<number, number>();
  getDb()
    .getAllSync<{ date: string; new_count: number; review_count: number }>(
      'SELECT date, new_count, review_count FROM daily_stats WHERE date >= ? AND date <= ?',
      [`${year}-${mm}-01`, `${year}-${mm}-${String(days).padStart(2, '0')}`]
    )
    .forEach((r) => byDay.set(Number(r.date.slice(8, 10)), r.new_count + r.review_count));
  const out: { day: number; total: number }[] = [];
  for (let d = 1; d <= days; d++) out.push({ day: d, total: byDay.get(d) ?? 0 });
  return out;
}

// 留存率：基于复习日志的四档评分，rating>=3 视为「正确」（Good/Easy），否则未掌握。
export function getRetention(): { total: number; correct: number; rate: number } {
  const row = getDb().getFirstSync<{ total: number; correct: number }>(
    "SELECT COUNT(*) AS total, SUM(CASE WHEN rating >= 3 THEN 1 ELSE 0 END) AS correct FROM review_logs"
  );
  const total = row?.total ?? 0;
  const correct = row?.correct ?? 0;
  return { total, correct, rate: total > 0 ? correct / total : 0 };
}

// 卡片状态分布（new/learning/review/relearning），用于记忆持久度概览。
export function getStateDistribution(): { state: string; count: number }[] {
  return getDb().getAllSync<{ state: string; count: number }>(
    'SELECT state, COUNT(*) AS count FROM cards GROUP BY state ORDER BY count DESC'
  );
}

// 学习总览：总卡片数、已学习卡数（reps>0）、已掌握数。
export function getLearningStats(): { totalCards: number; learned: number; mastered: number } {
  const r = getDb().getFirstSync<{ total: number; learned: number }>(
    "SELECT COUNT(*) AS total, SUM(CASE WHEN reps > 0 THEN 1 ELSE 0 END) AS learned FROM cards"
  );
  return {
    totalCards: r?.total ?? 0,
    learned: r?.learned ?? 0,
    mastered: getMasteredCount(),
  };
}

// ── M5 备份导出 / 导入 ──────────────────────────────────────────────────────
// 备份数据结构（与 backup.tsx 导出一致）。导入侧只认这些字段，缺字段按可选处理。
export interface BackupCard {
  word_id: number;
  state: string;
  due: number;
  stability: number;
  difficulty: number;
  retrievability: number;
  reps: number;
  lapses: number;
  elapsed_days: number;
  scheduled_days: number;
  last_review_at: number | null;
  mastered: number;
}
export interface BackupLog {
  id?: number;
  card_id: number;
  reviewed_at: number;
  rating: number;
  state: string;
  taken_ms?: number | null;
  prev_stability?: number | null;
  prev_difficulty?: number | null;
}
export interface BackupDay {
  date: string;
  new_count: number;
  review_count: number;
  correct_count?: number;
  elapsed_ms?: number;
}
export interface BackupNote {
  word_id: number;
  mnemonic: string | null;
  note: string | null;
  updated_at: number | null;
}
export interface BackupData {
  cards: BackupCard[];
  review_logs: BackupLog[];
  daily_stats: BackupDay[];
  user_notes: BackupNote[];
  settings: { key: string; value: string }[];
}

// 读取全部进度为纯数据对象，供 UI 序列化成 JSON 备份文件。
export function exportBackupData(): BackupData {
  const db = getDb();
  const cards = db.getAllSync<BackupCard>(
    'SELECT word_id, state, due, stability, difficulty, retrievability, reps, lapses, elapsed_days, scheduled_days, last_review_at, mastered FROM cards'
  );
  const review_logs = db.getAllSync<BackupLog>(
    'SELECT id, card_id, reviewed_at, rating, state, taken_ms, prev_stability, prev_difficulty FROM review_logs'
  );
  const daily_stats = db.getAllSync<BackupDay>(
    'SELECT date, new_count, review_count, correct_count, elapsed_ms FROM daily_stats'
  );
  const user_notes = db.getAllSync<BackupNote>(
    'SELECT word_id, mnemonic, note, updated_at FROM user_notes'
  );
  const settings = db.getAllSync<{ key: string; value: string }>('SELECT key, value FROM settings');
  return { cards, review_logs, daily_stats, user_notes, settings };
}

// 合并备份到本地库：cards 按 last_review_at 取新（null 视为旧）、review_logs 追加（主键冲突跳过）、
// daily_stats 按日期累加、user_notes 按 updated_at 取新、settings 覆盖。整批包在事务里，失败回滚。
// 仅导入 words 中存在的词（避免不同词库版本产生的孤儿卡）。
export function restoreBackup(data: BackupData): { cards: number; logs: number; days: number; notes: number } {
  const db = getDb();
  const out = { cards: 0, logs: 0, days: 0, notes: 0 };
  db.execSync('BEGIN');
  try {
    for (const bc of data.cards ?? []) {
      const w = db.getFirstSync<{ id: number }>('SELECT id FROM words WHERE id = ?', [bc.word_id]);
      if (!w) continue;
      const local = db.getFirstSync<{ last_review_at: number | null }>(
        'SELECT last_review_at FROM cards WHERE word_id = ?',
        [bc.word_id]
      );
      if (!local) {
        db.runSync(
          'INSERT INTO cards (word_id,state,due,stability,difficulty,retrievability,reps,lapses,elapsed_days,scheduled_days,last_review_at,mastered) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',
          [bc.word_id, bc.state, bc.due, bc.stability, bc.difficulty, bc.retrievability, bc.reps, bc.lapses, bc.elapsed_days, bc.scheduled_days, bc.last_review_at, bc.mastered]
        );
        out.cards++;
      } else if ((bc.last_review_at ?? 0) > (local.last_review_at ?? 0)) {
        db.runSync(
          'UPDATE cards SET state=?,due=?,stability=?,difficulty=?,retrievability=?,reps=?,lapses=?,elapsed_days=?,scheduled_days=?,last_review_at=?,mastered=? WHERE word_id=?',
          [bc.state, bc.due, bc.stability, bc.difficulty, bc.retrievability, bc.reps, bc.lapses, bc.elapsed_days, bc.scheduled_days, bc.last_review_at, bc.mastered, bc.word_id]
        );
        out.cards++;
      }
    }
    for (const rl of data.review_logs ?? []) {
      db.runSync(
        'INSERT OR IGNORE INTO review_logs (id,card_id,reviewed_at,rating,state,taken_ms,prev_stability,prev_difficulty) VALUES (?,?,?,?,?,?,?,?)',
        [rl.id ?? null, rl.card_id, rl.reviewed_at, rl.rating, rl.state, rl.taken_ms ?? null, rl.prev_stability ?? null, rl.prev_difficulty ?? null]
      );
      out.logs++;
    }
    for (const ds of data.daily_stats ?? []) {
      db.runSync(
        `INSERT INTO daily_stats (date,new_count,review_count,correct_count,elapsed_ms) VALUES (?,?,?,?,?)
         ON CONFLICT(date) DO UPDATE SET
           new_count = new_count + excluded.new_count,
           review_count = review_count + excluded.review_count,
           correct_count = correct_count + COALESCE(excluded.correct_count, 0),
           elapsed_ms = elapsed_ms + COALESCE(excluded.elapsed_ms, 0)`,
        [ds.date, ds.new_count, ds.review_count, ds.correct_count ?? 0, ds.elapsed_ms ?? 0]
      );
      out.days++;
    }
    for (const n of data.user_notes ?? []) {
      const local = db.getFirstSync<{ updated_at: number | null }>(
        'SELECT updated_at FROM user_notes WHERE word_id = ?',
        [n.word_id]
      );
      if (!local) {
        db.runSync('INSERT INTO user_notes (word_id,mnemonic,note,updated_at) VALUES (?,?,?,?)', [
          n.word_id,
          n.mnemonic ?? null,
          n.note ?? null,
          n.updated_at ?? null,
        ]);
        out.notes++;
      } else if ((n.updated_at ?? 0) > (local.updated_at ?? 0)) {
        db.runSync('UPDATE user_notes SET mnemonic=?, note=?, updated_at=? WHERE word_id=?', [
          n.mnemonic ?? null,
          n.note ?? null,
          n.updated_at ?? null,
          n.word_id,
        ]);
        out.notes++;
      }
    }
    for (const s of data.settings ?? []) {
      db.runSync("INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value", [
        s.key,
        s.value,
      ]);
    }
    db.execSync('COMMIT');
  } catch (e) {
    db.execSync('ROLLBACK');
    throw e;
  }
  return out;
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
  // 用 upsert 而不是 UPDATE：新增的设置项（如 quiz_mode）在老库里没有对应行，
  // 只 UPDATE 会静默失败 —— 开关看着能点，值从来没写进去。
  for (const [k, v] of Object.entries(p)) {
    if (v === undefined) continue;
    getDb().runSync(
      'INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=?',
      [k, String(v), String(v)]
    );
  }
}

// ── 选择题干扰项 ──────────────────────────────────────────────────────────
export interface ChoiceOption {
  word_id: number;
  word: string;
  definition_zh: string;
  pos: string | null;
}

// 三个随机干扰项：**同词性优先**。
// 拿一个名词的释义去干扰动词，学习者一眼就排除了 —— 那样的选项只是凑数，测不出「记不记得」。
//
// 词性从**释义文本**里取，不用 `words.pos` 列：该列全表为 NULL（30,565 词无一例外），
// 词性一直写在释义开头（实测 99.7% 的释义以 `n.` / `vt.` / `a.` 这类前缀起头）。
// 顺着数据事实取，而不是顺着列名想当然 —— 否则这段会变成一段永远走不到的代码。
function posPrefix(def: string | null): string | null {
  const m = /^([a-z]{1,6})\.\s/.exec(def ?? '');
  return m ? m[1] : null;
}

export function getDistractors(target: QueueItem, n = 3): ChoiceOption[] {
  const scope = getStudyScope();
  const tagFilter =
    scope.tagId != null ? ' AND w.id IN (SELECT word_id FROM word_tags WHERE tag_id = ?)' : '';
  const tagArgs: any[] = scope.tagId != null ? [scope.tagId] : [];
  const prefix = posPrefix(target.definition_zh);
  const frqRow = getDb().getFirstSync<{ frq: number | null }>('SELECT frq FROM words WHERE id = ?', [
    target.word_id,
  ]);
  const frq = frqRow?.frq ?? null;

  // 形近词排除（part / parts / partial 互为干扰）：选项里出现同根词，考的是拼写不是词义。
  // 只对 ≥4 字母的目标启用 —— 短词（be / of / a）会把一大批正常词误伤掉。
  const guard =
    target.word.length >= 4
      ? " AND NOT (LOWER(w.word) LIKE LOWER(?) || '%' OR LOWER(?) LIKE LOWER(w.word) || '%')"
      : '';
  const guardArgs = target.word.length >= 4 ? [target.word, target.word] : [];

  const base = `SELECT w.id AS word_id, w.word, w.definition_zh, w.pos FROM words w
     WHERE w.id <> ? AND w.definition_zh IS NOT NULL AND w.definition_zh <> '' ${tagFilter}`;

  const pick = (usePos: boolean, band: number | null): ChoiceOption[] => {
    const frqSql = band != null && frq != null ? ' AND COALESCE(w.frq, 999999) BETWEEN ? AND ?' : '';
    const frqArgs = band != null && frq != null ? [frq - band, frq + band] : [];
    const posSql = usePos && prefix ? ' AND w.definition_zh LIKE ?' : '';
    const posArgs = usePos && prefix ? [`${prefix}. %`] : [];
    return getDb()
      .getAllSync<any>(base + frqSql + posSql + guard + ' ORDER BY RANDOM() LIMIT ?', [
        target.word_id,
        ...tagArgs,
        ...frqArgs,
        ...posArgs,
        ...guardArgs,
        n,
      ])
      .map((r) => ({ word_id: r.word_id, word: r.word, definition_zh: r.definition_zh, pos: r.pos }));
  };

  // 由严到宽：**同词性 + 同难度带 → 同词性 → 同难度带 → 随机**。
  // 难度带这条是实测逼出来的：目标 the（frq=1）配上 frq≈30000 的 escarole / echelon，
  // 学习者一眼就排除（压根不认识），四选一变成了送分题。
  const ladder: [boolean, number | null][] = [
    [true, 1500],
    [true, 6000],
    [true, null],
    [false, 1500],
    [false, null],
  ];
  const out: ChoiceOption[] = [];
  for (const [usePos, band] of ladder) {
    if (out.length >= n) break;
    for (const o of pick(usePos, band)) {
      if (out.length >= n) break;
      if (o.word_id === target.word_id || out.some((x) => x.word_id === o.word_id)) continue;
      out.push(o);
    }
  }
  return out;
}

// 重置「已掌握」：把所有 mastered=1 的词放回学习池（保留原有 FSRS 状态）。
export function resetMastered(): void {
  getDb().runSync('UPDATE cards SET mastered=0 WHERE mastered=1');
}

// ── 自定义词库导入 ───────────────────────────────────────────────────────
// 自定义 tag 的落库颜色。取设计令牌的朱砂值——词库列表按「单色体系」渲染，
// 内置 tag 那些 Material 主色（蓝/红/橙/黄…）在界面上已被忽略，这里也不再写旧值 #C0452F。
// 保留字段是为了兼容既有库与其备份（导入导出会带上它）。
const TAG_COLOR_CUSTOM = '#A8382A';

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
      TAG_COLOR_CUSTOM,
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

// ── M6 · 词根词缀（运行时规则拆解）────────────────────────────────────────
// 惰性构建一次「全部单词」集合，供拆解算法验证词干是否为随包词典里的真实单词。
let _wordSet: Set<string> | null = null;
function getWordSet(): Set<string> {
  if (!_wordSet) {
    _wordSet = new Set(
      getDb()
        .getAllSync<{ word: string }>('SELECT word FROM words')
        .map((r) => r.word.toLowerCase())
    );
  }
  return _wordSet;
}

// 把一个单词拆成 前缀/词干/词根/后缀；拆不出（或不可信）返回 null。
export function decomposeWord(word: string): Morphology | null {
  return decompose(word, (w) => getWordSet().has(w));
}

// ── M6 · 手写助记（读写 user_notes，word_id 为 PRIMARY KEY）─────────────
export interface UserNote {
  word_id: number;
  mnemonic: string | null;
  note: string | null;
  updated_at: number | null;
}

export function getUserNote(wordId: number): UserNote | null {
  return (
    getDb().getFirstSync<UserNote>(
      'SELECT word_id, mnemonic, note, updated_at FROM user_notes WHERE word_id = ?',
      [wordId]
    ) ?? null
  );
}

// 保存助记 / 备注。两者皆空则删除该行，不留空记录（保持「有助记才有行」的语义）。
export function saveUserNote(wordId: number, mnemonic: string, note: string): void {
  const m = mnemonic.trim();
  const n = note.trim();
  if (!m && !n) {
    getDb().runSync('DELETE FROM user_notes WHERE word_id = ?', [wordId]);
    return;
  }
  getDb().runSync(
    `INSERT INTO user_notes (word_id, mnemonic, note, updated_at) VALUES (?, ?, ?, ?)
     ON CONFLICT(word_id) DO UPDATE SET
       mnemonic = excluded.mnemonic, note = excluded.note, updated_at = excluded.updated_at`,
    [wordId, m || null, n || null, Date.now()]
  );
}

// 「我的助记」列表 / 检索：有关联词的助记记录。传 q 则按 单词 / 助记 / 备注 模糊匹配。
export interface NoteRow {
  word_id: number;
  word: string;
  phonetic_uk: string | null;
  definition_zh: string | null;
  mnemonic: string | null;
  note: string | null;
  updated_at: number | null;
}

export function getNotes(q = '', limit = 300): NoteRow[] {
  const kw = q.trim().toLowerCase();
  const base = `SELECT n.word_id, w.word, w.phonetic_uk, w.definition_zh,
                       n.mnemonic, n.note, n.updated_at
                FROM user_notes n JOIN words w ON w.id = n.word_id`;
  if (!kw) {
    return getDb().getAllSync<NoteRow>(`${base} ORDER BY n.updated_at DESC LIMIT ?`, [limit]);
  }
  const like = `%${kw}%`;
  return getDb().getAllSync<NoteRow>(
    `${base}
     WHERE lower(w.word) LIKE ?
        OR lower(COALESCE(n.mnemonic, '')) LIKE ?
        OR lower(COALESCE(n.note, '')) LIKE ?
     ORDER BY n.updated_at DESC LIMIT ?`,
    [like, like, like, limit]
  );
}

export function getNoteCount(): number {
  const r = getDb().getFirstSync<{ c: number }>('SELECT COUNT(*) AS c FROM user_notes');
  return r?.c ?? 0;
}
