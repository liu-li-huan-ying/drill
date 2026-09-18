// 共享 UI 原子 —— 把朱批设计语言固化成组件，各屏不再各写各的散值。
// 规矩：颜色一律走 useTheme().colors；尺寸走 RADIUS / SPACE / CONTROL；字重走 WEIGHT。
import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
  type TextStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeProvider';
import { RADIUS, SPACE, CONTROL, WEIGHT, SHADOW, serif } from '../../theme/tokens';

/** 天头：朱印 + 品牌名。全局顶栏，四个 tab 共用（对应原型的 .top）。 */
export function BrandBar() {
  const { colors: c } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View
      style={{
        backgroundColor: c.bg,
        paddingTop: insets.top,
        paddingHorizontal: SPACE.xl,
        height: 52 + insets.top,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 9,
      }}
    >
      <Seal size={16} />
      <Text style={{ fontFamily: serif, fontSize: 16.5, letterSpacing: 2, color: c.tx1 }}>背呗</Text>
    </View>
  );
}

/** 卡片：压在纸上的一张纸 —— 1px 描边 + 极轻抬升（暗色不投影，靠描边分层）。 */
export function Card({
  children,
  style,
  pad = SPACE.xl,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  pad?: number;
}) {
  const { colors: c, scheme } = useTheme();
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: c.sf, borderColor: c.bd, padding: pad },
        scheme === 'light' ? (SHADOW.card as ViewStyle) : null,
        style,
      ]}
    >
      {children}
    </View>
  );
}

/** 中文小节标签：10.5px + 2.2px 字距 + 600（10px 级才用宽字距，属「章印式」）。 */
export function Label({
  children,
  style,
  color,
}: {
  children: React.ReactNode;
  style?: StyleProp<TextStyle>;
  color?: string;
}) {
  const { colors: c } = useTheme();
  return <Text style={[styles.label, { color: color ?? c.tx3 }, style]}>{children}</Text>;
}

/** 拉丁全大写小标签：+3px 字距（宽字距是报纸法则，只适用于拉丁文本）。 */
export function Kicker({ children, style }: { children: React.ReactNode; style?: StyleProp<TextStyle> }) {
  const { colors: c } = useTheme();
  return <Text style={[styles.kicker, { color: c.tx3 }, style]}>{children}</Text>;
}

/** 按钮：solid = 朱砂实底（主行动）；outline = 纸面描边（次行动）。 */
export function Btn({
  title,
  onPress,
  disabled,
  variant = 'solid',
  style,
}: {
  title: string;
  onPress?: () => void;
  disabled?: boolean;
  variant?: 'solid' | 'outline';
  style?: StyleProp<ViewStyle>;
}) {
  const { colors: c } = useTheme();
  const solid = variant === 'solid';
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.btn,
        solid ? { backgroundColor: c.ac } : { backgroundColor: c.sf, borderWidth: 1, borderColor: c.bd2 },
        disabled ? { opacity: 0.4 } : null,
        style,
      ]}
    >
      <Text style={[styles.btnText, { color: solid ? c.acon : c.tx1 }]}>{title}</Text>
    </TouchableOpacity>
  );
}

/** hairline 分割线。粗线是廉价的头号来源。 */
export function Hair({ style }: { style?: StyleProp<ViewStyle> }) {
  const { colors: c } = useTheme();
  return <View style={[{ height: 1, backgroundColor: c.bd }, style]} />;
}

/** 进度线：2px 轨道 + 朱砂填充（量度必须有物理编码）。 */
export function Progress({ ratio, style }: { ratio: number; style?: StyleProp<ViewStyle> }) {
  const { colors: c } = useTheme();
  const pct = `${Math.max(0, Math.min(1, ratio)) * 100}%` as const;
  return (
    <View style={[{ height: 2, borderRadius: RADIUS.bar, backgroundColor: c.bd, overflow: 'hidden' }, style]}>
      <View style={{ height: 2, borderRadius: RADIUS.bar, backgroundColor: c.ac, width: pct }} />
    </View>
  );
}

/** 朱笔横痕：一条带收笔的短横（纯 View 近似原型里带起收笔的笔触）。 */
export function StrokeBar({
  width = 180,
  thickness = 3,
  style,
}: {
  width?: number;
  thickness?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors: c } = useTheme();
  return (
    <View
      style={[
        { width, height: thickness, borderRadius: thickness / 2, backgroundColor: c.ac, opacity: 0.8 },
        style,
      ]}
    />
  );
}

/** 朱印：solid = 朱底纸字（白文印）/ text = 朱边朱字（朱文印）。 */
export function Seal({
  size = 16,
  label,
  variant = 'solid',
  style,
}: {
  size?: number;
  label?: string;
  variant?: 'solid' | 'text';
  style?: StyleProp<ViewStyle>;
}) {
  const { colors: c } = useTheme();
  const solid = variant === 'solid';
  const inset = Math.round(size * 0.22);
  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: RADIUS.mark + 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: solid ? c.ac : 'transparent',
          borderWidth: solid ? 0 : 1,
          borderColor: c.ac,
        },
        style,
      ]}
    >
      {label ? (
        <Text
          style={{
            color: solid ? c.bg : c.ac,
            fontSize: size * 0.42,
            fontWeight: WEIGHT.semibold,
            fontFamily: serif,
            lineHeight: size * 0.5,
          }}
        >
          {label}
        </Text>
      ) : solid ? (
        <View
          style={{
            position: 'absolute',
            top: inset,
            left: inset,
            right: inset,
            bottom: inset,
            borderWidth: 1,
            borderColor: c.bg,
            borderRadius: RADIUS.mark,
          }}
        />
      ) : null}
    </View>
  );
}

/** 白文朱印（竖排字）：朱底纸字小方章，用于「新词 / 易忘」这类批点标记。 */
export function SealMark({ text, style }: { text: string; style?: StyleProp<ViewStyle> }) {
  const { colors: c } = useTheme();
  return (
    <View
      style={[
        styles.sealMark,
        { backgroundColor: c.ac },
        style,
      ]}
    >
      {text.split('').map((ch, i) => (
        <Text
          key={i}
          style={{
            color: c.bg,
            fontSize: 12.5,
            fontWeight: WEIGHT.semibold,
            fontFamily: serif,
            lineHeight: 15,
          }}
        >
          {ch}
        </Text>
      ))}
    </View>
  );
}

/** 数据格：衬线大数字 + 标签（标签用 600，中文小字不靠字距撑）。 */
export function StatCell({
  label,
  value,
  unit,
  accent,
  style,
}: {
  label: string;
  value: React.ReactNode;
  unit?: string;
  accent?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors: c } = useTheme();
  return (
    <View style={[{ alignItems: 'center' }, style]}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
        <Text
          style={{
            color: accent ? c.ac : c.tx1,
            fontFamily: serif,
            fontSize: 28,
            lineHeight: 32,
            fontWeight: WEIGHT.medium,
            letterSpacing: -0.3,
          }}
        >
          {value}
        </Text>
        {unit ? (
          <Text style={{ color: c.tx3, fontSize: 12, marginLeft: 3, fontWeight: WEIGHT.medium }}>{unit}</Text>
        ) : null}
      </View>
      <Text style={{ color: c.tx3, fontSize: 11.5, marginTop: 6, fontWeight: WEIGHT.semibold }}>{label}</Text>
    </View>
  );
}

/** 列表行：左右对齐 + 可选箭头，最小高 48（触摸目标）。 */
export function RowItem({
  label,
  value,
  onPress,
  last,
  chev,
  right,
  style,
}: {
  label: string;
  value?: string;
  onPress?: () => void;
  last?: boolean;
  chev?: boolean;
  right?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors: c } = useTheme();
  return (
    <TouchableOpacity
      activeOpacity={onPress ? 0.6 : 1}
      disabled={!onPress}
      onPress={onPress}
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: SPACE.md,
          minHeight: SPACE.touch,
          paddingHorizontal: SPACE.xl,
          borderBottomWidth: last ? 0 : 1,
          borderBottomColor: c.bd,
        },
        style,
      ]}
    >
      <Text style={{ flex: 1, fontSize: 15, color: c.tx1, fontWeight: WEIGHT.medium }}>{label}</Text>
      {right}
      {value ? (
        <Text
          style={{
            fontSize: 12.5,
            color: c.tx3,
            fontWeight: WEIGHT.medium,
            fontVariant: ['tabular-nums'],
          }}
        >
          {value}
        </Text>
      ) : null}
      {chev ? <Chev /> : null}
    </TouchableOpacity>
  );
}

/** 行尾箭头（1px 描边旋转 45°，细线不用图标）。 */
export function Chev({ style }: { style?: StyleProp<ViewStyle> }) {
  const { colors: c } = useTheme();
  return (
    <View
      style={[
        {
          width: 7,
          height: 7,
          borderTopWidth: 1,
          borderRightWidth: 1,
          borderColor: c.tx3,
          transform: [{ rotate: '45deg' }],
          opacity: 0.8,
        },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: RADIUS.card, borderWidth: 1 },
  label: { fontSize: 10.5, letterSpacing: 2.2, fontWeight: WEIGHT.semibold },
  kicker: { fontSize: 10.5, letterSpacing: 3, textTransform: 'uppercase', fontWeight: WEIGHT.semibold },
  btn: { height: CONTROL.xl, borderRadius: RADIUS.ctrl, alignItems: 'center', justifyContent: 'center' },
  btnText: { fontSize: 15, letterSpacing: 1.5, fontWeight: WEIGHT.semibold },
  sealMark: {
    width: 30,
    borderRadius: RADIUS.xs,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    gap: 1,
  },
});
