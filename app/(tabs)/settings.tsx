// 设置：每日限额 / 外观 / 学习记录 / 工具入口。
// 每张卡自带一个小节标签（章印式），行一律走共享 RowItem —— 设置页最容易长成一堆各写各的样式。
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../../src/theme/ThemeProvider';
import { RADIUS, SPACE, CONTROL, WEIGHT, FONT, TRACK } from '../../src/theme/tokens';
import { Card, Btn, RowItem, Label, Num } from '../../src/components/ui';
import { getSettings, getMasteredCount, saveSettings, resetMastered } from '../../src/db/queries';
import { useGutter } from '../../src/lib/layout';
import { fmtNum } from '../../src/lib/num';

const THEME_MODES = ['system', 'light', 'dark'] as const;
const THEME_LABELS: Record<(typeof THEME_MODES)[number], string> = {
  system: '跟随系统',
  light: '浅色',
  dark: '深色',
};

export default function SettingsScreen() {
  const { colors: c, themeMode, setThemeMode } = useTheme();
  const gutter = useGutter();
  const router = useRouter();
  const s = getSettings();

  const [newLimit, setNewLimit] = useState(s.daily_new_limit);
  const [reviewLimit, setReviewLimit] = useState(s.daily_review_limit);
  const [quiz, setQuiz] = useState(s.quiz_mode === 1);
  const [saved, setSaved] = useState(false);
  const [mastered, setMastered] = useState(() => getMasteredCount());

  const save = () => {
    saveSettings({ daily_new_limit: newLimit, daily_review_limit: reviewLimit });
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  // 复习方式即时生效（不用等「保存设置」）：它是一个开关，不是一份待提交的表单。
  const pickQuiz = (on: boolean) => {
    setQuiz(on);
    saveSettings({ quiz_mode: on ? 1 : 0 });
  };

  // 重置后直接重读计数 —— 原来的 tick 计数器只是为了骗 React 重渲染，属于多余的间接层。
  const doReset = () => {
    resetMastered();
    setMastered(getMasteredCount());
  };

  return (
    <ScrollView
      style={{ backgroundColor: c.bg }}
      contentContainerStyle={[styles.container, { backgroundColor: c.bg, paddingHorizontal: gutter }]}
    >
      <Card style={styles.first}>
        <Label>额 度</Label>
        <View style={[styles.list, { borderColor: c.bd }]}>
          <Stepper label="每日新词上限" value={newLimit} onChange={setNewLimit} min={1} max={200} />
          <Stepper label="每日复习上限" value={reviewLimit} onChange={setReviewLimit} min={10} max={1000} last />
        </View>
        <View style={styles.saveWrap}>
          <Btn title={saved ? '已保存' : '保存设置'} onPress={save} />
        </View>
      </Card>

      <Label style={styles.group}>复 习 方 式</Label>
      <Card>
        <Label>背的时候怎么判定</Label>
        <View style={styles.quizRow}>
          <Btn
            title="选择题"
            variant={quiz ? 'solid' : 'outline'}
            onPress={() => pickQuiz(true)}
            style={styles.quizBtn}
          />
          <Btn
            title="自己评分"
            variant={quiz ? 'outline' : 'solid'}
            onPress={() => pickQuiz(false)}
            style={styles.quizBtn}
          />
        </View>
        <Text style={[styles.note, { color: c.tx3 }]}>
          {quiz
            ? '四选一：一个正确答案 + 三个同词性的干扰项，两种题型（看词选义 / 看义选词）轮换。答错就记为「重来」，一分钟内会再来一次。首次见面的新词仍是先看释义。'
            : '翻到背面自己评四档。省力的那一档永远最好按 —— 这就是为什么它容易把每张卡都评成「会了」。'}
        </Text>
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
        <RowItem label="我的助记" value={`已掌握 ${fmtNum(mastered)}`} chev last onPress={() => router.push('/notes')} />
      </Card>

      <Label style={styles.group}>工 具</Label>
      <Card pad={0} style={styles.tight}>
        <RowItem label="自定义词库导入" chev onPress={() => router.push('/import')} />
        <RowItem label="词汇量测试" chev onPress={() => router.push('/vocabtest')} />
        <RowItem label="熟词校准" chev onPress={() => router.push('/calibration')} />
        <RowItem label="备份与恢复" value="JSON" chev last onPress={() => router.push('/backup')} />
      </Card>

      <View style={styles.dangerWrap}>
        <Btn title={`重置已掌握（${fmtNum(mastered)}）`} variant="outline" onPress={doReset} />
        <Text style={[styles.note, { color: c.tx3 }]}>
          改动立刻生效；重置会把「已掌握」的词重新放回学习池。
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
        <Num value={value} style={[styles.stepVal, { color: c.tx1 }]} />
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
  rowLabel: { fontSize: FONT.body, fontWeight: WEIGHT.medium },
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
    fontSize: FONT.body,
    fontWeight: WEIGHT.semibold,
    marginHorizontal: SPACE.md,
    minWidth: 32,
    textAlign: 'center',
  },

  saveWrap: { marginTop: SPACE.lg },

  group: { marginTop: SPACE.xxl, marginBottom: SPACE.sm },
  tight: { marginTop: 0 },

  seg: { flexDirection: 'row', gap: SPACE.sm },
  quizRow: { flexDirection: 'row', gap: SPACE.sm, marginTop: SPACE.md },
  quizBtn: { flex: 1 },
  segItem: {
    flex: 1,
    minHeight: CONTROL.sm,
    borderRadius: RADIUS.chip,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segText: { fontSize: 13, letterSpacing: TRACK.body, fontWeight: WEIGHT.semibold },

  dangerWrap: { marginTop: SPACE.xxl },
  note: { fontSize: 12, lineHeight: 18, marginTop: SPACE.md, letterSpacing: TRACK.body },
});
