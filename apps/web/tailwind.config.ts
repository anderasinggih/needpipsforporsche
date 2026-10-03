import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        background: "#090A0F",
        surface: "#12141C",
        border: "#1E2230",
        porsche: {
          gold: "#D4AF37",
          green: "#10B981",
          red: "#EF4444",
          muted: "#94A3B8"
        }
      },
    },
  },
  plugins: [],
};
export default config;
