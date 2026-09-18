import React, { useEffect, useMemo, useRef } from 'react';
import { View, Text, TouchableOpacity, Animated, ScrollView, StyleSheet, type ViewStyle } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { serif, mono, FONT, MOTION, RADIUS, SPACE, WEIGHT, TRACK } from '../../theme/tokens';
import { ease, useReducedMotion } from '../../lib/motion';
import { speak } from '../../lib/speak';
import { DefinitionView } from '../../components/Definition';
import { SealMark, SoundIcon } from '../../components/ui';
import { RatingBar } from './RatingBar';
import { getExamples, type QueueItem } from '../../db/queries';
import type { IntervalPreview } from '../../srs/fsrs';

// 3D 翻转卡：正面单词 + 音标；背面释义 + 例句 + 词根 + 评分条。翻转用 rotateY + backfaceVisibility。
//
// 关键坑（Android 真机）：两个面都是 absolute 叠放，背面写在 DOM 后面 → 在视图层级上盖在正面之上。
// 即便 backfaceVisibility:'hidden' 让它「看不见」，它在命中测试层仍然挡在最上面，会吞掉所有点击，
// 导致正面的 TouchableOpacity 永远收不到 tap，卡片「怎么点都不翻」。
// 修法：面上不再放任何全屏 touchable；改为最上层铺一个透明翻转层统一接手势。
//
// 评分条是背面的「固定页脚」而不是滚动内容的一部分 —— 释义长时若跟着滚走，
// 用户就得先滚到底才能评分，评分是这一步唯一动作，必须永远在手边。
export function ReviewCard({
  item,
  flipped,
  onFlip,
  intervals,
  onRate,
}: {
  item: QueueItem;
  flipped: boolean;
  onFlip: () => void;
  intervals: IntervalPreview[];
  onRate: (rating: number) => void;
}) {
  const { colors: c } = useTheme();
  const reduce = useReducedMotion();
  const spin = useRef(new Animated.Value(0)).current;
  // 背面长释义滚动：记录按下的位置/时间，抬手时判断是否「轻点」（非滚动）以翻转回正面。
  const tapStart = useRef<{ x: number; y: number; t: number } | null>(null);

  useEffect(() => {
    // 「减弱动效」时不做翻转动画：3D 翻转是最容易引起前庭不适的动作，直接切到目标面。
    if (reduce) {
      spin.setValue(flipped ? 1 : 0);
      return;
    }
    // 注意：rotateY（3D 翻转）在 Android 上不被原生动画驱动支持，
    // 必须用 JS 驱动（useNativeDriver: false），否则卡片在安卓上根本不翻转。
    const anim = Animated.timing(spin, {
      toValue: flipped ? 1 : 0,
      duration: MOTION.flip,
      easing: ease(), // 纸的物理性：慢而稳，无回弹
      useNativeDriver: false,
    });
    anim.start();
    return () => anim.stop();
  }, [flipped, spin, reduce]);

  const frontRotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] });
  const backRotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['180deg', '360deg'] });

  const phonetic = item.phonetic_uk || item.phonetic_us || '';
  // 例句只取一句：这一屏的使命是「快速判断记住了没有」，不是精读。
  const example = useMemo(() => getExamples(item.word_id, 1)[0] ?? null, [item.word_id]);

  // 白文朱印：只标「这张卡为什么现在出现」——首次接触 / 曾经失手。没有第三种含义就不盖章。
  const seal = item.isNew ? '新词' : item.state === 'relearning' ? '易忘' : '';

  // 卡面抬升只靠「面比底亮一档 + 1px 描边」——不投影（原因见 tokens.ts 里 SHADOW 的删除说明）。
  const faceStyle = [styles.face, { backgroundColor: c.sf, borderColor: c.bd }];

  return (
    <View style={styles.wrap}>
      {/* 正面（纯展示，不含 touchable） */}
      <Animated.View
        style={[faceStyle, { transform: [{ rotateY: frontRotate }], backfaceVisibility: 'hidden' }]}
      >
        {seal ? <SealMark text={seal} style={styles.seal} /> : null}
        <View style={styles.frontBody}>
          {/* 长词不再任其换 3–4 行把音标和喇叭挤出卡外：最多两行，超出就等比缩字。
              minimumFontScale 0.45 —— 缩到 22sp 仍是全屏最大的字，主角地位不受影响，
              但「卡面装不下自己」这种事从此不会发生（小屏 + 系统大字号的组合最容易踩）。 */}
          <Text numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.45} style={[styles.word, { color: c.tx1 }]}>
            {item.word}
          </Text>
          <View style={[styles.stroke, { backgroundColor: c.ac }]} />
          {phonetic ? <Text style={[styles.ipa, { color: c.tx2 }]}>{phonetic}</Text> : null}
          <TouchableOpacity
            activeOpacity={0.6}
            onPress={() => speak(item.word)}
            style={[styles.sound, { borderColor: c.bd2, backgroundColor: c.bg }]}
            accessibilityLabel="播放发音"
          >
            <SoundIcon color={c.tx2} size={19} />
          </TouchableOpacity>
        </View>
        <Text style={[styles.hint, { color: c.tx3 }]}>轻 触 卡 片 · 查 看 释 义</Text>
      </Animated.View>

      {/* 翻转触发层：覆盖整卡，统一接手势。
          必须渲染在背面之前——翻面后背面（JSX 顺序在后 = 层级更高）才能盖住它、接管滚动。 */}
      <TouchableOpacity style={styles.tap} activeOpacity={1} onPress={onFlip} />

      {/* 背面：释义可滚动，评分条固定为页脚。 */}
      <Animated.View
        style={[faceStyle, { transform: [{ rotateY: backRotate }], backfaceVisibility: 'hidden' }]}
        pointerEvents={flipped ? 'auto' : 'none'}
      >
        <View style={styles.backHead}>
          <Text style={[styles.wordSm, { color: c.tx1 }]}>{item.word}</Text>
          <TouchableOpacity
            activeOpacity={0.6}
            onPress={() => speak(item.word)}
            style={[styles.soundSm, { borderColor: c.bd2 }]}
            accessibilityLabel="播放发音"
          >
            <SoundIcon color={c.tx2} size={14} />
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.backScroll}
          contentContainerStyle={styles.backContent}
          showsVerticalScrollIndicator
          keyboardShouldPersistTaps="handled"
          onTouchStart={(e) => {
            const { pageX, pageY } = e.nativeEvent;
            tapStart.current = { x: pageX, y: pageY, t: Date.now() };
          }}
          onTouchEnd={(e) => {
            const s = tapStart.current;
            if (!s) return;
            const { pageX, pageY } = e.nativeEvent;
            const dx = Math.abs(pageX - s.x);
            const dy = Math.abs(pageY - s.y);
            const dt = Date.now() - s.t;
            if (dx < 10 && dy < 10 && dt < 300) onFlip();
          }}
        >
          <Text style={[styles.secK, { color: c.tx3 }]}>释 义</Text>
          <DefinitionView
            raw={item.definition_zh}
            accent={c.ac}
            numbered
            style={{ color: c.tx1, fontSize: FONT.def, lineHeight: 26 }}
          />
          {/* 英文释义去斜体（P1.3）：斜体是「例句原文」的专用记号，释义不占这个记号。 */}
          <DefinitionView
            raw={item.definition_en}
            accent={c.ac}
            numbered
            blockStyle={{ marginTop: 8 }}
            style={{ color: c.tx2, fontSize: 13, lineHeight: 20 }}
          />

          {example ? (
            <>
              <Hair color={c.bd} />
              <Text style={[styles.secK, { color: c.tx3 }]}>例 句</Text>
              {/* 例句原文是**唯一**用斜体的地方 —— 语料与释义的区别就靠它。 */}
              <Text style={[styles.quote, { color: c.tx2 }]}>{example.sentence_en}</Text>
              {example.sentence_zh ? (
                <Text style={[styles.quoteZh, { color: c.tx3 }]}>{example.sentence_zh}</Text>
              ) : null}
            </>
          ) : null}

          {item.root_affix ? (
            <>
              <Hair color={c.bd} />
              <Text style={[styles.secK, { color: c.tx3 }]}>词 根 词 缀</Text>
              <View style={styles.chipRow}>
                {item.root_affix.split(/[;；]/).map((t, i) => (
                  <View key={i} style={[styles.chip, { backgroundColor: c.acsf }]}>
                    <Text style={[styles.chipText, { color: c.ac }]}>{t.trim()}</Text>
                  </View>
                ))}
              </View>
            </>
          ) : null}
        </ScrollView>

        <View style={[styles.footer, { borderTopColor: c.bd }]}>
          <RatingBar intervals={intervals} onRate={onRate} />
        </View>
      </Animated.View>
    </View>
  );
}

function Hair({ color }: { color: string }) {
  return <View style={{ height: 1, backgroundColor: color, marginVertical: SPACE.lg }} />;
}

// 纸感抬升靠「面比底亮一档 + 描边」，不用投影 —— 卡片是压在纸上的另一张纸，不是浮着的塑料板。
const styles = StyleSheet.create({
  // perspective 放在容器上，让 iOS 的 3D 翻转有正确的纵深感（rotateY 在 JS 驱动下生效）。
  // 该 prop 在 RN 运行时支持，但当前 @types 未收录，故在 wrap 上做局部断言。
  wrap: { flex: 1, position: 'relative', perspective: 1600 } as ViewStyle,
  face: { position: 'absolute', inset: 0, borderRadius: RADIUS.card, borderWidth: 1, overflow: 'hidden' },

  frontBody: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 26 },
  seal: { position: 'absolute', top: 22, right: 22, zIndex: 2 },
  word: { fontFamily: serif, fontSize: FONT.cardWord, letterSpacing: TRACK.tight, textAlign: 'center' },
  // 朱笔横痕：不是色块，是批注的那一「批」。纯 View 近似（两端圆头 + 略收窄），不引 SVG。
  stroke: { width: 168, height: 3, borderRadius: RADIUS.bar, opacity: 0.8, marginTop: 6 },
  ipa: { fontFamily: mono, fontSize: FONT.ipa, letterSpacing: TRACK.body, marginTop: 16 },
  sound: {
    width: 48,
    height: 48,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 26,
  },
  hint: { fontSize: 12, letterSpacing: TRACK.body, textAlign: 'center', paddingBottom: 18, fontWeight: WEIGHT.medium },

  // 透明翻转层：盖住整张卡，承接所有点击。
  tap: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },

  backHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.md,
    paddingHorizontal: 24,
    paddingTop: 18,
    paddingBottom: 14,
  },
  wordSm: { flex: 1, fontFamily: serif, fontSize: FONT.wordSm, letterSpacing: TRACK.tight },
  soundSm: {
    width: 34,
    height: 34,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backScroll: { flex: 1, width: '100%' },
  backContent: { paddingHorizontal: 24, paddingBottom: SPACE.xl },
  secK: { fontSize: 10, letterSpacing: TRACK.label, fontWeight: WEIGHT.semibold, marginBottom: SPACE.md },
  quote: { fontFamily: serif, fontStyle: 'italic', fontSize: FONT.quote, lineHeight: 24 },
  quoteZh: { fontSize: 12.5, letterSpacing: TRACK.body, marginTop: 8, fontWeight: WEIGHT.medium },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { paddingHorizontal: 11, paddingVertical: 5, borderRadius: RADIUS.chip },
  chipText: { fontSize: 10, letterSpacing: TRACK.label, fontWeight: WEIGHT.semibold },

  footer: { borderTopWidth: 1, paddingHorizontal: 12, paddingTop: 12, paddingBottom: 12 },
});
