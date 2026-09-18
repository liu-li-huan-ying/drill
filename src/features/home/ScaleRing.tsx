// 刻度环：20 段弧刻度，一格 = 一个当日新词配额；已完成段填朱砂。
//
// 纯 View 实现（项目无 SVG 依赖）。做法：每段是一根「贴切线」的横条 —— 段弧只有十几个 dp，
// 直线弦与圆弧的矢高差 < 1dp（20 段时约 0.7dp），肉眼不可辨，所以用直条逼近弧段。
// 段数少时（配额小）单根直条跨弧过大会露出「多边形感」，故每段再按 ≤9° 切分，
// 并让子条之间重叠 0.6dp 消除接缝。
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { serif, WEIGHT, FONT, RADIUS } from '../../theme/tokens';

export function ScaleRing({
  total,
  done,
  size = 196,
  centerValue,
  centerLabel,
}: {
  total: number;
  done: number;
  size?: number;
  centerValue: React.ReactNode;
  centerLabel: string;
}) {
  const { colors: c } = useTheme();

  const n = Math.max(1, Math.min(40, total)); // 段数 = 当日配额
  const seg = 360 / n;
  const gap = seg * 0.16; // 段间留隙（原型 20 段时约 2.8°）
  const visible = seg - gap;
  const per = Math.max(1, Math.ceil(visible / 9)); // 单根横条跨弧 ≤ 9°
  const sub = visible / per;

  const stroke = 9;
  const r = size * 0.388; // 196 → 76，与原型一致
  const mid = size / 2;
  const barLen = (r * (sub * Math.PI)) / 180 + 0.6;

  const bars: { angle: number; filled: boolean }[] = [];
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < per; j++) {
      bars.push({
        angle: i * seg + gap / 2 + sub * (j + 0.5),
        filled: i < done,
      });
    }
  }

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      {bars.map((b, k) => (
        <View key={k} style={[StyleSheet.absoluteFill, { transform: [{ rotate: `${b.angle}deg` }] }]}>
          <View
            style={{
              position: 'absolute',
              top: mid - r - stroke / 2,
              left: mid - barLen / 2,
              width: barLen,
              height: stroke,
              borderRadius: RADIUS.bar,
              backgroundColor: b.filled ? c.ac : c.bd,
            }}
          />
        </View>
      ))}

      <View style={{ alignItems: 'center' }}>
        <Text style={[styles.num, { color: c.tx1, fontFamily: serif }]}>{centerValue}</Text>
        <Text style={[styles.cap, { color: c.tx3 }]}>{centerLabel}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  num: {
    fontSize: FONT.ring,
    lineHeight: FONT.ring,
    letterSpacing: -1.2,
    marginBottom: 12,
    fontWeight: WEIGHT.semibold,
    fontVariant: ['tabular-nums'],
  },
  cap: { fontSize: 10, letterSpacing: 2.6, fontWeight: WEIGHT.semibold },
});
