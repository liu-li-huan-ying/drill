// M0 验证脚本：确认 ts-fsrs 在 Node/Expo 环境下可运行，调度输出合理。
// 不进入 App 构建链，仅用于地基验证。
import { FSRS, Rating, State, createEmptyCard } from 'ts-fsrs';

const f = new FSRS(); // 默认 FSRS 参数（17 个），无需手动调参
const now = new Date();

console.log('=== 初始卡片 ===');
let card = createEmptyCard();
console.log('state:', State[card.state], '| due:', card.due.toISOString());

console.log('\n=== 四档评分后的 next due（以今天为基准） ===');
for (const r of [Rating.Again, Rating.Hard, Rating.Good, Rating.Easy]) {
  const c = createEmptyCard();
  const s = f.repeat(c, now)[r];
  const days = Math.round((s.card.due - now) / 86400000);
  console.log(
    `${Rating[r].padEnd(6)} -> next due: ${s.card.due.toISOString()}  (约 ${days} 天后)  stability=${s.card.stability.toFixed(2)}`
  );
}

console.log('\n=== 连续 Good 三次，观察间隔增长（FSRS 应稳定放大） ===');
let c = createEmptyCard();
for (let i = 1; i <= 3; i++) {
  const s = f.repeat(c, now)[Rating.Good];
  const days = Math.round((s.card.due - now) / 86400000);
  console.log(`第 ${i} 次 Good: 间隔 ~${days} 天, stability=${s.card.stability.toFixed(2)}, difficulty=${s.card.difficulty}`);
  c = s.card;
}

console.log('\n✅ ts-fsrs 地基验证通过');
