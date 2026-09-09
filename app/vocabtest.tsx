// 全局词汇量测试：按词频分层抽 ~36 词，逐词问「认识/不认识」，认识则标已掌握；
// 结束按各频段认识比例外推估算词汇量。
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../src/theme/ThemeProvider';
import { serif, mono } from '../src/theme/tokens';
import { getVocabTestSample, markMastered } from '../src/db/queries';
import { speak } from '../src/lib/speak';

const PER_BAND = 3;
const BANDS = 12;

export default function VocabTestScreen() {
  const { colors: c } = useTheme();
  const router = useRouter();
  const [data] = useState(() => getVocabTestSample(PER_BAND, BANDS));
  const [idx, setIdx] = useState(0);
  const [done, setDone] = useState(false);
  const [known, setKnown] = useState(0);
  const [knownByBand, setKnownByBand] = useState<number[]>(() => new Array(BANDS).fill(0));

  const items = data.items;
  const advance = () => (idx + 1 >= items.length ? setDone(true) : setIdx(idx + 1));

  const decide = (isKnown: boolean) => {
    const it = items[idx];
    if (isKnown && it) {
      markMastered(it.word_id);
      setKnown((k) => k + 1);
      setKnownByBand((arr) => {
        const next = arr.slice();
        next[it.band] = (next[it.band] ?? 0) + 1;
        return next;
      });
    }
    advance();
  };

  // 估算：各频段 认识比例 × 该频段总词数，求和。
  let estimate = 0;
  for (let b = 0; b < data.bandSizes.length; b++) {
    const sampled = Math.min(PER_BAND, data.bandSizes[b]);
    const p = sampled > 0 ? (knownByBand[b] ?? 0) / sampled : 0;
    estimate += p * data.bandSizes[b];
  }

  if (done) {
    return (
      <View style={[styles.screen, { backgroundColor: c.bg }]}>
        <View style={styles.doneWrap}>
          <Text style={[styles.doneKicker, { color: c.tx3 }]}>词 汇 量 估 算</Text>
          <Text style={[styles.est, { color: c.ac, fontFamily: serif }]}>{Math.round(estimate).toLocaleString()}</Text>
          <Text style={[styles.doneSub, { color: c.tx2 }]}>
            抽样 {items.length} 词中认识 {known} 个，已知词已标为「已掌握」
          </Text>
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => router.back()}
            style={[styles.doneBtn, { backgroundColor: c.ac }]}
          >
            <Text style={[styles.doneBtnText, { color: c.acon }]}>完 成</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const cur = items[idx];
  return (
    <View style={[styles.screen, { backgroundColor: c.bg }]}>
      <View style={[styles.top, { borderBottomColor: c.bd }]}>
        <Text style={[styles.progress, { color: c.tx3 }]}>
          {idx + 1} / {items.length}
        </Text>
        <TouchableOpacity activeOpacity={0.6} onPress={() => router.back()}>
          <Text style={[styles.end, { color: c.tx2 }]}>退出</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.explain}>
        <Text style={[styles.explainText, { color: c.tx2 }]}>
          按词频分层抽样，估计你「大概认识多少词」。认识的会标为已掌握。
        </Text>
      </View>

      <View style={styles.cardArea}>
        <View style={[styles.card, { backgroundColor: c.sf, borderColor: c.bd }]}>
          <Text style={[styles.ul, { color: c.tx3 }]}>这 个 词 你 认 识 吗</Text>
          <Text style={[styles.word, { color: c.tx1, fontFamily: serif }]}>{cur?.word}</Text>
          {cur?.phonetic_uk || cur?.phonetic_us ? (
            <Text style={[styles.ipa, { color: c.tx3, fontFamily: mono }]}>
              {cur.phonetic_uk || cur.phonetic_us}
            </Text>
          ) : null}
          <TouchableOpacity
            style={styles.sound}
            activeOpacity={0.6}
            onPress={() => cur && speak(cur.word)}
          >
            <View style={[styles.soundDot, { borderColor: c.tx1 }]}>
              <View style={[styles.soundInner, { backgroundColor: c.tx1 }]} />
            </View>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity activeOpacity={0.85} onPress={() => decide(true)} style={[styles.btnKnow, { backgroundColor: c.ac }]}>
          <Text style={[styles.btnKnowText, { color: c.acon }]}>认 识</Text>
        </TouchableOpacity>
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => decide(false)}
          style={[styles.btnUnknown, { backgroundColor: c.sf, borderColor: c.bd2 }]}
        >
          <Text style={[styles.btnUnknownText, { color: c.tx1 }]}>不 认 识</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingTop: 52 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 22, paddingBottom: 14, borderBottomWidth: 1 },
  progress: { fontSize: 12, letterSpacing: 2, fontVariant: ['tabular-nums'] },
  end: { fontSize: 14, letterSpacing: 1 },
  explain: { paddingHorizontal: 24, paddingTop: 18 },
  explainText: { fontSize: 13, lineHeight: 19, letterSpacing: 0.5 },
  cardArea: { flex: 1, paddingHorizontal: 20, justifyContent: 'center' },
  card: { borderRadius: 12, borderWidth: 1, paddingVertical: 40, alignItems: 'center' },
  ul: { fontSize: 10.5, letterSpacing: 2, textTransform: 'uppercase', fontWeight: '500' },
  word: { fontSize: 42, marginTop: 18, letterSpacing: -0.8 },
  ipa: { fontSize: 13, marginTop: 12, letterSpacing: 0.8 },
  sound: { marginTop: 26 },
  soundDot: { width: 44, height: 44, borderRadius: 22, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  soundInner: { width: 8, height: 8, borderRadius: 4 },
  actions: { flexDirection: 'row', gap: 12, paddingHorizontal: 20, paddingBottom: 34 },
  btnKnow: { flex: 1, height: 52, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  btnKnowText: { fontSize: 15, letterSpacing: 3, fontWeight: '600' },
  btnUnknown: { flex: 1, height: 52, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  btnUnknownText: { fontSize: 15, letterSpacing: 3 },
  doneWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 },
  doneKicker: { fontSize: 11, letterSpacing: 3, textTransform: 'uppercase', fontWeight: '600' },
  est: { fontSize: 56, marginTop: 10, letterSpacing: -1 },
  doneSub: { fontSize: 13, marginTop: 12, lineHeight: 19, textAlign: 'center', letterSpacing: 0.5 },
  doneBtn: { marginTop: 32, height: 50, width: 200, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  doneBtnText: { fontSize: 15, letterSpacing: 3, fontWeight: '600' },
});
