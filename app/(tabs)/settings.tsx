// 设置：每日限额 / 外观 / 学习记录 / 工具入口。
// 每张卡自带一个小节标签（章印式），行一律走共享 RowItem —— 设置页最容易长成一堆各写各的样式。
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../../src/theme/ThemeProvider';
import { RADIUS, SPACE, CONTROL, WEIGHT } from '../../src/theme/tokens';
import { Card, Btn, RowItem, Label } from '../../src/components/ui';
import { getSettings, getMasteredCount, saveSettings, resetMastered } from '../../src/db/queries';

const THEME_MODES = ['system', 'light', 'dark'] as const;
const THEME_LABELS: Record<(typeof THEME_MODES)[number], string> = {
  system: '跟随系统',
  light: '浅色',
  dark: '深色',
};

export default function SettingsScreen() {
  const { colors: c, themeMode, setThemeMode } = useTheme();
  const router = useRouter();
  const s = getSettings();

  const [newLimit, setNewLimit] = useState(s.daily_new_limit);
  const [reviewLimit, setReviewLimit] = useState(s.daily_review_limit);
  const [saved, setSaved] = useState(false);
  const [mastered, setMastered] = useState(() => getMasteredCount());

  const save = () => {
    saveSettings({ daily_new_limit: newLimit, daily_review_limit: reviewLimit });
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  // 重置后直接重读计数 —— 原来的 tick 计数器只是为了骗 React 重渲染，属于多余的间接层。
  const doReset = () => {
    resetMastered();
    setMastered(getMasteredCount());
  };

  return (
    <ScrollView contentContainerStyle={[styles.container, { backgroundColor: c.bg }]}>
      <Card style={styles.first}>
        <Label>额 度</Label>
        <View style={[styles.list, { borderColor: c.bd }]}>
          <Stepper label="每日新词上限" value={newLimit} onChange={setNewLimit} min={1} max={200} />
          <Stepper label="每日复习上限" value={reviewLimit} onChange={setReviewLimit} min={10} max={1000} last />
        </View>
        <View style={styles.saveWrap}>
          <Btn title={saved ? '已 保 存' : '保 存 设 置'} onPress={save} />
        </View>
      </Card>

      <Label style={styles.group}>外 观</Label>
      <Card style={styles.tight}>
        <View style={styles.seg}>
          {THEME_MODES.map((m) => {
            const active = themeMode === m;
            return (
              <TouchableOpacity
                key={m}
                activeOpacity={0.8}
                onPress={() => setThemeMode(m)}
                style={[
                  styles.segItem,
                  { backgroundColor: active ? c.ac : 'transparent', borderColor: active ? c.ac : c.bd2 },
                ]}
              >
                <Text style={[styles.segText, { color: active ? c.acon : c.tx2 }]}>{THEME_LABELS[m]}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </Card>

      <Label style={styles.group}>学 习 记 录</Label>
      <Card pad={0} style={styles.tight}>
        <RowItem label="我的助记" value={`已掌握 ${mastered}`} chev last onPress={() => router.push('/notes')} />
      </Card>

      <Label style={styles.group}>工 具</Label>
      <Card pad={0} style={styles.tight}>
        <RowItem label="自定义词库导入" chev onPress={() => router.push('/import')} />
        <RowItem label="词汇量测试" chev onPress={() => router.push('/vocabtest')} />
        <RowItem label="熟词校准" chev onPress={() => router.push('/calibration')} />
        <RowItem label="备份与恢复" value="JSON" chev last onPress={() => router.push('/backup')} />
      </Card>

      <View style={styles.dangerWrap}>
        <Btn title={`重 置 已 掌 握（${mastered}）`} variant="outline" onPress={doReset} />
        <Text style={[styles.note, { color: c.tx3 }]}>
          设置即时写入本地库；重置会把所有「已掌握」的词放回学习池。
        </Text>
      </View>
    </ScrollView>
  );
}

function Stepper({
  label,
  value,
  onChange,
  min,
  max,
  last,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  min: number;
  max: number;
  last?: boolean;
}) {
  const { colors: c } = useTheme();
  return (
    <View style={[styles.row, { borderBottomColor: c.bd }, last && styles.rowLast]}>
      <Text style={[styles.rowLabel, { color: c.tx1 }]}>{label}</Text>
      <View style={styles.stepper}>
        <TouchableOpacity
          style={[styles.stepBtn, { borderColor: c.bd2 }]}
          activeOpacity={0.6}
          onPress={() => onChange(Math.max(min, value - 1))}
        >
          <Text style={[styles.stepTxt, { color: c.tx1 }]}>−</Text>
        </TouchableOpacity>
        <Text style={[styles.stepVal, { color: c.tx1 }]}>{value}</Text>
        <TouchableOpacity
          style={[styles.stepBtn, { borderColor: c.bd2 }]}
          activeOpacity={0.6}
          onPress={() => onChange(Math.min(max, value + 1))}
        >
          <Text style={[styles.stepTxt, { color: c.tx1 }]}>＋</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, paddingTop: SPACE.sm, paddingHorizontal: SPACE.xl, paddingBottom: SPACE.huge },
  first: { marginTop: SPACE.xs },

  // 卡内分隔线由行自己画，卡不设内边距（pad=0），行统一 20dp 缩进。
  list: { borderTopWidth: 1, marginHorizontal: -SPACE.xl },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 56,
    paddingHorizontal: SPACE.xl,
    borderBottomWidth: 1,
  },
  rowLast: { borderBottomWidth: 0 },
  rowLabel: { fontSize: 15, fontWeight: WEIGHT.medium },
  stepper: { flexDirection: 'row', alignItems: 'center' },
  stepBtn: {
    width: 32,
    height: 32,
    borderRadius: RADIUS.chip,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepTxt: { fontSize: 18, fontWeight: WEIGHT.semibold },
  stepVal: {
    fontSize: 15,
    fontWeight: WEIGHT.semibold,
    fontVariant: ['tabular-nums'],
    marginHorizontal: SPACE.md,
    minWidth: 32,
    textAlign: 'center',
  },

  saveWrap: { marginTop: SPACE.lg },

  group: { marginTop: SPACE.xxl, marginBottom: SPACE.sm },
  tight: { marginTop: 0 },

  seg: { flexDirection: 'row', gap: SPACE.sm },
  segItem: {
    flex: 1,
    height: CONTROL.sm,
    borderRadius: RADIUS.chip,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segText: { fontSize: 13, letterSpacing: 1.5, fontWeight: WEIGHT.semibold },

  dangerWrap: { marginTop: SPACE.xxl },
  note: { fontSize: 12, lineHeight: 18, marginTop: SPACE.md, letterSpacing: 0.5 },
});
