import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#FFB340',
          strong: '#FF9F0A',
          dim: 'rgba(255, 179, 64, 0.14)',
        }
      }
    },
  },
  plugins: [],
};
export default config;
