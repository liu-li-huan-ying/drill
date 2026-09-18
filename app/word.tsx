// 单词详情：释义 / 词性 / 例句 / 词根词缀（运行时拆解） / 手写助记 / 考纲标签 + 标为已掌握。
import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, TextInput } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTheme } from '../src/theme/ThemeProvider';
import { serif, FONT, mono, RADIUS, WEIGHT, SPACE, CONTROL, TRACK } from '../src/theme/tokens';
import { PageEnter, SoundIcon } from '../src/components/ui';
import {
  getWordDetail,
  markMastered,
  getExamples,
  decomposeWord,
  getUserNote,
  saveUserNote,
  type ExampleRow,
} from '../src/db/queries';
import type { Morphology } from '../src/lib/morphology';
import { DefinitionView } from '../src/components/Definition';
import { MorphologyView } from '../src/components/Morphology';
import { speak } from '../src/lib/speak';
import { useSideInset, useTopPad, useBottomPad } from '../src/lib/layout';

// 考纲代号 → 中文展示名（与 build_dict.py 的 EXAM_LABELS 对应）。
const EXAM_LABELS: Record<string, string> = {
  zk: '中考', gk: '高考', ky: '考研', cet4: 'CET-4', cet6: 'CET-6',
  toefl: 'TOEFL', ielts: 'IELTS', gre: 'GRE', 考研: '考研',
};

export default function WordScreen() {
  const { colors: c } = useTheme();
  const side = useSideInset();
  const topPad = useTopPad();
  const bottomPad = useBottomPad();
  const router = useRouter();
  const params = useLocalSearchParams();
  const wordId = Number(params.wordId);

  const [detail, setDetail] = useState<ReturnType<typeof getWordDetail>>(null);
  const [mastered, setMastered] = useState(false);
  const [examples, setExamples] = useState<ExampleRow[]>([]);
  const [morph, setMorph] = useState<Morphology | null>(null);
  const [mnemonic, setMnemonic] = useState('');
  const [note, setNote] = useState('');
  const [noteSaved, setNoteSaved] = useState(false);

  useEffect(() => {
    const d = getWordDetail(wordId);
    setDetail(d);
    setMastered(d?.mastered ?? false);
    setExamples(getExamples(wordId));
    setMorph(d ? decomposeWord(d.word) : null);
    const un = getUserNote(wordId);
    setMnemonic(un?.mnemonic ?? '');
    setNote(un?.note ?? '');
  }, [wordId]);

  if (!detail) {
    return (
      <PageEnter style={[styles.screen, { backgroundColor: c.bg, paddingHorizontal: side, paddingTop: topPad }]}>
        <View style={[styles.top, { borderBottomColor: c.bd }]}>
          <TouchableOpacity activeOpacity={0.6} onPress={() => router.back()}>
            <Text style={[styles.back, { color: c.tx2 }]}>‹ 返回</Text>
          </TouchableOpacity>
          <Text style={[styles.title, { color: c.tx1 }]}>未找到</Text>
        </View>
      </PageEnter>
    );
  }

  const toggleMastered = () => {
    markMastered(detail.word_id);
    setMastered((m) => !m);
  };

  // 编辑结束时落库；两栏皆空则删行（保持「有助记才有记录」）。
  const persistNote = () => {
    saveUserNote(detail.word_id, mnemonic, note);
    setNoteSaved(true);
    setTimeout(() => setNoteSaved(false), 1500);
  };

  const examChips = (detail.exam_tags || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  return (
    <PageEnter style={[styles.screen, { backgroundColor: c.bg, paddingHorizontal: side, paddingTop: topPad }]}>
      <View style={[styles.top, { borderBottomColor: c.bd }]}>
        <TouchableOpacity activeOpacity={0.6} onPress={() => router.back()}>
          <Text style={[styles.back, { color: c.tx2 }]}>‹ 返回</Text>
        </TouchableOpacity>
        <Text style={[styles.title, { color: c.tx1 }]}>单 词 详 情</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <View style={styles.wordRow}>
          <Text style={[styles.word, { color: c.tx1 }]}>{detail.word}</Text>
          <TouchableOpacity
            style={[styles.sound, { borderColor: c.bd2, backgroundColor: c.sf }]}
            activeOpacity={0.6}
            onPress={() => speak(detail.word)}
            accessibilityLabel="播放发音"
          >
            <SoundIcon color={c.ac} />
          </TouchableOpacity>
        </View>
        {/* 朱笔横痕：这个词被「批」过一次的痕迹，也是详情页与复习卡共用的识别符。 */}
        <View style={[styles.stroke, { backgroundColor: c.ac }]} />
        {/* 音标走 tx2（P1.3）：它是「怎么读」这个信息本身，不是装饰。
            旧值 tx3 在亮色下对纸底只有 2.5:1 —— 一条读不清的音标等于没有音标。 */}
        {detail.phonetic_uk ? (
          <Text style={[styles.ipa, { color: c.tx2 }]}>{detail.phonetic_uk}</Text>
        ) : null}

        {detail.pos ? (
          <View style={[styles.posChip, { backgroundColor: c.acsf }]}>
            <Text style={[styles.posText, { color: c.ac }]}>{detail.pos}</Text>
          </View>
        ) : null}

        {/* 词性已在上面落过一次 → 义项里不再重复；义项改成编号列表，
            长释义（考研词常有 4–6 条）才数得清有几条、也才看得出读到了第几条。 */}
        <DefinitionView
          raw={detail.definition_zh}
          accent={c.ac}
          numbered
          stripPos={Boolean(detail.pos)}
          blockStyle={{ marginTop: 18 }}
          style={{ color: c.tx1, fontSize: FONT.def, lineHeight: 25 }}
        />
        {/* 英文释义：**不用斜体**（P1.3）。斜体在中文界面里是「例句原文」的专用记号，
            给释义也套上，例句就失去了它唯一的视觉身份；对比度也从 tx3 提到 tx2。 */}
        <DefinitionView
          raw={detail.definition_en}
          accent={c.ac}
          numbered
          stripPos={Boolean(detail.pos)}
          blockStyle={{ marginTop: 10 }}
          style={{ color: c.tx2, fontSize: 13, lineHeight: 19 }}
        />

        {morph ? (
          <View style={{ marginTop: 22 }}>
            <View style={styles.exHeader}>
              <View style={[styles.mk, { backgroundColor: c.ac }]} />
              <Text style={[styles.secTitle, { color: c.tx1 }]}>词 根 词 缀</Text>
            </View>
            <View style={[styles.morphBox, { borderColor: c.bd, backgroundColor: c.sf }]}>
              <MorphologyView data={morph} />
            </View>
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

        <View style={styles.exHeader}>
          <View style={[styles.mk, { backgroundColor: c.ac }]} />
          <Text style={[styles.secTitle, { color: c.tx1 }]}>例 句</Text>
        </View>
        {examples.length > 0 ? (
          examples.map((ex, i) => (
            <View key={i} style={[styles.exItem, { borderLeftColor: c.bd }]}>
              <Text style={[styles.exEn, { color: c.tx2 }]}>{ex.sentence_en}</Text>
              {ex.sentence_zh ? (
                <Text style={[styles.exZh, { color: c.tx3 }]}>{ex.sentence_zh}</Text>
              ) : null}
            </View>
          ))
        ) : (
          <Text style={[styles.exEmpty, { color: c.tx3 }]}>暂无例句</Text>
        )}

        <View style={[styles.exHeader, { justifyContent: 'space-between' }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={[styles.mk, { backgroundColor: c.ac }]} />
            <Text style={[styles.secTitle, { color: c.tx1 }]}>我 的 助 记</Text>
          </View>
          {noteSaved ? <Text style={[styles.savedTag, { color: c.ac }]}>已保存</Text> : null}
        </View>
        <TextInput
          style={[styles.input, { color: c.tx1, borderColor: c.bd2, backgroundColor: c.sf }]}
          placeholder="联想 / 谐音 / 拆词记忆点…"
          placeholderTextColor={c.tx3}
          value={mnemonic}
          onChangeText={setMnemonic}
          onEndEditing={persistNote}
          multiline
        />
        <TextInput
          style={[
            styles.input,
            styles.inputMulti,
            { color: c.tx1, borderColor: c.bd2, backgroundColor: c.sf },
          ]}
          placeholder="补充备注（易混词、搭配、考点…）"
          placeholderTextColor={c.tx3}
          value={note}
          onChangeText={setNote}
          onEndEditing={persistNote}
          multiline
        />

        <View style={{ flex: 1 }} />
      </ScrollView>

      <View style={[styles.footer, { borderTopColor: c.bd, paddingBottom: bottomPad }]}>
        <TouchableOpacity
          style={[
            styles.masterBtn,
            mastered ? { backgroundColor: c.pg } : { backgroundColor: c.ac },
          ]}
          activeOpacity={0.85}
          onPress={toggleMastered}
        >
          <Text style={[styles.masterText, { color: mastered ? c.tx1 : c.acon }]}>
            {mastered ? '已掌握 · 取消' : '标为已掌握'}
          </Text>
        </TouchableOpacity>
      </View>
    </PageEnter>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  top: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACE.xl, paddingBottom: 12, borderBottomWidth: 1,
  },
  back: { fontSize: FONT.body, width: 56 },
  title: { fontSize: 13, letterSpacing: TRACK.title, textTransform: 'uppercase', fontWeight: WEIGHT.semibold, flex: 1, textAlign: 'center' },
  body: { paddingHorizontal: SPACE.xl, paddingTop: 28, paddingBottom: 24, flexGrow: 1 },
  wordRow: { flexDirection: 'row', alignItems: 'center' },
  word: { fontFamily: serif, fontSize: FONT.detailWord, letterSpacing: TRACK.tight, flexShrink: 1 },
  stroke: { width: 168, height: 3, borderRadius: RADIUS.bar, opacity: 0.8, marginTop: 8 },
  // 发音键：48dp 触控目标 + 描边（P0.3）。以前只有一个裸图标，看不出是个按钮；
  // 描一圈 bd2 之后它才读得出「这里可以点」。朱砂留给图标本身（这是这一页唯一的可点动作）。
  sound: {
    width: 44, height: 44, borderRadius: RADIUS.pill, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center', marginLeft: 14, flexShrink: 0,
  },
  ipa: { fontFamily: mono, fontSize: FONT.ipa, marginTop: 12, letterSpacing: TRACK.body },
  posChip: { alignSelf: 'flex-start', marginTop: 16, paddingHorizontal: 10, paddingVertical: 4, borderRadius: RADIUS.chip },
  posText: { fontSize: 11, letterSpacing: TRACK.body, fontWeight: WEIGHT.semibold, textTransform: 'uppercase' },
  mk: { width: 7, height: 7, borderRadius: RADIUS.mark },
  morphBox: { marginTop: 14, padding: 16, borderRadius: RADIUS.ctrl, borderWidth: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 18 },
  chip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: RADIUS.chip },
  chipText: { fontSize: 12, letterSpacing: TRACK.body },
  exHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 26 },
  secTitle: { fontSize: 13, letterSpacing: TRACK.title, fontWeight: WEIGHT.semibold },
  // 例句是语料不是人的批注 —— 用中性界行（1px bd），不用朱砂。朱砂只标人的痕迹。
  exItem: { marginTop: 12, paddingLeft: 12, borderLeftWidth: 1 },
  exEn: { fontFamily: serif, fontStyle: 'italic', fontSize: FONT.quote, lineHeight: 20 },
  exZh: { fontSize: 13, lineHeight: 19, marginTop: 6 },
  exEmpty: { fontSize: 13, marginTop: 14 },
  savedTag: { fontSize: 12, letterSpacing: TRACK.body },
  input: {
    marginTop: 12, minHeight: 44, borderRadius: RADIUS.ctrl, borderWidth: 1,
    paddingHorizontal: 14, paddingVertical: 11, fontSize: 14.5, lineHeight: 21,
  },
  inputMulti: { minHeight: 72, textAlignVertical: 'top' },
  footer: { paddingHorizontal: SPACE.xl, paddingBottom: SPACE.xl, paddingTop: SPACE.md, borderTopWidth: 1 },
  masterBtn: { minHeight: CONTROL.lg, borderRadius: RADIUS.ctrl, alignItems: 'center', justifyContent: 'center' },
  masterText: { fontSize: FONT.body, letterSpacing: TRACK.body, fontWeight: WEIGHT.semibold },
});
