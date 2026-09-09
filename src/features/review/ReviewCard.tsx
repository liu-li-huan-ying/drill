import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, Animated, ScrollView, StyleSheet, type ViewStyle } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { serif, FONT, mono } from '../../theme/tokens';
import { speak } from '../../lib/speak';
import { DefinitionView } from '../../components/Definition';
import type { QueueItem } from '../../db/queries';

// 3D 翻转卡：正面单词 + 音标；背面释义 + 词根。翻转用 rotateY + backfaceVisibility 实现。
//
// 关键坑（Android 真机）：两个面都是 absolute 叠放，背面写在 DOM 后面 → 在视图层级上盖在正面之上。
// 即便 backfaceVisibility:'hidden' 让它「看不见」，它在命中测试层仍然挡在最上面，会吞掉所有点击，
// 导致正面的 TouchableOpacity 永远收不到 tap，卡片「怎么点都不翻」。
// 修法：面上不再放任何 touchable；改为最上层铺一个透明翻转层统一接手势，发音按钮再浮到翻转层之上。
export function ReviewCard({
  item,
  flipped,
  onFlip,
}: {
  item: QueueItem;
  flipped: boolean;
  onFlip: () => void;
}) {
  const { colors: c } = useTheme();
  const spin = useRef(new Animated.Value(0)).current;
  // 背面长释义滚动：记录按下的位置/时间，抬手时判断是否「轻点」（非滚动）以翻转回正面。
  const tapStart = useRef<{ x: number; y: number; t: number } | null>(null);

  useEffect(() => {
    // 注意：rotateY（3D 翻转）在 Android 上不被原生动画驱动支持，
    // 必须用 JS 驱动（useNativeDriver: false），否则卡片在安卓上根本不翻转。
    Animated.timing(spin, {
      toValue: flipped ? 1 : 0,
      duration: 450,
      useNativeDriver: false,
    }).start();
  }, [flipped, spin]);

  const frontRotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] });
  const backRotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['180deg', '360deg'] });

  const phonetic = item.phonetic_uk || item.phonetic_us || '';

  return (
    <View style={styles.wrap}>
      {/* 正面（纯展示，不含 touchable） */}
      <Animated.View
        style={[styles.face, { transform: [{ rotateY: frontRotate }], backfaceVisibility: 'hidden' }]}
      >
        <View style={styles.body}>
          <Text style={[styles.ul, { color: c.tx3 }]}>
            {item.isNew ? '首 次 接 触' : '复 习'}
          </Text>
          <Text style={[styles.word, { color: c.tx1 }]}>{item.word}</Text>
          {phonetic ? <Text style={[styles.ipa, { color: c.tx3 }]}>{phonetic}</Text> : null}
        </View>
        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: c.tx2 }]}>显 示 释 义</Text>
        </View>
      </Animated.View>

      {/* 翻转触发层：覆盖整卡，统一接手势（正面翻转触发）。
          必须渲染在背面之前——翻面后背面（JSX 顺序在后 = 层级更高）才能盖住它、接管滚动。 */}
      <TouchableOpacity style={styles.tap} activeOpacity={1} onPress={onFlip} />

      {/* 背面：长释义可滚动。渲染在翻转层之后（层级更高），pointerEvents 随翻转切换——
          未翻面时设为 none，点按穿透到下方翻转层触发翻面；
          翻面后设为 auto，由本 ScrollView 接管滚动，轻点（非滚动）翻转回正面。 */}
      <Animated.View
        style={[
          styles.face,
          styles.back,
          { transform: [{ rotateY: backRotate }], backfaceVisibility: 'hidden' },
        ]}
        pointerEvents={flipped ? 'auto' : 'none'}
      >
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
          {item.pos ? <Text style={[styles.pos, { color: c.ac }]}>{item.pos}</Text> : null}
          <DefinitionView
            raw={item.definition_zh}
            accent={c.ac}
            center
            style={{ color: c.tx1, fontSize: FONT.def, lineHeight: 24 }}
          />
          <DefinitionView
            raw={item.definition_en}
            accent={c.ac}
            center
            blockStyle={{ marginTop: 8 }}
            style={{ color: c.tx2, fontSize: 13, fontStyle: 'italic', lineHeight: 19 }}
          />
          {item.root_affix ? (
            <View style={styles.rootRow}>
              <View style={[styles.mk, { backgroundColor: c.ac }]} />
              <Text style={[styles.root, { color: c.tx2 }]}>{item.root_affix}</Text>
            </View>
          ) : null}
        </ScrollView>
      </Animated.View>

      {/* 发音按钮：浮在翻转层之上，停靠右上角，正反面都可重听；不挡居中释义。 */}
      <TouchableOpacity
        style={[styles.sound, { backgroundColor: c.acsf }]}
        activeOpacity={0.6}
        onPress={() => speak(item.word)}
      >
        <SoundIcon color={c.tx1} />
      </TouchableOpacity>
    </View>
  );
}

function SoundIcon({ color }: { color: string }) {
  return (
    <View style={{ width: 19, height: 19 }}>
      <View
        style={{
          width: 19,
          height: 19,
          borderRadius: 9.5,
          borderWidth: 1.5,
          borderColor: color,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // perspective 放在容器上，让 iOS 的 3D 翻转有正确的纵深感（rotateY 在 JS 驱动下生效）。
  // 该 prop 在 RN 运行时支持，但当前 @types 未收录，故在 wrap 上做局部断言。
  wrap: { flex: 1, position: 'relative', perspective: 1000 } as ViewStyle,
  face: {
    position: 'absolute',
    inset: 0,
    backgroundColor: 'transparent',
  },
  back: {},
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  // 背面滚动容器：内容短则整体居中（flexGrow + justifyContent center），
  // 内容长则超出高度可纵向滚动（ScrollView 接管）。
  backScroll: { flex: 1, width: '100%' },
  backContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    // 顶部预留发音按钮空间（top:14 + 高 42 ≈ 56），避免长释义滚动时文字被角标压住。
    paddingTop: 60,
    paddingBottom: 28,
  },
  // 透明翻转层：盖住整张卡，承接所有点击。
  tap: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  ul: { fontSize: 10.5, letterSpacing: 2, textTransform: 'uppercase', fontWeight: '500' },
  word: { fontFamily: serif, fontSize: FONT.word, marginTop: 18, letterSpacing: -0.8 },
  ipa: { fontFamily: mono, fontSize: FONT.ipa, marginTop: 12, letterSpacing: 0.8 },
  // 发音按钮浮在翻转层之上（写在 tap 之后 = 层级更高）。
  sound: {
    position: 'absolute',
    bottom: 86,
    alignSelf: 'center',
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: {
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    borderTopWidth: 1,
  },
  footerText: { fontSize: 14, letterSpacing: 1 },
  pos: { fontSize: 11, letterSpacing: 1, fontWeight: '600', textTransform: 'uppercase', marginBottom: 8 },
  def: { fontSize: FONT.def, textAlign: 'center', lineHeight: 24 },
  defEn: { fontSize: 13, textAlign: 'center', marginTop: 8, lineHeight: 19 },
  rootRow: { flexDirection: 'row', alignItems: 'center', marginTop: 18, gap: 8 },
  mk: { width: 7, height: 7, borderRadius: 1 },
  root: { fontSize: 13, lineHeight: 20 },
});
