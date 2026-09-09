// 底部标签栏：学习 / 词库 / 统计 / 设置。
// 朱批风格：激活态用朱砂方块标记 + 朱砂标签；未激活为描边方块 + 弱化标签。
// 方块刻意做得清晰、够大，避免被误认成「图片未加载」的占位点；栏体抬高加大，更顺手。
import React from 'react';
import { Tabs } from 'expo-router';
import { View, Text, type ColorValue } from 'react-native';
import { useTheme } from '../../src/theme/ThemeProvider';

function TabMark({ focused, color }: { focused: boolean; color: ColorValue }) {
  return (
    <View
      style={{
        width: 10,
        height: 10,
        borderWidth: 1.5,
        borderColor: color,
        backgroundColor: focused ? color : 'transparent',
        borderRadius: 2,
      }}
    />
  );
}

export default function TabsLayout() {
  const { colors: c } = useTheme();
  const icon = ({ focused, color }: { focused: boolean; color: ColorValue }) => (
    <TabMark focused={focused} color={color} />
  );
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: c.ac,
        tabBarInactiveTintColor: c.tx3,
        tabBarStyle: {
          backgroundColor: c.bg,
          borderTopColor: c.bd,
          borderTopWidth: 1,
          height: 66,
          paddingTop: 8,
          paddingBottom: 12,
        },
        tabBarLabelStyle: { fontSize: 11.5, letterSpacing: 1, marginTop: 5, fontWeight: '500' },
        tabBarItemStyle: { paddingTop: 0 },
      }}
    >
      <Tabs.Screen name="index" options={{ title: '学习', tabBarIcon: icon }} />
      <Tabs.Screen name="library" options={{ title: '词库', tabBarIcon: icon }} />
      <Tabs.Screen name="stats" options={{ title: '统计', tabBarIcon: icon }} />
      <Tabs.Screen name="settings" options={{ title: '设置', tabBarIcon: icon }} />
    </Tabs>
  );
}
