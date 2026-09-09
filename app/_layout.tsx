// 根布局：先初始化数据库（首启拷贝资产库 + 补齐 cards），就绪后再挂载路由。
// 这样任一页面在挂载时都能安全读取已初始化的数据库。
import React, { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { View, Text } from 'react-native';
import { ThemeProvider, useTheme } from '../src/theme/ThemeProvider';
import { initDatabase } from '../src/db/Database';
import { ensureCards } from '../src/db/queries';

function BootScreen() {
  const { colors: c } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: c.bg, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ width: 12, height: 12, backgroundColor: c.ac, borderRadius: 2, marginBottom: 14 }} />
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
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="review" />
          <Stack.Screen name="calibration" />
          <Stack.Screen name="wordlist" />
          <Stack.Screen name="word" />
          <Stack.Screen name="import" />
          <Stack.Screen name="vocabtest" />
        </Stack>
      ) : (
        <BootScreen />
      )}
    </ThemeProvider>
  );
}
