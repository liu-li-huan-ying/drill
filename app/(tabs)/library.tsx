// 词库（标签）列表：搜索 + 按标签浏览。M4：标签行可点进词列表，搜索可直达单词详情。
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, ScrollView, TextInput, TouchableOpacity, Animated, StyleSheet } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useTheme } from '../../src/theme/ThemeProvider';
import { serif, FONT, RADIUS, WEIGHT, SPACE, CONTROL, TRACK, MOTION } from '../../src/theme/tokens';
import { getTags, getWordCount, searchWords, getStudyScope, type WordRow } from '../../src/db/queries';
import { splitSenses } from '../../src/components/Definition';
import { Label, Chev, Num } from '../../src/components/ui';
import { easeSettle, useReducedMotion } from '../../src/lib/motion';
import { useGutter } from '../../src/lib/layout';

export default function LibraryScreen() {
  const { colors: c } = useTheme();
  const gutter = useGutter();
  const router = useRouter();
  // ⚠️ 这三个值曾经在**渲染期**一次性求值（`const tags = getTags()`）。
  // tab 屏切走不卸载、切回不重挂载 —— 值于是永远停在首次进入时的快照：
  // 学习范围在词单页改过之后，回到词库看「在背」的朱砂标记**永远不会出现**
  // （主人反馈：「预览里显示选择辞书会用红色标记，但实际并没有看到这个效果」）。
  // 凡是「别处可改、这里要显示」的值，都必须走聚焦重读（与 app/(tabs)/index.tsx 同一模式）。
  const [tags, setTags] = useState(() => getTags());
  const [total, setTotal] = useState(() => getWordCount());
  const [scopeTagId, setScopeTagId] = useState<number | null>(() => getStudyScope().tagId);

  const [query, setQuery] = useState('');
  const results: WordRow[] = query ? searchWords(query) : [];
  const max = Math.max(1, ...tags.map((t) => t.count));

  useFocusEffect(
    useCallback(() => {
      setTags(getTags());
      setTotal(getWordCount());
      setScopeTagId(getStudyScope().tagId);
    }, [])
  );

  const goWord = (w: WordRow) =>
    router.push({ pathname: '/word', params: { wordId: String(w.word_id) } });

  return (
    <ScrollView
      style={{ backgroundColor: c.bg }}
      contentContainerStyle={[styles.container, { backgroundColor: c.bg, paddingHorizontal: gutter }]}
    >
      <Label>词 库 · LIBRARY</Label>
      {/* 数字与单位分开：`已装载 30565 词` 读不出量级，`已装载 30,565 词` 一眼就有数。 */}
      <View style={styles.headRow}>
        <Text style={[styles.head, { color: c.tx1 }]}>已装载</Text>
        <Num value={total} style={[styles.headNum, { color: c.tx1, fontFamily: serif }]} />
        <Text style={[styles.headUnit, { color: c.tx3 }]}>词</Text>
      </View>
      {/* 勾选态的意思是「你正在背这本」——不说出来，8dp 方印只是一个装饰方点（P1.8）。 */}
      <Text style={[styles.hint, { color: c.tx3 }]}>点一行，就只背那一本</Text>

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
          <View style={styles.subheadRow}>
            <Label style={styles.subhead}>{results.length > 0 ? '匹配' : ''}</Label>
            {results.length > 0 ? (
              <Num value={results.length} style={[styles.subheadNum, { color: c.tx3 }]} />
            ) : null}
            <Label style={styles.subhead}>{results.length > 0 ? '词' : '无匹配'}</Label>
          </View>
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
                    {/* 选中态的**文字**反馈：只有方印变色时，「是你选的那本」和
                        「这本是自建词表」在余光里长得一样（P1.8）。 */}
                    <View style={styles.rowRight}>
                      {active ? <ScopeBadge color={c.ac} /> : null}
                      <Num value={t.count} style={[styles.count, { color: active ? c.ac : c.tx2 }]} />
                    </View>
                  </View>
                  {/* 轨道取 pg（机身底）而不是描边色：轨道是**凹槽**，凹槽比纸面暗一档才对；
                      取描边色（bd2）时条与轨的对比度只有 3.7:1，现在约 4.7:1（暗 5.9:1）。
                      填色取墨阶或朱砂（上面已述）。 */}
                  <View style={[styles.barTrack, { backgroundColor: c.pg }]}>
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

/**
 * 「在背」朱文小印 —— 它出现时是**钤**下去的（比例从 1.24 压到 1），不是淡入。
 *
 * 淡入是「显影」，钤印是「落下」：前者有过程、可撤销（写），后者瞬时、既成事实（盖）。
 * 「你正在背这本」是一个既成事实，所以它必须**落**下来。判据只有一句 ——
 * 这个动效是在「写」还是在「盖」？（见 docs/设计系统.md 的动效语汇一节）
 * 压下的起始比例比 1 **大**：印落在纸上的一瞬比静止时大，这是压开印泥的方向。
 */
function ScopeBadge({ color }: { color: string }) {
  const reduce = useReducedMotion();
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduce) {
      v.setValue(1);
      return;
    }
    const a = Animated.timing(v, {
      toValue: 1, duration: MOTION.sealTamp, easing: easeSettle(), useNativeDriver: true,
    });
    a.start();
    return () => a.stop();
  }, [reduce, v]);
  return (
    <Animated.Text
      style={[
        styles.badge,
        { color, borderColor: color },
        {
          opacity: v.interpolate({ inputRange: [0, 0.35, 1], outputRange: [0, 1, 1] }),
          transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [1.24, 1] }) }],
        },
      ]}
    >
      在背
    </Animated.Text>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, paddingTop: SPACE.sm, paddingHorizontal: SPACE.xl, paddingBottom: SPACE.huge },
  headRow: { flexDirection: 'row', alignItems: 'baseline', gap: 7, marginTop: 10 },
  head: { fontSize: FONT.title, fontFamily: serif, fontWeight: WEIGHT.semibold },
  // 数字走衬线 600 + 等宽数位：它和「已装载」是同一个标题里的两级 ——
  // 数字是读数（重）、汉字是定语（轻）。
  headNum: { fontSize: FONT.title, fontWeight: WEIGHT.semibold },
  headUnit: { fontSize: FONT.body, fontFamily: serif, fontWeight: WEIGHT.medium },
  hint: { fontSize: 12, letterSpacing: TRACK.body, marginTop: SPACE.sm },
  search: {
    flexDirection: 'row', alignItems: 'center', marginTop: 18,
    minHeight: CONTROL.md, borderRadius: RADIUS.ctrl, borderWidth: 1, paddingHorizontal: SPACE.md,
  },
  searchIcon: { fontSize: 18, marginRight: 8 },
  searchInput: { flex: 1, fontSize: 15, paddingVertical: 0 },
  searchClear: { fontSize: 20, marginLeft: 8, paddingHorizontal: 4 },
  subheadRow: { flexDirection: 'row', alignItems: 'baseline', gap: 3, marginBottom: 4 },
  subhead: { marginBottom: 0 },
  subheadNum: { fontSize: 10.5, fontWeight: WEIGHT.semibold, letterSpacing: TRACK.label },
  resRow: { paddingVertical: 13, borderBottomWidth: 1 },
  resWord: { fontSize: 15, fontFamily: serif },
  resDef: { fontSize: 13, marginTop: 3 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1 },
  // 8dp 方印：实底/描边两种状态外框同尺寸，行与行的左边缘才对得齐。
  mark: { width: 8, height: 8, borderRadius: RADIUS.mark, marginRight: SPACE.md },
  rowMain: { flex: 1 },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: SPACE.md },
  rowRight: { flexDirection: 'row', alignItems: 'baseline', gap: SPACE.sm, flexShrink: 0 },
  // 「在背」用朱砂**朱文印**式的小框：与「已掌握」这类批点同一套语汇。
  // 它由 ScopeBadge 渲染（出现时钤下去），这里只管静态样式。
  badge: {
    fontSize: 9.5, letterSpacing: TRACK.body, fontWeight: WEIGHT.semibold,
    borderWidth: 1, borderRadius: RADIUS.chip, paddingHorizontal: 5, paddingVertical: 1,
  },
  // 名称是内容，用 tx1 满墨 + 500（列表项档）；长名截断而不是把词数挤出去。
  name: { flexShrink: 1, fontSize: 15, fontWeight: WEIGHT.medium },
  // 词数走衬线 600：数字是这一行的「读数」，靠字重站住，不靠颜色（§3 字重）。
  count: {
    fontSize: 15,
    fontFamily: serif,
    fontWeight: WEIGHT.semibold,
  },
  barTrack: { height: 4, borderRadius: RADIUS.bar, marginTop: SPACE.sm, overflow: 'hidden' },
  barFill: { height: 4, borderRadius: RADIUS.bar },
});
