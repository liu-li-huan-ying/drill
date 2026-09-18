// 今日（首页）：刻度环展示当日新词配额进度；复习 / 新词双列数据；朱砂主 CTA；熟词校准入口。
import React, { useCallback, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useTheme } from '../../src/theme/ThemeProvider';
import { RADIUS, SPACE, CONTROL, WEIGHT, type Tokens } from '../../src/theme/tokens';
import { ScaleRing } from '../../src/features/home/ScaleRing';
import { Btn, Chev } from '../../src/components/ui';
import { getHomeSummary, getMasteredCount, setStudyScope } from '../../src/db/queries';

// 每题约 30 秒 —— 「预计 N 分钟」是估算值，不是承诺值，所以取整到分钟。
const SEC_PER_WORD = 30;

export default function TodayScreen() {
  const { colors: c } = useTheme();
  const router = useRouter();
  const [s, setS] = useState(() => getHomeSummary());
  const [mastered, setMastered] = useState(() => getMasteredCount());

  useFocusEffect(
    useCallback(() => {
      setS(getHomeSummary());
      setMastered(getMasteredCount());
    }, [])
  );

  const remaining = Math.max(0, s.dailyNewLimit - s.newDone); // 今日待学（配额剩余）
  const todayNew = Math.min(s.newAvailable, remaining); // 今日实际会学到的新词
  const todayWords = s.reviewDue + todayNew;
  const minutes = Math.round((todayWords * SEC_PER_WORD) / 60);
  const nothing = s.reviewDue === 0 && todayNew === 0;

  return (
    <ScrollView contentContainerStyle={[styles.wrap, { backgroundColor: c.bg }]}>
      <View style={styles.ringWrap}>
        <ScaleRing
          total={s.dailyNewLimit}
          done={s.newDone}
          centerValue={String(remaining)}
          centerLabel="今 日 待 学"
        />
      </View>

      <View style={styles.grid2}>
        <Stat label="复 习" value={s.reviewDue} colors={c} />
        <Stat label="新 词" value={s.newAvailable} colors={c} />
      </View>

      <View style={{ marginTop: SPACE.xxxl }}>
        <Btn
          title={nothing ? '今 日 已 清 空' : '开 始 学 习'}
          disabled={nothing}
          onPress={() => router.push('/review')}
        />
        <Text style={[styles.sub, { color: c.tx3 }]}>
          {nothing ? '今天没有待学的词 · 明日再来' : `预计 ${minutes} 分钟 · 今日 ${todayWords} 词`}
        </Text>
      </View>

      {s.isScoped ? (
        <TouchableOpacity
          activeOpacity={0.6}
          onPress={() => {
            setStudyScope(null);
            setS(getHomeSummary());
          }}
          style={[styles.scope, { borderColor: c.bd2 }]}
        >
          <Text style={[styles.scopeText, { color: c.tx2 }]}>只背 · {s.scopeName}</Text>
          <Text style={[styles.scopeClear, { color: c.ac }]}>✕ 背全部</Text>
        </TouchableOpacity>
      ) : null}

      <View style={{ marginTop: SPACE.xxl }}>
        <View style={[styles.card, { backgroundColor: c.sf, borderColor: c.bd }]}>
          <TouchableOpacity
            activeOpacity={0.6}
            onPress={() => router.push('/calibration')}
            style={styles.row}
          >
            <Text style={[styles.rowName, { color: c.tx1 }]}>熟词校准</Text>
            <Text style={[styles.rowValue, { color: c.tx3 }]}>已掌握 {mastered} 词</Text>
            <Chev />
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}

function Stat({ label, value, colors: c }: { label: string; value: number; colors: Tokens }) {
  return (
    <View style={[styles.stat, { backgroundColor: c.sf, borderColor: c.bd }]}>
      <Text style={[styles.statK, { color: c.tx3 }]}>{label}</Text>
      <View style={styles.statVRow}>
        <Text style={[styles.statV, { color: c.tx1 }]}>{value}</Text>
        <Text style={[styles.statU, { color: c.tx3 }]}>词</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexGrow: 1, paddingHorizontal: SPACE.xl, paddingBottom: SPACE.huge },
  ringWrap: { marginTop: SPACE.xxxl, alignSelf: 'center' },

  grid2: { flexDirection: 'row', gap: SPACE.md, marginTop: SPACE.xxl },
  stat: { flex: 1, borderRadius: RADIUS.card, borderWidth: 1, paddingTop: SPACE.xxxl, paddingHorizontal: SPACE.xl, paddingBottom: SPACE.xl },
  statK: { fontSize: 10, letterSpacing: 2, fontWeight: WEIGHT.semibold },
  statVRow: { flexDirection: 'row', alignItems: 'baseline', marginTop: SPACE.md },
  statV: { fontSize: 31, lineHeight: 36, letterSpacing: -0.3, fontWeight: WEIGHT.semibold, fontVariant: ['tabular-nums'] },
  statU: { fontSize: 12, marginLeft: 3, fontWeight: WEIGHT.medium },

  sub: { fontSize: 12.5, letterSpacing: 0.2, textAlign: 'center', marginTop: SPACE.md },

  scope: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: SPACE.lg,
    paddingHorizontal: SPACE.lg,
    height: CONTROL.md,
    borderRadius: RADIUS.ctrl,
    borderWidth: 1,
  },
  scopeText: { fontSize: 13, letterSpacing: 0.5, fontWeight: WEIGHT.medium },
  scopeClear: { fontSize: 13, letterSpacing: 0.5, fontWeight: WEIGHT.semibold },

  card: { borderRadius: RADIUS.card, borderWidth: 1, paddingHorizontal: SPACE.xl },
  row: { flexDirection: 'row', alignItems: 'center', gap: SPACE.lg, minHeight: SPACE.touch },
  rowName: { flex: 1, fontSize: 15, fontWeight: WEIGHT.medium },
  rowValue: { fontSize: 12.5, fontWeight: WEIGHT.medium, fontVariant: ['tabular-nums'] },
});
