// 共享 UI 原子 —— 把朱批设计语言固化成组件，各屏不再各写各的散值。
// 规矩：颜色一律走 useTheme().colors；尺寸走 RADIUS / SPACE / CONTROL；字重走 WEIGHT。
import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Animated,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
  type TextStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeProvider';
import { useSideInset } from '../../lib/layout';
import { ease, useReducedMotion } from '../../lib/motion';
import { RADIUS, SPACE, CONTROL, WEIGHT, MOTION, FONT, TRACK, STAMP, serif, type StampInk } from '../../theme/tokens';
import { fmtNum } from '../../lib/num';

/**
 * 纵深屏的内容入场（栈屏专用，**不要用在 tab 屏**：tab 的场景自己已有交叉淡入，套两层会发飘）。
 *
 * 为什么只做透明度、不做位移：卡片由原生栈横向推进（这份动效是系统给的），
 * 内容若同时向上浮，合成运动就是**斜向**的 —— 横向来自系统、竖向来自我们，
 * 两股力方向不同，看起来正是「业余」。让内容在原地「显影落定」，
 * 只补系统缺的那半拍：卡片到达的同时内容才逐渐清晰，而不是一块硬纸板被推过来。
 */
export function PageEnter({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const reduce = useReducedMotion();
  const v = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // 「减弱动效」时不播动画，直接到位（不是变慢 —— 变慢对前庭敏感的用户更难受）。
    if (reduce) {
      v.setValue(1);
      return;
    }
    const anim = Animated.timing(v, {
      toValue: 1,
      duration: MOTION.enter,
      easing: ease(),
      useNativeDriver: true,
    });
    anim.start();
    return () => anim.stop();
  }, [reduce, v]);

  return (
    <Animated.View testID="page-enter" style={[{ flex: 1 }, style, { opacity: v }]}>
      {children}
    </Animated.View>
  );
}

/** 天头：朱印 + 品牌名。全局顶栏，四个 tab 共用（对应原型的 .top）。 */
export function BrandBar() {
  const { colors: c } = useTheme();
  const insets = useSafeAreaInsets();
  // 宽屏时天头必须与内容列对齐 —— 天头横跨全屏、内容缩在中间，比不对齐还难看。
  const side = useSideInset();
  return (
    <View
      style={{
        backgroundColor: c.bg,
        paddingTop: insets.top,
        paddingHorizontal: SPACE.xl + side,
        // minHeight 而非 height：系统字号放大时天头自己长高，不会把品牌名裁掉半行。
        minHeight: 52 + insets.top,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 9,
      }}
    >
      <Seal size={16} />
      <Text style={{ fontFamily: serif, fontSize: 16.5, letterSpacing: TRACK.label, fontWeight: WEIGHT.semibold, color: c.tx1 }}>
        背呗
      </Text>
    </View>
  );
}

/** 卡片：压在纸上的一张纸 —— 靠「面比底亮一档 + 1px 描边」表达抬升，不投影（见 tokens 里的长注释）。 */
export function Card({
  children,
  style,
  pad = SPACE.xl,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  pad?: number;
}) {
  const { colors: c } = useTheme();
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: c.sf, borderColor: c.bd, padding: pad },
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

/**
 * 朱印：**尺寸恒定，浓度靠墨量**（见 tokens 的 STAMP 注释）。
 *
 *   ink 1 细边朱文（只有轮廓）/ 2 粗边朱文 / 3 满墨白文（印面全朱 + 纸色内框，默认）
 *
 * 「未打卡」不在这里表达 —— 那由调用方决定**不渲染**。给空槽描一圈虚线等于往日历里
 * 凭空塞 30 个元素，而空白的克制本身就是「还没盖」最好的说法。
 *
 * `paper` 是印下面那张「纸」的颜色。白文印的内框是**纸色实体**，不是描边：
 * 印压在卡面上就该取卡面色（`c.sf`），取错（比如永远取 `c.bg`）会让内框比周围暗一档，
 * 于是读成「一个空心框」而不是「白文印」。默认取页面底色。
 */
export function Seal({
  size = 16,
  ink = 3,
  paper,
  style,
}: {
  size?: number;
  ink?: StampInk;
  paper?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors: c } = useTheme();
  // 边宽以 9dp 的印面（STAMP.size）为基准单位：换尺寸时整枚印等比缩放，
  // 「墨量」在任何尺寸下的**相对**视觉重量才不变。
  const u = size / STAMP.size;
  const paperColor = paper ?? c.bg;
  const base: StyleProp<ViewStyle> = {
    width: size,
    height: size,
    borderRadius: RADIUS.mark + 1,
    alignItems: 'center',
    justifyContent: 'center',
  };

  if (ink === 3) {
    // 满墨白文：印面整块朱，内嵌一道纸色细框 —— 这不是「装饰内框」，
    // 而是白文印真实的结构：朱色是底，「字」是纸。
    const inset = Math.round(size * 0.22);
    return (
      <View style={[base, { backgroundColor: c.ac }, style]}>
        <View
          style={{
            position: 'absolute',
            top: inset,
            left: inset,
            right: inset,
            bottom: inset,
            borderWidth: 1,
            borderColor: paperColor,
            borderRadius: RADIUS.mark,
          }}
        />
      </View>
    );
  }

  return (
    <View
      style={[
        base,
        {
          borderWidth: (ink === 1 ? 1 : 1.9) * u,
          borderColor: c.ac,
          backgroundColor: 'transparent',
        },
        style,
      ]}
    />
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

/**
 * 数字读数。**任何**会被用户当「一个值」看的数字都走这里，别直接写 `<Text>{n}</Text>`。
 *
 * 为什么必须有这个原子（P0.1，主人反馈「大数字折行」）：
 *   · `numberOfLines={1}` —— `<Text>` 默认换行。数字折行不是「挤了一点」，
 *     是把一个值读成两个：`1000` 断成 `10` / `00`，`18 词` 断成 `18` / `词`。
 *   · `flexShrink: 0` —— 数字是最容易被父容器挤扁的元素（长名称有 `numberOfLines`，
 *     数字没有就会被压到裁字），而裁掉的位别人看不见、也没人报错。
 *   · `adjustsFontSizeToFit` + `minimumFontScale` —— 窄屏 + 系统大字号下，
 *     宁可整串等比缩一点，也不折行、不裁字。缩到 0.6 仍比彻底读不出好。
 *   · `tabular-nums` —— 等宽数位，多位数字才不会左右跳。
 */
export function Num({
  value,
  style,
  format = true,
  minScale = 0.6,
}: {
  value: number | string;
  style?: StyleProp<TextStyle>;
  format?: boolean; // 传 false 用于「2026」「第 3 天」这类不是读数的数字
  minScale?: number;
}) {
  const text = typeof value === 'number' && format ? fmtNum(value) : String(value);
  return (
    <Text
      numberOfLines={1}
      adjustsFontSizeToFit
      minimumFontScale={minScale}
      style={[styles.num, style]}
    >
      {text}
    </Text>
  );
}

/**
 * 数字 + 单位（「18 词」）。两件事：
 *   ① `alignItems: 'baseline'` —— 单位贴的是数字的**基线**，不是它的底部。
 *      靠底对齐时，衬线数字的降部（`9`/`4`）会把单位顶起来，两行卡片的高度就对不上了。
 *   ② 单位用 `FONT.unit` 且不再放大 —— 一屏里数字是主角，单位是注解。
 *      旧代码里单位跟着数字一起放大（12→13 各自手写），读起来像两个并列的值。
 */
export function NumUnit({
  value,
  unit,
  color,
  unitColor,
  accent,
  valueStyle,
  unitStyle,
  style,
}: {
  value: number | string;
  unit?: string;
  color?: string;
  unitColor?: string;
  accent?: boolean;
  valueStyle?: StyleProp<TextStyle>;
  unitStyle?: StyleProp<TextStyle>;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors: c } = useTheme();
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'baseline' }, style]}>
      <Num value={value} style={[{ color: accent ? c.ac : (color ?? c.tx1), fontFamily: serif }, valueStyle]} />
      {unit ? (
        <Text
          numberOfLines={1}
          style={[
            // 单位永不参与压缩：位置不够时该缩的是数字（正文值），不是单位 ——
            // 单位被挤掉之后「1000」和「1000 万」长得一样。
            { color: unitColor ?? c.tx3, fontSize: FONT.unit, marginLeft: 3, fontWeight: WEIGHT.medium, flexShrink: 0 },
            unitStyle,
          ]}
        >
          {unit}
        </Text>
      ) : null}
    </View>
  );
}

/**
 * 喇叭（音量）图标 —— 表示「点这里播放发音」。
 *
 * 为什么要换（P0.3）：原来音标旁画的是「一个圆环套一个实心圆点」。
 * 那在图形语言里是「录制 / 电台 / 状态灯」，**没有一个读音叫「播放」** ——
 * 学生看到一个红点，第一反应不是「点它听发音」。图标是这个按钮唯一的文案，
 * 它认错就等于这个功能不存在。
 *
 * 标准音量图标 = 音箱箱体 + 向右张开的喇叭口 + 两道声波。
 * 纯 View 绘制（项目无 SVG 依赖，也不装图标库）。两条几何结论是截图实测出来的，
 * 光看代码推不出来：
 * ① 喇叭口必须是**梯形**（左沿与箱体等高、右沿向两侧张开）。用「左右同宽的三角」
 *    会读成「▶ 播放键」；用错误的 border 边还会让口张反，变成「收口喇叭」。
 * ② 声波必须是**弧**：圆形只留右边框 = 一段 90° 弧。曾用「旋转 45° 的方角边框」，
 *    在 20px 上下渲染出来是个菱形环，既不像弧也不像声波。
 */
export function SoundIcon({ color, size = 18 }: { color: string; size?: number }) {
  // 几何在 18 单位的方格上定义，k 只做整体缩放。轮廓照 Material「volume_up」重建：
  // 箱体 + 梯形喇叭口 + 两道 90° 弧。
  const k = size / 18;
  const X0 = 2; // 箱体左缘
  const Y = 9; // 图标中线
  const BODY_H = 4.5; // 箱体高
  const HORN_H = 12; // 喇叭口右沿高
  const HORN_W = 3.75; // 喇叭口宽
  const BOX_W = 6.75; // 箱体与喇叭口中带等高 → 合成一个矩形，接缝天然不存在
  const bodyTop = Y - BODY_H / 2;
  const flare = (HORN_H - BODY_H) / 2; // 上下各张开多少
  // 14px 及以下只留一道波：两道弧在这个尺寸会糊成一团色点，反而认不出喇叭。
  const one = size < 16;
  const edge = (one ? 1.05 : 0.95) * k;
  const hornLeft = (X0 + BOX_W) * k;
  const cx = 6; // 弧心 = 喇叭口中点
  // 弧的右缘对齐 Material 的 13.5 / 21（24 网格折算到 18 网格 = 10.1 / 15.75）
  const arcs = one ? [19.5] : [8.2, 19.5];

  return (
    <View style={{ width: size, height: size, overflow: 'visible' }}>
      {/* 箱体（含中带）：只圆左两角，右缘多伸 0.3 藏到喇叭口底下，接缝不会漏出白线 */}
      <View
        style={{
          position: 'absolute',
          left: X0 * k,
          top: bodyTop * k,
          width: (BOX_W + 0.3) * k,
          height: BODY_H * k,
          backgroundColor: color,
          borderTopLeftRadius: 0.7 * k,
          borderBottomLeftRadius: 0.7 * k,
        }}
      />
      {/* 上张口：borderLeft 透明撑宽 + borderBottom 着色 → 垂直边在右、斜边由左下升到右上，
          恰好是喇叭口向外张开的形状。换成 borderLeft 着色会得到「▶ 播放键」，实测过。 */}
      <View
        style={{
          position: 'absolute',
          left: hornLeft,
          top: (bodyTop - flare) * k,
          width: 0,
          height: 0,
          borderLeftWidth: HORN_W * k,
          borderBottomWidth: flare * k,
          borderLeftColor: 'transparent',
          borderBottomColor: color,
        }}
      />
      {/* 下张口：与上张口镜像 */}
      <View
        style={{
          position: 'absolute',
          left: hornLeft,
          top: (bodyTop + BODY_H) * k,
          width: 0,
          height: 0,
          borderLeftWidth: HORN_W * k,
          borderTopWidth: flare * k,
          borderLeftColor: 'transparent',
          borderTopColor: color,
        }}
      />
      {/* 声波：圆形只留右边框 = 一段 90° 弧。曾用「旋转 45° 的方角边框」，那画出来是个菱形环，
          在 20px 上下完全不像声波。弧心固定、只放大直径，两道弧自然同心。 */}
      {arcs.map((d) => (
        <View
          key={d}
          style={{
            position: 'absolute',
            left: (cx - d / 2) * k,
            top: (Y - d / 2) * k,
            width: d * k,
            height: d * k,
            borderRadius: (d / 2) * k,
            borderWidth: edge,
            borderColor: 'transparent',
            borderRightColor: color,
          }}
        />
      ))}
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
  label: { fontSize: FONT.label, letterSpacing: TRACK.label, fontWeight: WEIGHT.semibold },
  kicker: { fontSize: FONT.label, letterSpacing: TRACK.caps, textTransform: 'uppercase', fontWeight: WEIGHT.semibold },
  btn: { minHeight: CONTROL.xl, borderRadius: RADIUS.ctrl, alignItems: 'center', justifyContent: 'center' },
  // 按钮文案走 TRACK.body（P1.1）：这里是「读一句指令」，不是「看一列字」——
  // 拉到 1.5 之后「开始学习」四个字各自为政，按钮变得像四个独立的标签。
  // 中文本就全角、字面已有天然间距，再加宽字距等于双重加宽。
  btnText: { fontSize: FONT.body, letterSpacing: TRACK.body, fontWeight: WEIGHT.semibold },
  // 数字的排版契约（与 src/lib/num.ts 的说明同源）。
  // flexShrink 取 1 而不是 0：0 会让数字**溢出**容器（比裁字更糟，会把旁边的单位顶出去），
  // 1 则是「先缩字、缩到 minimumFontScale 为止」—— 这正是 P0.1 要的「不折行、不被截断」。
  num: { fontVariant: ['tabular-nums'], flexShrink: 1 },
  sealMark: {
    width: 30,
    borderRadius: RADIUS.xs,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    gap: 1,
  },
});
