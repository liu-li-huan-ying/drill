// 统计看板：连续天数 hero → 累计/已掌握 → 月度打卡日历 → 本周 → 正确率 → 记忆状态。
// 数据全部来自本地库，纯 RN View 自绘，不引图表库。
//
// 这里刻意不再重复首页已有的「今日新词 / 今日复习」——统计屏回答的是「我坚持了多久、走得怎么样」，
// 今日待办属于首页。词库总量同理，它是语料事实不是进度事实。
//
// 一周的锚点是**周一**（P1.6）：日历表头、本周柱状图、本周进度三处必须是同一个约定，
// 否则同一屏里「周三」在两个地方落在不同的列上。
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, ScrollView, Animated, StyleSheet } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useTheme } from '../../src/theme/ThemeProvider';
import {
  serif, FONT, RADIUS, SPACE, WEIGHT, TRACK, STAMP, MOTION, stampInk,
  type StampInk, type Tokens,
} from '../../src/theme/tokens';
import { useGutter } from '../../src/lib/layout';
import { easeSettle, useReducedMotion } from '../../src/lib/motion';
import { fmtNum, fmtPct } from '../../src/lib/num';
import { Num, NumUnit, Seal } from '../../src/components/ui';
import {
  getStreak,
  getLongestStreak,
  getWeekProgress,
  getWeekHistory,
  getMonthHistory,
  todayParts,
  getRetention,
  getStateDistribution,
  getLearningStats,
} from '../../src/db/queries';

// 表头从**周一**起（P1.6）。数组顺序就是屏幕上的列顺序，不再靠 getDay() 的周日为 0 索引。
const WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日'];

const STATE_META: Record<string, { label: string; key: keyof Tokens }> = {
  new: { label: '新词', key: 'tx3' },
  learning: { label: '学习中', key: 'ac' },
  review: { label: '复习中', key: 'tx2' },
  relearning: { label: '重新学习', key: 'b1t' },
};

export default function StatsScreen() {
  const { colors: c } = useTheme();
  const gutter = useGutter();

  // 打卡日历的宽度上限：7 列 × 48dp = 336。48 是 App 全局的触控节奏（`SPACE.touch`），
  // 格子本身不可点，但列宽与全局节奏同源，日历才不会显得比别处「密一档」。
  // 窄屏时 `width: '100%'` 会让它自己收窄（列宽按百分比），手机上无需另算。
  const calW = 7 * SPACE.touch;
  const [s, setS] = useState(compute);
  const [replay, setReplay] = useState(0);

  // 与首页一致：每次聚焦重算（tab 切换不重挂载，故需主动刷新）。
  useFocusEffect(
    React.useCallback(() => {
      setS(compute());
      // 每次聚焦重播钤印。刷新进度条的功能是「读数据」，重播钤印的功能是「仪式」——
      // 这一屏值得重复的只有后者（它不消耗注意力，只确认「这个月我盖了这么多天」）。
      setReplay((n) => n + 1);
    }, [])
  );

  const maxDay = Math.max(1, ...s.weekBars.map((h) => h.new_count + h.review_count));
  const maxMonth = Math.max(1, ...s.month.map((m) => m.total));
  const monthDays = s.month.filter((m) => m.total > 0).length;
  const distTotal = s.dist.reduce((a, d) => a + d.count, 0);
  const distMax = Math.max(1, ...s.dist.map((d) => d.count));
  const pct = Math.round(s.retention.rate * 100);
  const pctText = fmtPct(s.retention.rate);

  // 打卡日历：先补月初空位（**周一**为第一列），再铺日期格。
  const cells: (number | null)[] = [
    ...Array.from({ length: s.firstWeekday }, () => null),
    ...s.month.map((m) => m.day),
  ];

  // 错峰钤印的拍子：一屏 30 枚印同时「啪」出来是一片闪，一枚一枚盖上才读得出
  // 「这个月我盖了这么多天」。只给**打了卡的**日子排拍子（空槽不占拍），
  // 且封顶 12 拍 —— 月底的格子不该排在最后才出现。
  const cadence = new Map<number, number>();
  cells
    .filter((d): d is number => d != null && d <= s.todayDay && s.month[d - 1].total > 0)
    .forEach((d, i) => cadence.set(d, Math.min(i, 12)));

  return (
    <ScrollView
      style={{ backgroundColor: c.bg }}
      contentContainerStyle={[styles.container, { backgroundColor: c.bg, paddingHorizontal: gutter }]}
    >
      {/* 连续天数：整屏的主角，用最大字号 */}
      <View style={[styles.streak, { backgroundColor: c.sf, borderColor: c.bd }]}>
        <Text style={[styles.k, { color: c.tx3 }]}>连 续 学 习</Text>
        <NumUnit
          value={s.streak}
          unit="天"
          color={c.tx1}
          unitColor={c.tx3}
          style={styles.srow}
          valueStyle={styles.big}
          unitStyle={styles.bigUnit}
        />
        <Text style={[styles.sub2, { color: c.tx3 }]}>
          最长 {fmtNum(s.longest)} 天 · 本周 {s.week.done} / {s.week.total} 天
        </Text>
      </View>

      <View style={styles.grid2}>
        <Stat label="累 计 学 习" value={s.learned.learned} colors={c} />
        <Stat label="已 掌 握" value={s.learned.mastered} colors={c} />
      </View>

      {/* 打卡记录：有表头、有日期数字、有印记 —— 每一格都自明，不用猜 */}
      <Card colors={c}>
        <Text style={[styles.kCard, { color: c.tx3 }]}>打 卡 记 录</Text>
        <View style={styles.calWrap}>
          <View style={[styles.calRow, { maxWidth: calW }]}>
            {WEEKDAYS.map((w) => (
              <View key={w} style={styles.calOuter}>
                <Text style={[styles.calhdText, { color: c.tx3 }]}>{w}</Text>
              </View>
            ))}
          </View>
          <View style={[styles.calRow, { maxWidth: calW }]}>
            {cells.map((d, i) => {
              if (d == null) return <View key={`e${i}`} style={styles.calOuter} />;
              const future = d > s.todayDay;
              // 量级 → 墨量档（同尺寸，1 细边朱文 / 2 粗边朱文 / 3 满墨白文；见 tokens 的 STAMP）。
              const ink = future ? 0 : stampInk(s.month[d - 1].total, maxMonth);
              return (
                <View key={d} style={styles.calOuter}>
                  <View style={styles.calDay}>
                    <Text style={[styles.calDayText, { color: ink === 0 ? c.tx3 : c.tx1 }]}>
                      {d}
                    </Text>
                    {/* 印记槽：打卡日落一枚朱印，未打卡留空槽 —— 槽高恒定，行高才不跳。
                        未打卡**不画印**（不是画一枚空印）：给 30 个空槽描一圈虚线，
                        等于凭空多塞 30 个元素，而空白的克制本身就是「还没盖」的表达。 */}
                    <View style={styles.stampSlot}>
                      {ink === 0 ? null : (
                        <DayStamp
                          ink={ink}
                          delay={(cadence.get(d) ?? 0) * 16}
                          replay={replay}
                          paper={c.sf}
                        />
                      )}
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
          <View style={styles.calft}>
            <Text style={[styles.footText, { color: c.tx3 }]}>
              {s.monthLabel} 月打了 {monthDays} 天卡 · 连着 {fmtNum(s.streak)} 天
            </Text>
            {/* 图例用与格子**同一种印记、同一条分档规则**：图例画色块、格子画印记，
                读者就得自己做一次映射 —— 图例的意义正是免掉这一步。
                三枚样本的**尺寸完全一样**，变的只有墨量（细边 → 粗边 → 满墨）：
                尺寸一多样，眼睛去比的就是「哪个更大」，而不是「哪天的墨更重」——
                而相邻两档只差 1.6dp，比大小本身也分不出来（见 tokens 的 STAMP）。 */}
            <View style={styles.lgnd}>
              <Text style={[styles.lgndText, { color: c.tx3 }]}>少</Text>
              {([1, 2, 3] as const).map((ink) => (
                <View key={ink} style={styles.lgndSlot}>
                  <Seal size={STAMP.size} ink={ink} paper={c.sf} />
                </View>
              ))}
              <Text style={[styles.lgndText, { color: c.tx3 }]}>多</Text>
            </View>
          </View>
        </View>
      </Card>

      {/* 本周：柱高编码量级，标签独立成行 */}
      <Card colors={c}>
        <Text style={[styles.kCard, { color: c.tx3 }]}>本 周</Text>
        <View style={[styles.bars, { borderBottomColor: c.bd }]}>
          {s.weekBars.map((h, i) => {
            const total = h.new_count + h.review_count;
            const hgt = total === 0 ? 0 : Math.max(4, Math.round((total / maxDay) * 74));
            const isToday = i === s.todayIdx;
            return (
              <View key={h.date} style={styles.barCol}>
                {hgt > 0 ? (
                  <View style={[styles.bar, { height: hgt, backgroundColor: isToday ? c.ac : c.bd2 }]} />
                ) : null}
              </View>
            );
          })}
        </View>
        <View style={styles.barlab}>
          {WEEKDAYS.map((w, i) => (
            <Text
              key={w}
              style={[styles.barDay, { color: i === s.todayIdx ? c.ac : c.tx3 }]}
            >
              {w}
            </Text>
          ))}
        </View>
        {/* 工程注释改人话（P2.4）：「柱高 = 当日新学 + 复习次数」是给开发者看的恒等式。 */}
        <Text style={[styles.note, { color: c.tx3 }]}>柱子越高，那天背得越多</Text>
      </Card>

      {/* 正确率：百分比必须配长度编码，光给数字不通过「量度」原则 */}
      <Card colors={c}>
        <View style={styles.retRow}>
          <Text style={[styles.retLabel, { color: c.tx1 }]}>正确率 · 良好以上</Text>
          <Num value={pctText} style={[styles.retVal, { color: c.tx1, fontFamily: serif }]} />
        </View>
        {/* 轨道取 pg（机身底）：与词库量度条同一条规矩 —— 轨道是「凹槽」不是「描边」。 */}
        <View style={[styles.track, { backgroundColor: c.pg }]}>
          <View style={[styles.trackFill, { width: `${pct}%`, backgroundColor: c.ac }]} />
        </View>
        <Text style={[styles.note, { color: c.tx3 }]}>
          {s.retention.total > 0
            ? `一共评了 ${fmtNum(s.retention.total)} 次，答对 ${fmtNum(s.retention.correct)} 次`
            : '还没有评分记录'}
        </Text>
      </Card>

      {/* 记忆状态：一张卡的记忆有多牢，按 FSRS 状态分层 */}
      <Card colors={c}>
        <View style={styles.cardHead}>
          <Text style={[styles.kCard, { color: c.tx3 }]}>记 忆 状 态</Text>
          {/* 每行给的是「这个词状态有多少词」，卡头补一次总量与单位 ——
              否则两个数字（行 / 合计）谁是谁全靠猜（P1.5）。 */}
          {s.dist.length > 0 ? (
            <View style={styles.headNum}>
              <Text style={[styles.headNumText, { color: c.tx3 }]}>共</Text>
              <Num value={distTotal} style={[styles.headNumText, { color: c.tx3 }]} />
              <Text style={[styles.headNumText, { color: c.tx3 }]}>词</Text>
            </View>
          ) : null}
        </View>
        {s.dist.length === 0 ? (
          <Text style={[styles.empty, { color: c.tx3 }]}>还没开始，先去背几个词呗</Text>
        ) : (
          s.dist.map((d, i) => {
            const meta = STATE_META[d.state] ?? { label: d.state, key: 'tx2' as keyof Tokens };
            const color = c[meta.key];
            // 最小条宽 2%：只有几个词的档位也必须在条上看得见，
            // 否则「新词 3 / 复习中 900」会画成「有一条、另一条不存在」（P1.5）。
            const w = Math.max(2, (d.count / distMax) * 100);
            return (
              <View
                key={d.state}
                style={[styles.distRow, i < s.dist.length - 1 && { borderBottomWidth: 1, borderBottomColor: c.bd }]}
              >
                <Text style={[styles.distLabel, { color: c.tx1 }]}>{meta.label}</Text>
                <View style={[styles.distTrack, { backgroundColor: c.pg }]}>
                  <View style={[styles.distFill, { width: `${w}%`, backgroundColor: color }]} />
                </View>
                <Num value={d.count} style={[styles.distCount, { color: c.tx1 }]} />
              </View>
            );
          })
        )}
      </Card>

      <Text style={[styles.tail, { color: c.tx3 }]}>
        学习记录只存在这台手机上，关掉应用也不会丢。
      </Text>
    </ScrollView>
  );
}

// 一次性取全部统计快照。
function compute() {
  const t = todayParts();
  const mondayFirst = (new Date(t.year, t.month0, t.day).getDay() + 6) % 7; // 周一 = 0
  return {
    streak: getStreak(),
    longest: getLongestStreak(),
    week: getWeekProgress(),
    weekBars: getWeekHistory(),
    todayIdx: mondayFirst,
    month: getMonthHistory(t.year, t.month0),
    monthLabel: t.month0 + 1,
    todayDay: t.day,
    // 月初空位按**周一为第一列**算：周日（getDay 0）→ 第 6 个空位。
    firstWeekday: (new Date(t.year, t.month0, 1).getDay() + 6) % 7,
    learned: getLearningStats(),
    retention: getRetention(),
    dist: getStateDistribution(),
  };
}

/**
 * 日历格里的那枚印。进场时**钤**下去（比例从 1.3 压到 1 + 淡入），不是淡入一个色块。
 *
 * 三件事各有各的理由：
 *   ① 用 `Seal` 原子而不是自己画方块 —— 墨量分档（细边 / 粗边 / 满墨）是印章的语汇，
 *      必须与图例、与其它地方的朱印同源，否则日历里的印会变成一个孤立的样式。
 *   ② `delay` 错峰（见 cadence）：一枚一枚盖上，才是「我这个月盖了这么多天」。
 *   ③ `replay` 每次聚焦 +1：tab 屏不重挂载，没有它这个仪式只在首次进入时演一次。
 */
function DayStamp({
  ink,
  delay,
  replay,
  paper,
}: {
  ink: StampInk;
  delay: number;
  replay: number;
  paper: string;
}) {
  const reduce = useReducedMotion();
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    // 「减弱动效」时印直接就在（不播，不是播得慢一点）。
    if (reduce) {
      v.setValue(1);
      return;
    }
    v.setValue(0);
    const a = Animated.timing(v, {
      toValue: 1, duration: MOTION.sealTamp, delay, easing: easeSettle(), useNativeDriver: true,
    });
    a.start();
    return () => a.stop();
  }, [delay, reduce, replay, v]);
  return (
    <Animated.View
      style={{
        opacity: v.interpolate({ inputRange: [0, 0.35, 1], outputRange: [0, 1, 1] }),
        transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [1.3, 1] }) }],
      }}
    >
      <Seal size={STAMP.size} ink={ink} paper={paper} />
    </Animated.View>
  );
}

function Card({ children, colors: c }: { children: React.ReactNode; colors: Tokens }) {
  return <View style={[styles.card, { backgroundColor: c.sf, borderColor: c.bd }]}>{children}</View>;
}

function Stat({ label, value, colors: c }: { label: string; value: number; colors: Tokens }) {
  return (
    <View style={[styles.stat, { backgroundColor: c.sf, borderColor: c.bd }]}>
      <Text style={[styles.k, { color: c.tx3 }]}>{label}</Text>
      <NumUnit
        value={value}
        unit="词"
        color={c.tx1}
        unitColor={c.tx3}
        style={{ marginTop: SPACE.md }}
        valueStyle={styles.statV}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, paddingTop: SPACE.sm, paddingHorizontal: SPACE.xl, paddingBottom: SPACE.huge },
  k: { fontSize: 10, letterSpacing: TRACK.label, fontWeight: WEIGHT.semibold },
  // 卡片内的小节标签：与正文之间必须有呼吸，否则标签会粘在内容上。
  kCard: { fontSize: 10, letterSpacing: TRACK.label, fontWeight: WEIGHT.semibold },
  cardHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: SPACE.md, marginBottom: SPACE.lg },
  headNum: { flexDirection: 'row', alignItems: 'baseline', gap: 2, flexShrink: 0 },
  headNumText: { fontSize: 11, fontWeight: WEIGHT.medium },

  streak: { borderRadius: RADIUS.card, borderWidth: 1, paddingTop: SPACE.xxxl, paddingHorizontal: SPACE.xl, paddingBottom: SPACE.xl },
  srow: { marginTop: SPACE.sm },
  big: { fontSize: FONT.hero, lineHeight: 48, letterSpacing: TRACK.tight, fontWeight: WEIGHT.semibold },
  bigUnit: { fontSize: 13, marginBottom: 7, fontWeight: WEIGHT.semibold },
  sub2: { fontSize: 12, letterSpacing: TRACK.body, marginTop: SPACE.lg },

  grid2: { flexDirection: 'row', gap: SPACE.md, marginTop: SPACE.xxl },
  stat: { flex: 1, borderRadius: RADIUS.card, borderWidth: 1, paddingTop: SPACE.xxxl, paddingHorizontal: SPACE.xl, paddingBottom: SPACE.xl },
  statV: { fontSize: FONT.stat, lineHeight: 36, letterSpacing: TRACK.tight, fontWeight: WEIGHT.semibold },

  card: { borderRadius: RADIUS.card, borderWidth: 1, paddingTop: SPACE.xxl, paddingHorizontal: SPACE.xl, paddingBottom: SPACE.xxl, marginTop: SPACE.md },

  // 日历：7 列用「外格 1/7 宽 + 内衬」实现，不用 gap —— 百分比宽度叠加 gap 会溢出换行，第 7 天掉到下一行。
  calWrap: { marginTop: SPACE.xs },
  calRow: { flexDirection: 'row', flexWrap: 'wrap', alignSelf: 'center', width: '100%' },
  calOuter: { width: `${100 / 7}%`, padding: 2.5, alignItems: 'center', justifyContent: 'center' },
  calhdText: { fontSize: 10, fontWeight: WEIGHT.semibold },
  // 格子不再是「填色方块」：数字占一行、印记占一槽。原来靠整格底色编码量级，
  // 一格里就只剩日期数字能看，深浅还要靠图例反查；现在量级落在印记上，数字恒为墨色。
  calDay: { alignSelf: 'stretch', alignItems: 'center', paddingTop: SPACE.xs, paddingBottom: SPACE.xs },
  calDayText: { fontSize: 11, fontWeight: WEIGHT.medium, fontVariant: ['tabular-nums'] },
  stampSlot: { height: STAMP.slot, alignItems: 'center', justifyContent: 'center' },
  calft: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SPACE.sm, marginTop: SPACE.md },
  footText: { flexShrink: 1, fontSize: 10.5, letterSpacing: TRACK.body },
  lgnd: { flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 0 },
  lgndText: { fontSize: 9.5, letterSpacing: TRACK.body },
  lgndSlot: { width: STAMP.slot, height: STAMP.slot, alignItems: 'center', justifyContent: 'center' },

  bars: { flexDirection: 'row', alignItems: 'flex-end', gap: SPACE.sm, height: 78, borderBottomWidth: 1, marginTop: SPACE.xs },
  barCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  bar: { width: '100%', maxWidth: 24, borderTopLeftRadius: 3, borderTopRightRadius: 3 },
  barlab: { flexDirection: 'row', gap: SPACE.sm, marginTop: SPACE.md },
  barDay: { flex: 1, textAlign: 'center', fontSize: 10, fontWeight: WEIGHT.medium },

  retRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: SPACE.md },
  retLabel: { flexShrink: 1, fontSize: FONT.body, fontWeight: WEIGHT.medium },
  retVal: { fontSize: 22, fontWeight: WEIGHT.semibold },
  track: { height: 2, borderRadius: RADIUS.mark, marginTop: SPACE.lg, overflow: 'hidden' },
  trackFill: { height: 2, borderRadius: RADIUS.mark },

  distRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: SPACE.md },
  distLabel: { width: 64, fontSize: 14, fontWeight: WEIGHT.medium },
  distTrack: { flex: 1, height: 8, borderRadius: RADIUS.xs, marginHorizontal: SPACE.sm, overflow: 'hidden' },
  distFill: { height: 8, borderRadius: RADIUS.xs },
  distCount: { width: 44, textAlign: 'right', fontSize: 14, fontWeight: WEIGHT.semibold },
  empty: { paddingVertical: 18, textAlign: 'center', fontSize: 13 },
  note: { fontSize: 11, letterSpacing: TRACK.body, marginTop: SPACE.md },
  tail: { fontSize: 12, lineHeight: 18, marginTop: SPACE.xl, letterSpacing: TRACK.body },
});
