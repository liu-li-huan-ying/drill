// 我的助记：集中查看 / 检索所有手写助记与备注。按更新时间倒序，点行进单词详情继续编辑。
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../src/theme/ThemeProvider';
import { serif, FONT, mono } from '../src/theme/tokens';
import { getNotes, getNoteCount, type NoteRow } from '../src/db/queries';
import { splitSenses } from '../src/components/Definition';

export default function NotesScreen() {
  const { colors: c } = useTheme();
  const router = useRouter();

  const [q, setQ] = useState('');
  const [rows, setRows] = useState<NoteRow[]>([]);
  const total = useMemo(() => getNoteCount(), []);

  useEffect(() => {
    setRows(getNotes(q));
  }, [q]);

  const goWord = (id: number) =>
    router.push({ pathname: '/word', params: { wordId: String(id) } });

  return (
    <View style={[styles.screen, { backgroundColor: c.bg }]}>
      <View style={[styles.top, { borderBottomColor: c.bd }]}>
        <TouchableOpacity activeOpacity={0.6} onPress={() => router.back()}>
          <Text style={[styles.back, { color: c.tx2 }]}>‹ 返回</Text>
        </TouchableOpacity>
        <Text style={[styles.title, { color: c.tx1, fontFamily: serif }]}>我 的 助 记</Text>
        <Text style={[styles.total, { color: c.tx3 }]}>{rows.length}/{total}</Text>
      </View>

      <View style={styles.searchWrap}>
        <View style={[styles.search, { backgroundColor: c.sf, borderColor: c.bd2 }]}>
          <TextInput
            style={[styles.searchInput, { color: c.tx1 }]}
            placeholder="搜单词 / 助记 / 备注…"
            placeholderTextColor={c.tx3}
            value={q}
            onChangeText={setQ}
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
          />
          {q ? (
            <TouchableOpacity activeOpacity={0.6} onPress={() => setQ('')} hitSlop={8}>
              <Text style={[styles.clear, { color: c.tx3 }]}>✕</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.list} keyboardShouldPersistTaps="handled">
        {rows.length === 0 ? (
          <Text style={[styles.empty, { color: c.tx3 }]}>
            {total === 0 ? '还没有助记。进单词详情页写下第一条吧。' : '没有匹配的助记。'}
          </Text>
        ) : (
          rows.map((r) => {
            const preview = r.mnemonic?.trim() || r.note?.trim() || '';
            const extra = r.mnemonic?.trim() && r.note?.trim() ? r.note.trim() : '';
            return (
              <TouchableOpacity
                key={r.word_id}
                style={[styles.card, { backgroundColor: c.sf, borderColor: c.bd }]}
                activeOpacity={0.7}
                onPress={() => goWord(r.word_id)}
              >
                <View style={styles.head}>
                  <Text style={[styles.word, { color: c.tx1 }]}>{r.word}</Text>
                  {r.phonetic_uk ? (
                    <Text style={[styles.ipa, { color: c.tx3 }]}>{r.phonetic_uk}</Text>
                  ) : null}
                </View>
                {r.definition_zh ? (
                  <Text style={[styles.def, { color: c.tx2 }]} numberOfLines={1}>
                    {splitSenses(r.definition_zh)[0] || ''}
                  </Text>
                ) : null}
                <View style={[styles.mnemonicBox, { borderLeftColor: c.ac }]}>
                  <Text style={[styles.mnemonic, { color: c.tx1 }]}>{preview}</Text>
                  {extra ? (
                    <Text style={[styles.extra, { color: c.tx2 }]} numberOfLines={4}>
                      {extra}
                    </Text>
                  ) : null}
                </View>
              </TouchableOpacity>
            );
          })
        )}
        <View style={{ height: 30 }} />
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
  back: { fontSize: 15, width: 56 },
  title: { fontSize: 18, flex: 1, textAlign: 'center' },
  total: { fontSize: 12, fontVariant: ['tabular-nums'], width: 56, textAlign: 'right' },
  searchWrap: { paddingHorizontal: 18, paddingTop: 14 },
  search: {
    flexDirection: 'row', alignItems: 'center', height: 42,
    borderRadius: 10, borderWidth: 1, paddingHorizontal: 14,
  },
  searchInput: { flex: 1, fontSize: 14.5, paddingVertical: 0 },
  clear: { fontSize: 15, paddingLeft: 8 },
  list: { paddingHorizontal: 18, paddingTop: 14 },
  empty: { fontSize: 13, fontStyle: 'italic', marginTop: 28, textAlign: 'center', lineHeight: 20 },
  card: { borderRadius: 10, borderWidth: 1, padding: 14, marginBottom: 12 },
  head: { flexDirection: 'row', alignItems: 'baseline', gap: 10 },
  word: { fontSize: 18, fontFamily: serif },
  ipa: { fontSize: FONT.ipa, fontFamily: mono },
  def: { fontSize: 13, marginTop: 4 },
  mnemonicBox: { marginTop: 10, paddingLeft: 12, borderLeftWidth: 2 },
  mnemonic: { fontSize: 14.5, lineHeight: 21 },
  extra: { fontSize: 13, lineHeight: 19, marginTop: 5 },
});
