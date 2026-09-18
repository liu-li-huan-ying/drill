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

// 动效曲线：**唯一来源**。曲线以贝塞尔控制点的形式导出（四个数），
// 用的时候 `Easing.bezier(...EASE)` —— 这样本文件仍然零依赖，而全项目只有两条曲线。
//
// 为什么必须收敛到两条：动效的廉价感八成来自「每条动效各用一个 ease」——
// 页面用 inOut、按钮用默认、印章用另一个，它们单看都还行，放在一起就散。
// 纸与墨的动作只有两种：
//   EASE        主曲线：起步快、收尾长 —— 东西被推了一下，自己减速停住（无过冲，纸不会弹）。
//   EASE_SETTLE 落印曲线：起步更急、收尾更缓 —— 印章落下只有一次，要「啪」地定住。
export const EASE = [0.32, 0.72, 0.28, 1] as const;
export const EASE_SETTLE = [0.22, 1, 0.36, 1] as const;

// 动效时长（ms）。只有五档，且每一档都对应一种**语义**，不是随手取值。
export const MOTION = {
  press: 120, // 按压反馈
  fade: 200, // 淡入淡出、内容替换
  flip: 500, // 卡片翻转（设计文档规定）
  sheet: 280, // 浮层进出
  // tab 切换：**内容位移与朱痕滑动必须同一时长**——它们表达的是同一个动作，
  // 一个 150ms 一个 380ms 会让人感觉「界面先跳过去、光标随后追上来」，这正是「切换不舒服」的来源。
  tab: 300,
  // 纵深屏内容入场：卡片由原生栈推进（这份动效是系统给的，我们改不了），
  // 内容是**我们自己能设计的那一层** —— 让它比卡片晚半拍「显影落定」，页面才不像一块被推过来的硬纸板。
  enter: 240,
  // 落印：全产品唯一的高潮动作（完成屏盖印），比其它动效慢，因为它只发生一次。
  seal: 520,
} as const;

// 同级切换时内容平移的距离（dp）。
// 原型页间位移用 18dp；tab 之间要更轻 —— 同级是「换个角度」，不是「走进下一页」。
// 内置 shift 预设用 ±50dp（整页滑过去），与这个语义不符，已在 tabs 里用自定义插值器替换。
export const TAB_SLIDE = 14;

// 字重：三级（2026-09-18 定案，**推翻**此前「中文层级不靠字重」的结论）。
// 正文长文用 regular；标签 / 按钮 / 标题 / 数字 / tab 标签用 semibold ——
// 中文 Regular 在屏显下细弱显廉价，而靠拉宽字距装层级只会更散，两者叠加就是廉价感来源。
export const WEIGHT = {
  regular: '400',
  medium: '500', // 列表项、次要值、tab 未选
  semibold: '600', // 标签、按钮、标题、数字、tab 选中
} as const;

// 抬升（纸感）：卡片是「压在纸上的另一张纸」，**只靠两件事**表达 ——
//   ① 面比底亮一档（亮：sf `#FDFCFA` 压在 bg `#F7F4ED` 上；暗：sf `#1B1A18` 浮在 bg `#131211` 上）
//   ② 1px 描边（`--bd`）
//
// ── 为什么全项目不用投影（2026-09-18 定案，主人反馈「统计 / 设置切换时各个框的阴影显示很久」）
//   · Android 的 `elevation` 是**平台投影**，不是可调样式：RN 只映射 `shadowColor`（API 28+），
//     `shadowOpacity / shadowRadius / shadowOffset` 在安卓上**被忽略**。也就是说设计稿里写的
//     「5% 极轻阴影」在真机上根本不存在，落地的是平台自己那层重得多的黑边。
//   · 更要命的是它**不随祖先的 opacity 交叉淡入消隐**：tab 切换时两层场景叠着淡入淡出，
//     投影由平台在阴影层单独绘制，旧屏卡片的投影会滞留在新屏上 —— 看起来就是「阴影显示很久」。
//   · 结果「一套令牌两端表现不一致」：iOS 有柔和阴影、Android 是一层滞后的黑边。
//   · 而且纸本来就没有会动的影子 —— 抬升语义用「面底色分级 + 描边」表达，与 §9.3 版框同源。
// 故删掉 `SHADOW` / `LAYER` 两个令牌（后者只是 elevation 的档位命名，随之一并作废）。
