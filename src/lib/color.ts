// 颜色混合工具。RN 没有 CSS 的 color-mix()，而「同色四档明度」这种编码又必须算出来。
// 两色线性混合：t=0 → from，t=1 → to。
export function mix(from: string, to: string, t: number): string {
  const a = parseHex(from);
  const b = parseHex(to);
  if (!a || !b) return from; // 非 #RRGGBB 一律原样返回，不悄悄给出一个错颜色
  const k = Math.max(0, Math.min(1, t));
  const ch = (i: number) => Math.round(a[i] + (b[i] - a[i]) * k).toString(16).padStart(2, '0');
  return `#${ch(0)}${ch(1)}${ch(2)}`;
}

function parseHex(s: string): [number, number, number] | null {
  const m = /^#([0-9a-f]{6})$/i.exec(s.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
