// 统计看板：连续天数 hero → 累计/已掌握 → 月度打卡日历 → 近 7 日 → 正确率 → 记忆状态。
// 数据全部来自本地库，纯 RN View 自绘，不引图表库。
//
// 这里刻意不再重复首页已有的「今日新词 / 今日复习」——统计屏回答的是「我坚持了多久、走得怎么样」，
// 今日待办属于首页。词库总量同理，它是语料事实不是进度事实。
import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, useWindowDimensions } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useTheme } from '../../src/theme/ThemeProvider';
import { serif, FONT, RADIUS, SPACE, WEIGHT, type Tokens } from '../../src/theme/tokens';
import { mix } from '../../src/lib/color';
import { useGutter } from '../../src/lib/layout';
import {
  getStreak,
  getLongestStreak,
  getWeekProgress,
  getMonthHistory,
  todayParts,
  getDailyHistory,
  getRetention,
  getStateDistribution,
  getLearningStats,
} from '../../src/db/queries';

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];
// 亮度梯度：15% / 40% / 68% / 100% 朱砂兑纸色 —— 四档深浅是有序量级，不是四种装饰色。
const LEVELS = [0.15, 0.4, 0.68, 1];

const STATE_META: Record<string, { label: string; key: keyof Tokens }> = {
  new: { label: '新词', key: 'tx3' },
  learning: { label: '学习中', key: 'ac' },
  review: { label: '复习中', key: 'tx2' },
  relearning: { label: '重新学习', key: 'b1t' },
};

export default function StatsScreen() {
  const { colors: c } = useTheme();
  const gutter = useGutter();
  const { width } = useWindowDimensions();

  // 打卡日历的宽度：用满卡片可用宽（窄屏自动收窄），上限 336dp。
  // 上限的判据不是「好看」，是**语义**：格子是「印记」不是按钮 ——
  // 7 列 + 5dp 内衬下，336dp 对应单格边长 43dp，正好压在 48dp 触控目标之下；
  // 再宽就会被读成「可点的按钮」，与「这天打过卡」的陈述性语义冲突。
  const calW = Math.min(336, width - 2 * gutter - 2 * SPACE.xl);
  const [s, setS] = useState(compute);

  // 与首页一致：每次聚焦重算（tab 切换不重挂载，故需主动刷新）。
  useFocusEffect(
    React.useCallback(() => {
      setS(compute());
    }, [])
  );

  const maxDay = Math.max(1, ...s.history.map((h) => h.new_count + h.review_count));
  const maxMonth = Math.max(1, ...s.month.map((m) => m.total));
  const monthDays = s.month.filter((m) => m.total > 0).length;
  const distTotal = Math.max(1, ...s.dist.map((d) => d.count));
  const pct = Math.round(s.retention.rate * 100);

  // 打卡日历：先补月初空位（周日为第一列），再铺日期格。
  const cells: (number | null)[] = [
    ...Array.from({ length: s.firstWeekday }, () => null),
    ...s.month.map((m) => m.day),
  ];

  return (
    <ScrollView
      style={{ backgroundColor: c.bg }}
      contentContainerStyle={[styles.container, { backgroundColor: c.bg, paddingHorizontal: gutter }]}
    >
      {/* 连续天数：整屏的主角，用最大字号 */}
      <View style={[styles.streak, { backgroundColor: c.sf, borderColor: c.bd }]}>
        <Text style={[styles.k, { color: c.tx3 }]}>连 续 学 习</Text>
        <View style={styles.srow}>
          <Text style={[styles.big, { color: c.tx1, fontFamily: serif }]}>{s.streak}</Text>
          <Text style={[styles.bigUnit, { color: c.tx3 }]}>天</Text>
        </View>
        <Text style={[styles.sub2, { color: c.tx3 }]}>
          最长 {s.longest} 天 · 本周 {s.week.done} / {s.week.total}
        </Text>
      </View>

      <View style={styles.grid2}>
        <Stat label="累 计 学 习" value={s.learned.learned} colors={c} />
        <Stat label="已 掌 握" value={s.learned.mastered} colors={c} />
      </View>

      {/* 打卡记录：有表头、有日期数字、有图例 —— 每一格都自明，不用猜 */}
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
              const total = s.month[d - 1].total;
              const lv = total === 0 ? 0 : Math.min(4, Math.ceil((total / maxMonth) * 4));
              const future = d > s.todayDay;
              return (
                <View key={d} style={styles.calOuter}>
                  <View
                    style={[
                      styles.calDay,
                      lv > 0 && !future ? { backgroundColor: mix(c.bg, c.ac, LEVELS[lv - 1]) } : null,
                      future ? { opacity: 0.35 } : null,
                    ]}
                  >
                    <Text
                      style={{
                        fontSize: 11,
                        fontWeight: WEIGHT.medium,
                        fontVariant: ['tabular-nums'],
                        // 只有最深的第 4 档用纸色字（白文印）；1–3 档底色还不够深，
                        // 用纸色字对比度只有 3.2/3.0，低于可读线 —— 一律用 tx1。
                        color: future ? c.tx3 : lv === 0 ? c.tx3 : lv >= 4 ? c.bg : lv === 1 ? c.tx2 : c.tx1,
                      }}
                    >
                      {d}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
          <View style={styles.calft}>
            <Text style={[styles.footText, { color: c.tx3 }]}>
              {s.monthLabel} 月 · 打卡 {monthDays} 天 · 连续 {s.streak} 天
            </Text>
            <View style={styles.lgnd}>
              <Text style={[styles.lgndText, { color: c.tx3 }]}>少</Text>
              {LEVELS.map((t, i) => (
                <View
                  key={i}
                  style={[
                    styles.lgndSw,
                    i === 0
                      ? { backgroundColor: c.pg, borderWidth: 1, borderColor: c.bd }
                      : { backgroundColor: mix(c.bg, c.ac, t) },
                  ]}
                />
              ))}
              <Text style={[styles.lgndText, { color: c.tx3 }]}>多</Text>
            </View>
          </View>
        </View>
      </Card>

      {/* 近 7 日：柱高编码量级，标签独立成行 */}
      <Card colors={c}>
        <Text style={[styles.kCard, { color: c.tx3 }]}>近 7 日</Text>
        <View style={[styles.bars, { borderBottomColor: c.bd }]}>
          {s.history.map((h, i) => {
            const total = h.new_count + h.review_count;
            const hgt = Math.max(4, Math.round((total / maxDay) * 74));
            const isToday = i === s.history.length - 1;
            return (
              <View key={h.date} style={styles.barCol}>
                <View style={[styles.bar, { height: hgt, backgroundColor: isToday ? c.ac : c.bd2 }]} />
              </View>
            );
          })}
        </View>
        <View style={styles.barlab}>
          {s.history.map((h, i) => {
            const isToday = i === s.history.length - 1;
            return (
              <Text key={h.date} style={[styles.barDay, { color: isToday ? c.ac : c.tx3 }]}>
                {WEEKDAYS[weekdayOfKey(h.date)]}
              </Text>
            );
          })}
        </View>
        <Text style={[styles.note, { color: c.tx3 }]}>柱高 = 当日新学 + 复习次数</Text>
      </Card>

      {/* 正确率：百分比必须配长度编码，光给数字不通过「量度」原则 */}
      <Card colors={c}>
        <View style={styles.retRow}>
          <Text style={[styles.retLabel, { color: c.tx1 }]}>正确率 · Good / Easy</Text>
          <Text style={[styles.retVal, { color: c.tx1, fontFamily: serif }]}>{pct}%</Text>
        </View>
        <View style={[styles.track, { backgroundColor: c.bd }]}>
          <View style={[styles.trackFill, { width: `${pct}%`, backgroundColor: c.ac }]} />
        </View>
        <Text style={[styles.note, { color: c.tx3 }]}>
          {s.retention.total > 0 ? `共 ${s.retention.total} 次评分 · 答对 ${s.retention.correct} 次` : '还没有评分记录'}
        </Text>
      </Card>

      {/* 记忆状态：一张卡的记忆有多牢，按 FSRS 状态分层 */}
      <Card colors={c}>
        <Text style={[styles.kCard, { color: c.tx3 }]}>记 忆 状 态</Text>
        {s.dist.length === 0 ? (
          <Text style={[styles.empty, { color: c.tx3 }]}>还没有开始学习</Text>
        ) : (
          s.dist.map((d, i) => {
            const meta = STATE_META[d.state] ?? { label: d.state, key: 'tx2' as keyof Tokens };
            const color = c[meta.key];
            return (
              <View
                key={d.state}
                style={[styles.distRow, i < s.dist.length - 1 && { borderBottomWidth: 1, borderBottomColor: c.bd }]}
              >
                <Text style={[styles.distLabel, { color: c.tx1 }]}>{meta.label}</Text>
                <View style={[styles.distTrack, { backgroundColor: c.pg }]}>
                  <View style={[styles.distFill, { width: `${(d.count / distTotal) * 100}%`, backgroundColor: color }]} />
                </View>
                <Text style={[styles.distCount, { color: c.tx1 }]}>{d.count}</Text>
              </View>
            );
          })
        )}
      </Card>

      <Text style={[styles.tail, { color: c.tx3 }]}>
        进度写入本地数据库，关闭应用与跨日统计均持久保存。
      </Text>
    </ScrollView>
  );
}

// 'YYYY-MM-DD' → 星期几（0=周日）。
function weekdayOfKey(key: string): number {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d).getDay();
}

// 一次性取全部统计快照。
function compute() {
  const t = todayParts();
  return {
    streak: getStreak(),
    longest: getLongestStreak(),
    week: getWeekProgress(),
    month: getMonthHistory(t.year, t.month0),
    monthLabel: t.month0 + 1,
    todayDay: t.day,
    firstWeekday: new Date(t.year, t.month0, 1).getDay(),
    learned: getLearningStats(),
    history: getDailyHistory(7),
    retention: getRetention(),
    dist: getStateDistribution(),
  };
}

function Card({ children, colors: c }: { children: React.ReactNode; colors: Tokens }) {
  return <View style={[styles.card, { backgroundColor: c.sf, borderColor: c.bd }]}>{children}</View>;
}

function Stat({ label, value, colors: c }: { label: string; value: number; colors: Tokens }) {
  return (
    <View style={[styles.stat, { backgroundColor: c.sf, borderColor: c.bd }]}>
      <Text style={[styles.k, { color: c.tx3 }]}>{label}</Text>
      <View style={styles.statVRow}>
        <Text style={[styles.statV, { color: c.tx1, fontFamily: serif }]}>{value}</Text>
        <Text style={[styles.statU, { color: c.tx3 }]}>词</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, paddingTop: SPACE.sm, paddingHorizontal: SPACE.xl, paddingBottom: SPACE.huge },
  k: { fontSize: 10, letterSpacing: 1.6, fontWeight: WEIGHT.semibold },
  // 卡片内的小节标签：与正文之间必须有呼吸，否则标签会粘在内容上。
  kCard: { fontSize: 10, letterSpacing: 1.6, fontWeight: WEIGHT.semibold, marginBottom: SPACE.lg },

  streak: { borderRadius: RADIUS.card, borderWidth: 1, paddingTop: SPACE.xxxl, paddingHorizontal: SPACE.xl, paddingBottom: SPACE.xl },
  srow: { flexDirection: 'row', alignItems: 'flex-end', marginTop: SPACE.sm },
  big: { fontSize: FONT.hero, lineHeight: 48, letterSpacing: -1, fontWeight: WEIGHT.semibold, fontVariant: ['tabular-nums'] },
  bigUnit: { fontSize: 13, letterSpacing: 1.5, marginLeft: 6, marginBottom: 7, fontWeight: WEIGHT.semibold },
  sub2: { fontSize: 12, letterSpacing: 0.4, marginTop: SPACE.lg },

  grid2: { flexDirection: 'row', gap: SPACE.md, marginTop: SPACE.xxl },
  stat: { flex: 1, borderRadius: RADIUS.card, borderWidth: 1, paddingTop: SPACE.xxxl, paddingHorizontal: SPACE.xl, paddingBottom: SPACE.xl },
  statVRow: { flexDirection: 'row', alignItems: 'baseline', marginTop: SPACE.md },
  statV: { fontSize: 31, lineHeight: 36, letterSpacing: -0.3, fontWeight: WEIGHT.semibold, fontVariant: ['tabular-nums'] },
  statU: { fontSize: 12, marginLeft: 3, fontWeight: WEIGHT.medium },

  card: { borderRadius: RADIUS.card, borderWidth: 1, paddingTop: SPACE.xxl, paddingHorizontal: SPACE.xl, paddingBottom: SPACE.xxl, marginTop: SPACE.md },

  // 日历：整体收窄到 252dp 居中，格子才是「印记」不是「按钮」。
  // 7 列用「外格 1/7 宽 + 内衬」实现，不用 gap —— 百分比宽度叠加 gap 会溢出换行，第 7 天掉到下一行。
  calWrap: { marginTop: SPACE.xs },
  calRow: { flexDirection: 'row', flexWrap: 'wrap', alignSelf: 'center', width: '100%' },
  calOuter: { width: `${100 / 7}%`, padding: 2.5, alignItems: 'center', justifyContent: 'center' },
  calhdText: { fontSize: 10, fontWeight: WEIGHT.semibold },
  calDay: {
    alignSelf: 'stretch',
    aspectRatio: 1,
    borderRadius: RADIUS.xs,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calft: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: SPACE.md },
  footText: { fontSize: 10.5, letterSpacing: 0.3 },
  lgnd: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  lgndText: { fontSize: 9.5, letterSpacing: 1 },
  lgndSw: { width: 11, height: 11, borderRadius: RADIUS.xs },

  bars: { flexDirection: 'row', alignItems: 'flex-end', gap: SPACE.sm, height: 78, borderBottomWidth: 1, marginTop: SPACE.xs },
  barCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  bar: { width: '100%', maxWidth: 24, borderTopLeftRadius: 3, borderTopRightRadius: 3 },
  barlab: { flexDirection: 'row', gap: SPACE.sm, marginTop: SPACE.md },
  barDay: { flex: 1, textAlign: 'center', fontSize: 10, fontWeight: WEIGHT.medium },

  retRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  retLabel: { fontSize: FONT.body, fontWeight: WEIGHT.medium },
  retVal: { fontSize: 22, fontWeight: WEIGHT.semibold, fontVariant: ['tabular-nums'] },
  track: { height: 2, borderRadius: RADIUS.mark, marginTop: SPACE.lg, overflow: 'hidden' },
  trackFill: { height: 2, borderRadius: RADIUS.mark },

  distRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: SPACE.md },
  distLabel: { width: 64, fontSize: 14, fontWeight: WEIGHT.medium },
  distTrack: { flex: 1, height: 8, borderRadius: RADIUS.xs, marginHorizontal: SPACE.sm, overflow: 'hidden' },
  distFill: { height: 8, borderRadius: RADIUS.xs },
  distCount: { width: 44, textAlign: 'right', fontSize: 14, fontWeight: WEIGHT.semibold, fontVariant: ['tabular-nums'] },
  empty: { paddingVertical: 18, textAlign: 'center', fontSize: 13 },
  note: { fontSize: 11, letterSpacing: 0.2, marginTop: SPACE.md },
  tail: { fontSize: 12, lineHeight: 18, marginTop: SPACE.xl, letterSpacing: 0.5 },
});
