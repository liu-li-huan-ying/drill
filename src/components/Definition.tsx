// 释义渲染：把词库里「字面转义」的换行还原成真实换行，并按义项分行显示。
// 词库数据在打包时被 JSON 转义，\n / \r\n 以「反斜杠+n」两个字符的形式入库，
// 直接渲染就会在屏幕上看到裸奔的 "\n"。这里在渲染期归一化，零成本、可逆、无需重建库。
import React from 'react';
import { Text, View, StyleSheet, type TextStyle } from 'react-native';
import { SPACE, WEIGHT, FONT } from '../theme/tokens';

// 字面转义 → 真实换行（顺序：先 \r\n，再 \r，再 \n，最后 \t）。
export function normalizeDef(raw: string | null | undefined): string {
  if (!raw) return '';
  return raw
    .replace(/\\r\\n/g, '\n')
    .replace(/\\r/g, '\n')
    .replace(/\\n/g, '\n')
    .replace(/\\t/g, ' ');
}

// 拆成「义项」数组：按真实换行切分、去首尾空白、丢弃空行；
// 不以词性缩写（v./n.…）或 [计] 等标签开头的行，视为上一义项的续行，合并回去。
export function splitSenses(raw: string | null | undefined): string[] {
  const s = normalizeDef(raw);
  if (!s) return [];
  const lines = s.split('\n').map((l) => l.trim()).filter(Boolean);
  const senseStart = /^([a-z]{1,8}\.|\[[^\]]+\])/i;
  const senses: string[] = [];
  for (const line of lines) {
    if (senseStart.test(line)) {
      senses.push(line);
    } else if (senses.length > 0) {
      senses[senses.length - 1] += ' ' + line;
    } else {
      senses.push(line);
    }
  }
  return senses;
}

/** 一个义项拆成三段：词性缩写 / 领域标签 / 正文。 */
export interface Sense {
  pos: string; // 'n.' —— 词性缩写，可能是空的
  tag: string; // '[经]' —— 领域标签，可能是空的
  body: string;
}

const POS_RE = /^([a-z]{1,8}\.)\s*/i;
const TAG_RE = /^(\[[^\]]+\])\s*/;

/**
 * 拆义项：词性和领域标签各剥一层。
 *
 * 词库原始形态是 `n. [经] (商品的) 供求…`，也就是**每个义项都带一遍词性和标签**。
 * 旧渲染原样照抄，于是同一个 `n.` 在一屏里出现五次 —— 而 `n.` 是「这个词是什么词」，
 * 是一个**词级**属性，不是义项级属性（P1.4：词性只在词头出现一次）。
 * 拆出来之后，谁来显示词性由调用方决定，渲染层只负责「该显示什么」。
 */
export function parseSense(sense: string): Sense {
  let rest = sense;
  const pm = rest.match(POS_RE);
  const pos = pm ? pm[1] : '';
  if (pm) rest = rest.slice(pm[0].length);
  const tm = rest.match(TAG_RE);
  const tag = tm ? tm[1] : '';
  if (tm) rest = rest.slice(tm[0].length);
  return { pos, tag, body: rest };
}

/** 拆成结构化义项数组。 */
export function parseSenses(raw: string | null | undefined): Sense[] {
  return splitSenses(raw).map(parseSense);
}

interface Props {
  raw: string | null | undefined;
  accent: string; // 序号 / 词性 / 领域标签的高亮色（朱砂）
  style?: TextStyle; // 每个义项行的文本样式（含 color / fontSize / lineHeight）
  blockStyle?: TextStyle; // 外层容器样式（通常用于 marginTop）
  numbered?: boolean; // 义项前落序号（1 2 3）—— 编号列表，长释义才数得清有几条
  stripPos?: boolean; // 调用方已在词头显示过词性 → 义项里不再重复
}

// 义项之间的间距。旧值 6 是硬编码，脱离了 4dp 网格，就近归并到 SPACE.sm。
const SENSE_GAP = SPACE.sm;

// 序号 / 词性 / 领域标签**共用同一档字号**：它们是一行里的同一个前缀，尺寸一多样，
// 前缀就散成两个记号。0.79 是实测定的比例（16.5 → 13 注解级；13 → 10.5）。
//
// 为什么不像旧版那样跟正文同号：三者都是**注解**。与正文同号时，每行开头立着两个
// 同等重量的朱砂记号（序号 + 词性），一列 4–6 条义项读下来，左边缘是一串红数字加红词性，
// 正文反倒像附带的。降到注解级之后，一行的读序才回到「序号 → 词性 → 释义」。
const TAG_RATIO = 0.79;

// 渲染一整段释义：每个义项独立成行，行首序号 / 词性 / [标签] 用 accent 高亮。
export function DefinitionView({ raw, accent, style, blockStyle, numbered, stripPos }: Props) {
  const senses = parseSenses(raw);
  if (senses.length === 0) return null;

  // 只有一个义项时不编号：`1  州, 状态, 情形…` 里的那个 1 不提供任何信息。
  // 这不是边角情况 —— 实测 30,565 词里 9,932 个词只有 1 条义项，接近三分之一。
  const listed = Boolean(numbered) && senses.length > 1;
  const tagSize = Math.round((style?.fontSize ?? FONT.def) * TAG_RATIO * 2) / 2;
  const tagStyle: TextStyle = { color: accent, fontWeight: WEIGHT.semibold, fontSize: tagSize };

  // 同一个领域标签在一条释义里只落一次 —— 数据里每个义项都重复着 `[经]`，
  // 全列出来不是「信息完整」，是让真正不同的标签失去对比（P1.4：领域标签统一样式）。
  const seenTags = new Set<string>();
  return (
    <View style={blockStyle}>
      {senses.map((s, i) => {
        const tag = s.tag && !seenTags.has(s.tag) ? s.tag : '';
        if (tag) seenTags.add(s.tag);
        // 词性：同一词性的第一个义项才显示（`n.` 是词级属性，重复出现只是噪声）；
        // 调用方已显示过词性时一律去掉。
        const pos = !stripPos && s.pos && senses.findIndex((x) => x.pos === s.pos) === i ? s.pos : '';
        const gap = i === 0 ? 0 : SENSE_GAP;
        const body = (
          <Text style={[{ flex: listed ? 1 : undefined, marginTop: listed ? 0 : gap }, style]}>
            {pos ? <Text style={tagStyle}>{pos} </Text> : null}
            {tag ? <Text style={tagStyle}>{tag} </Text> : null}
            {s.body}
          </Text>
        );
        if (!listed) return React.cloneElement(body, { key: i });
        // 编号列表：序号单独占一列并右对齐，正文左边缘才会齐（悬行缩进）。
        //
        // 间距必须挂在**行**上，不能像旧版那样挂在正文上：挂在正文上时序号没有跟着下移，
        // 第 2 条起序号就浮在自己的正文上方；再叠加「序号 lineHeight 与正文不一致」
        // （序号默认约 19，正文 25），错位会更大 —— 这两处正是列表「丑陋」的来源。
        // 序号带上正文的 lineHeight 之后，两者共用同一条基线网格，从第 1 条到最后一条都齐。
        return (
          <View key={i} style={[styles.row, { marginTop: gap }]}>
            <Text style={[styles.num, { color: accent, fontSize: tagSize, lineHeight: style?.lineHeight }]}>
              {i + 1}
            </Text>
            {body}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  // alignItems 必须是 flex-start：默认的 stretch 会把序号拉满整行高，
  // 而文字在那个高框里是居中的 —— 于是序号又跑到正文首行下方，正好抵消 lineHeight 的修法。
  row: { flexDirection: 'row', alignItems: 'flex-start' },
  // 序号列宽取 SPACE.lg（16dp）：两位数在 13sp 下约 14dp，装得下。
  // 右对齐 + 等宽列 → 正文的左边缘是一条直线，编号列表的全部意义就在这条线。
  num: { width: SPACE.lg, textAlign: 'right', marginRight: SPACE.sm, fontWeight: WEIGHT.semibold },
});
