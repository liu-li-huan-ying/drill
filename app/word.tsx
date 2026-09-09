// 单词详情：释义 / 词性 / 例句占位 / 词根词缀 / 考纲标签 + 标为已掌握。
import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTheme } from '../src/theme/ThemeProvider';
import { serif, FONT, mono } from '../src/theme/tokens';
import { getWordDetail, markMastered } from '../src/db/queries';
import { speak } from '../src/lib/speak';

// 考纲代号 → 中文展示名（与 build_dict.py 的 EXAM_LABELS 对应）。
const EXAM_LABELS: Record<string, string> = {
  zk: '中考', gk: '高考', ky: '考研', cet4: 'CET-4', cet6: 'CET-6',
  toefl: 'TOEFL', ielts: 'IELTS', gre: 'GRE', 考研: '考研',
};

export default function WordScreen() {
  const { colors: c } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams();
  const wordId = Number(params.wordId);

  const [detail, setDetail] = useState<ReturnType<typeof getWordDetail>>(null);
  const [mastered, setMastered] = useState(false);

  useEffect(() => {
    const d = getWordDetail(wordId);
    setDetail(d);
    setMastered(d?.mastered ?? false);
  }, [wordId]);

  if (!detail) {
    return (
      <View style={[styles.screen, { backgroundColor: c.bg }]}>
        <View style={[styles.top, { borderBottomColor: c.bd }]}>
          <TouchableOpacity activeOpacity={0.6} onPress={() => router.back()}>
            <Text style={[styles.back, { color: c.tx2 }]}>‹ 返回</Text>
          </TouchableOpacity>
          <Text style={[styles.title, { color: c.tx1 }]}>未找到</Text>
        </View>
      </View>
    );
  }

  const toggleMastered = () => {
    markMastered(detail.word_id);
    setMastered((m) => !m);
  };

  const examChips = (detail.exam_tags || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  return (
    <View style={[styles.screen, { backgroundColor: c.bg }]}>
      <View style={[styles.top, { borderBottomColor: c.bd }]}>
        <TouchableOpacity activeOpacity={0.6} onPress={() => router.back()}>
          <Text style={[styles.back, { color: c.tx2 }]}>‹ 返回</Text>
        </TouchableOpacity>
        <Text style={[styles.title, { color: c.tx1 }]}>单 词 详 情</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.wordRow}>
          <Text style={[styles.word, { color: c.tx1 }]}>{detail.word}</Text>
          <TouchableOpacity style={styles.sound} activeOpacity={0.6} onPress={() => speak(detail.word)}>
            <SoundIcon color={c.ac} />
          </TouchableOpacity>
        </View>
        {detail.phonetic_uk ? (
          <Text style={[styles.ipa, { color: c.tx3 }]}>{detail.phonetic_uk}</Text>
        ) : null}

        {detail.pos ? (
          <View style={[styles.posChip, { backgroundColor: c.acsf }]}>
            <Text style={[styles.posText, { color: c.ac }]}>{detail.pos}</Text>
          </View>
        ) : null}

        {detail.definition_zh ? (
          <Text style={[styles.def, { color: c.tx1 }]}>{detail.definition_zh}</Text>
        ) : null}
        {detail.definition_en ? (
          <Text style={[styles.defEn, { color: c.tx2 }]}>{detail.definition_en}</Text>
        ) : null}

        {detail.root_affix ? (
          <View style={[styles.rootRow, { borderColor: c.bd }]}>
            <View style={[styles.mk, { backgroundColor: c.ac }]} />
            <Text style={[styles.root, { color: c.tx2 }]}>{detail.root_affix}</Text>
          </View>
        ) : null}

        {examChips.length > 0 ? (
          <View style={styles.chips}>
            {examChips.map((code) => (
              <View key={code} style={[styles.chip, { backgroundColor: c.pg }]}>
                <Text style={[styles.chipText, { color: c.tx2 }]}>
                  {EXAM_LABELS[code] || code}
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        <View style={{ flex: 1 }} />
      </ScrollView>

      <View style={[styles.footer, { borderTopColor: c.bd }]}>
        <TouchableOpacity
          style={[
            styles.masterBtn,
            mastered ? { backgroundColor: c.pg } : { backgroundColor: c.ac },
          ]}
          activeOpacity={0.85}
          onPress={toggleMastered}
        >
          <Text style={[styles.masterText, { color: mastered ? c.tx1 : c.acon }]}>
            {mastered ? '已掌握 · 取消' : '标 为 已 掌 握'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function SoundIcon({ color }: { color: string }) {
  return (
    <View style={{ width: 19, height: 19, alignItems: 'center', justifyContent: 'center' }}>
      <View
        style={{
          width: 19, height: 19, borderRadius: 9.5,
          borderWidth: 1.5, borderColor: color, alignItems: 'center', justifyContent: 'center',
        }}
      >
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
      </View>
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
  title: { fontSize: 13, letterSpacing: 3, textTransform: 'uppercase', fontWeight: '600', flex: 1, textAlign: 'center' },
  body: { paddingHorizontal: 24, paddingTop: 28, paddingBottom: 24, flexGrow: 1 },
  wordRow: { flexDirection: 'row', alignItems: 'center' },
  word: { fontFamily: serif, fontSize: FONT.word, letterSpacing: -0.8 },
  sound: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginLeft: 14 },
  ipa: { fontFamily: mono, fontSize: FONT.ipa, marginTop: 12, letterSpacing: 0.8 },
  posChip: { alignSelf: 'flex-start', marginTop: 16, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  posText: { fontSize: 11, letterSpacing: 1, fontWeight: '600', textTransform: 'uppercase' },
  def: { fontSize: FONT.def, lineHeight: 25, marginTop: 18 },
  defEn: { fontSize: 13, fontStyle: 'italic', lineHeight: 19, marginTop: 10 },
  rootRow: { flexDirection: 'row', alignItems: 'center', marginTop: 18, paddingTop: 16, borderTopWidth: 1, gap: 8 },
  mk: { width: 7, height: 7, borderRadius: 1 },
  root: { fontSize: 13, lineHeight: 20 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 18 },
  chip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6 },
  chipText: { fontSize: 12, letterSpacing: 0.5 },
  footer: { paddingHorizontal: 18, paddingBottom: 24, paddingTop: 12, borderTopWidth: 1 },
  masterBtn: { height: 50, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  masterText: { fontSize: 15, letterSpacing: 3, fontWeight: '600' },
});
