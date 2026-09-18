// 词列表：某标签下的词，按词频升序分页。点单行进入单词详情。
import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTheme } from '../src/theme/ThemeProvider';
import { serif, FONT, mono, RADIUS, WEIGHT, SPACE, CONTROL } from '../src/theme/tokens';
import { PageEnter } from '../src/components/ui';
import { getTagWords, getTagWordCount, setStudyScope, getStudyScope, type WordRow } from '../src/db/queries';
import { splitSenses } from '../src/components/Definition';
import { useSideInset, useTopPad } from '../src/lib/layout';

const PAGE = 150;

export default function WordListScreen() {
  const { colors: c } = useTheme();
  const side = useSideInset();
  const topPad = useTopPad();
  const router = useRouter();
  const params = useLocalSearchParams();
  const tagId = Number(params.tagId);
  const name = String(params.name ?? '词库');

  const [words, setWords] = useState<WordRow[]>([]);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [total, setTotal] = useState(0);
  const [scoped, setScoped] = useState(getStudyScope().tagId === tagId);

  useEffect(() => {
    setWords([]);
    setOffset(0);
    setHasMore(true);
    setTotal(getTagWordCount(tagId));
    const first = getTagWords(tagId, PAGE, 0);
    setWords(first);
    setHasMore(first.length === PAGE);
  }, [tagId]);

  const loadMore = () => {
    const next = getTagWords(tagId, PAGE, offset + PAGE);
    if (next.length === 0) {
      setHasMore(false);
      return;
    }
    setWords((prev) => [...prev, ...next]);
    setOffset((o) => o + PAGE);
    setHasMore(next.length === PAGE);
  };

  const goWord = (w: WordRow) =>
    router.push({ pathname: '/word', params: { wordId: String(w.word_id) } });

  return (
    <PageEnter style={[styles.screen, { backgroundColor: c.bg, paddingHorizontal: side, paddingTop: topPad }]}>
      <View style={[styles.top, { borderBottomColor: c.bd }]}>
        <TouchableOpacity activeOpacity={0.6} onPress={() => router.back()}>
          <Text style={[styles.back, { color: c.tx2 }]}>‹ 返回</Text>
        </TouchableOpacity>
        <Text style={[styles.title, { color: c.tx1, fontFamily: serif }]} numberOfLines={1}>
          {name}
        </Text>
        <Text style={[styles.total, { color: c.tx3 }]}>{total}</Text>
      </View>

      {scoped ? (
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => router.dismissAll()}
          style={[styles.scopeBtn, { backgroundColor: c.acsf, borderColor: c.bd }]}
        >
          <Text style={[styles.scopeBtnText, { color: c.ac }]}>✓ 在 背 · 去 首 页</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => {
            setStudyScope(tagId);
            setScoped(true);
          }}
          style={[styles.scopeBtn, { backgroundColor: c.ac, borderColor: c.ac }]}
        >
          <Text style={[styles.scopeBtnText, { color: c.acon }]}>只 背 这 一 纲</Text>
        </TouchableOpacity>
      )}

      <ScrollView contentContainerStyle={styles.list}>
        {words.map((w) => (
          <TouchableOpacity key={w.word_id} style={[styles.row, { borderBottomColor: c.bd }]} onPress={() => goWord(w)}>
            <View style={styles.rowMain}>
              <Text style={[styles.word, { color: c.tx1 }]}>{w.word}</Text>
              {w.phonetic_uk ? (
                <Text style={[styles.ipa, { color: c.tx3 }]}>{w.phonetic_uk}</Text>
              ) : null}
            </View>
            <Text style={[styles.def, { color: c.tx2 }]} numberOfLines={1}>
              {splitSenses(w.definition_zh)[0] || ''}
            </Text>
          </TouchableOpacity>
        ))}

        {hasMore ? (
          <TouchableOpacity style={[styles.more, { borderColor: c.bd }]} onPress={loadMore}>
            <Text style={[styles.moreText, { color: c.ac }]}>加载更多</Text>
          </TouchableOpacity>
        ) : null}
      </ScrollView>
    </PageEnter>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  top: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACE.xl, paddingBottom: 12, borderBottomWidth: 1,
  },
  back: { fontSize: 15 },
  title: { fontSize: 18, flex: 1, textAlign: 'center', marginHorizontal: 10 },
  total: { fontSize: 12, fontVariant: ['tabular-nums'] },
  list: { paddingHorizontal: SPACE.xl, paddingBottom: 40 },
  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 14, borderBottomWidth: 1,
  },
  rowMain: { flex: 1, marginRight: 12 },
  word: { fontSize: 17, fontFamily: serif },
  ipa: { fontSize: FONT.ipa, fontFamily: mono, marginTop: 3 },
  def: { fontSize: 13, flex: 1, textAlign: 'right' },
  // 动作按钮**不顶满整行**（2026-09-18 主人反馈「左边顶到头右边顶到尾，超级无敌长的丑按钮」）：
  // 这屏的主行动不是它（这屏是「翻词表」），一个从左边距拉到右边距的长条会把浏览页
  // 读成「一屏只有一个按钮」，也正是初学者的通病 —— 把容器宽度当按钮宽度。
  // 居中等宽 = 「本页的一个动作」，视线从标题落下来正好接住；两态给同一 minWidth，切换不跳。
  scopeBtn: {
    alignSelf: 'center',
    marginTop: SPACE.lg,
    minWidth: 200,
    paddingHorizontal: SPACE.xxxl,
    minHeight: CONTROL.md,
    borderRadius: RADIUS.ctrl,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scopeBtnText: { fontSize: 14, letterSpacing: 1.5, fontWeight: WEIGHT.semibold },
  more: {
    marginTop: 18, minHeight: CONTROL.md, borderRadius: RADIUS.ctrl, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  moreText: { fontSize: 14, letterSpacing: 1 },
});
