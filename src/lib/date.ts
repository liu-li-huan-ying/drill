// 以「每日分界」为界生成日期键。设置项 day_cutoff_hour 默认 04:00：
// 当天 04:00 之前属于「前一天」。
export function dateKey(now: number, cutoffHour = 4): string {
  const d = new Date(now - cutoffHour * 3600_000);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
