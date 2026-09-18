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
    bg: '#F7F4ED', sf: '#FDFCFA', pg: '#EFEBE3',
    tx1: '#171512', tx2: '#6E675E', tx3: '#A29A8E', bd: '#E9E3D8', bd2: '#DAD3C5',
    ac: '#A8382A', acsf: '#F8EEEA', acon: '#FFFFFF',
    b1: '#F8EEEA', b1t: '#A8382A', b2: '#F2EFE7', b3: '#F4F3ED', b4: '#EBEEE5',
  },
  dark: {
    bg: '#131211', sf: '#1B1A18', pg: '#0D0C0B',
    tx1: '#F0EBE2', tx2: '#A69E93', tx3: '#736C62', bd: '#2A2722', bd2: '#494337',
    ac: '#D0684F', acsf: '#2D201B', acon: '#131211',
    b1: '#2D201B', b1t: '#D0684F', b2: '#252320', b3: '#232522', b4: '#212420',
  },
};

// 字体栈：单词 / 标题用衬线，UI 用无衬线，音标用等宽。
// 英文衬线在前，中文衬线（思源宋体 / 宋体）在后 fallback —— 这样英文走 Iowan/Georgia，中文走宋体。
export const serif =
  'Iowan Old Style, Palatino Linotype, Georgia, Times New Roman, Noto Serif, Source Han Serif SC, Noto Serif CJK SC, Songti SC, SimSun, serif';
export const mono = 'SF Mono, Roboto Mono, DejaVu Sans Mono, monospace';

// 字号阶梯（sp）
export const FONT = {
  cardWord: 48, // 复习卡正面单词（臣服原则：单词是唯一主角）
  detailWord: 34, // 详情页单词
  test: 36, // 校准词
  wordSm: 27, // 背面单词 / 统计数字
  title: 25, // 页面标题（含中文）
  hero: 46, // 统计页连续天数等 hero 数字
  ring: 58, // 首页刻度环中心数字
  def: 16.5, // 中文释义
  quote: 14, // 英文例句（斜体）
  body: 15, // 列表
  label: 10.5, // 小标签
  ipa: 13, // 音标
};

// 四档评分：条长即下次间隔。条长按「实际间隔的对数刻度」在 min..max 之间取值，
// 端点固定、中间单调 —— 这样不同卡的条长比例是真实的，而不是四条固定宽度。
export const RATING_LABELS = ['重来', '困难', '良好', '简单'] as const;
export const RATING_BAR = { min: 14, max: 66 } as const;

// ────────────────────────────────────────────────────────────
// 尺度系统（体系第二支柱）
//
// 建立动因是审查实证，不是预防性抽象：全量扫描 app/ 后发现
//   - border-radius 出现 2/4/5/6/8/9.5/10/12/20/22 共 10 种，
//     其中 12 出现 5 次、直接超出设计文档规定的 6/8/10 上限
//   - 控件高度出现 38/42/44/46/48/50/52/54 共 8 种
//   - padding 取 10/14/18/22 等脱离 4dp 网格的值
// 每个文件各写各的 → 同一 App 内界面互不相认。以下尺度是唯一取值来源。
// ────────────────────────────────────────────────────────────

// 圆角：只此七档。圆形一律用 pill，不再出现 20/22/9.5 这类随直径手算的值。
export const RADIUS = {
  mark: 1, // 方块标记 .mk（朱批印记）
  bar: 2, // 进度条 / 细条
  xs: 4, // 打卡日历格、小方块
  chip: 6, // 小标签、词性角标
  ctrl: 10, // 按钮、输入框
  card: 12, // 卡片（v3 原型定案；旧值 10 偏硬、12 起才有「纸的柔」）
  pill: 999, // 圆形 / 胶囊：声波钮、头像、圆点
} as const;

// 间距：4dp 基础网格。现有 10/14/18/22 一律就近归并到偶数档。
export const SPACE = {
  hair: 1, // hairline
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20, // 页面左右边距（设计文档规定）
  xxl: 24,
  xxxl: 32,
  huge: 40,
  touch: 48, // 最小触摸目标
} as const;

// 控件高度：现有 8 种归并为 4 档。
export const CONTROL = {
  sm: 38, // 次级行内控件
  md: 44, // 常规按钮 / 输入
  lg: 50, // 主行动按钮
  xl: 54, // 首页 CTA
} as const;

// 动效时长（ms）。曲线不在常量里 —— RN 的 Easing 需从 react-native 导入，
// 保持本文件零依赖。曲线规范见设计文档「动效」一节：纸感，慢而稳，无回弹。
export const MOTION = {
  press: 120, // 按压反馈
  fade: 200, // 淡入淡出、内容替换
  flip: 500, // 卡片翻转（设计文档规定）
  sheet: 280, // 浮层进出
  // tab 切换：**内容位移与朱痕滑动必须同一时长**——它们表达的是同一个动作，
  // 一个 150ms 一个 380ms 会让人感觉「界面先跳过去、光标随后追上来」，这正是「切换不舒服」的来源。
  tab: 300,
} as const;

// 字重：三级（2026-09-18 定案，**推翻**此前「中文层级不靠字重」的结论）。
// 正文长文用 regular；标签 / 按钮 / 标题 / 数字 / tab 标签用 semibold ——
// 中文 Regular 在屏显下细弱显廉价，而靠拉宽字距装层级只会更散，两者叠加就是廉价感来源。
export const WEIGHT = {
  regular: '400',
  medium: '500', // 列表项、次要值、tab 未选
  semibold: '600', // 标签、按钮、标题、数字、tab 选中
} as const;

// 抬升（纸感）：卡片是「压在纸上的另一张纸」——1px 描边 + 极短阴影，不用大投影。
// 暗色下不投影（纸落在墨上，靠描边分层），由组件按 scheme 决定是否应用。
export const SHADOW = {
  card: {
    shadowColor: '#171512',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  overlay: {
    shadowColor: '#171512',
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
} as const;

// 层级：材质靠「描边 + 极轻抬升」表达，不靠色彩、不靠大阴影。
// 值为 elevation（Android）；iOS 走同档极轻 shadow。
export const LAYER = {
  flat: 0, // 页面底：无抬升
  card: 1, // 卡片：1px 描边
  overlay: 3, // 浮层：描边 + 抬升
} as const;
