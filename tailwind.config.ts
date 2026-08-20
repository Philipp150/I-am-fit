import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        paper: "#F4EFE6",
        ink: "#1C2A26",
        forest: {
          DEFAULT: "#2F5D50",
          dark: "#1F3F37",
          light: "#4C7C6C",
        },
        sage: "#A9C5B5",
        clay: "#D97657",
        sand: "#E7D7C1",
        cream: "#FFFBF4",
      },
      fontFamily: {
        display: ["var(--font-display)", "serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 18px 40px -28px rgba(31, 47, 43, 0.45)",
        soft: "0 10px 30px -20px rgba(47, 93, 80, 0.35)",
      },
    },
  },
  plugins: [],
};

export default config;
