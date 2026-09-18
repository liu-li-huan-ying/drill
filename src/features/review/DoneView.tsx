// 完成屏：一屏一事 = 收尾与成就感，不施压。
// 朱印「今日已毕」落印（落下 → 轻回弹 → 定住），落定的一瞬纸面微震，然后三格数据 + 两条出口。
//
// 出口的强弱是刻意的：主操作是实心朱砂「看看坚持了多久」（正反馈），
// 次操作是文字链「回到今日」（安静退出）、「撤销上一次评分」（修正）。
// 三者不再长得一样 —— 平级按钮会让「该点哪个」变成一道选择题（P1.7）。
import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, Animated, ScrollView, StyleSheet } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import {
  serif, FONT, MOTION, RADIUS, SPACE, CONTROL, WEIGHT, TRACK, SEAL_IMPACT, type Tokens,
} from '../../theme/tokens';
import { easeSettle, useReducedMotion } from '../../lib/motion';
import { useBottomPad } from '../../lib/layout';
import { Btn, Num } from '../../components/ui';
import { fmtNum } from '../../lib/num';

const SEAL = 72;
const SEAL_CHARS = '今日已毕';

// 落印的四个停点（`stamp` 0→1 的进度轴）。
//   0            —— 章还在半空、还带着角度
//   SEAL_IMPACT  —— 触纸：比例略过冲（1.08），因为印泥被压开了
//   +0.16        —— 回弹：缩回 0.98，这一下才有「按下去」的重量
//   1            —— 定住
// 为什么要拆成四个停点而不是换一条过冲曲线：曲线是全局共享的（tokens 里的 EASE_SETTLE），
// 曲线一过冲，全项目每一处用它入场的内容都会跟着弹 —— 那是另一回事。
// 这一个动作的物理感，由它自己的插值停点负责。
const STOPS = [0, SEAL_IMPACT, SEAL_IMPACT + 0.16, 1];

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
  const bottomPad = useBottomPad();
  const reduce = useReducedMotion();
  const stamp = useRef(new Animated.Value(0)).current;
  const shock = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // 「减弱动效」时印章直接就在，纸也不震（不播，不是播得慢一点）。
    if (reduce) {
      stamp.setValue(1);
      return;
    }
    const fall = Animated.timing(stamp, {
      toValue: 1,
      duration: MOTION.seal,
      easing: easeSettle(), // 落印：快落、稳住
      useNativeDriver: true,
    });
    // 微震**不是独立动作**，是落印的后果 —— 所以它必须等触纸那一刻才开始，
    // 而不是跟着 stamp 一起跑（一起跑就成了「章和纸同时在抖」，那是特效不是物理）。
    const jolt = Animated.sequence([
      Animated.delay(Math.round(MOTION.seal * SEAL_IMPACT)),
      Animated.timing(shock, { toValue: 1, duration: Math.round(MOTION.shock * 0.34), easing: easeSettle(), useNativeDriver: true }),
      Animated.timing(shock, { toValue: -0.5, duration: Math.round(MOTION.shock * 0.34), useNativeDriver: true }),
      Animated.timing(shock, { toValue: 0.18, duration: Math.round(MOTION.shock * 0.32), useNativeDriver: true }),
      Animated.timing(shock, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]);
    fall.start();
    jolt.start();
    return () => {
      fall.stop();
      jolt.stop();
    };
  }, [stamp, shock, reduce]);

  // 一个字都没评 → 不做庆祝。给一张空成绩单盖「今日已毕」是撒谎。
  if (words === 0) {
    return (
      <ScrollView
        contentContainerStyle={[styles.wrap, { paddingBottom: bottomPad }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.title, { color: c.tx1, fontFamily: serif }]}>今日已清空</Text>
        <Text style={[styles.sub, { color: c.tx3 }]}>没有到期的复习，也没有待学的新词</Text>
        <View style={styles.emptyBtn}>
          <Btn title="回到今日" onPress={onHome} style={{ alignSelf: 'stretch' }} />
        </View>
      </ScrollView>
    );
  }

  const sealStyle = {
    opacity: stamp.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0, 1, 1] }),
    transform: [
      { scale: stamp.interpolate({ inputRange: STOPS, outputRange: [0.72, 1.08, 0.98, 1] }) },
      { rotate: stamp.interpolate({ inputRange: STOPS, outputRange: ['-7deg', '0deg', '0deg', '0deg'] }) },
    ],
  };
  // 纸面微震：1.6dp 的横竖抖动。幅度别再加 —— 超过 3dp 就从「纸被震了一下」
  // 变成「屏幕在晃」，那是故障的观感。纸不是硬板，抖一下就该停。
  const shockStyle = {
    transform: [
      { translateY: shock.interpolate({ inputRange: [-1, 1], outputRange: [1.6, -1.6] }) },
      { translateX: shock.interpolate({ inputRange: [-1, 1], outputRange: [-1.1, 1.1] }) },
    ],
  };

  const deltaText = delta === 0 ? '和昨天一样' : `比昨天${delta > 0 ? '多背' : '少背'} ${fmtNum(Math.abs(delta))} 个`;

  return (
    <ScrollView
      contentContainerStyle={[styles.wrap, { paddingBottom: bottomPad }]}
      showsVerticalScrollIndicator={false}
    >
      {/* 印章与文字同在一个会震的容器里 —— 章已经压在纸上了，纸动章也动，
          分开震会立刻露馅（两件东西各震各的，眼睛一看就知道是两段动画）。 */}
      <Animated.View style={[styles.stage, shockStyle]}>
        <Animated.View style={[styles.seal, { backgroundColor: c.ac }, sealStyle]}>
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

        <Text style={[styles.title, { color: c.tx1, fontFamily: serif }]}>今日已毕</Text>
        <Text style={[styles.sub, { color: c.tx3 }]}>
          已经连着学 {fmtNum(streak)} 天 · {deltaText}
        </Text>

        <View style={styles.grid3}>
          <Cell value={words} unit="词" label="完 成" colors={c} />
          <Cell value={minutes} unit="分" label="用 时" colors={c} />
          <Cell value={`${Math.round(accuracy * 100)}%`} label="正 确 率" colors={c} />
        </View>
      </Animated.View>

      {/* 主出口：实心朱砂。它是这一屏唯一的「往前走」 */}
      <Btn title="看看坚持了多久" onPress={onStats} style={{ alignSelf: 'stretch' }} />
      {/* 次出口：文字链。与主出口拉开 24dp —— 两个等距的按钮是「并列选择」，
          而这里的关系是「主 / 备」，距离本身就是层级。 */}
      <View style={styles.exits}>
        <TouchableOpacity activeOpacity={0.6} onPress={onHome} style={styles.link}>
          <Text style={[styles.linkText, { color: c.tx2 }]}>回到今日</Text>
        </TouchableOpacity>
        {/* 最后一张卡手滑就再也回不去了 —— 完成屏必须留一个撤销口。 */}
        {onUndo ? (
          <TouchableOpacity activeOpacity={0.6} onPress={onUndo} style={styles.link}>
            <Text style={[styles.linkText, { color: c.ac }]}>撤销上一次评分</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </ScrollView>
  );
}

function Cell({
  value,
  unit,
  label,
  colors: c,
}: {
  value: number | string;
  unit?: string;
  label: string;
  colors: Tokens;
}) {
  return (
    <View style={[styles.cell, { backgroundColor: c.sf, borderColor: c.bd }]}>
      <View style={styles.cellRow}>
        <Num value={value} style={[styles.cellV, { color: c.tx1, fontFamily: serif }]} />
        {unit ? <Text style={[styles.cellU, { color: c.tx3 }]}>{unit}</Text> : null}
      </View>
      <Text style={[styles.cellK, { color: c.tx3 }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  // 完成屏的内容高度随机型变（短屏 640dp / 长屏 900dp）。
  // 用 flexGrow + justifyContent:center：**空间富余时整体居中**（不再顶头+底部一大片空），
  // **空间不足时可滚动**（短屏不会把「撤销上一次评分」裁掉 —— 那是不可替代的出口）。
  wrap: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'stretch',
    paddingTop: SPACE.xl,
    paddingHorizontal: SPACE.xxl,
  },

  stage: { alignItems: 'center' },
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

  // 标题恢复正常字距（P1.1）：大字号 + 宽字距 = 四个各自为政的字。
  title: { fontSize: FONT.title, letterSpacing: TRACK.title },
  sub: { fontSize: 13, letterSpacing: TRACK.body, marginTop: SPACE.md },

  grid3: { flexDirection: 'row', gap: SPACE.md, alignSelf: 'stretch', marginTop: SPACE.huge, marginBottom: SPACE.xxxl },
  cell: {
    flex: 1,
    alignItems: 'center',
    borderRadius: RADIUS.card,
    borderWidth: 1,
    paddingVertical: SPACE.xl,
    paddingHorizontal: SPACE.sm,
  },
  cellRow: { flexDirection: 'row', alignItems: 'baseline' },
  cellV: { fontSize: FONT.wordSm, lineHeight: 31, fontWeight: WEIGHT.semibold },
  cellU: { fontSize: FONT.unit, marginLeft: 2, fontWeight: WEIGHT.medium, flexShrink: 0 },
  cellK: { fontSize: 10, letterSpacing: TRACK.label, marginTop: SPACE.sm, fontWeight: WEIGHT.semibold },

  exits: { marginTop: SPACE.xxl },
  link: { minHeight: CONTROL.lg, justifyContent: 'center', alignItems: 'center' },
  linkText: { fontSize: 13.5, letterSpacing: TRACK.body, fontWeight: WEIGHT.medium },
  emptyBtn: { alignSelf: 'stretch', marginTop: SPACE.xxxl },
});
