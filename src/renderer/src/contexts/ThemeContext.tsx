import React, { createContext, useContext, useState, useEffect } from 'react';

export type Theme = 'dark' | 'light' | 'system';

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<Theme>(() => {
    if (window.electronAPI?.getThemeSync) {
      try {
        return (window.electronAPI.getThemeSync() || 'dark') as Theme;
      } catch (e) {
        console.error('Failed to load initial theme synchronously:', e);
      }
    }
    return 'dark';
  });

  const [resolvedTheme, setResolvedTheme] = useState<'dark' | 'light'>('dark');

  useEffect(() => {
    if (theme === 'system') {
      const media = window.matchMedia('(prefers-color-scheme: dark)');
      const listener = () => {
        setResolvedTheme(media.matches ? 'dark' : 'light');
      };
      listener();
      media.addEventListener('change', listener);
      return () => media.removeEventListener('change', listener);
    } else {
      setResolvedTheme(theme);
    }
    return undefined;
  }, [theme]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', resolvedTheme);
  }, [resolvedTheme]);

  const setTheme = async (nextTheme: Theme) => {
    setThemeState(nextTheme);
    if (window.electronAPI?.saveSettings) {
      try {
        await window.electronAPI.saveSettings({ theme: nextTheme });
      } catch (e) {
        console.error('Failed to persist theme:', e);
      }
    }
  };

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
