// 今日（首页）：刻度环展示新词配额进度，待复习 / 新词可用概览，开始学习 / 熟词校准入口。
import React, { useCallback, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useTheme } from '../../src/theme/ThemeProvider';
import { serif, type Tokens } from '../../src/theme/tokens';
import { ScaleRing } from '../../src/features/home/ScaleRing';
import { getHomeSummary, setStudyScope } from '../../src/db/queries';

export default function TodayScreen() {
  const { colors: c } = useTheme();
  const router = useRouter();
  const [s, setS] = useState(() => getHomeSummary());

  useFocusEffect(
    useCallback(() => {
      setS(getHomeSummary());
    }, [])
  );

  const nothing = s.reviewDue === 0 && s.newAvailable === 0;

  return (
    <ScrollView contentContainerStyle={[styles.container, { backgroundColor: c.bg }]}>
      <Text style={[styles.kicker, { color: c.tx3 }]}>今 日 · TODAY</Text>

      <View style={styles.ringWrap}>
        <ScaleRing total={s.dailyNewLimit} done={s.newDone} />
      </View>

      <View style={styles.statRow}>
        <Stat label="待复习" value={String(s.reviewDue)} colors={c} />
        <View style={[styles.div, { backgroundColor: c.bd }]} />
        <Stat label="新词可用" value={String(s.newAvailable)} colors={c} />
      </View>

      {s.isScoped ? (
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => {
            setStudyScope(null);
            setS(getHomeSummary());
          }}
          style={[styles.scope, { borderColor: c.bd }]}
        >
          <Text style={[styles.scopeText, { color: c.tx2 }]}>学习范围：{s.scopeName}</Text>
          <Text style={[styles.scopeClear, { color: c.ac }]}>✕ 背全部</Text>
        </TouchableOpacity>
      ) : (
        <Text style={[styles.scopeHint, { color: c.tx3 }]}>学习范围：全部词库 · 可在「词库」选某纲只背它</Text>
      )}

      <TouchableOpacity
        activeOpacity={0.85}
        disabled={nothing}
        onPress={() => router.push('/review')}
        style={[styles.cta, { backgroundColor: c.ac, opacity: nothing ? 0.4 : 1 }]}
      >
        <Text style={[styles.ctaText, { color: c.acon }]}>{nothing ? '今 日 已 清 空' : `开 始 学 习 · ${s.scopeName}`}</Text>
      </TouchableOpacity>

      <TouchableOpacity
        activeOpacity={0.6}
        onPress={() => router.push('/calibration')}
        style={styles.calib}
      >
        <Text style={[styles.calibText, { color: c.tx2 }]}>熟词校准</Text>
        <Text style={[styles.calibArrow, { color: c.ac }]}>→</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function Stat({ label, value, colors: c }: { label: string; value: string; colors: Tokens }) {
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, { color: c.tx1, fontFamily: serif }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: c.tx3 }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, paddingTop: 64, paddingHorizontal: 24, paddingBottom: 40, alignItems: 'center' },
  kicker: { fontSize: 10.5, letterSpacing: 3, textTransform: 'uppercase', fontWeight: '600', alignSelf: 'flex-start' },
  ringWrap: { marginTop: 36, marginBottom: 8 },
  statRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  stat: { alignItems: 'center', paddingHorizontal: 22 },
  statValue: { fontSize: 30, lineHeight: 34 },
  statLabel: { fontSize: 12, marginTop: 4, letterSpacing: 1 },
  div: { width: 1, height: 28 },
  scope: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 20, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, borderWidth: 1, width: '100%' },
  scopeText: { fontSize: 13, letterSpacing: 0.5 },
  scopeClear: { fontSize: 13, letterSpacing: 1, fontWeight: '600' },
  scopeHint: { marginTop: 20, fontSize: 12, lineHeight: 17, letterSpacing: 0.3, textAlign: 'center' },
  cta: { marginTop: 18, width: '100%', height: 54, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  ctaText: { fontSize: 16, letterSpacing: 4, fontWeight: '600' },
  calib: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 22 },
  calibText: { fontSize: 14, letterSpacing: 1 },
  calibArrow: { fontSize: 15 },
});
