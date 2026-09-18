// 熟词校准：冷启动快速筛除已掌握的词。20 个样本，认识→标为已掌握，不认识/跳过→保留学习。
// 两个落点：首次「开始学习」前置，以及设置页常驻入口。
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../src/theme/ThemeProvider';
import { serif, mono, FONT, RADIUS, WEIGHT, SPACE, CONTROL, TRACK } from '../src/theme/tokens';
import { PageEnter, Num, SoundIcon } from '../src/components/ui';
import { getCalibrationSample, markMastered, type QueueItem } from '../src/db/queries';
import { speak } from '../src/lib/speak';
import { useSideInset, useTopPad, useBottomPad } from '../src/lib/layout';

export default function CalibrationScreen() {
  const { colors: c } = useTheme();
  const side = useSideInset();
  const topPad = useTopPad();
  const bottomPad = useBottomPad();
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
      <PageEnter style={[styles.screen, { backgroundColor: c.bg, paddingHorizontal: side, paddingTop: topPad }]}>
        <View style={styles.doneWrap}>
          <Text style={[styles.doneTitle, { color: c.tx1, fontFamily: serif }]}>校准完成</Text>
          <View style={styles.doneSubRow}>
            <Text style={[styles.doneSub, { color: c.tx2 }]}>标记了</Text>
            <Num value={known} style={[styles.doneSub, { color: c.tx2 }]} />
            <Text style={[styles.doneSub, { color: c.tx2 }]}>/</Text>
            <Num value={sample.length} style={[styles.doneSub, { color: c.tx2 }]} />
            <Text style={[styles.doneSub, { color: c.tx2 }]}>个词为已掌握</Text>
          </View>
          <TouchableOpacity activeOpacity={0.85} onPress={() => router.back()} style={[styles.doneBtn, { backgroundColor: c.ac }]}>
            <Text style={[styles.doneBtnText, { color: c.acon }]}>返回</Text>
          </TouchableOpacity>
        </View>
      </PageEnter>
    );
  }

  const current = sample[idx];
  return (
    <PageEnter style={[styles.screen, { backgroundColor: c.bg, paddingHorizontal: side, paddingTop: topPad }]}>
      <View style={[styles.top, { borderBottomColor: c.bd }]}>
        <View style={styles.progRow}>
          <Num value={idx + 1} style={[styles.progress, { color: c.tx3 }]} />
          <Text style={[styles.progress, { color: c.tx3 }]}>/</Text>
          <Num value={sample.length} style={[styles.progress, { color: c.tx3 }]} />
        </View>
        <TouchableOpacity activeOpacity={0.6} onPress={() => router.back()}>
          <Text style={[styles.end, { color: c.tx2 }]}>退出</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.explain}>
        <Text style={[styles.explainText, { color: c.tx2 }]}>认得的就跳过，别再占你的复习时间。</Text>
      </View>

      <View style={styles.cardArea}>
        <View style={[styles.card, { backgroundColor: c.sf, borderColor: c.bd }]}>
          <Text style={[styles.ul, { color: c.tx3 }]}>这 个 词 你 认 识 吗</Text>
          <Text style={[styles.word, { color: c.tx1, fontFamily: serif }]}>{current?.word}</Text>
          {current?.phonetic_uk || current?.phonetic_us ? (
            <Text style={[styles.ipa, { color: c.tx2, fontFamily: mono }]}>
              {current.phonetic_uk || current.phonetic_us}
            </Text>
          ) : null}
          <TouchableOpacity
            style={styles.sound}
            activeOpacity={0.6}
            onPress={() => current && speak(current.word)}
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

      <TouchableOpacity activeOpacity={0.6} onPress={advance} style={styles.skip}>
        <Text style={[styles.skipText, { color: c.tx3 }]}>跳过这个词</Text>
      </TouchableOpacity>
    </PageEnter>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: SPACE.xl, paddingBottom: 14, borderBottomWidth: 1 },
  progRow: { flexDirection: 'row', alignItems: 'baseline', gap: 3 },
  progress: { fontSize: 12, letterSpacing: TRACK.body, fontWeight: WEIGHT.medium },
  end: { fontSize: 14, letterSpacing: TRACK.body },
  explain: { paddingHorizontal: SPACE.xl, paddingTop: SPACE.lg },
  explainText: { fontSize: 13, lineHeight: 19, letterSpacing: TRACK.body },
  cardArea: { flex: 1, paddingHorizontal: SPACE.xl, justifyContent: 'center' },
  card: { borderRadius: RADIUS.card, borderWidth: 1, paddingVertical: SPACE.huge, alignItems: 'center' },
  ul: { fontSize: FONT.label, letterSpacing: TRACK.label, textTransform: 'uppercase', fontWeight: WEIGHT.semibold },
  word: { fontSize: FONT.test, marginTop: 18, letterSpacing: TRACK.tight },
  ipa: { fontSize: FONT.ipa, marginTop: 12, letterSpacing: TRACK.body },
  sound: { marginTop: 26 },
  actions: { flexDirection: 'row', gap: SPACE.md, paddingHorizontal: SPACE.xl, paddingBottom: SPACE.md },
  btnKnow: { flex: 1, minHeight: CONTROL.lg, borderRadius: RADIUS.ctrl, alignItems: 'center', justifyContent: 'center' },
  btnKnowText: { fontSize: FONT.body, letterSpacing: TRACK.body, fontWeight: WEIGHT.semibold },
  btnUnknown: { flex: 1, minHeight: CONTROL.lg, borderRadius: RADIUS.ctrl, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  btnUnknownText: { fontSize: FONT.body, letterSpacing: TRACK.body, fontWeight: WEIGHT.medium },
  skip: { alignItems: 'center', paddingBottom: 34 },
  skipText: { fontSize: 12, letterSpacing: TRACK.body },
  doneWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 },
  doneTitle: { fontSize: 32, letterSpacing: TRACK.title },
  doneSubRow: { flexDirection: 'row', alignItems: 'baseline', gap: 3, marginTop: 12, flexWrap: 'wrap', justifyContent: 'center' },
  doneSub: { fontSize: 14, letterSpacing: TRACK.body },
  doneBtn: { marginTop: 32, minHeight: CONTROL.lg, width: 200, borderRadius: RADIUS.ctrl, alignItems: 'center', justifyContent: 'center' },
  doneBtnText: { fontSize: FONT.body, letterSpacing: TRACK.body, fontWeight: WEIGHT.semibold },
});
