import containerQueries from '@tailwindcss/container-queries';

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        sans: [
          'Inter',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Hiragino Sans"',
          '"Yu Gothic UI"',
          'system-ui',
          'sans-serif',
        ],
      },
      colors: {
        // Semantic variables mapped to reference design tokens
        canvas: "var(--bg-canvas)",
        surface: {
          DEFAULT: "var(--bg-surface)",
          2: "var(--bg-surface-2)",
          3: "var(--bg-elevated)",
        },
        elevated: "var(--bg-elevated)",
        subtle: "var(--border-subtle)",
        line: {
          DEFAULT: "var(--border-subtle)",
          strong: "var(--border-strong)",
        },
        "border-subtle": "var(--border-subtle)",
        "border-strong": "var(--border-strong)",
        "tx-primary": "var(--text-primary)",
        ink: "var(--text-primary)",
        "tx-muted": "var(--text-muted)",
        muted: "var(--text-muted)",
        accent: {
          DEFAULT: "var(--accent)",
          ink: "var(--accent-ink)",
          soft: "var(--accent-soft)",
          hover: "var(--accent-hover)",
        },
        danger: {
          DEFAULT: "var(--danger)",
          soft: "var(--danger-soft)",
        },
        warn: {
          DEFAULT: "var(--warn)",
          soft: "var(--warn-soft)",
        },
        ok: {
          DEFAULT: "var(--ok)",
          soft: "var(--ok-soft)",
        },
      },
      borderRadius: {
        chip: "var(--radius-chip)",
        block: "var(--radius-block)",
        column: "var(--radius-column)",
        control: "var(--radius-control)",
        surface: "var(--radius-surface)",
        panel: "var(--radius-panel)",
      },
      boxShadow: {
        DEFAULT: "var(--shadow)",
        card: "var(--shadow)",
        panel: "var(--shadow)",
        subtle: "0px 1px 2px 0px rgba(0, 0, 0, 0.04)",
      },
      transitionDuration: {
        fast: "var(--motion-duration-fast)",
        base: "var(--motion-duration-base)",
        slow: "var(--motion-duration-slow)",
      },
      transitionTimingFunction: {
        standard: "var(--motion-easing-standard)",
        emphasized: "var(--motion-easing-emphasized)",
      },
      spacing: {
        rail: "var(--rail)",
        "workspace-bar": "var(--workspace-bar-height)",
        "workspace-control": "var(--workspace-control-height)",
        "workspace-gutter": "var(--workspace-gutter)",
        "workspace-splitter": "var(--workspace-splitter-width)",
      },
    },
  },
  plugins: [
    containerQueries,
  ],
};
