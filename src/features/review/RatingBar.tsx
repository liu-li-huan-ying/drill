// 四档评分。条长 = 下次间隔 —— 按间隔的对数刻度映射到 RATING_BAR.min..max，
// 端点固定、中间单调，所以条长比例是这张卡的真实比例（写死宽度会让编码变成假的）。
//
// 只有「重来」用朱砂；困难/良好/简单靠底色冷暖微差 + 条长递进区分，
// 条色统一中性 —— 长度已经编码了量级，再叠一层灰度梯度就是冗余信号。
// 回调传入 1..4，对应 ts-fsrs 的 Rating（Again=1, Hard=2, Good=3, Easy=4）。
import React from 'react';
import { TouchableOpacity, View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { RATING_LABELS, RATING_BAR, WEIGHT, RADIUS, TRACK } from '../../theme/tokens';
import type { IntervalPreview } from '../../srs/fsrs';

export function RatingBar({
  intervals,
  onRate,
}: {
  intervals: IntervalPreview[];
  onRate: (rating: number) => void;
}) {
  const { colors: c } = useTheme();
  const bg = [c.b1, c.b2, c.b3, c.b4];
  const bar = [c.b1t, c.tx2, c.tx2, c.tx2];
  const txt = [c.b1t, c.tx1, c.tx1, c.tx1];

  // 对数刻度：间隔跨分钟到月，线性映射会把前两档挤成一样长。
  const mins = intervals.map((iv) => Math.max(1, iv.minutes));
  const lo = Math.log(Math.min(...mins));
  const hi = Math.log(Math.max(...mins));
  const widthOf = (m: number) =>
    hi > lo ? RATING_BAR.min + (RATING_BAR.max - RATING_BAR.min) * ((Math.log(m) - lo) / (hi - lo)) : RATING_BAR.min;

  return (
    <View style={styles.row}>
      {RATING_LABELS.map((label, i) => (
        <TouchableOpacity
          key={i}
          activeOpacity={0.7}
          onPress={() => onRate(i + 1)}
          style={[styles.btn, { backgroundColor: bg[i] }]}
        >
          <View style={styles.barWrap}>
            <View style={{ width: widthOf(mins[i]), height: 2, borderRadius: RADIUS.mark, backgroundColor: bar[i] }} />
          </View>
          <Text numberOfLines={1} style={[styles.label, { color: txt[i] }]}>
            {label}
          </Text>
          {/* 间隔文案在窄屏（320dp 四等分 ≈ 62dp/格）+ 系统大字号下会就换行，四格高度被撑破。
              单行 + 必要时缩字，保证四格的基线永远齐平。 */}
          <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} style={[styles.interval, { color: c.tx2 }]}>
            {intervals[i]?.label ?? ''}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 7 },
  btn: {
    flex: 1,
    height: 64,
    borderRadius: RADIUS.ctrl,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 11,
  },
  barWrap: { position: 'absolute', left: 0, right: 0, top: 14, alignItems: 'center' },
  label: { fontSize: 13.5, fontWeight: WEIGHT.semibold, letterSpacing: TRACK.body },
  interval: { fontSize: 10.5, marginTop: 4, fontVariant: ['tabular-nums'] },
});
