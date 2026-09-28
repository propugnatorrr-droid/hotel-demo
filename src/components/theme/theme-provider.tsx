'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';

export type ThemePref = 'auto' | 'day' | 'night';
export type Theme = 'day' | 'night';

type ThemeContextValue = {
  pref: ThemePref;
  theme: Theme;
  setPref: (pref: ThemePref) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function resolve(pref: ThemePref): Theme {
  if (pref !== 'auto') return pref;
  const h = new Date().getHours();
  return h >= 7 && h < 19 ? 'day' : 'night';
}

function apply(pref: ThemePref) {
  const theme = resolve(pref);
  const root = document.documentElement;
  root.dataset.theme = theme;
  root.dataset.themePref = pref;
  return theme;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [pref, setPrefState] = useState<ThemePref>('auto');
  const [theme, setTheme] = useState<Theme>('day');

  useEffect(() => {
    const stored = (localStorage.getItem('theme') as ThemePref | null) ?? 'auto';
    setPrefState(stored);
    setTheme(apply(stored));
  }, []);

  useEffect(() => {
    if (pref !== 'auto') return;
    const id = window.setInterval(() => setTheme(apply('auto')), 5 * 60 * 1000);
    return () => window.clearInterval(id);
  }, [pref]);

  const setPref = useCallback((next: ThemePref) => {
    localStorage.setItem('theme', next);
    setPrefState(next);
    setTheme(apply(next));
  }, []);

  return <ThemeContext.Provider value={{ pref, theme, setPref }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider');
  return ctx;
}
