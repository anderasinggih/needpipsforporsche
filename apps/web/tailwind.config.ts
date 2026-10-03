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
        background: "#000000",
        surface: "#0A0A0A",
        border: "#171717",
        electric: {
          DEFAULT: "#00FF66",
          glow: "#00FF6633",
          dim: "#00CC52",
          dark: "#003314",
        },
      },
    },
  },
  plugins: [],
};
export default config;
