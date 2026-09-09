// 统计：今日新词 / 今日复习 / 已掌握。M2 仅当日与累计两项，持久化在本地库。
import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useTheme } from '../../src/theme/ThemeProvider';
import { serif, type Tokens } from '../../src/theme/tokens';
import { getTodayCounts, getMasteredCount } from '../../src/db/queries';

export default function StatsScreen() {
  const { colors: c } = useTheme();
  const [s, setS] = useState(() => {
    const t = getTodayCounts();
    return { newDone: t.newDone, reviewDone: t.reviewDone, mastered: getMasteredCount() };
  });

  // 与首页一致：每次聚焦重新读取，否则 tab 切换不会重渲染、停在初始旧值。
  useFocusEffect(
    React.useCallback(() => {
      const t = getTodayCounts();
      setS({ newDone: t.newDone, reviewDone: t.reviewDone, mastered: getMasteredCount() });
    }, [])
  );

  return (
    <ScrollView contentContainerStyle={[styles.container, { backgroundColor: c.bg }]}>
      <Text style={[styles.kicker, { color: c.tx3 }]}>统 计 · STATS</Text>

      <Block label="今日新词" value={String(s.newDone)} colors={c} />
      <Block label="今日复习" value={String(s.reviewDone)} colors={c} />
      <Block label="已掌握" value={String(s.mastered)} colors={c} accent />

      <Text style={[styles.note, { color: c.tx3 }]}>
        进度写入本地数据库，关闭应用与跨日统计均持久保存。
      </Text>
    </ScrollView>
  );
}

function Block({
  label,
  value,
  colors: c,
  accent,
}: {
  label: string;
  value: string;
  colors: Tokens;
  accent?: boolean;
}) {
  return (
    <View style={[styles.block, { borderBottomColor: c.bd }]}>
      <Text style={[styles.value, { color: accent ? c.ac : c.tx1, fontFamily: serif }]}>{value}</Text>
      <Text style={[styles.label, { color: c.tx2 }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, paddingTop: 64, paddingHorizontal: 24, paddingBottom: 40 },
  kicker: { fontSize: 10.5, letterSpacing: 3, textTransform: 'uppercase', fontWeight: '600' },
  block: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', paddingVertical: 20, borderBottomWidth: 1 },
  value: { fontSize: 34, lineHeight: 38 },
  label: { fontSize: 13, letterSpacing: 1 },
  note: { fontSize: 12, lineHeight: 18, marginTop: 24, letterSpacing: 0.5 },
});
