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
