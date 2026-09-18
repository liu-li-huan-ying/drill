// 词库（标签）列表：搜索 + 按标签浏览。M4：标签行可点进词列表，搜索可直达单词详情。
import React, { useState } from 'react';
import { View, Text, ScrollView, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../../src/theme/ThemeProvider';
import { serif, FONT, RADIUS, WEIGHT, SPACE, CONTROL } from '../../src/theme/tokens';
import { getTags, getWordCount, searchWords, getStudyScope, type WordRow } from '../../src/db/queries';
import { splitSenses } from '../../src/components/Definition';
import { Label, Chev } from '../../src/components/ui';

export default function LibraryScreen() {
  const { colors: c } = useTheme();
  const router = useRouter();
  const tags = getTags();
  const total = getWordCount();
  const max = Math.max(1, ...tags.map((t) => t.count));
  const scopeTagId = getStudyScope().tagId; // 当前学习范围（朱砂只标「人选过的那一个」）

  const [query, setQuery] = useState('');
  const results: WordRow[] = query ? searchWords(query) : [];

  const goWord = (w: WordRow) =>
    router.push({ pathname: '/word', params: { wordId: String(w.word_id) } });

  return (
    <ScrollView contentContainerStyle={[styles.container, { backgroundColor: c.bg }]}>
      <Label>词 库 · LIBRARY</Label>
      <Text style={[styles.head, { color: c.tx1 }]}>已装载 {total} 词</Text>

      {/* 搜索框 */}
      <View style={[styles.search, { backgroundColor: c.pg, borderColor: c.bd }]}>
        <Text style={[styles.searchIcon, { color: c.tx3 }]}>⌕</Text>
        <TextInput
          style={[styles.searchInput, { color: c.tx1 }]}
          placeholder="搜索单词…"
          placeholderTextColor={c.tx3}
          value={query}
          onChangeText={setQuery}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
        />
        {query ? (
          <TouchableOpacity onPress={() => setQuery('')}>
            <Text style={[styles.searchClear, { color: c.tx3 }]}>×</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {query ? (
        <View style={{ marginTop: 18 }}>
          <Label style={styles.subhead}>
            {results.length > 0 ? `匹配 ${results.length} 词` : '无匹配'}
          </Label>
          {results.map((w) => (
            <TouchableOpacity key={w.word_id} style={[styles.resRow, { borderBottomColor: c.bd }]} onPress={() => goWord(w)}>
              <Text style={[styles.resWord, { color: c.tx1 }]}>{w.word}</Text>
              <Text style={[styles.resDef, { color: c.tx2 }]} numberOfLines={1}>
                {splitSenses(w.definition_zh)[0] || ''}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : (
        <View style={{ marginTop: 20 }}>
          {tags.map((t) => {
            const w = (t.count / max) * 100;
            // 词库是机器生成的分类，不给它彩色 —— 单色体系里 8 个 Material 主色会把「朱砂只标人的痕迹」冲掉。
            // 朱砂只留给「你正在背的这一本」：那是人的选择。
            const active = scopeTagId === t.id;
            return (
              <TouchableOpacity
                key={t.id}
                style={[styles.row, { borderBottomColor: c.bd }]}
                onPress={() =>
                  router.push({
                    pathname: '/wordlist',
                    params: { tagId: String(t.id), name: t.name },
                  })
                }
              >
                <View style={[styles.dot, { backgroundColor: active ? c.ac : c.tx3 }]} />
                <View style={styles.rowMain}>
                  <View style={styles.rowTop}>
                    <Text style={[styles.name, { color: c.tx1 }, active && styles.nameActive]}>
                      {t.name}
                    </Text>
                    <Text style={[styles.count, { color: c.tx2 }]}>{t.count}</Text>
                  </View>
                  <View style={[styles.barTrack, { backgroundColor: c.pg }]}>
                    <View style={[styles.barFill, { width: `${w}%`, backgroundColor: active ? c.ac : c.bd2 }]} />
                  </View>
                </View>
                <Chev />
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, paddingTop: SPACE.sm, paddingHorizontal: SPACE.xl, paddingBottom: SPACE.huge },
  head: { fontSize: FONT.title, marginTop: 10, fontFamily: serif, fontWeight: WEIGHT.semibold },
  search: {
    flexDirection: 'row', alignItems: 'center', marginTop: 18,
    height: CONTROL.md, borderRadius: RADIUS.ctrl, borderWidth: 1, paddingHorizontal: SPACE.md,
  },
  searchIcon: { fontSize: 18, marginRight: 8 },
  searchInput: { flex: 1, fontSize: 15, paddingVertical: 0 },
  searchClear: { fontSize: 20, marginLeft: 8, paddingHorizontal: 4 },
  subhead: { marginBottom: 4 },
  resRow: { paddingVertical: 13, borderBottomWidth: 1 },
  resWord: { fontSize: 15, fontFamily: serif },
  resDef: { fontSize: 13, marginTop: 3 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1 },
  dot: { width: 7, height: 7, borderRadius: RADIUS.mark, marginRight: 12 },
  rowMain: { flex: 1 },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  name: { fontSize: 15 },
  nameActive: { fontWeight: WEIGHT.semibold },
  count: { fontSize: 13, fontVariant: ['tabular-nums'] },
  barTrack: { height: 4, borderRadius: RADIUS.bar, marginTop: 8, overflow: 'hidden' },
  barFill: { height: 4, borderRadius: RADIUS.bar },
});
