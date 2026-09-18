// 根布局：先初始化数据库（首启拷贝资产库 + 补齐 cards），就绪后再挂载路由。
// 这样任一页面在挂载时都能安全读取已初始化的数据库。
import React, { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { View, Text, StyleSheet } from 'react-native';
import { ThemeProvider, useTheme } from '../src/theme/ThemeProvider';
import { RADIUS, SPACE, WEIGHT, TRACK, serif } from '../src/theme/tokens';
import { initDatabase } from '../src/db/Database';
import { ensureCards } from '../src/db/queries';
import { MOTION } from '../src/theme/tokens';
import { useReducedMotion } from '../src/lib/motion';

// 启动屏 = **全应用第一枚印章**（P2.3）。首启要拷贝资产词库，这一屏会停留一会儿，
// 与其放一个转圈，不如让品牌在这里先盖一次：朱底纸字的方章 + 竖排「背呗」，
// 就是四字篆印的形制。它是整个产品唯一一次「先看印章、再看界面」的机会。
const BOOT_SEAL = 64;
const BOOT_CHARS = ['背', '呗'];

function BootScreen() {
  const { colors: c } = useTheme();
  return (
    <View style={[styles.boot, { backgroundColor: c.bg }]}>
      <View style={[styles.bootSeal, { backgroundColor: c.ac }]}>
        {/* 印边：白文印里被磨掉的那一圈，缺了它就是一块红方块，不是章。 */}
        <View style={[styles.bootSealFrame, { borderColor: c.bg }]} />
        {BOOT_CHARS.map((ch) => (
          <Text key={ch} style={[styles.bootChar, { color: c.bg }]}>
            {ch}
          </Text>
        ))}
      </View>
      <Text style={[styles.bootName, { color: c.tx1 }]}>背呗</Text>
      <Text style={[styles.bootHint, { color: c.tx3 }]}>正在打开词库…</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  boot: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  bootSeal: {
    width: BOOT_SEAL,
    height: BOOT_SEAL,
    borderRadius: RADIUS.chip,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACE.xxl,
  },
  bootSealFrame: { position: 'absolute', top: 4, left: 4, right: 4, bottom: 4, borderWidth: 1, borderRadius: RADIUS.xs },
  bootChar: { fontFamily: serif, fontSize: 22, lineHeight: 25, fontWeight: WEIGHT.semibold },
  bootName: { fontFamily: serif, fontSize: 20, letterSpacing: TRACK.label, fontWeight: WEIGHT.semibold },
  bootHint: { fontSize: 12, letterSpacing: TRACK.body, marginTop: SPACE.sm },
});

// 转场：显式指定「从右侧推入」并让 pop 自动反向（原生栈的 pop 就是 push 的逆放）。
// 原来只写了 headerShown:false，动画走的是各平台默认值 —— Android 上默认是淡入，
// 于是「首页→学习→详情」这种层层深入的路径，方向感完全丢失，看起来像页面在互相替换。
// ios_from_right：Android 上给出 iOS 风格的右入、iOS 上即平台默认，两端一致。
function RootStack() {
  const { colors: c } = useTheme();
  const reduce = useReducedMotion();
  return (
    // **容器层纸底**（与 `(tabs)/_layout.tsx` 同一层，stack 这一侧此前一直缺）：
    // `contentStyle` 钉的是「屏幕内容」的底色，而 `ScreenStack` 容器自己没有底色 ——
    // Android 原生栈会把上一屏的视图**摘掉**，返回时要重新挂上，那几帧里屏幕内容还不存在，
    // 透出来的就是原生根视图（默认白）。这一层纸底才是「任何一帧都不露白」的兜底。
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Stack
        screenOptions={{
          headerShown: false,
          animation: 'ios_from_right',
          // 卡片位移与内容淡入是**同一个动作的两半**：一个 300 一个 240 就会「卡片已到位、
          // 内容还在淡」。这里把原生卡片的时长钉成与 `PageEnter` 同为 `MOTION.enter`。
          // 「减弱动效」时归零 —— 不是变慢，是直接到位。
          animationDuration: reduce ? 0 : MOTION.enter,
          // 屏幕内容底色：卡片底默认是白（Android 上取窗口色），推进来 / 被遮住的边缘露出的都是它。
          contentStyle: { backgroundColor: c.bg },
        }}
      >
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="review" />
      <Stack.Screen name="calibration" />
      <Stack.Screen name="vocabtest" />
      <Stack.Screen name="wordlist" />
      <Stack.Screen name="word" />
      <Stack.Screen name="notes" />
      <Stack.Screen name="import" />
      <Stack.Screen name="backup" />
      </Stack>
    </View>
  );
}

export default function RootLayout() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        await initDatabase();
        ensureCards();
      } catch (e) {
        console.error('[drill] db init failed', e);
      } finally {
        if (active) setReady(true);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  return (
    <ThemeProvider ready={ready}>{ready ? <RootStack /> : <BootScreen />}</ThemeProvider>
  );
}
