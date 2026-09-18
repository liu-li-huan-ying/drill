// 完成屏：一屏一事 = 收尾与成就感，不施压。
// 朱印「今日已毕」落印（缩放 + 微旋 → 归位），三格数据，然后两条出口。
// 出口的强弱是刻意的：先给「看看你坚持了多久」（正反馈），再给「回到今日」（安静退出）。
import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, Animated, Easing, StyleSheet } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { serif, FONT, RADIUS, SPACE, CONTROL, WEIGHT, type Tokens } from '../../theme/tokens';
import { Btn } from '../../components/ui';

const SEAL = 72;
const SEAL_CHARS = '今日已毕';

export function DoneView({
  words,
  minutes,
  accuracy,
  streak,
  delta,
  onStats,
  onHome,
  onUndo,
}: {
  words: number;
  minutes: number;
  accuracy: number; // 0..1
  streak: number;
  delta: number; // 今日总词数 - 昨日总词数，可负
  onStats: () => void;
  onHome: () => void;
  onUndo?: () => void;
}) {
  const { colors: c } = useTheme();
  const stamp = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(stamp, {
      toValue: 1,
      duration: 520,
      easing: Easing.bezier(0.22, 1, 0.36, 1), // 落印：快落、稳住，不回弹
      useNativeDriver: true,
    }).start();
  }, [stamp]);

  // 一个字都没评 → 不做庆祝。给一张空成绩单盖「今日已毕」是撒谎。
  if (words === 0) {
    return (
      <View style={[styles.wrap, styles.wrapEmpty]}>
        <Text style={[styles.title, { color: c.tx1, fontFamily: serif }]}>今 日 已 清 空</Text>
        <Text style={[styles.sub, { color: c.tx3 }]}>没有到期的复习，也没有待学的新词</Text>
        <View style={styles.emptyBtn}>
          <Btn title="回 到 今 日" onPress={onHome} style={{ alignSelf: 'stretch' }} />
        </View>
      </View>
    );
  }

  const style = {
    opacity: stamp.interpolate({ inputRange: [0, 0.55, 1], outputRange: [0, 1, 1] }),
    transform: [
      { scale: stamp.interpolate({ inputRange: [0, 1], outputRange: [0.72, 1] }) },
      { rotate: stamp.interpolate({ inputRange: [0, 1], outputRange: ['-4deg', '0deg'] }) },
    ],
  };

  const deltaText = delta === 0 ? '与昨日持平' : `比昨日${delta > 0 ? '多' : '少'} ${Math.abs(delta)} 词`;

  return (
    <View style={styles.wrap}>
      <Animated.View style={[styles.seal, { backgroundColor: c.ac }, style]}>
        <View style={[styles.sealFrame, { borderColor: c.bg }]} />
        <View style={styles.sealGrid}>
          {[0, 1].map((row) => (
            <View key={row} style={styles.sealRow}>
              {[0, 1].map((col) => (
                <Text key={col} style={[styles.sealChar, { color: c.bg }]}>
                  {SEAL_CHARS[row * 2 + col]}
                </Text>
              ))}
            </View>
          ))}
        </View>
      </Animated.View>

      <Text style={[styles.title, { color: c.tx1, fontFamily: serif }]}>今 日 已 毕</Text>
      <Text style={[styles.sub, { color: c.tx3 }]}>
        连续学习 {streak} 天 · {deltaText}
      </Text>

      <View style={styles.grid3}>
        <Cell value={String(words)} label="完 成" colors={c} />
        <Cell value={String(minutes)} label="分 钟" colors={c} />
        <Cell value={`${Math.round(accuracy * 100)}%`} label="正 确 率" colors={c} />
      </View>

      <Btn title="看 看 坚 持 了 多 久" variant="outline" onPress={onStats} style={{ alignSelf: 'stretch' }} />
      <TouchableOpacity activeOpacity={0.6} onPress={onHome} style={styles.bt2}>
        <Text style={[styles.bt2Text, { color: c.tx3 }]}>回 到 今 日</Text>
      </TouchableOpacity>
      {/* 最后一张卡手滑就再也回不去了 —— 完成屏必须留一个撤销口。 */}
      {onUndo ? (
        <TouchableOpacity activeOpacity={0.6} onPress={onUndo} style={styles.bt2}>
          <Text style={[styles.bt2Text, { color: c.ac }]}>撤 销 上 一 次 评 分</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

function Cell({ value, label, colors: c }: { value: string; label: string; colors: Tokens }) {
  return (
    <View style={[styles.cell, { backgroundColor: c.sf, borderColor: c.bd }]}>
      <Text style={[styles.cellV, { color: c.tx1, fontFamily: serif }]}>{value}</Text>
      <Text style={[styles.cellK, { color: c.tx3 }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', paddingTop: SPACE.huge, paddingHorizontal: SPACE.xxl },
  wrapEmpty: { justifyContent: 'center', paddingTop: 0 },

  seal: {
    width: SEAL,
    height: SEAL,
    borderRadius: RADIUS.chip,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACE.xxxl,
  },
  sealFrame: { position: 'absolute', top: 5, left: 5, right: 5, bottom: 5, borderWidth: 1, borderRadius: RADIUS.xs },
  sealGrid: { alignItems: 'center', justifyContent: 'center' },
  sealRow: { flexDirection: 'row' },
  sealChar: { fontFamily: serif, fontSize: 21, lineHeight: 25, fontWeight: WEIGHT.semibold },

  title: { fontSize: FONT.title, letterSpacing: 3 },
  sub: { fontSize: 13, letterSpacing: 0.5, marginTop: SPACE.md },

  grid3: { flexDirection: 'row', gap: SPACE.md, alignSelf: 'stretch', marginTop: SPACE.huge, marginBottom: SPACE.xxxl },
  cell: {
    flex: 1,
    alignItems: 'center',
    borderRadius: RADIUS.card,
    borderWidth: 1,
    paddingVertical: SPACE.xl,
    paddingHorizontal: SPACE.sm,
  },
  cellV: { fontSize: FONT.wordSm, lineHeight: 31, fontWeight: WEIGHT.semibold, fontVariant: ['tabular-nums'] },
  cellK: { fontSize: 10, letterSpacing: 1.6, marginTop: SPACE.sm, fontWeight: WEIGHT.semibold },

  bt2: { height: CONTROL.lg, justifyContent: 'center', alignItems: 'center', alignSelf: 'stretch' },
  bt2Text: { fontSize: 13.5, letterSpacing: 1.5, fontWeight: WEIGHT.medium },
  emptyBtn: { alignSelf: 'stretch', marginTop: SPACE.xxxl },
});
