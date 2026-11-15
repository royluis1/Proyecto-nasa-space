import type { Config } from "tailwindcss";
import animate from "tailwindcss-animate";

/** Los tokens guardan componentes oklch sueltos ("L C H"), así Tailwind puede aplicar transparencia (bg-primary/10). */
const c = (name: string) => `oklch(var(--${name}) / <alpha-value>)`;

const config: Config = {
  darkMode: "class",
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./hooks/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    container: { center: true, padding: "1rem", screens: { "2xl": "1280px" } },
    extend: {
      colors: {
        border: c("border"),
        input: c("input"),
        ring: c("ring"),
        background: c("background"),
        foreground: c("foreground"),
        primary: { DEFAULT: c("primary"), foreground: c("primary-foreground"), glow: c("primary-glow") },
        secondary: { DEFAULT: c("secondary"), foreground: c("secondary-foreground") },
        muted: { DEFAULT: c("muted"), foreground: c("muted-foreground") },
        accent: { DEFAULT: c("accent"), foreground: c("accent-foreground") },
        destructive: { DEFAULT: c("destructive"), foreground: c("destructive-foreground") },
        card: { DEFAULT: c("card"), foreground: c("card-foreground") },
        popover: { DEFAULT: c("popover"), foreground: c("popover-foreground") },
        // Semáforo y acentos del diseño
        success: { DEFAULT: c("success"), soft: c("success-soft") },
        warning: { DEFAULT: c("warning"), soft: c("warning-soft") },
        critical: { DEFAULT: c("critical"), soft: c("critical-soft") },
        sky: { DEFAULT: c("sky"), soft: c("sky-soft") },
        map: { DEFAULT: c("map"), hover: c("map-hover"), stroke: c("map-stroke") },
        // Nombres cortos que ya usaban los gráficos
        good: c("success"),
        warn: c("warning"),
        bad: c("critical"),
        info: c("sky"),
        chart: { 1: c("chart-1"), 2: c("chart-2"), 3: c("chart-3"), 4: c("chart-4"), 5: c("chart-5") },
        // Paleta del dominio: verde (cultivo), tierra (suelo), azul (agua)
        cultivo: { 50: "#f0f7f1", 100: "#dcecdf", 500: "#3f8a52", 600: "#2f6f40", 700: "#255833", 900: "#16351f" },
        tierra: { 50: "#faf6f0", 100: "#f1e7d8", 300: "#d6b98f", 500: "#a87a44", 600: "#8a6234", 700: "#6b4b28", 900: "#3b2a17" },
        agua: { 50: "#eef6fb", 100: "#d6e9f5", 500: "#2f7fb5", 600: "#236796", 700: "#1d5279", 900: "#11314a" },
      },
      borderRadius: {
        sm: "calc(var(--radius) - 4px)",
        md: "calc(var(--radius) - 2px)",
        lg: "var(--radius)",
        xl: "calc(var(--radius) + 4px)",
        "2xl": "calc(var(--radius) + 8px)",
        "3xl": "calc(var(--radius) + 12px)",
      },
      boxShadow: {
        soft: "0 1px 2px color-mix(in oklab, oklch(var(--foreground)) 4%, transparent), 0 8px 24px -12px color-mix(in oklab, oklch(var(--primary)) 18%, transparent)",
        lift: "0 2px 4px color-mix(in oklab, oklch(var(--foreground)) 5%, transparent), 0 24px 48px -20px color-mix(in oklab, oklch(var(--primary)) 35%, transparent)",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
        display: ["var(--font-display)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [animate],
};

export default config;
