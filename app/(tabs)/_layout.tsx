// 底部标签栏：朱批导航 —— 线性图标 + 朱笔横痕指示器。
// 废掉「每个 tab 挂一个小方块」：方块是「未读」状态指示，不是导航语言，
// 四格各挂一个等于把导航降格成开关。现在用一根会滑动的朱痕说「你在这里」。
import React, { useEffect, useRef, useState } from 'react';
import { Tabs } from 'expo-router';
import { View, Text, TouchableOpacity, Animated, Easing, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../src/theme/ThemeProvider';
import { BrandBar } from '../../src/components/ui';
import { useSideInset, CONTENT_MAX } from '../../src/lib/layout';
import { RADIUS, MOTION, SPACE, WEIGHT } from '../../src/theme/tokens';

const RULE_W = 30; // 朱痕宽度
const TITLES: Record<string, string> = {
  index: '学习',
  library: '词库',
  stats: '统计',
  settings: '设置',
};

// tab 切换：内容不「瞬间替换」，而是**按索引方向平移 50dp + 交叉淡入**，
// 与朱痕的滑动同一条曲线、同一个时长 —— 两者是同一个动作的两半，时长不一致就会「光标追着内容跑」。
const SWITCH = {
  animation: 'timing' as const,
  config: { duration: MOTION.tab, easing: Easing.bezier(0.32, 0.72, 0.28, 1) },
};

/** 四个线性图标（纯 View 绘制，项目无 SVG 依赖）：册页 / 书 / 柱 / 旋钮。 */
function Icon({ name, color }: { name: string; color: string }) {
  const bar = { backgroundColor: color } as const;
  switch (name) {
    case 'index': // 册页
      return (
        <View style={styles.iconBox}>
          <View
            style={{
              width: 15,
              height: 17,
              borderWidth: 1.5,
              borderColor: color,
              borderRadius: RADIUS.xs,
              alignItems: 'center',
              justifyContent: 'center',
              gap: 2.5,
            }}
          >
            <View style={[bar, { width: 7.5, height: 1.2, borderRadius: RADIUS.mark }]} />
            <View style={[bar, { width: 7.5, height: 1.2, borderRadius: RADIUS.mark }]} />
            <View style={[bar, { width: 4.5, height: 1.2, borderRadius: RADIUS.mark }]} />
          </View>
        </View>
      );
    case 'library': // 书（书脊在右）
      return (
        <View style={styles.iconBox}>
          <View
            style={{
              width: 14,
              height: 16,
              borderWidth: 1.5,
              borderColor: color,
              borderRadius: RADIUS.xs,
            }}
          />
          <View
            style={[
              bar,
              { position: 'absolute', right: 2.4, top: 5.5, width: 1.5, height: 11, borderRadius: RADIUS.mark },
            ]}
          />
        </View>
      );
    case 'stats': // 柱
      return (
        <View style={styles.iconBox}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 3.4, height: 15 }}>
            <View style={[bar, { width: 1.8, height: 7, borderRadius: RADIUS.mark }]} />
            <View style={[bar, { width: 1.8, height: 14, borderRadius: RADIUS.mark }]} />
            <View style={[bar, { width: 1.8, height: 4.5, borderRadius: RADIUS.mark }]} />
          </View>
        </View>
      );
    default: // 设置：旋钮
      return (
        <View style={styles.iconBox}>
          <View
            style={{
              width: 15,
              height: 15,
              borderRadius: RADIUS.pill,
              borderWidth: 1.5,
              borderColor: color,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <View style={[bar, { width: 4.5, height: 4.5, borderRadius: RADIUS.xs }]} />
          </View>
        </View>
      );
  }
}

function TabBar({ state, navigation }: { state: any; navigation: any }) {
  const { colors: c } = useTheme();
  const insets = useSafeAreaInsets();
  // 宽屏时四个 tab 也收进内容列 —— 800dp 宽的栏里塞 4 个 200dp 的格子会散掉，
  // 而且栏与内容不对齐，视觉上像两个无关的东西叠在一起。手机上 side = 0，完全不变。
  const side = useSideInset();
  const [width, setWidth] = useState(0);
  const slide = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!width) return;
    const cell = (width - 2 * side) / state.routes.length;
    Animated.timing(slide, {
      toValue: side + (state.index + 0.5) * cell - RULE_W / 2,
      duration: MOTION.tab,
      easing: Easing.bezier(0.32, 0.72, 0.28, 1),
      useNativeDriver: true,
    }).start();
  }, [state.index, state.routes.length, width, side, slide]);

  return (
    <View
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      style={[
        styles.bar,
        { backgroundColor: c.bg, borderTopColor: c.bd, paddingBottom: insets.bottom + SPACE.sm },
      ]}
    >
      {width > 0 ? (
        <Animated.View
          pointerEvents="none"
          style={[styles.rule, { backgroundColor: c.ac, transform: [{ translateX: slide }] }]}
        />
      ) : null}

      <View style={[styles.items, { maxWidth: CONTENT_MAX, alignSelf: 'center' }]}>
        {state.routes.map((route: any, i: number) => {
          const focused = state.index === i;
          const color = focused ? c.ac : c.tx3;
          const labelColor = focused ? c.tx1 : c.tx3;
          return (
            <TouchableOpacity
              key={route.key}
              activeOpacity={0.6}
              style={styles.item}
              onPress={() => {
                const event = navigation.emit({
                  type: 'tabPress',
                  target: route.key,
                  canPreventDefault: true,
                });
                if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
              }}
            >
              <Icon name={route.name} color={color} />
              <Text
                style={{
                  color: labelColor,
                  fontSize: 11,
                  // 未选 0.8 / 选中 1.1：中文全角字不吃宽字距，只留一点呼吸
                  letterSpacing: focused ? 1.1 : 0.8,
                  fontWeight: focused ? WEIGHT.semibold : WEIGHT.medium,
                }}
              >
                {TITLES[route.name] ?? route.name}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

export default function TabsLayout() {
  return (
    <View style={{ flex: 1 }}>
      <BrandBar />
      <Tabs
        screenOptions={{
          headerShown: false,
          animation: 'shift',
          transitionSpec: SWITCH,
          // 四个 tab 的首次挂载会各自跑一次同步查库。默认 lazy 会把这笔开销压在**第一次切换的那一刻**，
          // 正好落在转场动画的起始帧上 → 掉帧、卡一下。预挂载换掉这一下卡顿。
          lazy: false,
        }}
        tabBar={(props: any) => <TabBar {...props} />}
      >
        <Tabs.Screen name="index" options={{ title: '学习' }} />
        <Tabs.Screen name="library" options={{ title: '词库' }} />
        <Tabs.Screen name="stats" options={{ title: '统计' }} />
        <Tabs.Screen name="settings" options={{ title: '设置' }} />
      </Tabs>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { borderTopWidth: 1, paddingTop: SPACE.sm },
  // 朱痕：栏顶一道笔触，切换时横向滑动 —— 它不是装饰，是「你在这里」的痕迹。
  rule: { position: 'absolute', top: -1, left: 0, width: RULE_W, height: 4, borderRadius: RADIUS.bar },
  items: { flexDirection: 'row' },
  // minHeight 而非 height：系统字号调大时栏会自己长高，而不是把标签裁掉。
  // paddingVertical 让「图标 + 标签」在栏内居中；默认字号下总高仍是 62（内容只有 45），栏高不变。
  item: { flex: 1, minHeight: 62, alignItems: 'center', justifyContent: 'center', gap: 7, paddingVertical: SPACE.sm },
  iconBox: { width: 22, height: 22, alignItems: 'center', justifyContent: 'center' },
});
