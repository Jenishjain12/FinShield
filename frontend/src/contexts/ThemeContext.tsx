import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

export type Theme = "dark" | "light";

const STORAGE_KEY = "fin-shield-theme";

/** Read the initial theme synchronously (called once before React renders). */
function getInitialTheme(): Theme {
  try {
    const saved = localStorage.getItem(STORAGE_KEY) as Theme | null;
    if (saved === "dark" || saved === "light") return saved;
  } catch {
    // localStorage unavailable (private-browsing, etc.)
  }
  // Fall back to OS preference
  if (typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: light)").matches) {
    return "light";
  }
  return "dark";
}

/** Apply a theme class to <html> and persist the choice. */
function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.classList.remove("dark", "light");
  root.classList.add(theme);
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // ignore
  }
}

// ─── Context ──────────────────────────────────────────────────────────────
interface ThemeContextValue {
  theme: Theme;
  setTheme: (t: Theme) => void;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: "dark",
  setTheme: () => undefined,
  toggle: () => undefined,
});

// ─── Provider ─────────────────────────────────────────────────────────────
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(getInitialTheme);

  // Apply on mount + whenever theme changes
  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  // Listen for OS preference changes (only when user hasn't set a saved pref)
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: light)");
    function onOsChange(e: MediaQueryListEvent) {
      try {
        if (!localStorage.getItem(STORAGE_KEY)) {
          setThemeState(e.matches ? "light" : "dark");
        }
      } catch {
        setThemeState(e.matches ? "light" : "dark");
      }
    }
    mq.addEventListener("change", onOsChange);
    return () => mq.removeEventListener("change", onOsChange);
  }, []);

  const setTheme = useCallback((t: Theme) => setThemeState(t), []);
  const toggle   = useCallback(() => setThemeState((t) => (t === "dark" ? "light" : "dark")), []);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
