// 释义渲染：把词库里「字面转义」的换行还原成真实换行，并按义项分行显示。
// 词库数据在打包时被 JSON 转义，\n / \r\n 以「反斜杠+n」两个字符的形式入库，
// 直接渲染就会在屏幕上看到裸奔的 "\n"。这里在渲染期归一化，零成本、可逆、无需重建库。
import React from 'react';
import { Text, View, type TextStyle } from 'react-native';

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

interface Props {
  raw: string | null | undefined;
  accent: string; // 词性 / 标签 token 的高亮色（朱砂）
  style?: TextStyle; // 每个义项行的文本样式（含 color / fontSize / lineHeight / fontStyle）
  blockStyle?: TextStyle; // 外层容器样式（通常用于 marginTop）
  center?: boolean; // 是否居中（当前无调用方，保留给需要居中的场景）
  rule?: string; // 传入颜色即给每个义项加「界行」（1px 竖线），古籍版式的义项分隔
}

// 渲染一整段释义：每个义项独立成行，行首词性缩写 / [标签] 用 accent 高亮。
export function DefinitionView({ raw, accent, style, blockStyle, center, rule }: Props) {
  const senses = splitSenses(raw);
  if (senses.length === 0) return null;
  return (
    <View style={blockStyle}>
      {senses.map((sense, i) => {
        const m = sense.match(/^((?:[a-z]{1,8}\.|\[[^\]]+\])\s*)/i);
        const pos = m ? m[1] : '';
        const rest = m ? sense.slice(pos.length) : sense;
        const line = (
          <Text style={[{ flex: rule ? 1 : undefined, marginTop: i === 0 ? 0 : 6, textAlign: center ? 'center' : 'left' }, style]}>
            {pos ? <Text style={{ color: accent }}>{pos}</Text> : null}
            {rest}
          </Text>
        );
        // 界行：竹片之间的那道缝。义项有自己的边界，才不会连成一坨。
        return rule ? (
          <View key={i} style={{ flexDirection: 'row' }}>
            <View style={{ width: 1, backgroundColor: rule, marginRight: 15, marginVertical: 4 }} />
            {line}
          </View>
        ) : (
          React.cloneElement(line, { key: i })
        );
      })}
    </View>
  );
}
