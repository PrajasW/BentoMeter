import { createContext, useContext, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import { useAppStore } from '@/store/useAppStore';
import { dark, light, type Palette } from './tokens';

interface Theme {
  c: Palette;
  isDark: boolean;
}

const ThemeContext = createContext<Theme>({ c: light, isDark: false });

export function ThemeProvider({ children }: { children: ReactNode }) {
  const pref = useAppStore((s) => s.themePref);
  const system = useColorScheme();
  const isDark = pref === 'dark' || (pref === 'system' && system === 'dark');
  return <ThemeContext.Provider value={{ c: isDark ? dark : light, isDark }}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);
