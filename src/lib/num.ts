// 数字的**排版契约**（P0.1，2026-09-18）。
//
// 为什么单独开一个文件：统计屏上的数字不是「一个值」，是一条**排版规则**，
// 而这条规则有四条腿，缺一条就会在某个屏宽 / 某个系统字号下露出来：
//
//   ① 千分位      —— `30565` 与 `30,565` 的信息量差一个数量级，前者要点着数位读。
//   ② 等宽数位    —— 不设 `tabular-nums` 时 `1` 比 `8` 窄，一串数字跳动、右边缘参差。
//   ③ 单行不折    —— `<Text>` 默认会换行。数字换行不是「排版挤了一点」，
//                    是把一个值读成了两个（`18` / `词` 分家，或 `1000` 断成 `10` `00`）。
//   ④ 不被压缩    —— 在 `space-between` 的行里，数字是最先被挤扁的那一个，
//                    因为它是唯一「看起来还能缩」的元素（字被裁掉半截却没人报错）。
//
// ①②在函数里，③④在 `components/ui` 的 `Num` / `NumUnit` 里 —— 那里才有 Text。
//
// 手写而不是 `toLocaleString()`：Hermes 的 Intl 依赖系统区域设置，
// 同一个 `30565` 在部分地区会输出 `30 565` 或 `30.565`，而这里的数字是**读数**，
// 千分位必须恒为逗号。手写 8 行，行为完全确定。

/** 千分位整数。`30565` → `'30,565'`；负数保留符号。 */
export function fmtNum(n: number): string {
  const neg = n < 0;
  const s = String(Math.round(Math.abs(n)));
  let out = '';
  for (let i = s.length; i > 0; i -= 3) {
    const chunk = i > 3 ? s.slice(i - 3, i) : s.slice(0, i);
    out = out ? `${chunk},${out}` : chunk;
  }
  return neg ? `-${out}` : out;
}

/** 0..1 的比率 → 百分数整数串（`0.923` → `'92%'`）。与 `fmtNum` 同源，只此一处取整。 */
export function fmtPct(rate: number): string {
  return `${Math.round(rate * 100)}%`;
}
