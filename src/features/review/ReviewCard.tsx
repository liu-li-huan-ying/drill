import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, Animated, StyleSheet, type ViewStyle } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { serif, FONT, mono } from '../../theme/tokens';
import { speak } from '../../lib/speak';
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

      {/* 背面（纯展示，不含 touchable） */}
      <Animated.View
        style={[
          styles.face,
          styles.back,
          { transform: [{ rotateY: backRotate }], backfaceVisibility: 'hidden' },
        ]}
      >
        <View style={styles.body}>
          {item.pos ? <Text style={[styles.pos, { color: c.ac }]}>{item.pos}</Text> : null}
          <Text style={[styles.def, { color: c.tx1 }]}>{item.definition_zh}</Text>
          {item.definition_en ? (
            <Text style={[styles.defEn, { color: c.tx2 }]}>{item.definition_en}</Text>
          ) : null}
          {item.root_affix ? (
            <View style={styles.rootRow}>
              <View style={[styles.mk, { backgroundColor: c.ac }]} />
              <Text style={[styles.root, { color: c.tx2 }]}>{item.root_affix}</Text>
            </View>
          ) : null}
        </View>
      </Animated.View>

      {/* 翻转触发层：覆盖整卡，统一接手势，避免背面（层级在上）吞掉点击 */}
      <TouchableOpacity style={styles.tap} activeOpacity={1} onPress={onFlip} />

      {/* 发音按钮：浮在翻转层之上，单独接手势（RN 命中测试取最上层，不会误触翻转） */}
      <TouchableOpacity
        style={styles.sound}
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
