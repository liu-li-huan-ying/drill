// 设计体系自检（可在任何改动后跑一次：`npm run verify`）
//
// 为什么要这个脚本：设计体系的失效方式不是「报错」，是**悄悄退化** ——
// 有人顺手写回一个 `paddingTop: 52`、一个 `#C0452F`、一个 `height: 54`，
// 代码照样跑、tsc 照样过，只有真机上才看得出「怎么又不对了」。
// 所以把已经踩过的判据写成断言，改坏就红。
//
// 断言分四组：令牌纪律 / 尺度纪律 / 弹性布局 / 转场与长内容。
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

// 动作按钮不得顶满整行 —— 容器宽度不等于按钮宽度（主人：「左边顶到头右边顶到尾的丑按钮」）。
const scopeBlock = (code('app/wordlist.tsx').match(/scopeBtn: \{[\s\S]*?\n  \}/) || [''])[0];
check(
  '行内动作按钮不顶满整行',
  /alignSelf: 'center'/.test(scopeBlock) && /minWidth: \d+/.test(scopeBlock),
  'scopeBtn: 居中 + minWidth'
);

// ── 7. 可见性（对比度）────────────────────────────────────────────────
// 「代码里写了 `c.tx2`」不等于「看得见」——决定看不看得见的是它对底色的对比度。
// 这一条是被真事逼出来的：词库条色用过 `bd2`，而轨道是 `pg`，两者对比度只有 **1.25:1**，
// 于是 8 行「量度」画了等于没画，整屏只剩浅灰（主人：「都是灰的，死气沉沉」）。
// 下限取 3:1：量度条 / 方印都是图形不是正文，WCAG 对非文本图形的要求就是 3:1。
const tok = read('src/theme/tokens.ts');
const blocks = {
  light: tok.slice(tok.indexOf('light: {'), tok.indexOf('dark: {')),
  dark: tok.slice(tok.indexOf('dark: {')),
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
// 每对 [名称, 前色, 底色, 下限]。
// 下限分两档：**前景压背景**（文字 / 描边）取 3:1；**同一条上的两段**（填充 vs 轨道）取 2.5:1 ——
// 后者不是前景/背景关系，且两段色相相距很远（朱砂 vs 墨/描边），2.5 再加色相差已足够分辨；
// 暗色下 ac/bd2 实测 2.70（再抬轨道就与页面底色分不开了）。
const PAIRS = [
  ['名称 tx1/bg', 'tx1', 'bg', 3],
  ['词数 tx2/bg', 'tx2', 'bg', 3],
  ['方印描边 tx2/bg', 'tx2', 'bg', 3],
  ['量度条 tx2/bd2', 'tx2', 'bd2', 2.5],
  ['选中条 ac/bd2', 'ac', 'bd2', 2.5],
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
check('对比度达标（前景 3:1 / 同条两段 2.5:1）', dim.length === 0, dim.join(', ') || `${PAIRS.length * 2} 对达标`);

// ── 输出 ──────────────────────────────────────────────────────────────
console.log(results.map(([p, n, d]) => `${p ? '✓' : '✗'} ${n}  —— ${d}`).join('\n'));
const fail = results.filter(([p]) => !p).length;
console.log(fail === 0 ? `\n全部 ${results.length} 条通过` : `\n${fail}/${results.length} 条未通过`);
process.exitCode = fail ? 1 : 0;
