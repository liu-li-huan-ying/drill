// 复习会话：构建今日队列（到期复习与当日新词交错、新词按词频分档掺着来）→ 翻转看释义 → 评分 → 写回 → 推进。
// 评分仅在翻转后开放；评分可撤销一次（还原 cards / 删除 review_logs / 回退 daily_stats）。
// 队列走完（或主动「结束本轮」）→ 完成屏。
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useTheme } from '../src/theme/ThemeProvider';
import { SPACE, CONTROL, WEIGHT, RADIUS, TRACK, FONT, serif } from '../src/theme/tokens';
import { PageEnter, Progress, Num } from '../src/components/ui';
import { ReviewCard } from '../src/features/review/ReviewCard';
import { ChoiceQuiz } from '../src/features/review/ChoiceQuiz';
import { DoneView } from '../src/features/review/DoneView';
import {
  getCard,
  getDailyHistory,
  getSettings,
  getStreak,
  mixSession,
  planSession,
  recordGrade,
  undoGrade,
  type GradeSnapshot,
  type QueueItem,
} from '../src/db/queries';
import { previewIntervals, type IntervalPreview } from '../src/srs/fsrs';
import type { Grade } from 'ts-fsrs';
import { speak } from '../src/lib/speak';
import { useSideInset, useTopPad, useBottomPad } from '../src/lib/layout';

// 预览尚未取到时的占位（只影响首帧，条长会立刻被真实值替换）。
const NO_PREVIEW: IntervalPreview[] = [
  { label: '', minutes: 1 },
  { label: '', minutes: 2 },
  { label: '', minutes: 4 },
  { label: '', minutes: 8 },
];

// 会话内重学窗口：learning / relearning 的卡还没「毕业」，必须在**本次会话**里再出现一次。
//
// 定 2 分钟而不是 FSRS 的完整步长（1 / 6 / 10 分钟）：让人干等十分钟不是「遗忘曲线」，
// 是惩罚。窗口只收「重来」那一步（1 分钟）—— 它才是「刚背完立刻再认一次」。
// 6 / 10 分钟的卡不进本次会话的等待：它们到期后，下一次打开（或重新聚焦）本屏时
// planSession() 会按 `due <= now` 自然捡回来，没有任何学习损失。
const RELEARN_WINDOW_MS = 2 * 60 * 1000;

export default function ReviewScreen() {
  const { colors: c } = useTheme();
  const side = useSideInset();
  const topPad = useTopPad();
  const bottomPad = useBottomPad();
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
  // 待重来池：评完后还没「毕业」的卡（learning / relearning）连同它的到期时间放这儿，
  // 到期后再接回队列。旧代码没有这个池 —— 队列一次性生成、idx 只往前推，
  // 于是「1 分钟后再见」从来没有兑现过：**选什么都是「过了」**。
  const relearn = useRef<{ item: QueueItem; due: number }[]>([]);
  // 队列走完、但还有没到期的重学卡时的等待态（at = 最近一张的到期时刻）。
  const [waiting, setWaiting] = useState<{ count: number; at: number } | null>(null);
  const [quizMode, setQuizMode] = useState(true);

  const build = useCallback(() => {
    const { reviews, news } = planSession();
    // 新旧交错成一条队列 —— 不是「先啃完所有复习、再一口气灌生词」。
    const q = mixSession(reviews, news);
    run.current = { startedAt: Date.now(), done: 0, correct: 0 };
    relearn.current = [];
    setWaiting(null);
    setQuizMode(getSettings().quiz_mode === 1);
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

  const finish = () => {
    const d = run.current.done;
    setSummary({
      words: d,
      minutes: Math.max(1, Math.round((Date.now() - run.current.startedAt) / 60000)),
      accuracy: d > 0 ? run.current.correct / d : 0,
    });
  };

  // 记一次评分：写库 + 计数 + 撤销快照，并把「还没毕业」的卡放进待重来池。
  const grade = (r: number) => {
    const item = queue[idx];
    if (!item) return;
    const snap = recordGrade(item, r as Grade);
    run.current.done += 1;
    if (r >= 3) run.current.correct += 1; // Good / Easy 记为「答对」
    if (snap) setUndo({ snap, label: intervals[r - 1]?.label ?? '', rating: r, at: idx });

    // learning / relearning 的卡还没毕业 → 到期后必须再出现一次。
    // 这就是「1 分钟重学」真正生效的地方：没有这一步，选哪一档都是「今天就到这儿了」。
    const card = getCard(item.word_id);
    if (
      card &&
      (card.state === 'learning' || card.state === 'relearning') &&
      card.due - Date.now() <= RELEARN_WINDOW_MS
    ) {
      relearn.current.push({ item, due: card.due });
    }
  };

  const advance = () => {
    const now = Date.now();
    // 已到期的重学卡先消化：接到队尾，进度条随之变长 —— 用户看得见「它还会回来」。
    const due = relearn.current.filter((r) => r.due <= now);
    if (due.length) {
      relearn.current = relearn.current.filter((r) => r.due > now);
      setQueue((q) => [...q, ...due.map((d) => d.item)]);
      setIdx((i) => i + 1);
      setFlipped(false);
      return;
    }
    const next = idx + 1;
    if (next < queue.length) {
      setFlipped(false);
      setIdx(next);
      return;
    }
    // 队列走完但还有没到期的重学卡 → 进入等待态，等它到期（等的就是那一分钟）。
    if (relearn.current.length) {
      setWaiting({ count: relearn.current.length, at: Math.min(...relearn.current.map((r) => r.due)) });
      return;
    }
    finish();
  };

  // 等待到期：把到期的重学卡接回队列；还没到期就再等一轮。
  useEffect(() => {
    if (!waiting) return;
    const t = setTimeout(() => {
      const now = Date.now();
      const due = relearn.current.filter((r) => r.due <= now);
      if (!due.length) {
        setWaiting(relearn.current.length ? { count: relearn.current.length, at: Math.min(...relearn.current.map((r) => r.due)) } : null);
        return;
      }
      relearn.current = relearn.current.filter((r) => r.due > now);
      setWaiting(null);
      setQueue((q) => [...q, ...due.map((d) => d.item)]);
      setIdx((i) => i + 1);
      setFlipped(false);
    }, Math.max(300, waiting.at - Date.now()));
    return () => clearTimeout(t);
  }, [waiting]);

  // 等待屏的倒计时要真的走：写死一句「等一下」会让人以为卡住了，
  // 而这里显示的正是遗忘曲线本身 —— 隔多久再来，是调度算出来的，不是我们定的。
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!waiting) return;
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [waiting]);

  /** 自评模式：评分即推进。 */
  const rate = (r: number) => {
    grade(r);
    advance();
  };

  // 选择题模式：判定是客观的（答对 Good / 答错 Again）。
  // 刻意**不在这里推进** —— 先让学习者看清对错与正确答案，由「继续」推进。
  // 判定权从学习者手里拿回来，才是「怎么选都算学会」的正解。
  const answerQuiz = (correct: boolean) => grade(correct ? 3 : 1);

  // 新卡（选择题模式）：先问认不认识，**判完才翻面看答案**。
  // 翻面之后再问「记不记得」，答案就摆在眼前 —— 那不是判定，是复述，
  // 于是每张新卡都被判成「会了」，这正是「怎么选都算学会」剩下的那一半。
  // 认识=Good(3)：10 分钟后回来，那时它是 learning 身份，走的就是选择题了 ——
  // 判定没有被跳过，只是延后到它真的有得可判的时候。
  const judgeNew = (knew: boolean) => {
    grade(knew ? 3 : 1);
    // 判「不认识」= 这一下是学这个词 → 顺手读一遍（墨墨揭示答案时即朗读）。
    // 只在「不认识」时自动读：判「认识」的人不需要，无差别朗读只会吵。
    if (!knew) speak(queue[idx]?.word ?? '');
    setFlipped(true); // 判完立刻给答案：这一下是「学」，不是「考」
  };

  // 判「认识」之后看了答案才发现记错了 —— **单向**改判成「不认识」。
  // 只能往下改：往上改（不认识 → 认识）就是把答案当提示用，那正是 v3.14 要堵的那条路。
  // 做法 = 撤销刚才那次 Good + 按 Again 重记一次；计数与待重来池同步回退。
  const correctJudge = () => {
    if (!undo) return;
    undoGrade(undo.snap);
    run.current.done = Math.max(0, run.current.done - 1);
    if (undo.rating >= 3) run.current.correct = Math.max(0, run.current.correct - 1);
    relearn.current = relearn.current.filter((r) => r.item.word_id !== undo.snap.word_id);
    grade(1);
  };

  // 选择题只用于「验证记忆」，不用于「首次见面」：
  // 一个从没见过的词，四选一只是瞎猜，那不是测试，是掷骰子。
  const useQuiz = quizMode && !!current && current.state !== 'new';
  // 新卡（选择题模式）走判定栏：判定必须在**看到答案之前**。
  const useJudge = quizMode && !!current && current.state === 'new';

  const doUndo = () => {
    if (!undo) return;
    undoGrade(undo.snap);
    run.current.done = Math.max(0, run.current.done - 1);
    if (undo.rating >= 3) run.current.correct = Math.max(0, run.current.correct - 1);
    const back = undo.at;
    // 撤销也要撤掉重学安排：这张卡的调度已还原成评分前，不该再被拉回队列。
    relearn.current = relearn.current.filter((r) => r.item.word_id !== undo.snap.word_id);
    setWaiting(null);
    setUndo(null);
    setSummary(null); // 从完成屏退回时也走这里
    setIdx(back);
    // 回到那张卡的背面，让用户看到自己刚刚改的是哪张。
    // 但**判定过的新卡必须退回正面** —— 背面页脚是「继续」，没有判定按钮，
    // 退到背面就只能干推进，那张卡等于被白拿走一次判定。
    setFlipped(!(quizMode && undo.snap.wasNew));
  };

  // ── 完成屏 ────────────────────────────────────────────────────────────
  if (summary) {
    const hist = getDailyHistory(2); // [昨日, 今日]
    const todayTotal = (hist[1]?.new_count ?? 0) + (hist[1]?.review_count ?? 0);
    const ydayTotal = (hist[0]?.new_count ?? 0) + (hist[0]?.review_count ?? 0);
    return (
      <PageEnter style={[styles.screen, { backgroundColor: c.bg, paddingHorizontal: side, paddingTop: topPad }]}>
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
      </PageEnter>
    );
  }

  // ── 学习中 ────────────────────────────────────────────────────────────
  const total = queue.length;
  return (
    <PageEnter style={[styles.screen, { backgroundColor: c.bg, paddingHorizontal: side, paddingTop: topPad }]}>
      <View style={styles.top}>
        <View style={styles.ulRow}>
          <Text style={[styles.ul, { color: c.tx3 }]}>复习</Text>
          <Num value={idx + 1} style={[styles.ul, { color: c.tx3 }]} />
          <Text style={[styles.ul, { color: c.tx3 }]}>/</Text>
          <Num value={total} style={[styles.ul, { color: c.tx3 }]} />
        </View>
        <View style={styles.ulRow}>
          <Text style={[styles.ul, { color: c.tx3 }]}>剩</Text>
          <Num value={total - idx - 1} style={[styles.ul, { color: c.tx3 }]} />
        </View>
      </View>
      <Progress ratio={total > 0 ? (idx + 1) / total : 0} style={styles.prog} />

      <View style={styles.cardArea}>
        {waiting ? (
          <View style={styles.waitBox}>
            <Text style={[styles.waitTitle, { color: c.tx1 }]}>还有 {waiting.count} 张要重来</Text>
            <Num
              value={Math.max(0, Math.ceil((waiting.at - Date.now()) / 1000))}
              style={[styles.waitCount, { color: c.ac }]}
            />
            <Text style={[styles.waitHint, { color: c.tx2 }]}>
              秒后继续 —— 刚背过的词会再出现一次，这个间隔就是遗忘曲线（重来 1 分钟 / 一般 6
              分钟 / 记住了 10 分钟）。不想等可以结束本轮，它们明天还会来。
            </Text>
            <TouchableOpacity activeOpacity={0.6} onPress={finish} style={styles.waitGiveUp}>
              <Text style={[styles.waitGiveUpText, { color: c.tx3 }]}>不等了，结束本轮</Text>
            </TouchableOpacity>
          </View>
        ) : current ? (
          useQuiz ? (
            <ChoiceQuiz item={current} onAnswer={answerQuiz} onContinue={advance} />
          ) : (
            <ReviewCard
            item={current}
            flipped={flipped}
            onFlip={() => {
              setUndo(null); // 与原型一致：翻页即收起撤销条，它只服务于刚做的那一下
              setFlipped((f) => !f);
            }}
            intervals={intervals}
            onRate={rate}
            onJudge={useJudge ? judgeNew : undefined}
            onContinue={advance}
            onWrongAfterJudge={
              useJudge && undo?.rating === 3 && undo.snap.wasNew ? correctJudge : undefined
            }
          />
          )
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
        style={[styles.endRound, { marginBottom: bottomPad }]}
      >
        <Text style={[styles.endRoundText, { color: c.tx3 }]}>结束本轮</Text>
      </TouchableOpacity>
    </PageEnter>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: SPACE.xl },
  // 数字与文字拆成独立节点：数字走 Num（等宽数位 + 不折 + 千分位），
  // 整串塞进一个 Text 就没法对数字单独设契约。
  ulRow: { flexDirection: 'row', alignItems: 'baseline', gap: 3 },
  ul: { fontSize: 10, letterSpacing: TRACK.label, fontWeight: WEIGHT.semibold },
  prog: { marginTop: SPACE.lg, marginHorizontal: SPACE.xl },

  cardArea: { flex: 1, paddingHorizontal: SPACE.lg, paddingTop: SPACE.md, paddingBottom: SPACE.sm },

  // 撤销条：只在刚评分完、且还没翻下一页时出现 —— 它服务的是「手滑了一下」，不是历史编辑。
  undo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: SPACE.lg,
    marginBottom: SPACE.sm,
    minHeight: CONTROL.md,
    borderRadius: RADIUS.ctrl,
    paddingLeft: SPACE.lg,
  },
  undoText: { fontSize: 13, letterSpacing: TRACK.body, fontWeight: WEIGHT.medium },
  undoBtn: { minHeight: CONTROL.md, paddingHorizontal: SPACE.md, justifyContent: 'center' },
  undoBtnText: { fontSize: 13, letterSpacing: TRACK.body, fontWeight: WEIGHT.semibold },

  endRound: { minHeight: CONTROL.lg, alignItems: 'center', justifyContent: 'center', marginBottom: SPACE.sm },
  endRoundText: { fontSize: 13.5, letterSpacing: TRACK.body, fontWeight: WEIGHT.medium },

  // 等待重学：这一屏本身就是「遗忘曲线在工作」的证据，所以要写清楚在等什么。
  waitBox: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: SPACE.xl, gap: SPACE.md },
  waitTitle: { fontFamily: serif, fontSize: FONT.title, fontWeight: WEIGHT.semibold },
  waitCount: { fontFamily: serif, fontSize: FONT.hero, fontWeight: WEIGHT.semibold, letterSpacing: TRACK.tight },
  waitHint: { fontSize: FONT.body, lineHeight: 22, textAlign: 'center' },
  waitGiveUp: { minHeight: CONTROL.sm, justifyContent: 'center', paddingHorizontal: SPACE.lg },
  waitGiveUpText: { fontSize: FONT.body, letterSpacing: TRACK.body },
});
