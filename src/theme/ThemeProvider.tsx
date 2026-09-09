import React, { createContext, useContext, useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';
import { tokens, type Scheme, type Tokens } from './tokens';

interface ThemeValue {
  scheme: Scheme;
  colors: Tokens;
}

const ThemeContext = createContext<ThemeValue>({ scheme: 'light', colors: tokens.light });

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const system = useColorScheme();
  const [scheme, setScheme] = useState<Scheme>((system as Scheme) ?? 'light');

  useEffect(() => {
    if (system === 'light' || system === 'dark') setScheme(system);
  }, [system]);

  return (
    <ThemeContext.Provider value={{ scheme, colors: tokens[scheme] }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeValue {
  return useContext(ThemeContext);
}
