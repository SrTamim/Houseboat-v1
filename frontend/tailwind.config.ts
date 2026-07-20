import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-dm-sans)', 'DM Sans', 'system-ui', 'sans-serif'],
        bangla: ['var(--font-hind-siliguri)', 'Hind Siliguri', 'sans-serif'],
        mono: ['var(--font-roboto-mono)', 'monospace'],
      },
      colors: {
        // Placeholder brand palette — swap for real brand later.
        water: {
          50: '#eff9fb',
          100: '#d6eff4',
          500: '#0e94ad',
          600: '#0b7b90',
          700: '#0a6376',
        },
      },
    },
  },
  plugins: [],
};

export default config;
