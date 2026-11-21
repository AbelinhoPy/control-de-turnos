import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        petroleum: {
          50: '#f0f7f9',
          100: '#d9ebef',
          200: '#b6d7df',
          300: '#87bdca',
          400: '#4fa0b1',
          500: '#1e7f94',
          600: '#146478',
          700: '#0f4f5f',
          800: '#0c3e4c',
          900: '#09313d',
          950: '#041d24',
        },
      },
    },
  },
  plugins: [],
};

export default config;
