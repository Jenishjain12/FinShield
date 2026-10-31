/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // Core application surfaces (mapped to CSS variables)
        bg:            "var(--c-bg)",
        ink: {
          950: "var(--ink-950)",
          900: "var(--ink-900)",
          850: "var(--ink-850)",
          800: "var(--ink-800)",
          DEFAULT: "var(--c-bg)",
        },
        panel:         "var(--c-panel)",
        surface:       "var(--c-surface)",
        overlay:       "var(--c-overlay)",

        line:          "var(--c-line)",
        "line-subtle": "var(--c-line-subtle)",
        "line-strong": "var(--c-line-strong)",

        paper: {
          100: "var(--paper-100)",
          300: "var(--paper-300)",
          500: "var(--paper-500)",
          DEFAULT: "var(--c-paper)",
        },
        sub:           "var(--c-sub)",
        mute:          "var(--c-sub)",
        dim:           "var(--c-dim)",

        // Signal Cartography palette
        "signal-cyan":     "#58C7D9",
        "signal-cyan-dim": "rgba(88, 199, 217, 0.12)",
        "mineral-green":   "#63B78C",
        "burnished-amber": "#D9A34C",
        vermilion:         "#E6654F",
        "signal-red":      "#B9383A",

        // Primary analytical accent
        accent:           "#58C7D9",
        "accent-dim":     "rgba(88, 199, 217, 0.12)",
        "accent-border":  "rgba(88, 199, 217, 0.22)",

        // Semantic status
        ok:            "#63B78C",
        "ok-dim":      "rgba(99, 183, 140, 0.14)",
        warn:          "#D9A34C",
        "warn-dim":    "rgba(217, 163, 76, 0.14)",
        danger:        "#E6654F",
        "danger-dim":  "rgba(230, 101, 79, 0.14)",
        crit:          "#B9383A",
        "crit-dim":    "rgba(185, 56, 58, 0.14)",

        // Compatibility aliases
        high:          "#E6654F",
        critical:      "#B9383A",
        mid:           "#D9A34C",
        low:           "#63B78C",
      },

      fontFamily: {
        display: ["Libre Baskerville", "Georgia", "serif"],
        sans:    ["DM Sans", "Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        mono:    ["DM Mono", "JetBrains Mono", "ui-monospace", "SFMono-Regular", "monospace"],
      },

      fontSize: {
        "3xs": ["0.5625rem", { lineHeight: "0.875rem" }],
        "2xs": ["0.6875rem", { lineHeight: "1rem" }],
        xs:    ["0.75rem",   { lineHeight: "1.125rem" }],
        sm:    ["0.8125rem", { lineHeight: "1.25rem" }],
        base:  ["0.875rem",  { lineHeight: "1.375rem" }],
        md:    ["0.9375rem", { lineHeight: "1.5rem" }],
        lg:    ["1rem",      { lineHeight: "1.5rem" }],
        xl:    ["1.125rem",  { lineHeight: "1.625rem" }],
        "2xl": ["1.25rem",   { lineHeight: "1.75rem" }],
        "3xl": ["1.5rem",    { lineHeight: "2rem" }],
        "4xl": ["1.875rem",  { lineHeight: "2.25rem" }],
      },

      borderRadius: {
        none:    "0",
        sm:      "2px",
        DEFAULT: "4px",
        md:      "4px",
        lg:      "6px",
        xl:      "8px",
        full:    "9999px",
      },

      boxShadow: {
        panel:        "var(--shadow-panel)",
        modal:        "var(--shadow-modal)",
        glow:         "0 0 0 1px rgba(88, 199, 217, 0.25), 0 0 16px rgba(88, 199, 217, 0.08)",
        "glow-danger":"0 0 0 1px rgba(185, 56, 58, 0.25), 0 0 16px rgba(185, 56, 58, 0.08)",
        focus:        "0 0 0 2px rgba(88, 199, 217, 0.35)",
        card:         "var(--shadow-card)",
      },

      keyframes: {
        "fade-in": {
          from: { opacity: "0", transform: "translateY(4px)" },
          to:   { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in-fast": {
          from: { opacity: "0" },
          to:   { opacity: "1" },
        },
        shimmer: {
          "0%":   { backgroundPosition: "-400px 0" },
          "100%": { backgroundPosition:  "400px 0" },
        },
        "score-fill": {
          from: { "stroke-dashoffset": "251" },
        },
        pulse_subtle: {
          "0%, 100%": { opacity: "1" },
          "50%":       { opacity: "0.55" },
        },
        "slide-in": {
          from: { opacity: "0", transform: "translateX(-8px)" },
          to:   { opacity: "1", transform: "translateX(0)" },
        },
        "slide-up": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to:   { opacity: "1", transform: "translateY(0)" },
        },
        "node-appear": {
          from: { opacity: "0", transform: "scale(0.8)" },
          to:   { opacity: "1", transform: "scale(1)" },
        },
      },

      animation: {
        "fade-in":      "fade-in 0.25s ease-out both",
        "fade-in-fast": "fade-in-fast 0.15s ease-out both",
        shimmer:        "shimmer 1.8s ease-in-out infinite",
        "score-fill":   "score-fill 0.8s ease-out both",
        pulse_subtle:   "pulse_subtle 2.4s ease-in-out infinite",
        "slide-in":     "slide-in 0.2s ease-out both",
        "slide-up":     "slide-up 0.25s ease-out both",
        "node-appear":  "node-appear 0.3s cubic-bezier(0.34,1.56,0.64,1) both",
      },

      transitionDuration: {
        DEFAULT: "150ms",
      },
    },
  },
  plugins: [],
};
