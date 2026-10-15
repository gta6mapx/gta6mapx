"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
// Theme state lives in the unified engagement settings store. This component
// keeps the historical context interface ({ theme, setTheme }) and treats
// every stored value as untrusted: malformed data falls back to the default.
import {
  getSettings,
  setSettings,
  subscribeSettings,
  type ThemeId,
} from "@/modules/engagement/settings/store";

export type { ThemeId };
/** Legacy alias — the map chrome themes. "neon-mirage" is the default. */
export type MapThemeName = ThemeId;

interface MapThemeContextValue {
  theme: ThemeId;
  setTheme: (theme: ThemeId) => void;
}

const DEFAULT_THEME: ThemeId = "neon-mirage";

const MapThemeContext = createContext<MapThemeContextValue>({
  theme: DEFAULT_THEME,
  setTheme: () => {},
});

function coerceTheme(value: unknown): ThemeId {
  return value === "neon-mirage" ||
    value === "midnight-outrun" ||
    value === "sunset-boulevard"
    ? value
    : DEFAULT_THEME;
}

function readThemeFromStore(): ThemeId {
  try {
    return coerceTheme(getSettings().theme);
  } catch {
    return DEFAULT_THEME;
  }
}

/**
 * Exposes { theme, setTheme } from the unified settings store. The store
 * itself applies `data-theme`/`data-accent`/`data-panel` to <html> (and the
 * pre-paint script in the root layout sets them before first paint), so
 * context consumers never branch rendered markup on the value during
 * hydration.
 */
export function MapThemeProvider({ children }: { children: ReactNode }) {
  // Lazy initializer reads the store on the client only; the server always
  // starts at the default so SSR output stays consistent.
  const [theme, setThemeState] = useState<ThemeId>(() =>
    typeof window === "undefined" ? DEFAULT_THEME : readThemeFromStore()
  );

  // Stay in sync with cross-tab changes (the store's `storage` listener).
  useEffect(() => subscribeSettings(() => setThemeState(readThemeFromStore())), []);

  const setTheme = useCallback((next: ThemeId) => {
    const safe = coerceTheme(next);
    setThemeState(safe);
    try {
      setSettings({ theme: safe });
    } catch {
      // Persistence is best-effort; the theme still applies for this session.
    }
  }, []);

  const value = useMemo(() => ({ theme, setTheme }), [theme, setTheme]);

  return (
    <MapThemeContext.Provider value={value}>{children}</MapThemeContext.Provider>
  );
}

export function useMapTheme(): MapThemeContextValue {
  return useContext(MapThemeContext);
}
