// 刻度环：一圈刻度，一格 = 一个当日新词配额；已完成的刻度填朱砂。
// 纯 View 实现（无 SVG 依赖）：每个刻度是一个绝对定位的小竖条，绕圆心旋转。
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { serif, FONT } from '../../theme/tokens';

export function ScaleRing({ total, done, size = 220 }: { total: number; done: number; size?: number }) {
  const { colors: c } = useTheme();
  const ticks = Math.max(1, total);
  const r = size / 2;
  const tickLen = 12;
  const tickW = 2.5;

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      {Array.from({ length: ticks }).map((_, i) => {
        const angle = (360 / ticks) * i;
        const filled = i < done;
        return (
          <View key={i} style={[StyleSheet.absoluteFill, { transform: [{ rotate: `${angle}deg` }] }]}>
            <View
              style={{
                position: 'absolute',
                top: 6,
                left: r - tickW / 2,
                width: tickW,
                height: tickLen,
                borderRadius: tickW / 2,
                backgroundColor: filled ? c.ac : c.bd2,
              }}
            />
          </View>
        );
      })}
      <View style={{ alignItems: 'center' }}>
        <Text style={[styles.num, { color: c.tx1, fontFamily: serif }]}>{done}</Text>
        <Text style={[styles.cap, { color: c.tx3 }]}>/ {total} 新词</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  num: { fontSize: FONT.wordSm, letterSpacing: -0.5 },
  cap: { fontSize: 11, marginTop: 2, letterSpacing: 1 },
});
