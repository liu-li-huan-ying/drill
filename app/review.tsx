// 复习会话：构建今日队列（先到期的复习 + 当日新词）→ 翻转看释义 → 四档评分 → 写回 → 推进。
// 评分仅在翻转后开放；队列清空显示今日已清空。
import React, { useCallback, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useTheme } from '../src/theme/ThemeProvider';
import { serif, type Tokens } from '../src/theme/tokens';
import { ReviewCard } from '../src/features/review/ReviewCard';
import { RatingBar } from '../src/features/review/RatingBar';
import { planSession, recordGrade, type QueueItem } from '../src/db/queries';
import type { Grade } from 'ts-fsrs';

export default function ReviewScreen() {
  const { colors: c } = useTheme();
  const router = useRouter();
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [finished, setFinished] = useState(false);
  const [stat, setStat] = useState({ review: 0, news: 0 });

  const build = useCallback(() => {
    const { reviews, news } = planSession();
    setQueue([...reviews, ...news]);
    setStat({ review: reviews.length, news: news.length });
    setIdx(0);
    setFlipped(false);
    setFinished(reviews.length + news.length === 0);
  }, []);

  useFocusEffect(
    useCallback(() => {
      build();
    }, [build])
  );

  const rate = (r: number) => {
    if (!queue[idx]) return;
    recordGrade(queue[idx], r as Grade);
    const next = idx + 1;
    setFlipped(false);
    if (next >= queue.length) setFinished(true);
    else setIdx(next);
  };

  if (finished) {
    return (
      <View style={[styles.screen, { backgroundColor: c.bg }]}>
        <View style={styles.doneWrap}>
          <Text style={[styles.doneTitle, { color: c.tx1, fontFamily: serif }]}>今日已清空</Text>
          <Text style={[styles.doneSub, { color: c.tx2 }]}>复习 {stat.review} · 新词 {stat.news}</Text>
          <TouchableOpacity activeOpacity={0.85} onPress={() => router.back()} style={[styles.doneBtn, { backgroundColor: c.ac }]}>
            <Text style={[styles.doneBtnText, { color: c.acon }]}>返 回 今 日</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const current = queue[idx];
  return (
    <View style={[styles.screen, { backgroundColor: c.bg }]}>
      <View style={[styles.top, { borderBottomColor: c.bd }]}>
        <Text style={[styles.progress, { color: c.tx3 }]}>
          {idx + 1} / {queue.length}
        </Text>
        <TouchableOpacity activeOpacity={0.6} onPress={() => router.back()}>
          <Text style={[styles.end, { color: c.tx2 }]}>结束</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.cardArea}>
        {current ? <ReviewCard item={current} flipped={flipped} onFlip={() => setFlipped((f) => !f)} /> : null}
      </View>

      {flipped ? (
        <View style={styles.rateArea}>
          <RatingBar onRate={rate} />
        </View>
      ) : (
        <View style={styles.hintArea}>
          <Text style={[styles.hint, { color: c.tx3 }]}>轻触卡片查看释义</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingTop: 52 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 22, paddingBottom: 14, borderBottomWidth: 1 },
  progress: { fontSize: 12, letterSpacing: 2, fontVariant: ['tabular-nums'] },
  end: { fontSize: 14, letterSpacing: 1 },
  cardArea: { flex: 1, paddingHorizontal: 16 },
  rateArea: { paddingHorizontal: 16, paddingBottom: 28 },
  hintArea: { paddingBottom: 40, alignItems: 'center' },
  hint: { fontSize: 12, letterSpacing: 1 },
  doneWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 },
  doneTitle: { fontSize: 32, letterSpacing: -0.5 },
  doneSub: { fontSize: 14, marginTop: 12, letterSpacing: 1 },
  doneBtn: { marginTop: 32, height: 50, width: 200, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  doneBtnText: { fontSize: 15, letterSpacing: 3, fontWeight: '600' },
});
