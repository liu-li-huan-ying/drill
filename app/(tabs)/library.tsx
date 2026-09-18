// 词库（标签）列表：搜索 + 按标签浏览。M4：标签行可点进词列表，搜索可直达单词详情。
import React, { useState } from 'react';
import { View, Text, ScrollView, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../../src/theme/ThemeProvider';
import { serif, FONT, RADIUS, WEIGHT, SPACE, CONTROL } from '../../src/theme/tokens';
import { getTags, getWordCount, searchWords, getStudyScope, type WordRow } from '../../src/db/queries';
import { splitSenses } from '../../src/components/Definition';
import { Label, Chev } from '../../src/components/ui';
import { useGutter } from '../../src/lib/layout';

export default function LibraryScreen() {
  const { colors: c } = useTheme();
  const gutter = useGutter();
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
    <ScrollView
      style={{ backgroundColor: c.bg }}
      contentContainerStyle={[styles.container, { backgroundColor: c.bg, paddingHorizontal: gutter }]}
    >
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
            //
            // 但「中性」不等于「灰得看不见」（2026-09-18 主人反馈「都是灰的，死气沉沉」）：
            // 原来条色取 `bd2`、标记取实心灰点，而 bd2 与轨道 `pg` 的对比度只有 **1.25:1**（实测）——
            // 8 行「量度」全都画了等于没画，屏幕只剩一片浅灰。中性靠**墨阶**表达：
            //   名称 tx1（近墨）> 词数 tx2 · 条色 tx2（墨阶第二档）> 计数标记描边 tx2（1px 细线）
            // 量度于是重新可见：条长比 = 词库相对大小，是本屏唯一的图形信息。
            const active = scopeTagId === t.id;
            const custom = t.kind === 'custom'; // 自己导的词表：用虚线方框区分（原型 s6 的写法）
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
                {/* 计数标记：1px 内描边小方印（朱文印），只有「你正在背的这一本」才落朱砂实底 ——
                    原来是实心灰圆点：既看不出「选中 / 未选」的边界，也是纯色块（§9.3 明令禁止）。 */}
                <View
                  style={[
                    styles.mark,
                    active
                      ? { backgroundColor: c.ac }
                      : { borderWidth: 1, borderColor: c.tx2, borderStyle: custom ? 'dashed' : 'solid' },
                  ]}
                />
                <View style={styles.rowMain}>
                  <View style={styles.rowTop}>
                    <Text
                      style={[
                        styles.name,
                        { color: c.tx1 },
                        active && { color: c.ac, fontWeight: WEIGHT.semibold },
                      ]}
                      numberOfLines={1}
                    >
                      {t.name}
                    </Text>
                    <Text style={[styles.count, { color: active ? c.ac : c.tx2 }]}>{t.count}</Text>
                  </View>
                  {/* 轨道取 bd2（原型 .rw .bar 的取值）：轨道是「满额」的容器，
                      有它才读得出「这一段占了整个词库的多少」——填色取墨阶或朱砂（上面已述）。 */}
                  <View style={[styles.barTrack, { backgroundColor: c.bd2 }]}>
                    <View style={[styles.barFill, { width: `${w}%`, backgroundColor: active ? c.ac : c.tx2 }]} />
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
    minHeight: CONTROL.md, borderRadius: RADIUS.ctrl, borderWidth: 1, paddingHorizontal: SPACE.md,
  },
  searchIcon: { fontSize: 18, marginRight: 8 },
  searchInput: { flex: 1, fontSize: 15, paddingVertical: 0 },
  searchClear: { fontSize: 20, marginLeft: 8, paddingHorizontal: 4 },
  subhead: { marginBottom: 4 },
  resRow: { paddingVertical: 13, borderBottomWidth: 1 },
  resWord: { fontSize: 15, fontFamily: serif },
  resDef: { fontSize: 13, marginTop: 3 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1 },
  // 8dp 方印：实底/描边两种状态外框同尺寸，行与行的左边缘才对得齐。
  mark: { width: 8, height: 8, borderRadius: RADIUS.mark, marginRight: SPACE.md },
  rowMain: { flex: 1 },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: SPACE.md },
  // 名称是内容，用 tx1 满墨 + 500（列表项档）；长名截断而不是把词数挤出去。
  name: { fontSize: 15, fontWeight: WEIGHT.medium, flexShrink: 1 },
  // 词数走衬线 600：数字是这一行的「读数」，靠字重站住，不靠颜色（§3 字重）。
  count: {
    fontSize: 15,
    fontFamily: serif,
    fontWeight: WEIGHT.semibold,
    fontVariant: ['tabular-nums'],
    flexShrink: 0,
  },
  barTrack: { height: 4, borderRadius: RADIUS.bar, marginTop: SPACE.sm, overflow: 'hidden' },
  barFill: { height: 4, borderRadius: RADIUS.bar },
});
