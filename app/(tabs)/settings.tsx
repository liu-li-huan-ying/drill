// 设置：M2 仅展示当前配置（只读），并作为「熟词校准」的常驻入口。
import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../../src/theme/ThemeProvider';
import { type Tokens } from '../../src/theme/tokens';
import { getSettings } from '../../src/db/queries';

export default function SettingsScreen() {
  const { colors: c } = useTheme();
  const router = useRouter();
  const s = getSettings();
  const rows: [string, string][] = [
    ['每日新词上限', String(s.daily_new_limit)],
    ['每日复习上限', String(s.daily_review_limit)],
    ['目标留存率', `${Math.round(s.desired_retention * 100)}%`],
    ['每日分界', `${String(s.day_cutoff_hour).padStart(2, '0')}:00`],
  ];

  return (
    <ScrollView contentContainerStyle={[styles.container, { backgroundColor: c.bg }]}>
      <Text style={[styles.kicker, { color: c.tx3 }]}>设 置 · SETTINGS</Text>

      <View style={[styles.card, { backgroundColor: c.sf, borderColor: c.bd }]}>
        {rows.map(([k, v], i) => (
          <View
            key={k}
            style={[
              styles.row,
              { borderBottomColor: c.bd, borderBottomWidth: i < rows.length - 1 ? 1 : 0 },
            ]}
          >
            <Text style={[styles.k, { color: c.tx2 }]}>{k}</Text>
            <Text style={[styles.v, { color: c.tx1 }]}>{v}</Text>
          </View>
        ))}
      </View>

      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => router.push('/calibration')}
        style={[styles.calib, { backgroundColor: c.sf, borderColor: c.bd }]}
      >
        <View>
          <Text style={[styles.calibTitle, { color: c.tx1 }]}>熟词校准</Text>
          <Text style={[styles.calibSub, { color: c.tx3 }]}>快速筛除已掌握的词</Text>
        </View>
        <Text style={[styles.arrow, { color: c.ac }]}>→</Text>
      </TouchableOpacity>

      <Text style={[styles.note, { color: c.tx3 }]}>设置项调整与自定义词库将在后续版本开放。</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, paddingTop: 64, paddingHorizontal: 24, paddingBottom: 40 },
  kicker: { fontSize: 10.5, letterSpacing: 3, textTransform: 'uppercase', fontWeight: '600' },
  card: { marginTop: 18, borderRadius: 10, borderWidth: 1, overflow: 'hidden' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 15 },
  k: { fontSize: 14 },
  v: { fontSize: 14, fontVariant: ['tabular-nums'] },
  calib: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14, paddingHorizontal: 16, paddingVertical: 16, borderRadius: 10, borderWidth: 1 },
  calibTitle: { fontSize: 15 },
  calibSub: { fontSize: 12, marginTop: 4 },
  arrow: { fontSize: 16 },
  note: { fontSize: 12, lineHeight: 18, marginTop: 24, letterSpacing: 0.5 },
});
