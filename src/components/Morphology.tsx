import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { serif } from '../theme/tokens';
import type { Morphology } from '../lib/morphology';

// 词根词缀拆解展示：把 decompose() 的结果渲染成「前缀 + 词干 + 后缀」的横向分段，
// 每个词缀下方标注释义。词干/词根用主文本色，词缀用朱砂强调——一眼看清「哪段是词缀」。
export function MorphologyView({ data }: { data: Morphology }) {
  const { colors: c } = useTheme();
  return (
    <View style={styles.wrap}>
      {data.parts.map((p, i) => {
        const isAffix = p.kind === 'prefix' || p.kind === 'suffix';
        const label = p.kind === 'suffix' ? `-${p.text}` : p.kind === 'prefix' ? `${p.text}-` : p.text;
        return (
          <React.Fragment key={`${p.text}-${i}`}>
            {i > 0 ? <Text style={[styles.plus, { color: c.tx3 }]}>+</Text> : null}
            <View style={styles.seg}>
              <Text style={[styles.segText, { color: isAffix ? c.ac : c.tx1 }]}>{label}</Text>
              {p.meaning ? (
                <Text style={[styles.segMean, { color: c.tx3 }]} numberOfLines={2}>
                  {p.meaning}
                </Text>
              ) : null}
            </View>
          </React.Fragment>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', gap: 8 },
  seg: { alignItems: 'center' },
  segText: { fontFamily: serif, fontSize: 17, letterSpacing: -0.2 },
  segMean: { fontSize: 10.5, marginTop: 3, maxWidth: 96, textAlign: 'center' },
  plus: { fontSize: 13, marginTop: 4 },
});
