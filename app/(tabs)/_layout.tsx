// 底部标签栏：学习 / 词库 / 统计 / 设置。
// 朱批风格：激活态用朱砂，标签旁配 7dp 方块标记（无图标库依赖）。
import React from 'react';
import { Tabs } from 'expo-router';
import { View, type ColorValue } from 'react-native';
import { useTheme } from '../../src/theme/ThemeProvider';

function TabMark({ focused, color }: { focused: boolean; color: ColorValue }) {
  return (
    <View
      style={{
        width: 7,
        height: 7,
        borderWidth: 1,
        borderColor: color,
        backgroundColor: focused ? color : 'transparent',
        borderRadius: 1,
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
          height: 58,
          paddingBottom: 8,
        },
        tabBarLabelStyle: { fontSize: 10.5, letterSpacing: 1 },
        tabBarItemStyle: { paddingTop: 4 },
      }}
    >
      <Tabs.Screen name="index" options={{ title: '学习', tabBarIcon: icon }} />
      <Tabs.Screen name="library" options={{ title: '词库', tabBarIcon: icon }} />
      <Tabs.Screen name="stats" options={{ title: '统计', tabBarIcon: icon }} />
      <Tabs.Screen name="settings" options={{ title: '设置', tabBarIcon: icon }} />
    </Tabs>
  );
}
