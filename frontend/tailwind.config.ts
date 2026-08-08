import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        /* Editorial light palette shared by landing, auth and workspace */
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
