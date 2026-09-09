// 朱批设计令牌 —— 与 docs/ui-prototype.html 的 CSS 变量一一对应。
// 安卓端：1dp = 1px，字号即 sp。所有数值直接当作 dp/sp 用。

export type Scheme = 'light' | 'dark';

export interface Tokens {
  bg: string; // 页面底色（纸/墨）
  sf: string; // 卡片面
  pg: string; // 机身 / 分组底
  tx1: string; // 主文本
  tx2: string; // 次要文本
  tx3: string; // 弱化文本
  bd: string; // hairline 分割线
  bd2: string; // 描边
  ac: string; // 朱砂强调
  acsf: string; // 朱砂浅底
  acon: string; // 朱砂上的文字
  b1: string; // 评分·重来底
  b1t: string; // 评分·重来字
  b2: string; // 评分·困难底
  b3: string; // 评分·良好底
  b4: string; // 评分·简单底
}

export const tokens: Record<Scheme, Tokens> = {
  light: {
    bg: '#FBF9F5', sf: '#FFFFFF', pg: '#F2EFE8',
    tx1: '#1B1917', tx2: '#6E6862', tx3: '#A89F94', bd: '#E7E2D8', bd2: '#D8D2C6',
    ac: '#C0452F', acsf: '#F7EBE6', acon: '#FFFFFF',
    b1: '#F7EBE6', b1t: '#C0452F', b2: '#F2EEE5', b3: '#F5F3EC', b4: '#EAEDE4',
  },
  dark: {
    bg: '#141311', sf: '#1C1A17', pg: '#0E0D0C',
    tx1: '#EDE8DE', tx2: '#A79F94', tx3: '#6F685E', bd: '#2C2925', bd2: '#3A362F',
    ac: '#E0705A', acsf: '#2E211C', acon: '#141311',
    b1: '#2E211C', b1t: '#E0705A', b2: '#262320', b3: '#242720', b4: '#212420',
  },
};

// 字体栈：单词 / 标题用衬线，UI 用无衬线，音标用等宽。
// 英文衬线在前，中文衬线（思源宋体 / 宋体）在后 fallback —— 这样英文走 Iowan/Georgia，中文走宋体。
export const serif =
  'Iowan Old Style, Palatino Linotype, Georgia, Times New Roman, Noto Serif, Source Han Serif SC, Noto Serif CJK SC, Songti SC, SimSun, serif';
export const mono = 'SF Mono, Roboto Mono, DejaVu Sans Mono, monospace';

// 字号阶梯（sp）
export const FONT = {
  word: 42, // 复习/新词卡单词
  test: 36, // 校准词
  wordSm: 27, // 背面单词 / 统计数字
  title: 25, // 页面标题（含中文）
  def: 16.5, // 中文释义
  quote: 14, // 英文例句（斜体）
  body: 15, // 列表
  label: 10.5, // 小标签
  ipa: 13, // 音标
};

// 四档评分：条长即下次间隔（dp）
export const RATING_BARS = [14, 26, 42, 66] as const;
export const RATING_LABELS = ['重来', '困难', '良好', '简单'] as const;
export const RATING_INTERVALS = ['10 分钟', '1 天', '4 天', '12 天'] as const;
