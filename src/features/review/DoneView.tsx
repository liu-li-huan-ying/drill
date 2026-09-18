// 完成屏：一屏一事 = 收尾与成就感，不施压。
// 朱印「今日已毕」**落**印（落 → 压 → 收，三段独立时长），落定的一瞬纸面微震、朱墨向四周洇开，
// 标题与三格数据在那之后才显影 —— 空纸上先落一枚印，再写字。然后两条出口。
//
// 出口的强弱是刻意的：主操作是实心朱砂「看看坚持了多久」（正反馈），
// 次操作是文字链「回到今日」（安静退出）、「撤销上一次评分」（修正）。
// 三者不再长得一样 —— 平级按钮会让「该点哪个」变成一道选择题（P1.7）。
import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, Animated, ScrollView, StyleSheet } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import {
  serif, FONT, MOTION, RADIUS, SPACE, CONTROL, WEIGHT, TRACK, type Tokens,
} from '../../theme/tokens';
import { ease, easeFall, easeSettle, useReducedMotion } from '../../lib/motion';
import { useBottomPad } from '../../lib/layout';
import { Btn, Num } from '../../components/ui';
import { fmtNum } from '../../lib/num';

const SEAL = 72;
const SEAL_CHARS = '今日已毕';

// 章悬在纸上方多高（dp）。**这是「落」唯一能被看见的方式**：旧版只有 scale 与 rotate、
// 没有位移，读者看到的是「章在原地变大」，不是「章掉下来」—— 而原地放大与「屏幕抖了一下」
// 在观感上是同一件事，这正是主人说「根本和描述完全不符」的直接原因。
const SEAL_DROP = 30;
// 触纸瞬间的比例过冲：印泥被压开了，所以那一帧它比静止时**大**，不是小。
const SEAL_PRESS = 1.09;
// 回弹缩到的比例：只小一点点，这一下才有「按下去」的重量。
const SEAL_CHOKE = 0.985;

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
  // 章的位置轴：0 悬空 → 1 触纸 → 2 回弹 → 3 定住。
  // 四个位置由**三段各自独立的 duration** 推进，不是一条曲线上的四个插值停点
  // （原因见 tokens 的 MOTION.sealFall：一条曲线承载不了时间轴）。
  const drop = useRef(new Animated.Value(0)).current;
  const shock = useRef(new Animated.Value(0)).current; // 纸面微震 -1..1
  const spread = useRef(new Animated.Value(0)).current; // 朱墨洇开的那一圈
  const reveal = useRef(new Animated.Value(0)).current; // 标题与数据的显影

  useEffect(() => {
    // 「减弱动效」时印章直接就在，纸也不震、墨也不洇（不播，不是播得慢一点）。
    if (reduce) {
      drop.setValue(3);
      reveal.setValue(1);
      return;
    }
    const fall = Animated.timing(drop, {
      toValue: 1, duration: MOTION.sealFall, easing: easeFall(), useNativeDriver: true,
    });
    const press = Animated.timing(drop, {
      toValue: 2, duration: MOTION.sealPress, easing: easeSettle(), useNativeDriver: true,
    });
    const settle = Animated.timing(drop, {
      toValue: 3, duration: MOTION.sealSettle, easing: easeSettle(), useNativeDriver: true,
    });
    // 微震**不是独立动作**，是落印的后果 —— 所以它必须等触纸那一刻才开始，
    // 而不是跟着 drop 一起跑（一起跑就成了「章和纸同时在抖」，那是特效不是物理）。
    const jolt = Animated.sequence([
      Animated.delay(MOTION.sealFall),
      Animated.timing(shock, { toValue: 1, duration: Math.round(MOTION.shock * 0.34), easing: easeSettle(), useNativeDriver: true }),
      Animated.timing(shock, { toValue: -0.5, duration: Math.round(MOTION.shock * 0.34), useNativeDriver: true }),
      Animated.timing(shock, { toValue: 0.18, duration: Math.round(MOTION.shock * 0.32), useNativeDriver: true }),
      Animated.timing(shock, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]);
    // 墨洇也是后果：与微震同时开始，但走得更久（朱墨在纸上散开比纸回弹慢）。
    const ink = Animated.timing(spread, {
      toValue: 1, duration: MOTION.sealSpread, delay: MOTION.sealFall, easing: ease(), useNativeDriver: true,
    });
    // 字**在印落定之后才出现**。次序就是语义：先落印再显字 = 批注（这一屏要的），
    // 字先铺好、印后盖上 = 表单盖章。差半拍，读出来的意思完全不同。
    const text = Animated.timing(reveal, {
      toValue: 1,
      duration: MOTION.enter,
      delay: MOTION.sealFall + MOTION.sealPress,
      easing: ease(),
      useNativeDriver: true,
    });
    const anims = [Animated.sequence([fall, press, settle]), jolt, ink, text];
    anims.forEach((a) => a.start());
    return () => anims.forEach((a) => a.stop());
  }, [drop, reveal, shock, spread, reduce]);

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
    opacity: drop.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, 1, 1] }),
    transform: [
      { translateY: drop.interpolate({ inputRange: [0, 1, 3], outputRange: [-SEAL_DROP, 0, 0] }) },
      { scale: drop.interpolate({ inputRange: [0, 1, 2, 3], outputRange: [0.88, SEAL_PRESS, SEAL_CHOKE, 1] }) },
      { rotate: drop.interpolate({ inputRange: [0, 1, 3], outputRange: ['-6deg', '0deg', '0deg'] }) },
    ],
  };
  // 纸面微震：1.6dp 的横竖抖动。幅度别再加 —— 超过 3dp 就从「纸被震了一下」
  // 变成「屏幕在晃」，那是故障的观感。纸不是硬板，抖一下就该停。
  //
  // 它仍然作用在**整块内容**上（章压在纸上，纸动章也动，分开震会立刻露馅），
  // 而它之所以不再被读成「屏幕抖了一下」，是因为章自己先有了 30dp 的下落：
  // 微震从「屏幕上唯一的运动」退回了它本来的位置 —— 落印的余韵。
  const shockStyle = {
    transform: [
      { translateY: shock.interpolate({ inputRange: [-1, 1], outputRange: [1.6, -1.6] }) },
      { translateX: shock.interpolate({ inputRange: [-1, 1], outputRange: [-1.1, 1.1] }) },
    ],
  };
  // 朱墨洇开的那一圈：贴着印边向外洇一线、随即收掉。
  //
  // 刻意**不**用「填充色块 + 低透明度」做这件事（那是光晕/投影的语汇，而体系里纸没有影），
  // 也刻意不放大到 1.5× —— 定格分镜里 1.5× 的一圈读起来是「外面又套了一个框」，
  // 不是「墨从印边洇出来」。贴着印边走 1.22×（每边洇出约 6dp）才读得出是洇。
  // 走主曲线（被推出去的东西只会减速）—— 与下落段的加速恰好构成一对。
  const spreadStyle = {
    opacity: spread.interpolate({ inputRange: [0, 0.12, 1], outputRange: [0, 0.5, 0] }),
    transform: [{ scale: spread.interpolate({ inputRange: [0, 1], outputRange: [0.97, 1.22] }) }],
  };
  const revealStyle = {
    opacity: reveal,
    transform: [{ translateY: reveal.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }],
  };

  const deltaText = delta === 0 ? '和昨天一样' : `比昨天${delta > 0 ? '多背' : '少背'} ${fmtNum(Math.abs(delta))} 个`;

  return (
    <ScrollView
      contentContainerStyle={[styles.wrap, { paddingBottom: bottomPad }]}
      showsVerticalScrollIndicator={false}
    >
      <Animated.View style={[styles.stage, shockStyle]}>
        {/* 印与洇圈叠在同一个固定尺寸的架子上：洇圈不吃印的 transform，
            它压在纸上，不该跟着章一起下落/回弹。 */}
        <View style={styles.sealStack}>
          <Animated.View pointerEvents="none" style={[styles.spread, { borderColor: c.ac }, spreadStyle]} />
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
        </View>

        <Animated.View style={[styles.reveal, revealStyle]}>
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
  // 印的架子：尺寸固定，所以印在里面下落、洇圈在里面扩张，都不会推挤旁边的字。
  // marginBottom 从 `seal` 移到这里 —— 章下落时它下方的留白不该跟着上下动。
  sealStack: {
    width: SEAL,
    height: SEAL,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACE.xxxl,
  },
  seal: {
    width: SEAL,
    height: SEAL,
    borderRadius: RADIUS.chip,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // 朱墨洇开的那一圈：与印面同尺寸起手，靠 scale 贴边洇出去（1.0 → 1.22）。
  spread: { position: 'absolute', width: SEAL, height: SEAL, borderRadius: RADIUS.chip, borderWidth: 1.5 },
  sealFrame: { position: 'absolute', top: 5, left: 5, right: 5, bottom: 5, borderWidth: 1, borderRadius: RADIUS.xs },
  sealGrid: { alignItems: 'center', justifyContent: 'center' },
  sealRow: { flexDirection: 'row' },
  sealChar: { fontFamily: serif, fontSize: 21, lineHeight: 25, fontWeight: WEIGHT.semibold },

  // 印落定之后才显影的那一层（标题 / 副文 / 三格）。alignSelf: stretch 是必须的：
  // 少了它，这一层的宽度会缩到「最宽的那个孩子」（标题），grid3 的 alignSelf: 'stretch'
  // 再跟着缩，三格数据就会挤在屏幕中间一小条里。
  reveal: { alignSelf: 'stretch', alignItems: 'center' },

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
