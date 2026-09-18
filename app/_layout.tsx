// 根布局：先初始化数据库（首启拷贝资产库 + 补齐 cards），就绪后再挂载路由。
// 这样任一页面在挂载时都能安全读取已初始化的数据库。
import React, { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { View, Text } from 'react-native';
import { ThemeProvider, useTheme } from '../src/theme/ThemeProvider';
import { RADIUS } from '../src/theme/tokens';
import { initDatabase } from '../src/db/Database';
import { ensureCards } from '../src/db/queries';

function BootScreen() {
  const { colors: c } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: c.bg, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ width: 12, height: 12, backgroundColor: c.ac, borderRadius: RADIUS.xs, marginBottom: 14 }} />
      <Text style={{ color: c.tx2, fontSize: 12, letterSpacing: 2 }}>载 入 中</Text>
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
    <ThemeProvider ready={ready}>
      {ready ? (
        // 转场：显式指定「从右侧推入」并让 pop 自动反向（原生栈的 pop 就是 push 的逆放）。
        // 原来只写了 headerShown:false，动画走的是各平台默认值 —— Android 上默认是淡入，
        // 于是「首页→学习→详情」这种层层深入的路径，方向感完全丢失，看起来像页面在互相替换。
        // ios_from_right：Android 上给出 iOS 风格的右入、iOS 上即平台默认，两端一致。
        <Stack screenOptions={{ headerShown: false, animation: 'ios_from_right' }}>
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
      ) : (
        <BootScreen />
      )}
    </ThemeProvider>
  );
}
