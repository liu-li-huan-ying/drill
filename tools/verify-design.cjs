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

check('完成屏可滚动（短屏不裁）', /<ScrollView/.test(read('src/features/review/DoneView.tsx')), 'DoneView');
check('长词自适应（不挤出卡外）', /adjustsFontSizeToFit/.test(read('src/features/review/ReviewCard.tsx')), 'numberOfLines=2');
check('刻度环按视口定尺', /size=\{ringSize\}/.test(read('app/(tabs)/index.tsx')), 'ringSize');
check('日历宽度按容器算（≤336）', /maxWidth: calW/.test(read('app/(tabs)/stats.tsx')), 'calW');

// ── 输出 ──────────────────────────────────────────────────────────────
console.log(results.map(([p, n, d]) => `${p ? '✓' : '✗'} ${n}  —— ${d}`).join('\n'));
const fail = results.filter(([p]) => !p).length;
console.log(fail === 0 ? `\n全部 ${results.length} 条通过` : `\n${fail}/${results.length} 条未通过`);
process.exitCode = fail ? 1 : 0;
