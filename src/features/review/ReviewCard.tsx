import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, Animated, StyleSheet } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { serif, FONT, mono } from '../../theme/tokens';
import { speak } from '../../lib/speak';
import type { QueueItem } from '../../db/queries';

// 3D 翻转卡：正面单词 + 音标 + 发音；背面释义 + 词根。
// 翻转用 rotateY + backfaceVisibility 实现。
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
    Animated.timing(spin, {
      toValue: flipped ? 1 : 0,
      duration: 450,
      useNativeDriver: true,
    }).start();
  }, [flipped, spin]);

  const frontRotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] });
  const backRotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['180deg', '360deg'] });

  const phonetic = item.phonetic_uk || item.phonetic_us || '';

  return (
    <View style={styles.wrap}>
      <Animated.View
        style={[styles.face, { transform: [{ rotateY: frontRotate }], backfaceVisibility: 'hidden' }]}
      >
        <TouchableOpacity style={styles.faceInner} activeOpacity={0.92} onPress={onFlip}>
          <View style={styles.body}>
            <Text style={[styles.ul, { color: c.tx3 }]}>
              {item.isNew ? '首 次 接 触' : '复 习'}
            </Text>
            <Text style={[styles.word, { color: c.tx1 }]}>{item.word}</Text>
            {phonetic ? (
              <Text style={[styles.ipa, { color: c.tx3 }]}>{phonetic}</Text>
            ) : null}
            <TouchableOpacity
              style={styles.sound}
              activeOpacity={0.6}
              onPress={(e) => {
                e.stopPropagation();
                speak(item.word);
              }}
            >
              <SoundIcon color={c.tx1} />
            </TouchableOpacity>
          </View>
          <View style={styles.footer}>
            <Text style={[styles.footerText, { color: c.tx2 }]}>显 示 释 义</Text>
          </View>
        </TouchableOpacity>
      </Animated.View>

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
  wrap: { flex: 1, position: 'relative' },
  face: {
    position: 'absolute',
    inset: 0,
    backgroundColor: 'transparent',
  },
  faceInner: { flex: 1 },
  back: {},
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  ul: { fontSize: 10.5, letterSpacing: 2, textTransform: 'uppercase', fontWeight: '500' },
  word: { fontFamily: serif, fontSize: FONT.word, marginTop: 18, letterSpacing: -0.8 },
  ipa: { fontFamily: mono, fontSize: FONT.ipa, marginTop: 12, letterSpacing: 0.8 },
  sound: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 26,
  },
  footer: {
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    borderTopWidth: 1,
    borderColor: 'rgba(128,128,128,0.18)',
  },
  footerText: { fontSize: 14, letterSpacing: 1 },
  pos: { fontSize: 11, letterSpacing: 1, fontWeight: '600', textTransform: 'uppercase', marginBottom: 8 },
  def: { fontSize: FONT.def, textAlign: 'center', lineHeight: 24 },
  defEn: { fontSize: 13, textAlign: 'center', marginTop: 8, lineHeight: 19 },
  rootRow: { flexDirection: 'row', alignItems: 'center', marginTop: 18, gap: 8 },
  mk: { width: 7, height: 7, borderRadius: 1 },
  root: { fontSize: 13, lineHeight: 20 },
});
