// 设计体系自检（可在任何改动后跑一次：`npm run verify`）
//
// 为什么要这个脚本：设计体系的失效方式不是「报错」，是**悄悄退化** ——
// 有人顺手写回一个 `paddingTop: 52`、一个 `#C0452F`、一个 `height: 54`，
// 代码照样跑、tsc 照样过，只有真机上才看得出「怎么又不对了」。
// 所以把已经踩过的判据写成断言，改坏就红。
//
// 断言分组：1 令牌纪律 / 2 尺度纪律 / 3 弹性布局 / 4 转场与长内容 /
//           5 转场不露白与曲线唯一来源 / 6 抬升·量度·动作按钮 /
//           6b 数字的排版契约 / 6c 字距纪律 / 6d 品牌锚点（朱砂 + 印章）/
//           7 可见性（对比度实算）。
const fs = require('fs');
const path = require('path');

const SKIP = /node_modules|\.git|android|ios|\.tmp_|tools\/cache/;
function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name).replace(/\\/g, '/');
    if (e.isDirectory()) {
      if (!SKIP.test(p)) walk(p, out);
    } else if (/\.(ts|tsx)$/.test(e.name)) out.push(p);
  }
  return out;
}

const files = [...walk('app'), ...walk('src')];
const read = (f) => fs.readFileSync(f, 'utf8');
// 断言只看代码，不看注释 —— 注释里常要引用「旧的坏写法」来说明为什么改。
const code = (f) =>
  read(f)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((l) => !/^\s*(\/\/|\*)/.test(l))
    .join('\n');

const results = [];
const check = (name, pass, detail) => results.push([!!pass, name, detail || '']);

// ── 1. 令牌纪律 ────────────────────────────────────────────────────────
const HEX_OK = ['src/theme/tokens.ts', 'src/db/queries.ts']; // 令牌本身 + 落库色常量
const hexBad = files.filter((f) => !HEX_OK.includes(f) && /#[0-9a-fA-F]{3,8}\b/.test(code(f)));
check('无硬编码色（走 useTheme 令牌）', hexBad.length === 0, hexBad.join(',') || '零残留');

const wBad = files.filter((f) => /fontWeight: '\d+'/.test(code(f)));
check('无裸字重（走 WEIGHT）', wBad.length === 0, wBad.join(',') || '零残留');

const rBad = files.filter((f) => /borderRadius: (?!RADIUS\.)[\d.]+/.test(code(f)));
check('无裸圆角（走 RADIUS 档位）', rBad.length === 0, rBad.join(',') || '零残留');

// ── 2. 尺度纪律 ────────────────────────────────────────────────────────
// 装文字的控件用 minHeight：RN 的 Text 默认跟随系统字号，固定高度 + 大字号 = 裁掉半行。
const hBad = files.filter((f) => /height: CONTROL\./.test(code(f)));
check('控件容器无固定 height（用 minHeight）', hBad.length === 0, hBad.join(',') || '零残留');

// ── 3. 弹性布局（多机型） ──────────────────────────────────────────────
const STACK = ['app/word.tsx', 'app/wordlist.tsx', 'app/notes.tsx', 'app/import.tsx', 'app/backup.tsx', 'app/calibration.tsx', 'app/vocabtest.tsx', 'app/review.tsx'];
const TABS = ['app/(tabs)/index.tsx', 'app/(tabs)/stats.tsx', 'app/(tabs)/library.tsx', 'app/(tabs)/settings.tsx'];
const BOTTOM_CTA = ['app/word.tsx', 'app/calibration.tsx', 'app/vocabtest.tsx', 'app/review.tsx', 'src/features/review/DoneView.tsx'];

const soft = [...STACK, ...TABS].filter((f) => /paddingTop: (52|56|60)\b/.test(code(f)));
check('无写死的顶部留白（走 useTopPad / 安全区）', soft.length === 0, soft.join(',') || '零残留');

const noTop = STACK.filter((f) => !/paddingTop: topPad/.test(code(f)));
check('8 个栈屏接 useTopPad', noTop.length === 0, noTop.join(',') || `${STACK.length}/${STACK.length}`);

const noSide = STACK.filter((f) => !/paddingHorizontal: side/.test(code(f)));
check('栈屏根容器接 useSideInset（宽屏收列）', noSide.length === 0, noSide.join(',') || `${STACK.length}/${STACK.length}`);

const noGut = TABS.filter((f) => !/paddingHorizontal: gutter/.test(code(f)));
check('tabs 屏根容器接 useGutter', noGut.length === 0, noGut.join(',') || `${TABS.length}/${TABS.length}`);

const noBot = BOTTOM_CTA.filter((f) => !/bottomPad/.test(code(f)));
check('底部 CTA 避让手势条', noBot.length === 0, noBot.join(',') || `${BOTTOM_CTA.length}/${BOTTOM_CTA.length}`);

const layout = read('src/lib/layout.ts');
check(
  '弹性基元齐备（且手机恒零变化）',
  ['useTopPad', 'useSideInset', 'useGutter', 'useBottomPad'].every((h) => layout.includes(`export function ${h}`)) &&
    /CONTENT_MAX = 520/.test(layout) &&
    /Math\.max\(0, Math\.round\(\(width - CONTENT_MAX\) \/ 2\)\)/.test(layout) && // side 下限为 0 = 手机上零变化
    /Math\.max\(SPACE\.xl, Math\.round\(\(width - CONTENT_MAX\) \/ 2\)\)/.test(layout), // gutter 下限为 20
  '5 个基元 / CONTENT_MAX 520 / 下限 0 与 20'
);

// ── 4. 转场与长内容 ────────────────────────────────────────────────────
const root = code('app/_layout.tsx');
const tabL = code('app/(tabs)/_layout.tsx');
check(
  '宽屏时栏也收进内容列（天头 + 底部栏）',
  /useSideInset/.test(code('src/components/ui/index.tsx')) &&
    /maxWidth: CONTENT_MAX/.test(tabL) &&
    /side \+ \(state\.index/.test(tabL), // 朱痕的位移要跟着收列后的格子算，否则会偏出去
  'BrandBar + TabBar'
);
check('Stack 指定转场方向', /animation: 'ios_from_right'/.test(root), '前进右入 / 返回自动反向');
check(
  'Stack 声明全部路由',
  ['(tabs)', 'review', 'calibration', 'vocabtest', 'wordlist', 'word', 'notes', 'import', 'backup'].every((n) => root.includes(`name="${n}"`)),
  '9 条'
);
check('tab 切换有动效', /animation: 'shift'/.test(tabL) && /transitionSpec: SWITCH/.test(tabL), 'shift + transitionSpec');
check('tab 预挂载（消除首切掉帧）', /lazy: false/.test(tabL), 'lazy:false');
check('朱痕与内容位移同一时长', (tabL.match(/MOTION\.tab/g) || []).length === 2 && /tab: 300/.test(read('src/theme/tokens.ts')), 'MOTION.tab = 300 × 2');

// ── 5. 转场：不露白 + 曲线唯一来源 ─────────────────────────────────────
// 白光的根因是「透光」：场景/卡片没有底色，交叉淡入时透过去看到原生窗口的白。
check(
  '转场三层底色都钉住（不露白）',
  /contentStyle: \{ backgroundColor: c\.bg \}/.test(root) && // 原生栈卡片
    /sceneStyle: \{ backgroundColor: c\.bg \}/.test(tabL) && // tab 场景
    /flex: 1, backgroundColor: c\.bg/.test(tabL), // tabs 布局根容器
  'Stack.contentStyle + Tabs.sceneStyle + 根 View'
);
check(
  '同级切换用自定义插值器（不是内置 ±50dp）',
  /sceneStyleInterpolator/.test(tabL) && /TAB_SLIDE/.test(tabL) && /makeTabScene/.test(tabL),
  '纸页轻推 14dp + 交叉淡入'
);
check(
  '动效曲线唯一来源（无手写贝塞尔数字）',
  files.every((f) => !/Easing\.bezier\(\s*\d/.test(code(f))),
  'EASE / EASE_SETTLE 走 tokens'
);
check(
  '纵深屏内容入场 + 减弱动效',
  STACK.every((f) => /<PageEnter/.test(code(f))) &&
    /useReducedMotion/.test(read('src/lib/motion.ts')) &&
    /reduce/.test(tabL),
  '8 屏 PageEnter / reduce-motion 分支'
);

check('完成屏可滚动（短屏不裁）', /<ScrollView/.test(read('src/features/review/DoneView.tsx')), 'DoneView');
check('长词自适应（不挤出卡外）', /adjustsFontSizeToFit/.test(read('src/features/review/ReviewCard.tsx')), 'numberOfLines=2');
check('刻度环按视口定尺', /size=\{ringSize\}/.test(read('app/(tabs)/index.tsx')), 'ringSize');
check('日历宽度按容器算（≤336）', /maxWidth: calW/.test(read('app/(tabs)/stats.tsx')), 'calW');

// ── 6. 抬升 / 量度 / 动作按钮（2026-09-18 第二轮验收） ────────────────
// 投影在 Android 上是**平台阴影**：shadowOpacity / shadowRadius 被忽略，而且它
// **不随祖先 opacity 的交叉淡入消隐** → tab 切换时旧屏卡片的投影滞留在新屏上
// （主人原话：「统计和设置切换的时候各个框的阴影会显示很久」）。
// 故抬升一律用「面比底亮一档 + 1px 描边」，令牌层删掉 SHADOW / LAYER。
check(
  '不用投影（改用面底色分级 + 描边）',
  files.every((f) => !/elevation: [1-9]/.test(code(f))) && files.every((f) => !/SHADOW/.test(code(f))),
  '0 处 elevation / 0 处 SHADOW'
);

// 词库每行的「量度」必须看得见：条色曾取 bd2，而轨道是 pg —— 两者只差一档明度，
// 于是 8 行条长画了等于没画，整屏只剩浅灰（主人：「都是灰的，死气沉沉」）。
// 判据：表示量级的填充必须落在**墨阶**上（tx2 及以上），描边色不得当填充用。
check(
  '词库细条用墨阶填充（不是描边色）',
  /active \? c\.ac : c\.tx2/.test(code('app/(tabs)/library.tsx')),
  'barFill: ac / tx2'
);

// 量度条的**轨道**取 pg（机身底）而不是描边色 bd2：轨道是凹槽，凹槽要比纸面暗一档才对，
// 而 bd2 与填充只差一档明度（实测条/轨 3.7:1），pg 把它抬到约 4.7:1（暗 5.9:1）。
check(
  '量度条轨道取 pg（凹槽色）',
  /barTrack, \{ backgroundColor: c\.pg \}/.test(code('app/(tabs)/library.tsx')) &&
    !/barTrack, \{ backgroundColor: c\.bd2 \}/.test(code('app/(tabs)/library.tsx')) &&
    /track, \{ backgroundColor: c\.pg \}/.test(code('app/(tabs)/stats.tsx')),
  '词库 barTrack + 统计 track 均为 pg'
);

// 动作按钮不得顶满整行 —— 容器宽度不等于按钮宽度（主人：「左边顶到头右边顶到尾的丑按钮」）。
const scopeBlock = (code('app/wordlist.tsx').match(/scopeBtn: \{[\s\S]*?\n  \}/) || [''])[0];
check(
  '行内动作按钮不顶满整行',
  /alignSelf: 'center'/.test(scopeBlock) && /minWidth: \d+/.test(scopeBlock),
  'scopeBtn: 居中 + minWidth'
);

// ── 色彩工具（对比度 + 色相）─────────────────────────────────────────
// 分块取 tokens.ts 的 light / dark 两段，后面的断言全部从这里读实际取值 ——
// 「令牌改了就重新算」，而不是让断言记着一组会过期的旧数字。
const tokText = read('src/theme/tokens.ts');
const blocks = {
  light: tokText.slice(tokText.indexOf('light: {'), tokText.indexOf('dark: {')),
  dark: tokText.slice(tokText.indexOf('dark: {')),
};
const hexIn = (blk, k) => {
  const m = blk.match(new RegExp(`\\b${k}: '(#[0-9A-Fa-f]{6})'`));
  return m ? m[1] : null;
};
const chan = (v) => {
  const c = v / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};
const lum = (h) => {
  const n = parseInt(h.slice(1), 16);
  return 0.2126 * chan((n >> 16) & 255) + 0.7152 * chan((n >> 8) & 255) + 0.0722 * chan(n & 255);
};
const cr = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};
const rgbOf = (h) => {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
// HSL 色相（度）。用来钉住「深色朱砂只提明度、不偏色相」。
const hueOf = (h) => {
  const [r, g, b] = rgbOf(h).map((v) => v / 255);
  const mx = Math.max(r, g, b);
  const mn = Math.min(r, g, b);
  const d = mx - mn;
  if (d === 0) return 0;
  const x = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return (x * 60 + 360) % 360;
};
const lightOf = (h) => {
  const [r, g, b] = rgbOf(h).map((v) => v / 255);
  return (Math.max(r, g, b) + Math.min(r, g, b)) / 2;
};

// ── 6b. 数字的排版契约（P0.1，2026-09-18） ──────────────────────────────
// 主人反馈「大数字折行」。折行不是「排版挤了一点」—— 它把一个值读成两个
// （`1000` 断成 10 / 00，`18 词` 断成 18 / 词）。所以数字必须有唯一入口，
// 而不是每个屏各写各的 `<Text>{n}</Text>`。
const NUM_SCREENS = [
  'app/(tabs)/stats.tsx', 'app/(tabs)/library.tsx', 'app/(tabs)/index.tsx', 'app/(tabs)/settings.tsx',
  'src/features/review/DoneView.tsx', 'app/wordlist.tsx', 'app/notes.tsx',
  'app/vocabtest.tsx', 'app/calibration.tsx', 'app/import.tsx',
];
const uiCode = code('src/components/ui/index.tsx');
// 按「下一个 export」切片而不是按 `\n}` 匹配：props 的解构参数以 `}) {` 收尾，
// 那个 `\n}` 会被惰性匹配当成分界（实测截断在参数表上）。
const between = (s, from, to) => {
  const a = s.indexOf(from);
  if (a < 0) return '';
  const b = to ? s.indexOf(to, a + from.length) : -1;
  return s.slice(a, b < 0 ? s.length : b);
};
const numBlock = between(uiCode, 'export function Num(', 'export function NumUnit(');
const numUnitBlock = between(uiCode, 'export function NumUnit(', 'export function SoundIcon(');

check(
  '数字契约三件套齐备（单行 / 自动缩字 / 等宽数位）',
  /numberOfLines=\{1\}/.test(numBlock) &&
    /adjustsFontSizeToFit/.test(numBlock) &&
    /minimumFontScale/.test(numBlock) &&
    /tabular-nums/.test(uiCode),
  'numberOfLines={1} + adjustsFontSizeToFit + tabular-nums'
);

check(
  '数字有唯一入口（Num / NumUnit）',
  /export function Num\(/.test(uiCode) && /export function NumUnit\(/.test(uiCode) && NUM_SCREENS.every((f) => files.includes(f)),
  `${NUM_SCREENS.length} 屏可用`
);

// 裸渲染 = 一个读数直接当 `<Text>` 的全部子节点（`>{total}<`）。这类写法绕开了三件套，
// 也正是折行 bug 的现场。词库页的「已装载 30,565 词」就是被这一条抓住的。
const BARE = />\s*\{\s*(?:s\.\w+|total|value|mastered|d\.count|results\.length|known|items\.length|sample\.length|rows\.length)\s*\}\s*</;
const bare = NUM_SCREENS.filter((f) => BARE.test(code(f)));
check('读数不裸渲染（必须走 Num）', bare.length === 0, bare.join(',') || '0 处裸渲染');

// 千分位必须自己算：Hermes 的 Intl 跟随系统区域，同一串数字在部分地区会输出 `30 565`，
// 而这里的数字是**读数**，分隔符必须恒为逗号。
check(
  '千分位自己算（不用区域相关的 toLocaleString）',
  /export function fmtNum/.test(read('src/lib/num.ts')) &&
    files.every((f) => !/toLocaleString/.test(code(f))),
  'fmtNum 手写 / 0 处 toLocaleString'
);

// 数字与单位：单位贴**基线**（不是底部），且单位永不参与压缩（被挤掉后「1000」与「1000 万」同形）。
check(
  '数字与单位基线对齐（单位小一档且不被压缩）',
  /alignItems: 'baseline'/.test(numUnitBlock) &&
    /flexShrink: 0/.test(numUnitBlock) &&
    /fontSize: FONT\.unit/.test(numUnitBlock),
  'NumUnit: baseline + unit flexShrink 0'
);

// ── 6c. 字距纪律（P1.1） ───────────────────────────────────────────────
// 宽字距是**小标签**的排版语汇。旧代码把它用在按钮文案（1.5）与大标题（3）上，
// 字与字之间空到能塞进另一个字（主人：「收敛字距」）。
// 报纸法则里 tracking 随字号**反向**变化 —— 字越大，字距越要收。
const bareTrack = files.filter((f) => f !== 'src/theme/tokens.ts' && /letterSpacing: -?[\d.]+/.test(code(f)));
check('无裸字距（走 TRACK 档位）', bareTrack.length === 0, bareTrack.join(',') || '0 处裸字距');

check(
  '字距五档齐备且宽档只给标签',
  ['tight:', 'body:', 'title:', 'label:', 'caps:'].every((k) => tokText.includes(k)) &&
    /btnText: \{[^}]*letterSpacing: TRACK\.body/.test(uiCode) &&
    /label: \{[^}]*letterSpacing: TRACK\.label/.test(uiCode) &&
    /kicker: \{[^}]*letterSpacing: TRACK\.caps/.test(uiCode),
  'TRACK 五档 / 按钮走 body / 标签走 label'
);

// ── 6d. 品牌锚点：朱砂 + 印章（P2，2026-09-18） ────────────────────────
// 朱砂色相守恒：深色模式的强调色**只许提明度，不许偏色相**。
// 旧暗色 ac `#D0684F` 的色相是 11.6°，而亮色 `#A8382A` 是 6.67° —— 偏了 5 度落到「橙」一侧，
// 于是深色模式里所有朱砂都读成了珊瑚橙（主人原话）。这条断言从此钉住色相。
const acL = hexIn(blocks.light, 'ac');
const acD = hexIn(blocks.dark, 'ac');
const dHue = Math.abs(hueOf(acL) - hueOf(acD));
check(
  '朱砂色相守恒（深色只提明度不偏色相）',
  dHue <= 2 && lightOf(acD) > lightOf(acL),
  `色相差 ${dHue.toFixed(2)}° / 明度 ${lightOf(acL).toFixed(2)}→${lightOf(acD).toFixed(2)}`
);

// 「墨纸」不是「黑板」：暗色底必须**暖**（R 明显大于 B）且不能是纯黑。
// 旧值 `#131211` 的 R−B 只有 2、R 只有 19 —— 那就是纯黑，纸没有纯黑的。
const bgL = hexIn(blocks.dark, 'bg');
const bgRGB = rgbOf(bgL);
check(
  '暗色底是墨纸（暖 + 非纯黑 + 三通道同源）',
  bgRGB[0] >= 24 && bgRGB[0] - bgRGB[2] >= 4 && Math.max(...bgRGB) - Math.min(...bgRGB) <= 24,
  `${bgL} R−B=${bgRGB[0] - bgRGB[2]}`
);

// 打卡日历印章化：格子不再是「填色方块」，量级落在**印记**上。
//
// 2026-09-18 改写（旧断言保护的正是被主人推翻的做法）：
// 第一版把浓度编码成**印面大小**（6 → 10.8dp）。主人的反驳一句到位：
// 「大小绝对是要一样大的，不然大大小小放一起很不好看」。这条异议背后是更硬的编码原则 ——
// **重复出现、且必须并排比较的元素，不能用尺寸编码差异**：日历里 30 格是一排读数，
// 尺寸一多样，眼睛比的是「哪个更大」，而不是「哪天的墨更重」；何况相邻两档只差 1.6dp，
// 比大小本身也不成立。于是改成**同尺寸 + 墨量分档**（细边朱文 / 粗边朱文 / 满墨白文）。
//
// 判据因此从「有 stampSize 这个函数」反过来变成「全屏只有一个尺寸取值」。
// 旧断言会替坏设计站岗 —— 这是这条断言必须改写而不只是补一条的原因。
const statsCode = code('app/(tabs)/stats.tsx');
const stampSizeArgs = statsCode.match(/\bsize=\{[^}]*\}/g) || [];
check(
  '打卡印记尺寸唯一（浓度靠墨量，不靠大小）',
  /stampInk\(/.test(statsCode) &&
    stampSizeArgs.length > 0 &&
    stampSizeArgs.every((s) => s === 'size={STAMP.size}') &&
    /StampInk/.test(uiCode) &&
    /\(\[1, 2, 3\] as const\)/.test(statsCode) &&
    // 「按档位算尺寸」这个做法整体删掉：令牌里不许再有 stampSize，
    // 否则下一个改这屏的人会顺手把它用回来。
    !/stampSize/.test(statsCode) &&
    !/stampSize/.test(tokText),
  `印记 size 参数只有 ${'size={STAMP.size}'} 一种（共 ${stampSizeArgs.length} 处）/ 图例三档与日历同源`
);

// 一周以**周一**为始，且三处同一套约定（日历表头 / 本周柱状图 / 本周进度）。
check(
  '一周以周一为始（三处一致）',
  /mondayOffset/.test(read('src/db/queries.ts')) &&
    /const WEEKDAYS = \['一'/.test(statsCode) &&
    /export function getWeekHistory/.test(read('src/db/queries.ts')),
  'mondayOffset + WEEKDAYS[0]=一 + getWeekHistory'
);

// 「小数值条看不见」的另一半：只有几个词的档位也必须画出来（最小条宽）。
check('小数值条有最小宽度', /Math\.max\(2, \(d\.count \/ distMax\)/.test(statsCode), 'min 2%');

// 落印：**三段独立时长**（落 / 压 / 收），不是一条曲线上的多个插值停点。
//
// 2026-09-18 改写（旧断言保护的正是被主人推翻的做法）：
// 旧做法把 `stamp` 0→1 交给一条 EASE_SETTLE 急收曲线跑满 520ms，再用停止点
// [0, .72, .88, 1] 表达「落 / 触纸 / 回弹 / 定住」，断言也就写了「STOPS 落 72%」。
// 主人的反馈：「根本和描述完全不符，看起来只是屏幕抖动了一下」。
// 原因是可测的：cubic-bezier(.22,1,.36,1) 前 20% 的时间走完约 80% 路程，
// 于是停点 .72 落在约第 15ms（≈1 帧）；更要命的是旧 `sealStyle` 里**根本没有 translateY** ——
// 「落」从未被表达，屏幕上唯一在动的就是那 1.6dp 的纸面微震。
//
// 判据的核心因此只有一句：**「落」这一段有没有位移**。
// 配套三条：三段各自有自己的 duration；微震从触纸（sealFall 结束）起算；
// 令牌里不许再有 SEAL_IMPACT（防止有人顺着旧名字把插值停点写回来）。
const doneCode = code('src/features/review/DoneView.tsx');
check(
  '落印分三段（落/压/收）+ 下落有位移 + 微震自触纸起算',
  /MOTION\.sealFall/.test(doneCode) &&
    /MOTION\.sealPress/.test(doneCode) &&
    /MOTION\.sealSettle/.test(doneCode) &&
    /translateY: drop\.interpolate/.test(doneCode) &&
    /scale: drop\.interpolate/.test(doneCode) &&
    /easeFall\(\)/.test(doneCode) &&
    /Animated\.delay\(MOTION\.sealFall\)/.test(doneCode) &&
    !/STOPS/.test(doneCode) &&
    !/SEAL_IMPACT/.test(tokText) &&
    /sealFall: 200/.test(tokText) && /sealPress: 90/.test(tokText) && /sealSettle: 170/.test(tokText) &&
    /shock: 220/.test(tokText),
  'sealFall/Press/Settle 三段各自 duration + translateY 下落 + 微震 delay = sealFall'
);

// 动效语汇：**「写」与「盖」是两种动作**，混用会让品牌语言失效（主人：「很多动效可以
// 结合朱批和盖章这两个行为去延伸拓展」）。判据只有一句 ——
// **这个动效是在「写」还是在「盖」？**
//   写 = 人的动作，有过程、有方向、可撤销 → 慢、线性展开、留锋（详情页朱笔横痕 width 0→168）
//   盖 = 确认，已成事实、不可撤销     → 快、瞬时压印、不留过程（词库「在背」、日历印记 scale 压到 1）
// 三种时长也各自成对：stroke 260（写）> sealTamp 150（钤）> 落印的三段（盖的高潮）。
check(
  '朱批动效语汇：写用展开、盖用钤下（两者不混用）',
  /outputRange: \[0, STROKE_W\]/.test(code('app/word.tsx')) &&
    /useNativeDriver: false/.test(code('app/word.tsx')) &&
    /MOTION\.sealTamp/.test(code('app/(tabs)/library.tsx')) &&
    /MOTION\.sealTamp/.test(statsCode) &&
    /sealTamp: 150/.test(tokText) && /stroke: 260/.test(tokText) &&
    /EASE_FALL/.test(tokText) && /EASE_FALL/.test(read('src/lib/motion.ts')),
  '详情页 width 展开（写）/ 词库 + 日历 scale 钤下（盖）/ EASE_FALL 落体曲线'
);

// **渲染期读库 = 过期快照**（这一条是真事逼出来的，也是本仓库复用过的同一个坑）：
// tab 屏切走不卸载、切回不重挂载 —— 任何在渲染期一次性求值的、「别处可改」的值，
// 都会永远停在首次挂载那一刻。学习范围在词单页改过之后，回到词库看「在背」的朱砂标记
// **永远不会出现**（主人：「预览里显示选择辞书会用红色标记，但实际并没有看到这个效果」）。
// 判据：三个读库的 tab 屏，查询函数只允许出现在 useState 初值或 useFocusEffect 回调里，
// 不许出现 `const x = getXxx()` 这种渲染期直读。
const TAB_DATA = ['app/(tabs)/index.tsx', 'app/(tabs)/library.tsx', 'app/(tabs)/stats.tsx'];
const staleRead = [];
for (const f of TAB_DATA) {
  const t = code(f);
  if (!/useFocusEffect/.test(t)) staleRead.push(`${f}: 无 useFocusEffect`);
  if (/\bconst \w+ = (?:get|search)[A-Z]\w*\(/.test(t)) staleRead.push(`${f}: 渲染期直读`);
}
check(
  'tab 屏不存过期快照（聚焦重读 + 无渲染期直读）',
  staleRead.length === 0,
  staleRead.join(', ') || '3 屏均聚焦重读，零渲染期直读'
);

// 出口层级：主操作实心、次操作文字链。平级按钮会让「该点哪个」变成一道选择题（P1.7）。
check(
  '完成屏主次出口拉开层级',
  /<Btn title="看看坚持了多久" onPress=\{onStats\}/.test(doneCode) &&
    !/variant="outline"/.test(doneCode) &&
    /styles\.link/.test(doneCode),
  '主=实心 Btn / 次=文字链'
);

// 喇叭图标：整 App 只有一个定义（P0.3）。
// 旧写法是「圆环套实心圆点」，那在图形语言里是「录制 / 状态灯」，没有一个读音叫「播放」——
// 图标是这个按钮唯一的文案，认错就等于功能不存在。四处复制 = 四处可能改漏。
const dupSound = files.filter(
  (f) => f !== 'src/components/ui/index.tsx' && (/function SoundIcon/.test(code(f)) || /soundInner/.test(code(f)))
);
check('喇叭图标唯一来源', /export function SoundIcon/.test(uiCode) && dupSound.length === 0, dupSound.join(',') || '1 处定义 / 0 处复制');

// 喇叭图标的几何（P0.3 的复核）：截图实测出来的三条硬约束，任何一条破了图标就认不出来。
// ① 喇叭口是梯形 —— 上张口「borderLeft 透明 + borderBottom 着色」、下张口镜像；
//    若两处都靠 borderLeft 着色，画出来是「▶ 播放键」。
// ② 声波是弧 —— 圆形只留 borderRight 得到 90° 弧；出现 rotate 就说明退回了菱形环老画法。
// ③ 14px 及以下只留一道弧，两道在这个尺寸会糊成色点。
const soundBlock = between(uiCode, 'export function SoundIcon(', 'export function RowItem(');
check(
  '喇叭图标几何正确（梯形口 / 圆弧 / 小尺寸降级）',
  /borderBottomColor: color/.test(soundBlock) &&
    /borderTopColor: color/.test(soundBlock) &&
    (soundBlock.match(/borderLeftColor: 'transparent'/g) || []).length === 2 &&
    /borderRightColor: color/.test(soundBlock) &&
    !/rotate/.test(soundBlock) &&
    /size < 16/.test(soundBlock),
  '梯形口 2 处 / 圆弧 / 无旋转方角 / <16px 单弧'
);

// 斜体只留给例句原文（P1.3）：给释义也套斜体，例句就失去了它唯一的视觉身份。
// 取 DefinitionView 的整段调用（`raw={...definition_en}` 到 `/>`），断言里面没有 fontStyle。
const enDefWord = (code('app/word.tsx').match(/<DefinitionView[\s\S]{0,200}?definition_en[\s\S]{0,300}?\/>/) || [''])[0];
const enDefCard = (code('src/features/review/ReviewCard.tsx').match(/<DefinitionView[\s\S]{0,200}?definition_en[\s\S]{0,300}?\/>/) || [''])[0];
check(
  '斜体只留给例句原文',
  enDefWord !== '' && !/fontStyle/.test(enDefWord) &&
    enDefCard !== '' && !/fontStyle/.test(enDefCard) &&
    /exEn: \{[^}]*fontStyle: 'italic'/.test(code('app/word.tsx')) &&
    /quote: \{[^}]*fontStyle: 'italic'/.test(code('src/features/review/ReviewCard.tsx')) &&
    !/fontStyle/.test(code('app/notes.tsx')),
  '释义无斜体 / 例句保留（单词页 + 复习卡）/ 空态不斜体'
);

// 词性只在词头出现一次（P1.4）：`n.` 是词级属性，不是义项级属性。
check(
  '词性只出现一次 + 义项编号列表',
  /export function parseSense/.test(read('src/components/Definition.tsx')) &&
    /stripPos/.test(read('src/components/Definition.tsx')) &&
    /numbered[\s\S]{0,80}stripPos=\{Boolean\(detail\.pos\)\}/.test(code('app/word.tsx')),
  'parseSense + stripPos + numbered'
);

// ── 7. 可见性（对比度）────────────────────────────────────────────────
// 「代码里写了 `c.tx2`」不等于「看得见」——决定看不看得见的是它对底色的对比度。
// 这一条是被真事逼出来的：词库条色用过 `bd2`，而轨道是 `pg`，两者对比度只有 **1.25:1**，
// 于是 8 行「量度」画了等于没画，整屏只剩浅灰（主人：「都是灰的，死气沉沉」）。
//
// 本轮把下限统一抬到 4.5:1（原为前景 3 / 同条 2.5）：
//   · P1.3 明确要求音标与英文释义 ≥4.5:1（它们在深色下都落在卡面 sf 上，是最紧的一对）；
//   · 朱砂在深色模式下同时是**文字色**（「撤销」「加载更多」「在背」），不到 4.5 就不成立；
//   · 轨道改取 pg 之后，条/轨这对也够得到 4.5 —— 下限有富余时就不该退而求其次。
// 唯一的例外仍是**非文本图形**可以低到 3:1，但本项目现在已经不需要这个豁免。
const PAIRS = [
  ['正文 tx1/bg', 'tx1', 'bg', 4.5],
  ['次要 tx2/bg', 'tx2', 'bg', 4.5],
  ['音标·释义 tx2/sf', 'tx2', 'sf', 4.5],
  ['朱砂字 ac/bg', 'ac', 'bg', 4.5],
  ['朱砂上字 acon/ac', 'acon', 'ac', 4.5],
  ['量度条 tx2/pg', 'tx2', 'pg', 4.5],
  ['选中条 ac/pg', 'ac', 'pg', 4.5],
];
const dim = [];
for (const [scheme, blk] of Object.entries(blocks)) {
  for (const [name, fg, bg, min] of PAIRS) {
    const a = hexIn(blk, fg);
    const b = hexIn(blk, bg);
    if (!a || !b) {
      dim.push(`${scheme}/${name}(取不到令牌)`);
      continue;
    }
    const r = cr(a, b);
    if (r < min) dim.push(`${scheme}/${name}=${r.toFixed(2)}:1<${min}`);
  }
}
check('对比度达标（全部 4.5:1）', dim.length === 0, dim.join(', ') || `${PAIRS.length * 2} 对达标`);

// ── 输出 ──────────────────────────────────────────────────────────────
console.log(results.map(([p, n, d]) => `${p ? '✓' : '✗'} ${n}  —— ${d}`).join('\n'));
const fail = results.filter(([p]) => !p).length;
console.log(fail === 0 ? `\n全部 ${results.length} 条通过` : `\n${fail}/${results.length} 条未通过`);
process.exitCode = fail ? 1 : 0;
