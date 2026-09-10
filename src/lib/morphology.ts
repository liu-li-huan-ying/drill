// 词根词缀规则拆解（运行时，纯规则表）。
//
// 背景：随包词库的 `words.root_affix` 字段全为 NULL（30565 词无一有值），
// 所以「词根词缀」不能靠读数据，只能按规则在运行时拆。
//
// 策略（保守，宁缺毋滥）：只有当「命中前缀/后缀 + 剩余词干能被词典或词根表验证」
// 时才输出拆解；验证不过就返回 null，界面上不显示，避免给出错误拆解误导记忆。
//
// 精度要点：同一单词往往有多条候选拆法（如 prediction 既可 pre+dice+tion，
// 也可 pre+dict+ion）。做法是给每条候选打分、取最高分，并优先「词根命中」
// ——词根表命中远比「词干恰好是个普通单词」可信（dice / discus / able 这类是假朋友）。

export type PartKind = 'prefix' | 'root' | 'suffix' | 'stem';

export interface Part {
  text: string; // 该段的字面文本（原词里的子串）
  kind: PartKind;
  meaning?: string; // 前缀/后缀/词根的释义（词干通常无）
}

export interface Morphology {
  parts: Part[];
}

// ── 前缀 ────────────────────────────────────────────────────────────────
const PREFIXES: Record<string, string> = {
  counter: '反', inter: '之间/相互', trans: '横越/转变', contra: '相反',
  super: '超/上', under: '下/不足', over: '过度/在上', semi: '半',
  anti: '反/抗', auto: '自己', micro: '微', macro: '宏', multi: '多',
  mono: '单', tele: '远', photo: '光', hyper: '过度', fore: '前',
  post: '后', pre: '前/预先', pro: '向前', sub: '下/次', extra: '超出',
  ultra: '极', non: '非', mis: '错误', dis: '不/分离', un: '不/否定',
  re: '再/回', de: '向下/去除', ex: '向外', en: '使…', em: '使…/入',
  co: '共同', com: '共同', con: '共同', col: '共同', cor: '共同',
  bi: '二', tri: '三', uni: '一', in: '不/入', im: '不/入',
  il: '不', ir: '不', ab: '离开', ad: '向', circum: '环绕',
  dia: '穿过', epi: '在上', eu: '好', hemi: '半', hypo: '下/次',
  meta: '超越/变化', para: '旁边/辅助', per: '贯穿', peri: '周围',
  poly: '多', proto: '原初', pseudo: '假', syn: '共同', to: '向',
};

// ── 后缀 ────────────────────────────────────────────────────────────────
const SUFFIXES: Record<string, string> = {
  ization: '…化（名词）', isation: '…化（名词）', ational: '…的', ically: '…地',
  ability: '能力（名词）', ibility: '能力（名词）', ology: '…学', fully: '…地',
  ation: '名词：行为/状态', tion: '名词：行为/状态', sion: '名词：行为/状态',
  ion: '名词：行为/状态',
  ment: '名词：结果/状态', ness: '名词：性质', ity: '名词：性质', ivity: '名词：性质',
  ance: '名词：状态', ence: '名词：状态', ism: '主义/学说', ist: '…者',
  logy: '…学', hood: '名词：身份', ship: '名词：身份/状态', dom: '名词：领域/状态',
  ward: '向…方向', less: '无…的', ful: '充满…的', ous: '多…的',
  ious: '多…的', able: '可…的', ible: '可…的', ive: '有…性质的',
  ative: '…的', ical: '…的', ic: '…的', al: '…的', ish: '略…的',
  like: '像…的', ly: '…地（副词）', ize: '使…（动词）', ise: '使…（动词）',
  ify: '使…（动词）', ate: '使…（动词）', ator: '…者/物', itor: '…者/物',
  er: '…者/物', or: '…者/物',
  ant: '…者/…的', ent: '…者/…的', ary: '…的/场所', ory: '…的/场所',
  age: '名词：行为/集合', ure: '名词：行为/结果', ade: '名词：行为',
};

// ── 常见词根（拉丁/希腊）────────────────────────────────────────────────
const ROOTS: Record<string, string> = {
  spect: '看', spec: '看', spic: '看', dict: '说', dic: '说', ject: '投',
  port: '携带', scrib: '写', script: '写', duc: '引导', duct: '引导',
  mit: '送', miss: '送', tract: '拉', pos: '放', pon: '放',
  vert: '转', vers: '转', cred: '相信', fer: '带来', log: '言/学',
  graph: '写', gram: '写', phon: '声音', bio: '生命', geo: '地',
  chron: '时间', path: '感受/病', morph: '形状', form: '形状', struct: '建造',
  fac: '做', fect: '做', fic: '做', ced: '走', ceed: '走',
  cess: '走', grad: '步/级', gress: '走', mot: '动', mov: '动',
  pel: '推', puls: '推/驱动', sent: '感觉', sens: '感觉', vid: '看',
  vis: '看', voc: '声音/叫', vok: '叫', cap: '拿/抓', cept: '拿取',
  cip: '拿取', tain: '握', ten: '握', tin: '握', serv: '服务/保持',
  stat: '站', stit: '站', sist: '站', tempor: '时间', text: '编织',
  therm: '热', vac: '空', van: '空', ven: '来', vent: '来',
  ver: '真', nounce: '宣布', nunci: '宣布', norm: '规范', ord: '顺序',
  part: '部分', pass: '通过', ped: '足', pend: '挂', pens: '挂/称',
  pet: '追求', phil: '爱', pict: '画', plen: '满', plic: '折叠',
  ply: '折叠', pop: '人民', prim: '第一', priv: '私人', prob: '证明',
  prov: '证明', psych: '心理', punct: '点', quir: '寻求', quis: '寻求',
  reg: '统治', rupt: '破', scend: '爬', sci: '知道', sect: '切',
  cis: '切', cid: '切/落', clus: '关闭', clud: '关闭',
  sequ: '跟随', sign: '记号', simil: '相似', sol: '太阳/单独', solv: '解开',
  solu: '解开', son: '声音', soph: '智慧', spir: '呼吸', sum: '取',
  sumpt: '取', tact: '接触', tang: '接触', tend: '伸展', tens: '伸展',
  term: '界限', test: '证明', tort: '扭', tour: '转', trib: '给予',
  trud: '推', trus: '推', urb: '城市', val: '价值', verb: '词',
  vict: '征服', vinc: '征服', viv: '生命', volv: '转', volut: '转',
  cur: '跑/关心', curr: '跑', curs: '跑', loc: '地方', man: '手',
  mar: '海', mater: '母', meter: '测量', metr: '测量', nom: '法则/名',
  nym: '名字', oper: '工作', opt: '选择/看', ora: '说', techn: '技术',
  rect: '直/正', rid: '笑', rog: '问', sal: '跳', sat: '足够', scop: '看',
  sede: '坐', sess: '坐', sid: '坐', sta: '站', string: '拉紧',
  stru: '建造', tail: '切', tect: '覆盖', tenu: '薄', the: '神',
  ton: '音', top: '地方', umbr: '阴影', und: '波', ut: '用',
  vade: '走', vel: '盖',
};

const PREFIX_LIST = Object.keys(PREFIXES).sort((a, b) => b.length - a.length);
const SUFFIX_LIST = Object.keys(SUFFIXES).sort((a, b) => b.length - a.length);

// 个别「容易假命中短词」的后缀，要求词干更长才可信。
// 例：million / companion 会分别误命中 mill / pan；把 -ion 的词干门槛抬到 5 即可滤掉，
// 同时保护 protect/express/discuss 这类真的 -ion 派生词。
const MIN_STEM: Record<string, number> = { ion: 5 };
const DEFAULT_MIN_STEM = 3;

interface StemInfo {
  matched: string; // 形态还原后的词干（如 happi → happy）
  isRoot: boolean;
  rootMeaning?: string;
  restored: boolean; // 是否为了命中而改了拼写（i→y / 补 e / 去重末辅音）
}

// 词干验证：词典命中，或词根表命中。额外尝试几种常见的形态还原。
function validateStem(stem: string, isKnown: (w: string) => boolean): StemInfo | null {
  const cands: { text: string; restored: boolean }[] = [{ text: stem, restored: false }];
  if (stem.endsWith('i')) cands.push({ text: stem.slice(0, -1) + 'y', restored: true });
  cands.push({ text: stem + 'e', restored: true });
  if (/(.)\1$/.test(stem)) cands.push({ text: stem.slice(0, -1), restored: true });
  for (const c of cands) {
    if (ROOTS[c.text]) return { matched: c.text, isRoot: true, rootMeaning: ROOTS[c.text], restored: c.restored };
  }
  for (const c of cands) {
    if (isKnown(c.text)) return { matched: c.text, isRoot: false, restored: c.restored };
  }
  return null;
}

interface Candidate {
  parts: Part[];
  score: number;
}

// 尝试一条具体拆法；不可信（词干太短 / 验证不过）返回 null。
function buildCandidate(
  w: string,
  prefix: string | undefined,
  suffix: string | undefined,
  isKnown: (x: string) => boolean
): Candidate | null {
  let stem = w;
  const parts: Part[] = [];
  if (prefix) {
    if (!stem.startsWith(prefix)) return null;
    stem = stem.slice(prefix.length);
  }
  if (suffix) {
    if (!stem.endsWith(suffix)) return null;
    stem = stem.slice(0, stem.length - suffix.length);
  }
  if (stem.length < 3 || stem === w) return null;
  const info = validateStem(stem, isKnown);
  if (!info) return null;
  // 词干门槛：词根命中永远可信；普通单词命中受后缀门槛约束（见 MIN_STEM）。
  if (!info.isRoot && info.matched.length < (MIN_STEM[suffix ?? ''] ?? DEFAULT_MIN_STEM)) return null;

  // 打分：词根命中 ≫ 普通单词命中；拼写无改动、词缀更全、词干更长者更可信。
  let score = info.isRoot ? 100 : 40;
  if (!info.restored) score += 8;
  if (prefix) score += 6;
  if (suffix) score += 6;
  score += 2 * info.matched.length;

  if (prefix) parts.push({ text: prefix, kind: 'prefix', meaning: PREFIXES[prefix] });
  parts.push(
    info.isRoot
      ? { text: info.matched, kind: 'root', meaning: info.rootMeaning }
      : { text: info.matched, kind: 'stem' }
  );
  if (suffix) parts.push({ text: suffix, kind: 'suffix', meaning: SUFFIXES[suffix] });
  return { parts, score };
}

// 最低可信分：低于此分宁可返回 null，也不展示可疑拆解。
const MIN_SCORE = 50;

// 主入口：把单词拆成前缀 + 词干/词根 + 后缀。拆不出（或不可信）返回 null。
// isKnown 由调用方注入（用随包词典判断词干是否为真实单词），保持本模块无 DB 依赖、可单测。
export function decompose(word: string, isKnown: (w: string) => boolean): Morphology | null {
  const w = (word || '').trim().toLowerCase();
  if (w.length < 5 || !/^[a-z]+$/.test(w)) return null;

  const pfx = PREFIX_LIST.filter((p) => w.startsWith(p) && w.length - p.length >= 3);
  const sfx = SUFFIX_LIST.filter((s) => w.endsWith(s) && w.length - s.length >= 3);

  // 枚举所有组合，收集候选择优——避免「先命中先返回」把 pre+dice+tion 当成答案。
  const cands: Candidate[] = [];
  for (const p of pfx) for (const s of sfx) { const c = buildCandidate(w, p, s, isKnown); if (c) cands.push(c); }
  for (const p of pfx) { const c = buildCandidate(w, p, undefined, isKnown); if (c) cands.push(c); }
  for (const s of sfx) { const c = buildCandidate(w, undefined, s, isKnown); if (c) cands.push(c); }

  let best: Candidate | null = null;
  for (const c of cands) if (!best || c.score > best.score) best = c;
  if (!best || best.score < MIN_SCORE) return null;
  return { parts: best.parts };
}

// 纯文本摘要（如 "un- · happy"），供紧凑场景（复习卡背面）一行显示。
export function morphologyPlain(m: Morphology): string {
  return m.parts
    .map((p) => (p.kind === 'suffix' ? `-${p.text}` : p.kind === 'prefix' ? `${p.text}-` : p.text))
    .join('  ·  ');
}
