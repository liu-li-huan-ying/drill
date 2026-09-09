import React, { createContext, useContext, useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';
import { tokens, type Scheme, type Tokens } from './tokens';
import { getThemeMode, setThemeMode, type ThemeMode } from '../db/queries';

interface ThemeValue {
  scheme: Scheme;
  colors: Tokens;
  themeMode: ThemeMode;
  setThemeMode: (m: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeValue>({
  scheme: 'light',
  colors: tokens.light,
  themeMode: 'system',
  setThemeMode: () => {},
});

// 解析最终配色：手动模式直接取；跟随系统则看系统 scheme（unspecified 回落浅色）。
function resolve(system: string | null | undefined, mode: ThemeMode): Scheme {
  if (mode === 'light') return 'light';
  if (mode === 'dark') return 'dark';
  return system === 'dark' ? 'dark' : 'light';
}

export function ThemeProvider({
  children,
  ready,
}: {
  children: React.ReactNode;
  ready?: boolean;
}) {
  const system = useColorScheme();
  const [mode, setMode] = useState<ThemeMode>('system');

  // 数据库就绪后读取持久化的主题偏好（默认跟随系统）。
  useEffect(() => {
    if (!ready) return;
    try {
      setMode(getThemeMode());
    } catch {
      /* 表尚不存在时忽略，回落到跟随系统 */
    }
  }, [ready]);

  const scheme = resolve(system, mode);

  const update = (m: ThemeMode) => {
    setMode(m);
    try {
      setThemeMode(m);
    } catch {
      /* 持久化失败不影响本次渲染 */
    }
  };

  return (
    <ThemeContext.Provider
      value={{ scheme, colors: tokens[scheme], themeMode: mode, setThemeMode: update }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeValue {
  return useContext(ThemeContext);
}
