// FSRS 调度封装。ts-fsrs v5.4：
//   - createEmptyCard 是顶层函数（非实例方法）
//   - 评分用 f.next(card, now, grade)，返回 RecordLogItem（含 .card）
//   - Card 含 learning_steps，无 retrievability（留存率由 get_retrievability 计算）
import { FSRS, createEmptyCard, State, type Grade, type Card, type RecordLogItem } from 'ts-fsrs';

// 与数据库表 cards 字段一一对应（due / last_review_at 以毫秒时间戳存储）。
export interface DbCard {
  word_id: number;
  state: string; // 'new' | 'learning' | 'review' | 'relearning'
  due: number; // epoch ms
  stability: number;
  difficulty: number;
  retrievability: number;
  reps: number;
  lapses: number;
  elapsed_days: number;
  scheduled_days: number;
  learning_steps: number;
  last_review_at: number | null;
  mastered: number; // 0 / 1
}

// State 枚举（ts-fsrs v5 为 0 起始）：New=0, Learning=1, Review=2, Relearning=3。
// DB 存储字符串与之一一对应：'new' | 'learning' | 'review' | 'relearning'。
// 注意：早期版本误按 1 起始做 `-1/+1` 偏移，会把 Learning 写成 'new'，
// 导致评分后的新卡仍留在 new 池、次日（或退出重进）又从第一个开始学。已修正为直接下标映射。
const STATE_NAMES = ['new', 'learning', 'review', 'relearning'] as const;

export function stateName(s: State): string {
  return STATE_NAMES[s as number] ?? 'new';
}
export function stateFromName(n: string): State {
  const i = STATE_NAMES.indexOf(n as (typeof STATE_NAMES)[number]);
  return ((i < 0 ? 0 : i)) as State;
}

// 默认目标留存率 0.9（设置页可调）。此处取默认值，运行时从 settings 读取覆盖。
const fsrs = new FSRS({ request_retention: 0.9 });
type Sched = RecordLogItem;

export function newFsrsCard(now: number): Card {
  return createEmptyCard(new Date(now));
}

// DbCard -> ts-fsrs Card（补齐 learning_steps 等必填字段）。
export function dbToFsrs(c: DbCard): Card {
  return {
    due: new Date(c.due || Date.now()),
    stability: c.stability,
    difficulty: c.difficulty,
    elapsed_days: c.elapsed_days,
    scheduled_days: c.scheduled_days,
    learning_steps: c.learning_steps,
    reps: c.reps,
    lapses: c.lapses,
    state: stateFromName(c.state),
    last_review: c.last_review_at ? new Date(c.last_review_at) : undefined,
  };
}

// 对一张已有卡评分，返回调度结果（含更新后的 Card）。
export function gradeCard(c: DbCard, rating: Grade, now: number): Sched {
  return fsrs.next(dbToFsrs(c), new Date(now), rating);
}

// 新卡首次评分：从空卡开始，首评决定首次 due。
export function gradeNewCard(rating: Grade, now: number): Sched {
  return fsrs.next(newFsrsCard(now), new Date(now), rating);
}

// 把调度结果写回 DbCard 字段。retrievability 由 FSRS 即时计算快照。
export function schedToDb(sched: Sched, wordId: number, mastered: number, now: number): DbCard {
  const c = sched.card;
  const retrievability = fsrs.get_retrievability(c, new Date(now), false) as number;
  return {
    word_id: wordId,
    state: stateName(c.state),
    due: c.due.getTime(),
    stability: c.stability,
    difficulty: c.difficulty,
    retrievability,
    reps: c.reps,
    lapses: c.lapses,
    elapsed_days: c.elapsed_days,
    scheduled_days: c.scheduled_days,
    learning_steps: c.learning_steps,
    last_review_at: c.last_review ? c.last_review.getTime() : now,
    mastered,
  };
}

// ── 四档间隔预览 ──────────────────────────────────────────────────────────
// 评分条上写的间隔必须是这张卡真实的下次间隔 —— 设计体系里「条长即间隔」，
// 写死的固定文案会让条长编码变成假的（不同卡的实际间隔差着数量级）。
export interface IntervalPreview {
  label: string; // 人类可读：'10 分钟' / '1 天' / '3 个月'
  minutes: number; // 分钟数，供条长按对数刻度换算
}

// 毫秒 → 人类可读间隔。刻意只给一位有效数字：这是量级提示，不是精确时刻。
function formatInterval(ms: number): string {
  const min = ms / 60000;
  if (min < 60) return `${Math.max(1, Math.round(min))} 分钟`;
  const h = min / 60;
  if (h < 24) return `${Math.round(h)} 小时`;
  const d = h / 24;
  if (d < 30) return `${Math.round(d)} 天`;
  const mo = d / 30;
  if (mo < 12) return `${Math.round(mo)} 个月`;
  return `${(d / 365).toFixed(1)} 年`;
}

// 给定一张卡的当前状态，预览四档评分（1..4）各自会把它推到多久之后。
// 新卡（state='new'）走 gradeNewCard —— 与 recordGrade 的分支保持一致，否则预览会骗人。
export function previewIntervals(card: DbCard, now: number): IntervalPreview[] {
  const grades: Grade[] = [1, 2, 3, 4];
  return grades.map((g) => {
    const sched = card.state === 'new' ? gradeNewCard(g, now) : gradeCard(card, g, now);
    const ms = Math.max(0, sched.card.due.getTime() - now);
    return { label: formatInterval(ms), minutes: ms / 60000 };
  });
}

