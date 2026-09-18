// 动效基元 —— 一条曲线、一个时长，对**所有**动效一致地生效。
//
// 两件事在这里被固化：
//   1. 曲线与时长从 tokens 取（`EASE` / `EASE_SETTLE` / `MOTION`），不允许各处再写 `Easing.bezier(...)`；
//   2. 系统「减弱动效」打开时，动效**不是变慢，而是直接到位**。
//      这是无障碍要求里最常被漏掉的一条：动作越讲究，前庭敏感的用户越难受。
import { useEffect, useState } from 'react';
import { AccessibilityInfo, Easing } from 'react-native';
import { EASE, EASE_SETTLE, EASE_FALL } from '../theme/tokens';

/** 朱批主曲线（起步快、收尾长，无过冲）。 */
export const ease = () => Easing.bezier(EASE[0], EASE[1], EASE[2], EASE[3]);

/** 落印曲线（起步更急、收尾更缓）。 */
export const easeSettle = () => Easing.bezier(EASE_SETTLE[0], EASE_SETTLE[1], EASE_SETTLE[2], EASE_SETTLE[3]);

/** 落体曲线（起步慢、收尾快，即加速）。只给「东西自己在往下掉」的那一段用。 */
export const easeFall = () => Easing.bezier(EASE_FALL[0], EASE_FALL[1], EASE_FALL[2], EASE_FALL[3]);

/**
 * 系统是否开启了「减弱动效」。
 * 初始值取 false：读系统设置是异步的，而首帧就阻塞等待会让启动多一拍；
 * 读到 true 时动效已经被自己停掉，视觉上只是「这一屏没有过渡」，不会出错。
 */
export function useReducedMotion(): boolean {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled().then((v) => {
      if (alive) setReduce(v);
    });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', (v) => setReduce(v));
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);
  return reduce;
}
