// 复习会话：构建今日队列（先到期的复习 + 当日新词）→ 翻转看释义 → 四档评分 → 写回 → 推进。
// 评分仅在翻转后开放；评分可撤销一次（还原 cards / 删除 review_logs / 回退 daily_stats）。
// 队列走完（或主动「结束本轮」）→ 完成屏。
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useTheme } from '../src/theme/ThemeProvider';
import { SPACE, CONTROL, WEIGHT, RADIUS } from '../src/theme/tokens';
import { Progress } from '../src/components/ui';
import { ReviewCard } from '../src/features/review/ReviewCard';
import { DoneView } from '../src/features/review/DoneView';
import {
  getCard,
  getDailyHistory,
  getStreak,
  planSession,
  recordGrade,
  undoGrade,
  type GradeSnapshot,
  type QueueItem,
} from '../src/db/queries';
import { previewIntervals, type IntervalPreview } from '../src/srs/fsrs';
import type { Grade } from 'ts-fsrs';

// 预览尚未取到时的占位（只影响首帧，条长会立刻被真实值替换）。
const NO_PREVIEW: IntervalPreview[] = [
  { label: '', minutes: 1 },
  { label: '', minutes: 2 },
  { label: '', minutes: 4 },
  { label: '', minutes: 8 },
];

export default function ReviewScreen() {
  const { colors: c } = useTheme();
  const router = useRouter();
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [summary, setSummary] = useState<{ words: number; minutes: number; accuracy: number } | null>(null);
  // 撤销要记住「刚评的是第几张」——队列走完时 idx 停在最后一张，不能再减 1，否则会退到上一张。
  const [undo, setUndo] = useState<{ snap: GradeSnapshot; label: string; rating: number; at: number } | null>(
    null
  );
  const run = useRef({ startedAt: 0, done: 0, correct: 0 });

  const build = useCallback(() => {
    const { reviews, news } = planSession();
    const q = [...reviews, ...news];
    run.current = { startedAt: Date.now(), done: 0, correct: 0 };
    setQueue(q);
    setIdx(0);
    setFlipped(false);
    setUndo(null);
    // 队列一开始就是空的 → 直接进完成屏（它会渲染「今日已清空」的安静版，不做无谓的庆祝）。
    setSummary(q.length === 0 ? { words: 0, minutes: 0, accuracy: 0 } : null);
  }, []);

  useFocusEffect(
    useCallback(() => {
      build();
    }, [build])
  );

  const current: QueueItem | undefined = queue[idx];
  // 当前卡的调度状态（同步读库）→ 四档间隔预览。评分条上写的就是这张卡真实的下次间隔。
  const intervals = useMemo(() => {
    if (!current) return NO_PREVIEW;
    const card = getCard(current.word_id);
    return card ? previewIntervals(card, Date.now()) : NO_PREVIEW;
  }, [current]);

  const rate = (r: number) => {
    const item = queue[idx];
    if (!item) return;
    const snap = recordGrade(item, r as Grade);
    run.current.done += 1;
    if (r >= 3) run.current.correct += 1; // Good / Easy 记为「答对」
    if (snap) setUndo({ snap, label: intervals[r - 1]?.label ?? '', rating: r, at: idx });

    const next = idx + 1;
    setFlipped(false);
    if (next >= queue.length) finish();
    else setIdx(next);
  };

  const finish = () => {
    const d = run.current.done;
    setSummary({
      words: d,
      minutes: Math.max(1, Math.round((Date.now() - run.current.startedAt) / 60000)),
      accuracy: d > 0 ? run.current.correct / d : 0,
    });
  };

  const doUndo = () => {
    if (!undo) return;
    undoGrade(undo.snap);
    run.current.done = Math.max(0, run.current.done - 1);
    if (undo.rating >= 3) run.current.correct = Math.max(0, run.current.correct - 1);
    const back = undo.at;
    setUndo(null);
    setSummary(null); // 从完成屏退回时也走这里
    setIdx(back);
    setFlipped(true); // 回到那张卡的背面，让用户看到自己刚刚改的是哪张
  };

  // ── 完成屏 ────────────────────────────────────────────────────────────
  if (summary) {
    const hist = getDailyHistory(2); // [昨日, 今日]
    const todayTotal = (hist[1]?.new_count ?? 0) + (hist[1]?.review_count ?? 0);
    const ydayTotal = (hist[0]?.new_count ?? 0) + (hist[0]?.review_count ?? 0);
    return (
      <View style={[styles.screen, { backgroundColor: c.bg }]}>
        <DoneView
          words={summary.words}
          minutes={summary.minutes}
          accuracy={summary.accuracy}
          streak={getStreak()}
          delta={todayTotal - ydayTotal}
          onStats={() => router.navigate('/stats')}
          onHome={() => router.dismissAll()}
          onUndo={undo ? doUndo : undefined}
        />
      </View>
    );
  }

  // ── 学习中 ────────────────────────────────────────────────────────────
  const total = queue.length;
  return (
    <View style={[styles.screen, { backgroundColor: c.bg }]}>
      <View style={styles.top}>
        <Text style={[styles.ul, { color: c.tx3 }]}>
          复习 {idx + 1} / {total}
        </Text>
        <Text style={[styles.ul, { color: c.tx3 }]}>剩 {total - idx - 1}</Text>
      </View>
      <Progress ratio={total > 0 ? (idx + 1) / total : 0} style={styles.prog} />

      <View style={styles.cardArea}>
        {current ? (
          <ReviewCard
            item={current}
            flipped={flipped}
            onFlip={() => {
              setUndo(null); // 与原型一致：翻页即收起撤销条，它只服务于刚做的那一下
              setFlipped((f) => !f);
            }}
            intervals={intervals}
            onRate={rate}
          />
        ) : null}
      </View>

      {undo && !flipped ? (
        <View style={[styles.undo, { backgroundColor: c.acsf }]}>
          <Text style={[styles.undoText, { color: c.tx2 }]}>已记录 · {undo.label}</Text>
          <TouchableOpacity activeOpacity={0.6} onPress={doUndo} style={styles.undoBtn}>
            <Text style={[styles.undoBtnText, { color: c.ac }]}>撤销</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <TouchableOpacity
        activeOpacity={0.6}
        onPress={() => (run.current.done > 0 ? finish() : router.back())}
        style={styles.endRound}
      >
        <Text style={[styles.endRoundText, { color: c.tx3 }]}>结 束 本 轮</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingTop: 52 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: SPACE.xl },
  ul: { fontSize: 10, letterSpacing: 2, fontWeight: WEIGHT.semibold, fontVariant: ['tabular-nums'] },
  prog: { marginTop: SPACE.lg, marginHorizontal: SPACE.xl },

  cardArea: { flex: 1, paddingHorizontal: SPACE.lg, paddingTop: SPACE.md, paddingBottom: SPACE.sm },

  // 撤销条：只在刚评分完、且还没翻下一页时出现 —— 它服务的是「手滑了一下」，不是历史编辑。
  undo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: SPACE.lg,
    marginBottom: SPACE.sm,
    height: CONTROL.md,
    borderRadius: RADIUS.ctrl,
    paddingLeft: SPACE.lg,
  },
  undoText: { fontSize: 13, letterSpacing: 0.3, fontWeight: WEIGHT.medium },
  undoBtn: { height: CONTROL.md, paddingHorizontal: SPACE.md, justifyContent: 'center' },
  undoBtnText: { fontSize: 13, letterSpacing: 0.5, fontWeight: WEIGHT.semibold },

  endRound: { height: CONTROL.lg, alignItems: 'center', justifyContent: 'center', marginBottom: SPACE.sm },
  endRoundText: { fontSize: 13.5, letterSpacing: 1.5, fontWeight: WEIGHT.medium },
});
