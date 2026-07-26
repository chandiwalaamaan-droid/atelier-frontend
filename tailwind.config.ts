import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#1c1320",
        plum: "#2b1a3d",
        "plum-deep": "#1e1129",
        parchment: "#f6efe3",
        gold: "#c9a227",
        rose: "#b5657a",
        void: "#0a0a0c",
        "surface-raised": "#121218",
        "surface-card": "#18181f",
      },
      fontFamily: {
        display: ["var(--font-fraunces)", "serif"],
        body: ["var(--font-inter)", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;
