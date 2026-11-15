import type { Config } from "tailwindcss";
import animate from "tailwindcss-animate";

/** Los tokens guardan componentes oklch sueltos ("L C H"), así Tailwind puede aplicar transparencia (bg-primary/10). */
const c = (name: string) => `oklch(var(--${name}) / <alpha-value>)`;

const config: Config = {
  darkMode: "class",
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./hooks/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    container: { center: true, padding: { DEFAULT: "1rem", sm: "1.5rem" }, screens: { "2xl": "1152px" } }, // como max-w-6xl del diseño
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
        // Paleta del dominio: verde (cultivo), tierra (suelo), azul (agua).
        // Calculada desde los mismos tonos oklch del diseño (verde 155, tierra 70, cielo 245) para que combine.
        cultivo: { 50: "#edfbf1", 100: "#d5f5de", 300: "#95d6ab", 500: "#389560", 600: "#2a7449", 700: "#1e5a38", 900: "#0f2e1b" },
        tierra: { 50: "#fff5ea", 100: "#fde7cf", 300: "#e6bb8a", 500: "#a9742e", 600: "#845922", 700: "#674517", 900: "#34220b" },
        agua: { 50: "#ecf9ff", 100: "#d3efff", 300: "#92cbfb", 500: "#3786c3", 600: "#296898", 700: "#1d5178", 900: "#0e293d" },
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
