import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#080b16",
        panel: "#101526",
        line: "rgba(148, 163, 184, 0.14)",
        primary: {
          50: "#eef5ff",
          100: "#dbe8ff",
          200: "#bcd3ff",
          300: "#9dbcff",
          400: "#7aa7ff",
          500: "#4e7dff",
          600: "#315fe8",
          700: "#2249b8",
          900: "#15275f",
          950: "#0d1738",
        },
        /* Landing (editorial light) palette */
        cream: "#F7F5EF",
        sand: "#ECE7DC",
        carbon: "#111110",
        accent: {
          100: "#FFE6DC",
          400: "#FF7A4D",
          500: "#F04E23",
          600: "#C93A14",
        },
      },
      boxShadow: {
        glow: "0 0 60px rgba(78, 125, 255, 0.16)",
        hard: "5px 5px 0 0 #111110",
        "hard-accent": "5px 5px 0 0 #F04E23",
        lift: "0 30px 70px -35px rgba(17, 17, 16, 0.45)",
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["'Be Vietnam Pro'", "Inter", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      keyframes: {
        marquee: {
          from: { transform: "translateX(0)" },
          to: { transform: "translateX(-50%)" },
        },
      },
      animation: {
        marquee: "marquee 28s linear infinite",
      },
    },
  },
  plugins: [],
} satisfies Config;
