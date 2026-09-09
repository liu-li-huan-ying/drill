// 熟词校准：冷启动快速筛除已掌握的词。20 个样本，认识→标为已掌握，不认识/跳过→保留学习。
// 两个落点：首次「开始学习」前置，以及设置页常驻入口。
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../src/theme/ThemeProvider';
import { serif, mono, type Tokens } from '../src/theme/tokens';
import { getCalibrationSample, markMastered, type QueueItem } from '../src/db/queries';
import { speak } from '../src/lib/speak';

export default function CalibrationScreen() {
  const { colors: c } = useTheme();
  const router = useRouter();
  const [sample] = useState<QueueItem[]>(() => getCalibrationSample(20));
  const [idx, setIdx] = useState(0);
  const [done, setDone] = useState(false);
  const [known, setKnown] = useState(0);

  const advance = () => {
    const next = idx + 1;
    if (next >= sample.length) setDone(true);
    else setIdx(next);
  };
  const decide = (isKnown: boolean) => {
    if (isKnown && sample[idx]) {
      markMastered(sample[idx].word_id);
      setKnown((k) => k + 1);
    }
    advance();
  };

  if (done) {
    return (
      <View style={[styles.screen, { backgroundColor: c.bg }]}>
        <View style={styles.doneWrap}>
          <Text style={[styles.doneTitle, { color: c.tx1, fontFamily: serif }]}>校准完成</Text>
          <Text style={[styles.doneSub, { color: c.tx2 }]}>
            已标记 {known} / {sample.length} 个词为已掌握
          </Text>
          <TouchableOpacity activeOpacity={0.85} onPress={() => router.back()} style={[styles.doneBtn, { backgroundColor: c.ac }]}>
            <Text style={[styles.doneBtnText, { color: c.acon }]}>返 回</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const current = sample[idx];
  return (
    <View style={[styles.screen, { backgroundColor: c.bg }]}>
      <View style={[styles.top, { borderBottomColor: c.bd }]}>
        <Text style={[styles.progress, { color: c.tx3 }]}>
          {idx + 1} / {sample.length}
        </Text>
        <TouchableOpacity activeOpacity={0.6} onPress={() => router.back()}>
          <Text style={[styles.end, { color: c.tx2 }]}>退出</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.explain}>
        <Text style={[styles.explainText, { color: c.tx2 }]}>快速筛掉已掌握的词，避免占用复习配额。</Text>
      </View>

      <View style={styles.cardArea}>
        <View style={[styles.card, { backgroundColor: c.sf, borderColor: c.bd }]}>
          <Text style={[styles.ul, { color: c.tx3 }]}>这 个 词 你 认 识 吗</Text>
          <Text style={[styles.word, { color: c.tx1, fontFamily: serif }]}>{current?.word}</Text>
          {current?.phonetic_uk || current?.phonetic_us ? (
            <Text style={[styles.ipa, { color: c.tx3, fontFamily: mono }]}>
              {current.phonetic_uk || current.phonetic_us}
            </Text>
          ) : null}
          <TouchableOpacity
            style={styles.sound}
            activeOpacity={0.6}
            onPress={() => current && speak(current.word)}
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

      <TouchableOpacity activeOpacity={0.6} onPress={advance} style={styles.skip}>
        <Text style={[styles.skipText, { color: c.tx3 }]}>跳过这个词</Text>
      </TouchableOpacity>
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
  actions: { flexDirection: 'row', gap: 12, paddingHorizontal: 20, paddingBottom: 12 },
  btnKnow: { flex: 1, height: 52, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  btnKnowText: { fontSize: 15, letterSpacing: 3, fontWeight: '600' },
  btnUnknown: { flex: 1, height: 52, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  btnUnknownText: { fontSize: 15, letterSpacing: 3 },
  skip: { alignItems: 'center', paddingBottom: 34 },
  skipText: { fontSize: 12, letterSpacing: 1 },
  doneWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 },
  doneTitle: { fontSize: 32, letterSpacing: -0.5 },
  doneSub: { fontSize: 14, marginTop: 12, letterSpacing: 1 },
  doneBtn: { marginTop: 32, height: 50, width: 200, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  doneBtnText: { fontSize: 15, letterSpacing: 3, fontWeight: '600' },
});
