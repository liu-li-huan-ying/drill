import React from 'react';
import { TouchableOpacity, View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { RATING_BARS, RATING_LABELS, RATING_INTERVALS } from '../../theme/tokens';

// 四档评分。条长 = 下次间隔（14/26/42/66dp），不读数字也能量级。
// 只有「重来」用朱砂，其余靠底色与条色区分。
// 回调传入 1..4，对应 ts-fsrs 的 Rating（Again=1, Hard=2, Good=3, Easy=4）。
export function RatingBar({ onRate }: { onRate: (rating: number) => void }) {
  const { colors: c } = useTheme();
  const bg = [c.b1, c.b2, c.b3, c.b4];
  const bar = [c.b1t, c.tx3, c.tx2, c.tx1];
  const txt = [c.b1t, c.tx1, c.tx1, c.tx1];

  return (
    <View style={styles.row}>
      {RATING_LABELS.map((label, i) => (
        <TouchableOpacity
          key={i}
          activeOpacity={0.7}
          onPress={() => onRate(i + 1)}
          style={[styles.btn, { backgroundColor: bg[i] }]}
        >
          <View style={[styles.bar, { width: RATING_BARS[i], backgroundColor: bar[i] }]} />
          <Text style={[styles.label, { color: txt[i] }]}>{label}</Text>
          <Text style={[styles.interval, { color: c.tx2 }]}>{RATING_INTERVALS[i]}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 6 },
  btn: {
    flex: 1,
    height: 60,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 9,
  },
  bar: { position: 'absolute', left: 9, top: 13, height: 2, borderRadius: 1 },
  label: { fontSize: 13, fontWeight: '500' },
  interval: { fontSize: 10.5, marginTop: 3 },
});
