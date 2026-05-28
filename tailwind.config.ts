import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        risk: {
          safe: "#16a34a",
          warning: "#d97706",
          danger: "#dc2626",
          unknown: "#64748b",
        },
      },
    },
  },
  plugins: [],
};

export default config;
