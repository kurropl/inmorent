import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        score: {
          high: "#22c55e",
          mid: "#eab308",
          low: "#ef4444",
        },
      },
    },
  },
  plugins: [],
};

export default config;
