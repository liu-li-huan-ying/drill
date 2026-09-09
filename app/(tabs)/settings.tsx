// 设置：可调每日新词/复习上限并持久化；重置已掌握；自定义词库导入 / 词汇量测试 / 熟词校准入口。
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../../src/theme/ThemeProvider';
import { getSettings, getMasteredCount, saveSettings, resetMastered } from '../../src/db/queries';

export default function SettingsScreen() {
  const { colors: c, themeMode, setThemeMode } = useTheme();
  const router = useRouter();
  const s = getSettings();
  const mastered = getMasteredCount();

  const [newLimit, setNewLimit] = useState(s.daily_new_limit);
  const [reviewLimit, setReviewLimit] = useState(s.daily_review_limit);
  const [saved, setSaved] = useState(false);
  const [resetTick, setResetTick] = useState(0);

  const save = () => {
    saveSettings({ daily_new_limit: newLimit, daily_review_limit: reviewLimit });
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  const doReset = () => {
    resetMastered();
    setResetTick((t) => t + 1); // 触发重渲染，重读已掌握计数
  };

  const Stepper = ({
    label,
    value,
    onChange,
    min,
    max,
  }: {
    label: string;
    value: number;
    onChange: (n: number) => void;
    min: number;
    max: number;
  }) => (
    <View style={[styles.row, { borderBottomColor: c.bd }]}>
      <Text style={[styles.k, { color: c.tx2 }]}>{label}</Text>
      <View style={styles.stepper}>
        <TouchableOpacity
          style={[styles.stepBtn, { borderColor: c.bd2 }]}
          onPress={() => onChange(Math.max(min, value - 1))}
        >
          <Text style={[styles.stepTxt, { color: c.tx1 }]}>−</Text>
        </TouchableOpacity>
        <Text style={[styles.stepVal, { color: c.tx1 }]}>{value}</Text>
        <TouchableOpacity
          style={[styles.stepBtn, { borderColor: c.bd2 }]}
          onPress={() => onChange(Math.min(max, value + 1))}
        >
          <Text style={[styles.stepTxt, { color: c.tx1 }]}>＋</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const Entry = ({
    title,
    sub,
    onPress,
  }: {
    title: string;
    sub: string;
    onPress: () => void;
  }) => (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      style={[styles.entry, { backgroundColor: c.sf, borderColor: c.bd }]}
    >
      <View style={{ flex: 1 }}>
        <Text style={[styles.entryTitle, { color: c.tx1 }]}>{title}</Text>
        <Text style={[styles.entrySub, { color: c.tx3 }]}>{sub}</Text>
      </View>
      <Text style={[styles.arrow, { color: c.ac }]}>→</Text>
    </TouchableOpacity>
  );

  return (
    <ScrollView contentContainerStyle={[styles.container, { backgroundColor: c.bg }]}>
      <Text style={[styles.kicker, { color: c.tx3 }]}>设 置 · SETTINGS</Text>

      <View style={[styles.card, { backgroundColor: c.sf, borderColor: c.bd }]}>
        <Stepper label="每日新词上限" value={newLimit} onChange={setNewLimit} min={1} max={200} />
        <Stepper label="每日复习上限" value={reviewLimit} onChange={setReviewLimit} min={10} max={1000} />
      </View>

      <TouchableOpacity activeOpacity={0.85} onPress={save} style={[styles.save, { backgroundColor: c.ac }]}>
        <Text style={[styles.saveText, { color: c.acon }]}>{saved ? '已 保 存' : '保 存 设 置'}</Text>
      </TouchableOpacity>

      <TouchableOpacity
        activeOpacity={0.8}
        onPress={doReset}
        style={[styles.reset, { borderColor: c.bd }]}
      >
        <Text style={[styles.resetText, { color: c.tx2 }]}>重置已掌握（{mastered}）</Text>
      </TouchableOpacity>

      <Text style={[styles.group, { color: c.tx3 }]}>外 观</Text>
      <View style={[styles.card, { backgroundColor: c.sf, borderColor: c.bd }]}>
        <View style={[styles.row, { borderBottomWidth: 0 }]}>
          <Text style={[styles.k, { color: c.tx2 }]}>深色模式</Text>
        </View>
        <View style={styles.seg}>
          {(['system', 'light', 'dark'] as const).map((m) => {
            const active = themeMode === m;
            return (
              <TouchableOpacity
                key={m}
                activeOpacity={0.8}
                onPress={() => setThemeMode(m)}
                style={[
                  styles.segItem,
                  active && { backgroundColor: c.ac },
                  !active && { borderColor: c.bd2 },
                ]}
              >
                <Text style={[styles.segText, { color: active ? c.acon : c.tx2 }]}>
                  {m === 'system' ? '跟随系统' : m === 'light' ? '浅色' : '深色'}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <Text style={[styles.group, { color: c.tx3 }]}>工 具</Text>
      <Entry title="自定义词库导入" sub="粘贴单词，建专属词单" onPress={() => router.push('/import')} />
      <Entry title="词汇量测试" sub="估算你的词汇量并筛熟词" onPress={() => router.push('/vocabtest')} />
      <Entry title="熟词校准" sub="快速筛除已掌握的词" onPress={() => router.push('/calibration')} />
      <Entry title="备份与恢复" sub="导出 / 导入进度 JSON" onPress={() => router.push('/backup')} />

      <Text style={[styles.note, { color: c.tx3 }]}>
        设置即时写入本地库；重置已掌握会把所有「已掌握」放回学习池。
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, paddingTop: 64, paddingHorizontal: 24, paddingBottom: 40 },
  kicker: { fontSize: 10.5, letterSpacing: 3, textTransform: 'uppercase', fontWeight: '600' },
  card: { marginTop: 18, borderRadius: 10, borderWidth: 1, overflow: 'hidden' },
  seg: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingBottom: 16, paddingTop: 4 },
  segItem: {
    flex: 1, height: 38, borderRadius: 8, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  segText: { fontSize: 13, letterSpacing: 1, fontWeight: '600' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1 },
  k: { fontSize: 14 },
  stepper: { flexDirection: 'row', alignItems: 'center' },
  stepBtn: { width: 32, height: 32, borderRadius: 8, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  stepTxt: { fontSize: 18, fontWeight: '600' },
  stepVal: { fontSize: 15, fontVariant: ['tabular-nums'], marginHorizontal: 14, minWidth: 28, textAlign: 'center' },
  save: { marginTop: 16, height: 48, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  saveText: { fontSize: 15, letterSpacing: 3, fontWeight: '600' },
  reset: { marginTop: 12, height: 44, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  resetText: { fontSize: 14, letterSpacing: 1, fontVariant: ['tabular-nums'] },
  group: { fontSize: 10.5, letterSpacing: 3, textTransform: 'uppercase', fontWeight: '600', marginTop: 28, marginBottom: 10 },
  entry: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, paddingHorizontal: 16, paddingVertical: 16, borderRadius: 10, borderWidth: 1 },
  entryTitle: { fontSize: 15 },
  entrySub: { fontSize: 12, marginTop: 4 },
  arrow: { fontSize: 16 },
  note: { fontSize: 12, lineHeight: 18, marginTop: 20, letterSpacing: 0.5 },
});
