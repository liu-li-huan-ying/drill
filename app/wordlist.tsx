// 词列表：某标签下的词，按词频升序分页。点单行进入单词详情。
import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTheme } from '../src/theme/ThemeProvider';
import { serif, FONT, mono } from '../src/theme/tokens';
import { getTagWords, getTagWordCount, setStudyScope, getStudyScope, type WordRow } from '../src/db/queries';

const PAGE = 150;

export default function WordListScreen() {
  const { colors: c } = useTheme();
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
    <View style={[styles.screen, { backgroundColor: c.bg }]}>
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
          <Text style={[styles.scopeBtnText, { color: c.ac }]}>✓ 已设为学习范围 · 去首页 ›</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => {
            setStudyScope(tagId);
            setScoped(true);
          }}
          style={[styles.scopeBtn, { backgroundColor: c.ac }]}
        >
          <Text style={[styles.scopeBtnText, { color: c.acon }]}>只 背 这 一 纲 →</Text>
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
              {w.definition_zh || ''}
            </Text>
          </TouchableOpacity>
        ))}

        {hasMore ? (
          <TouchableOpacity style={[styles.more, { borderColor: c.bd }]} onPress={loadMore}>
            <Text style={[styles.moreText, { color: c.ac }]}>加载更多</Text>
          </TouchableOpacity>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingTop: 52 },
  top: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 18, paddingBottom: 12, borderBottomWidth: 1,
  },
  back: { fontSize: 15 },
  title: { fontSize: 18, flex: 1, textAlign: 'center', marginHorizontal: 10 },
  total: { fontSize: 12, fontVariant: ['tabular-nums'] },
  list: { paddingHorizontal: 18, paddingBottom: 40 },
  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 14, borderBottomWidth: 1,
  },
  rowMain: { flex: 1, marginRight: 12 },
  word: { fontSize: 17, fontFamily: serif },
  ipa: { fontSize: FONT.ipa, fontFamily: mono, marginTop: 3 },
  def: { fontSize: 13, flex: 1, textAlign: 'right' },
  scopeBtn: { marginTop: 12, height: 46, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  scopeBtnText: { fontSize: 14, letterSpacing: 2, fontWeight: '600' },
  more: {
    marginTop: 18, height: 44, borderRadius: 10, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  moreText: { fontSize: 14, letterSpacing: 1 },
});
