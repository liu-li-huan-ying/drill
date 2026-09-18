// 释义渲染：把词库里「字面转义」的换行还原成真实换行，并按义项分行显示。
// 词库数据在打包时被 JSON 转义，\n / \r\n 以「反斜杠+n」两个字符的形式入库，
// 直接渲染就会在屏幕上看到裸奔的 "\n"。这里在渲染期归一化，零成本、可逆、无需重建库。
import React from 'react';
import { Text, View, StyleSheet, type TextStyle } from 'react-native';
import { SPACE, WEIGHT } from '../theme/tokens';

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
  accent: string; // 词性 / 标签 / 序号的高亮色（朱砂）
  style?: TextStyle; // 每个义项行的文本样式（含 color / fontSize / lineHeight / fontStyle）
  blockStyle?: TextStyle; // 外层容器样式（通常用于 marginTop）
  center?: boolean; // 是否居中（当前无调用方，保留给需要居中的场景）
  rule?: string; // 传入颜色即给每个义项加「界行」（1px 竖线），古籍版式的义项分隔
  numbered?: boolean; // 义项前落序号（1 2 3）—— 编号列表，长释义才数得清有几条
  stripPos?: boolean; // 调用方已在词头显示过词性 → 义项里不再重复
}

// 渲染一整段释义：每个义项独立成行，行首词性 / [标签] 用 accent 高亮。
export function DefinitionView({ raw, accent, style, blockStyle, center, rule, numbered, stripPos }: Props) {
  const senses = parseSenses(raw);
  if (senses.length === 0) return null;
  // 同一个领域标签在一条释义里只落一次 —— 数据里每个义项都重复着 `[经]`，
  // 全列出来不是「信息完整」，是让真正不同的标签失去对比（P1.4：领域标签统一样式）。
  const seenTags = new Set<string>();
  return (
    <View style={blockStyle}>
      {senses.map((s, i) => {
        const tag = s.tag && !seenTags.has(s.tag) ? s.tag : '';
        if (tag) seenTags.add(tag);
        // 词性：同一词性的第一个义项才显示（`n.` 是词级属性，重复出现只是噪声）；
        // 调用方已显示过词性时一律去掉。
        const pos = !stripPos && s.pos && senses.findIndex((x) => x.pos === s.pos) === i ? s.pos : '';
        const body = (
          <Text
            style={[
              { flex: rule || numbered ? 1 : undefined, marginTop: i === 0 ? 0 : 6, textAlign: center ? 'center' : 'left' },
              style,
            ]}
          >
            {pos ? <Text style={{ color: accent, fontWeight: WEIGHT.semibold }}>{pos} </Text> : null}
            {tag ? <Text style={{ color: accent }}>{tag} </Text> : null}
            {s.body}
          </Text>
        );

        // 编号列表：序号单独占一列并右对齐，正文左边缘才会齐（悬行缩进）。
        if (numbered) {
          return (
            <View key={i} style={styles.row}>
              <Text style={[styles.num, { color: accent, fontSize: style?.fontSize }]}>{i + 1}</Text>
              {body}
            </View>
          );
        }
        // 界行：竹片之间的那道缝。义项有自己的边界，才不会连成一坨。
        return rule ? (
          <View key={i} style={styles.row}>
            <View style={{ width: 1, backgroundColor: rule, marginRight: 15, marginVertical: 4 }} />
            {body}
          </View>
        ) : (
          React.cloneElement(body, { key: i })
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row' },
  // 序号列宽取 SPACE.xxl（24dp）：两位数（10.）在 16.5sp 下也装得下，
  // 右对齐后正文的左边缘是一条直线 —— 编号列表的全部意义就在这条线。
  num: { width: SPACE.xxl, textAlign: 'right', marginRight: SPACE.sm, fontWeight: WEIGHT.semibold },
});
