// 统计看板（M5）：连续打卡 / 今日 / 累计 / 近 7 日趋势 / 留存率 / 记忆状态分布。
// 数据全部来自本地库，纯 RN View 自绘条形，不引图表库。朱批设计语言。
import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useTheme } from '../../src/theme/ThemeProvider';
import { serif, FONT, type Tokens } from '../../src/theme/tokens';
import {
  getTodayCounts,
  getStreak,
  getDailyHistory,
  getRetention,
  getStateDistribution,
  getLearningStats,
} from '../../src/db/queries';

// 卡片状态 → 展示名 + 配色（朱砂强调学习中，灰色淡化新词，重来红标重新学习）。
const STATE_META: Record<string, { label: string; key: keyof Tokens }> = {
  new: { label: '新词', key: 'tx3' },
  learning: { label: '学习中', key: 'ac' },
  review: { label: '复习中', key: 'tx2' },
  relearning: { label: '重新学习', key: 'b1t' },
};

export default function StatsScreen() {
  const { colors: c } = useTheme();
  const [s, setS] = useState(compute);

  // 与首页一致：每次聚焦重算，tab 切换不重挂载故需主动刷新。
  useFocusEffect(
    React.useCallback(() => {
      setS(compute());
    }, [])
  );

  const today = getTodayCounts();
  const history = s.history;
  const maxDay = Math.max(1, ...history.map((h) => h.new_count + h.review_count));
  const dist = s.dist;
  const distTotal = Math.max(1, ...dist.map((d) => d.count));

  return (
    <ScrollView contentContainerStyle={[styles.container, { backgroundColor: c.bg }]}>
      <Text style={[styles.kicker, { color: c.tx3 }]}>统 计 · STATS</Text>

      {/* 连续打卡：最醒目的成就位 */}
      <View style={[styles.streak, { backgroundColor: c.ac, borderColor: c.ac }]}>
        <Text style={[styles.streakNum, { color: c.acon, fontFamily: serif }]}>{s.streak}</Text>
        <Text style={[styles.streakLabel, { color: c.acon }]}>天连续打卡</Text>
      </View>

      {/* 今日三栏 */}
      <View style={[styles.row3, { backgroundColor: c.sf, borderColor: c.bd }]}>
        <Metric label="今日新词" value={today.newDone} colors={c} />
        <View style={[styles.vline, { backgroundColor: c.bd }]} />
        <Metric label="今日复习" value={today.reviewDone} colors={c} />
        <View style={[styles.vline, { backgroundColor: c.bd }]} />
        <Metric label="已掌握" value={s.learned.mastered} colors={c} accent />
      </View>

      {/* 学习总览 */}
      <Text style={[styles.group, { color: c.tx3 }]}>学 习 总 览</Text>
      <View style={[styles.card, { backgroundColor: c.sf, borderColor: c.bd }]}>
        <Row label="累计学习" value={`${s.learned.learned} 词`} colors={c} />
        <Row label="词库总量" value={`${s.learned.totalCards} 词`} colors={c} last />
      </View>

      {/* 近 7 日趋势 */}
      <Text style={[styles.group, { color: c.tx3 }]}>近 7 日</Text>
      <View style={[styles.card, { backgroundColor: c.sf, borderColor: c.bd, paddingVertical: 16 }]}>
        <View style={styles.bars}>
          {history.map((h, i) => {
            const total = h.new_count + h.review_count;
            const hgt = Math.round((total / maxDay) * 76) + (total > 0 ? 4 : 0);
            const day = h.date.slice(5); // MM-DD
            const isToday = i === history.length - 1;
            return (
              <View key={h.date} style={styles.barCol}>
                <Text style={[styles.barVal, { color: total > 0 ? c.tx1 : c.tx3 }]}>
                  {total > 0 ? total : ''}
                </Text>
                <View style={styles.barTrack}>
                  <View
                    style={[
                      styles.barFill,
                      { height: hgt, backgroundColor: isToday ? c.ac : c.acsf },
                    ]}
                  />
                </View>
                <Text style={[styles.barDay, { color: isToday ? c.ac : c.tx3 }]}>{day}</Text>
              </View>
            );
          })}
        </View>
        <Text style={[styles.barsNote, { color: c.tx3 }]}>每柱 = 当日新词 + 复习次数</Text>
      </View>

      {/* 留存率 */}
      <Text style={[styles.group, { color: c.tx3 }]}>留 存 率</Text>
      <View style={[styles.card, { backgroundColor: c.sf, borderColor: c.bd, paddingVertical: 16 }]}>
        <View style={styles.retHead}>
          <Text style={[styles.retPct, { color: c.ac, fontFamily: serif }]}>
            {Math.round(s.retention.rate * 100)}%
          </Text>
          <Text style={[styles.retSub, { color: c.tx3 }]}>
            共 {s.retention.total} 次评分 · 正确 {s.retention.correct}
          </Text>
        </View>
        <View style={[styles.track, { backgroundColor: c.pg }]}>
          <View style={[styles.trackFill, { width: `${Math.round(s.retention.rate * 100)}%`, backgroundColor: c.ac }]} />
        </View>
        <Text style={[styles.barsNote, { color: c.tx3 }]}>基于复习评分（Good/Easy 计为正确）</Text>
      </View>

      {/* 记忆状态分布 */}
      <Text style={[styles.group, { color: c.tx3 }]}>记 忆 状 态</Text>
      <View style={[styles.card, { backgroundColor: c.sf, borderColor: c.bd, paddingVertical: 8 }]}>
        {dist.length === 0 ? (
          <Text style={[styles.empty, { color: c.tx3 }]}>还没有开始学习</Text>
        ) : (
          dist.map((d, i) => {
            const meta = STATE_META[d.state] ?? { label: d.state, key: 'tx2' as keyof Tokens };
            const color = c[meta.key];
            return (
              <View key={d.state} style={[styles.distRow, i < dist.length - 1 && { borderBottomColor: c.bd, borderBottomWidth: 1 }]}>
                <Text style={[styles.distLabel, { color }]}>{meta.label}</Text>
                <View style={[styles.distTrack, { backgroundColor: c.pg }]}>
                  <View style={[styles.distFill, { width: `${(d.count / distTotal) * 100}%`, backgroundColor: color }]} />
                </View>
                <Text style={[styles.distCount, { color: c.tx1, fontVariant: ['tabular-nums'] }]}>{d.count}</Text>
              </View>
            );
          })
        )}
      </View>

      <Text style={[styles.note, { color: c.tx3 }]}>
        进度写入本地数据库，关闭应用与跨日统计均持久保存。
      </Text>
    </ScrollView>
  );
}

// 一次性取全部统计快照。
function compute() {
  return {
    streak: getStreak(),
    history: getDailyHistory(7),
    retention: getRetention(),
    dist: getStateDistribution(),
    learned: getLearningStats(),
  };
}

function Metric({
  label,
  value,
  colors: c,
  accent,
}: {
  label: string;
  value: number;
  colors: Tokens;
  accent?: boolean;
}) {
  return (
    <View style={styles.metric}>
      <Text style={[styles.metricVal, { color: accent ? c.ac : c.tx1, fontFamily: serif }]}>{value}</Text>
      <Text style={[styles.metricLabel, { color: c.tx2 }]}>{label}</Text>
    </View>
  );
}

function Row({
  label,
  value,
  colors: c,
  last,
}: {
  label: string;
  value: string;
  colors: Tokens;
  last?: boolean;
}) {
  return (
    <View style={[styles.rowLine, { borderBottomColor: c.bd }, last && { borderBottomWidth: 0 }]}>
      <Text style={[styles.rowLabel, { color: c.tx2 }]}>{label}</Text>
      <Text style={[styles.rowVal, { color: c.tx1, fontVariant: ['tabular-nums'] }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, paddingTop: 64, paddingHorizontal: 24, paddingBottom: 40 },
  kicker: { fontSize: 10.5, letterSpacing: 3, textTransform: 'uppercase', fontWeight: '600' },
  streak: { marginTop: 14, borderRadius: 12, paddingVertical: 18, alignItems: 'center', flexDirection: 'row', justifyContent: 'center' },
  streakNum: { fontSize: 46, lineHeight: 46, marginRight: 12 },
  streakLabel: { fontSize: 15, letterSpacing: 2 },
  row3: { marginTop: 16, borderRadius: 12, borderWidth: 1, flexDirection: 'row', alignItems: 'stretch', paddingVertical: 14 },
  metric: { flex: 1, alignItems: 'center' },
  metricVal: { fontSize: 28, lineHeight: 32 },
  metricLabel: { fontSize: 13, letterSpacing: 1, marginTop: 4 },
  vline: { width: 1 },
  group: { fontSize: 10.5, letterSpacing: 3, textTransform: 'uppercase', fontWeight: '600', marginTop: 26, marginBottom: 10 },
  card: { borderRadius: 12, borderWidth: 1, overflow: 'hidden' },
  rowLine: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: undefined },
  rowLabel: { fontSize: 14 },
  rowVal: { fontSize: 15 },
  bars: { flexDirection: 'row', paddingHorizontal: 8, alignItems: 'flex-end' },
  barCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  barVal: { fontSize: 11, marginBottom: 4, minHeight: 14 },
  barTrack: { height: 84, width: 14, justifyContent: 'flex-end', alignItems: 'center' },
  barFill: { width: 14, borderRadius: 4 },
  barDay: { fontSize: 10, marginTop: 6, letterSpacing: 0 },
  barsNote: { fontSize: 11, color: undefined, textAlign: 'center', marginTop: 8 },
  retHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', paddingHorizontal: 16 },
  retPct: { fontSize: 34, lineHeight: 38 },
  retSub: { fontSize: 12 },
  track: { height: 10, borderRadius: 5, marginHorizontal: 16, marginTop: 12, overflow: 'hidden' },
  trackFill: { height: 10, borderRadius: 5 },
  distRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  distLabel: { width: 64, fontSize: 14 },
  distTrack: { flex: 1, height: 8, borderRadius: 4, marginHorizontal: 10, overflow: 'hidden' },
  distFill: { height: 8, borderRadius: 4 },
  distCount: { width: 44, textAlign: 'right', fontSize: 14 },
  empty: { padding: 18, textAlign: 'center', fontSize: 13 },
  note: { fontSize: 12, lineHeight: 18, marginTop: 20, letterSpacing: 0.5 },
});
