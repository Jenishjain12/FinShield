import { Moon, Sun } from "lucide-react";
import { useTheme } from "../contexts/ThemeContext";

/**
 * Compact icon-button that toggles between Light and Dark mode.
 * Drop it anywhere in the app header or sidebar footer.
 */
export function ThemeSwitcher() {
  const { theme, toggle } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggle}
      className="flex items-center justify-center h-8 w-8 rounded
                 border border-line text-sub
                 hover:bg-surface hover:text-paper
                 transition-colors duration-150"
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
    >
      {isDark
        ? <Sun  size={15} aria-hidden="true" />
        : <Moon size={15} aria-hidden="true" />
      }
    </button>
  );
}
