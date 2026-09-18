// 全局词汇量测试：按词频分层抽 ~36 词，逐词问「认识/不认识」，认识则标已掌握；
// 结束按各频段认识比例外推估算词汇量。
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../src/theme/ThemeProvider';
import { serif, mono, FONT, RADIUS, WEIGHT, SPACE, CONTROL, TRACK } from '../src/theme/tokens';
import { PageEnter, Num, SoundIcon } from '../src/components/ui';
import { getVocabTestSample, markMastered } from '../src/db/queries';
import { speak } from '../src/lib/speak';
import { useSideInset, useTopPad, useBottomPad } from '../src/lib/layout';
import { fmtNum } from '../src/lib/num';

const PER_BAND = 3;
const BANDS = 12;

export default function VocabTestScreen() {
  const { colors: c } = useTheme();
  const side = useSideInset();
  const topPad = useTopPad();
  const bottomPad = useBottomPad();
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
      <PageEnter style={[styles.screen, { backgroundColor: c.bg, paddingHorizontal: side, paddingTop: topPad }]}>
        <View style={styles.doneWrap}>
          <Text style={[styles.doneKicker, { color: c.tx3 }]}>词 汇 量 估 算</Text>
          <Num value={Math.round(estimate)} style={[styles.est, { color: c.ac, fontFamily: serif }]} />
          <View style={styles.doneSubRow}>
            <Text style={[styles.doneSub, { color: c.tx2 }]}>抽样</Text>
            <Num value={items.length} style={[styles.doneSub, { color: c.tx2 }]} />
            <Text style={[styles.doneSub, { color: c.tx2 }]}>个词，认识</Text>
            <Num value={known} style={[styles.doneSub, { color: c.tx2 }]} />
            <Text style={[styles.doneSub, { color: c.tx2 }]}>个</Text>
          </View>
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => router.back()}
            style={[styles.doneBtn, { backgroundColor: c.ac }]}
          >
            <Text style={[styles.doneBtnText, { color: c.acon }]}>完成</Text>
          </TouchableOpacity>
        </View>
      </PageEnter>
    );
  }

  const cur = items[idx];
  return (
    <PageEnter style={[styles.screen, { backgroundColor: c.bg, paddingHorizontal: side, paddingTop: topPad }]}>
      <View style={[styles.top, { borderBottomColor: c.bd }]}>
        <View style={styles.progRow}>
          <Num value={idx + 1} style={[styles.progress, { color: c.tx3 }]} />
          <Text style={[styles.progress, { color: c.tx3 }]}>/</Text>
          <Num value={items.length} style={[styles.progress, { color: c.tx3 }]} />
        </View>
        <TouchableOpacity activeOpacity={0.6} onPress={() => router.back()}>
          <Text style={[styles.end, { color: c.tx2 }]}>退出</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.explain}>
        <Text style={[styles.explainText, { color: c.tx2 }]}>
          从各级词汇里抽样，估一下你大概认识多少词。认得的不再安排学习。
        </Text>
      </View>

      <View style={styles.cardArea}>
        <View style={[styles.card, { backgroundColor: c.sf, borderColor: c.bd }]}>
          <Text style={[styles.ul, { color: c.tx3 }]}>这 个 词 你 认 识 吗</Text>
          <Text style={[styles.word, { color: c.tx1, fontFamily: serif }]}>{cur?.word}</Text>
          {cur?.phonetic_uk || cur?.phonetic_us ? (
            <Text style={[styles.ipa, { color: c.tx2, fontFamily: mono }]}>
              {cur.phonetic_uk || cur.phonetic_us}
            </Text>
          ) : null}
          <TouchableOpacity
            style={styles.sound}
            activeOpacity={0.6}
            onPress={() => cur && speak(cur.word)}
            accessibilityLabel="播放发音"
          >
            <SoundIcon color={c.tx2} size={22} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={[styles.actions, { paddingBottom: bottomPad }]}>
        <TouchableOpacity activeOpacity={0.85} onPress={() => decide(true)} style={[styles.btnKnow, { backgroundColor: c.ac }]}>
          <Text style={[styles.btnKnowText, { color: c.acon }]}>认识</Text>
        </TouchableOpacity>
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => decide(false)}
          style={[styles.btnUnknown, { backgroundColor: c.sf, borderColor: c.bd2 }]}
        >
          <Text style={[styles.btnUnknownText, { color: c.tx1 }]}>不认识</Text>
        </TouchableOpacity>
      </View>
    </PageEnter>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: SPACE.xl, paddingBottom: 14, borderBottomWidth: 1 },
  progRow: { flexDirection: 'row', alignItems: 'baseline', gap: 3 },
  progress: { fontSize: 12, letterSpacing: TRACK.body, fontWeight: WEIGHT.medium },
  end: { fontSize: 14, letterSpacing: TRACK.body },
  explain: { paddingHorizontal: SPACE.xl, paddingTop: 18 },
  explainText: { fontSize: 13, lineHeight: 19, letterSpacing: TRACK.body },
  cardArea: { flex: 1, paddingHorizontal: SPACE.xl, justifyContent: 'center' },
  card: { borderRadius: RADIUS.card, borderWidth: 1, paddingVertical: 40, alignItems: 'center' },
  ul: { fontSize: FONT.label, letterSpacing: TRACK.label, textTransform: 'uppercase', fontWeight: WEIGHT.semibold },
  word: { fontSize: FONT.test, marginTop: 18, letterSpacing: TRACK.tight },
  ipa: { fontSize: FONT.ipa, marginTop: 12, letterSpacing: TRACK.body },
  sound: { marginTop: 26 },
  actions: { flexDirection: 'row', gap: SPACE.md, paddingHorizontal: SPACE.xl, paddingBottom: SPACE.xxxl },
  btnKnow: { flex: 1, minHeight: CONTROL.lg, borderRadius: RADIUS.ctrl, alignItems: 'center', justifyContent: 'center' },
  btnKnowText: { fontSize: FONT.body, letterSpacing: TRACK.body, fontWeight: WEIGHT.semibold },
  btnUnknown: { flex: 1, minHeight: CONTROL.lg, borderRadius: RADIUS.ctrl, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  btnUnknownText: { fontSize: FONT.body, letterSpacing: TRACK.body, fontWeight: WEIGHT.medium },
  doneWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 },
  doneKicker: { fontSize: 11, letterSpacing: TRACK.caps, textTransform: 'uppercase', fontWeight: WEIGHT.semibold },
  est: { fontSize: 56, marginTop: 10, letterSpacing: TRACK.tight, fontWeight: WEIGHT.semibold },
  doneSubRow: { flexDirection: 'row', alignItems: 'baseline', gap: 3, marginTop: 12, flexWrap: 'wrap', justifyContent: 'center', paddingHorizontal: SPACE.lg },
  doneSub: { fontSize: 13, letterSpacing: TRACK.body },
  doneBtn: { marginTop: 32, minHeight: CONTROL.lg, width: 200, borderRadius: RADIUS.ctrl, alignItems: 'center', justifyContent: 'center' },
  doneBtnText: { fontSize: FONT.body, letterSpacing: TRACK.body, fontWeight: WEIGHT.semibold },
});
