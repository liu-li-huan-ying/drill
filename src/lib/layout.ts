// 弹性布局基元 —— 应对「同一份设计稿要落在所有机型上」这件事。
//
// 背景（实测）：屏幕差异有三个维度，各自的坏法不同 ——
//   1. **顶部（状态栏 / 挖孔 / 灵动岛）**：高度从 0（浏览器）到 48+（挖孔机）都有。
//      写死 `paddingTop: 52` 在 32dp 状态栏的机器上刚好，在 48dp 挖孔机上就压字，
//      在无状态栏设备（平板分屏、桌面模式）上白留一大条。**竖留白必须由安全区推导。**
//   2. **长宽比**：16:9 短屏与 20:9 长屏差 20% 的可用高度。短屏会被裁、长屏会空一大块。
//      → 能用高度的构件按视口算尺寸（刻度环），不能裁的内容必须可滚动（完成屏）。
//   3. **宽度（平板 / 折叠屏展开）**：可达 700dp 以上。若不封顶，卡片会横跨整屏、
//      一行塞 60 个汉字，行距再讲究也读不动。→ **封内容列宽，把余量还给左右留白。**
//
// 纪律：这三个 hook 在**手机上必须是零变化**（gutter 恒为 20dp、topPad 与旧值同级），
// 只在挖孔屏、平板、折叠屏上生效 —— 否则就是拿「适配」当借口改设计。
import { useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SPACE } from '../theme/tokens';

/** 内容列宽上限（dp）。手机竖屏不会触及；平板/折叠屏展开后把余量均分到两侧。 */
export const CONTENT_MAX = 520;

/** 页面左右留白。手机恒为 20dp；宽于 CONTENT_MAX 的屏自动补成居中留白。 */
export function useGutter(): number {
  const { width } = useWindowDimensions();
  return Math.max(SPACE.xl, Math.round((width - CONTENT_MAX) / 2));
}

/**
 * 「额外」左右留白（手机上恒为 0）。
 * 用于那些**子元素自己已经带了 20dp 页面边距**的屏：把它加到根容器上，手机上看不出任何差别，
 * 平板/折叠屏上则把内容收成居中的一列（且表头/页脚的横线正好落在列宽上，而不是孤零零横跨全屏）。
 */
export function useSideInset(): number {
  const { width } = useWindowDimensions();
  return Math.max(0, Math.round((width - CONTENT_MAX) / 2));
}

/** 栈屏顶部留白 = 安全区 + 呼吸（旧实现是写死 52，两者在 32dp 状态栏机型上取同一值）。 */
export function useTopPad(): number {
  const insets = useSafeAreaInsets();
  return insets.top + SPACE.xl;
}

/** 底部避让：手势条机型要让开，无手势条机型不能白留一块。 */
export function useBottomPad(extra = SPACE.lg): number {
  const { bottom } = useSafeAreaInsets();
  return Math.max(bottom, SPACE.md) + extra;
}
