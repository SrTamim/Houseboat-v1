import type { Config } from 'tailwindcss';

/**
 * Customer-side design tokens are CSS variables defined in
 * src/app/(customer)/customer.css (`:root` + `:root[data-theme="dark"]`). We map
 * them here so Tailwind utilities like `bg-raise-1` / `text-ink` / `shadow-e3`
 * resolve through those vars and therefore switch automatically with the
 * `[data-theme]` toggle — no per-utility `dark:` needed for tokenised colours.
 */
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  // Dark mode is driven by <html data-theme="dark"> (set by ThemeToggle + the
  // pre-paint THEME_SCRIPT). Key `dark:` variants off that attribute.
  darkMode: ['selector', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        // brand
        blue: {
          DEFAULT: 'var(--blue)',
          600: 'var(--blue-600)',
          700: 'var(--blue-700)',
        },
        amber: { DEFAULT: 'var(--amber)', 700: 'var(--amber-700)' },
        ok: 'var(--ok)',
        warn: 'var(--warn)',
        danger: 'var(--danger)',
        // canvas / surfaces
        bg: 'var(--bg)',
        'raise-1': 'var(--raise-1)',
        'raise-2': 'var(--raise-2)',
        hair: 'var(--hair)',
        'hair-2': 'var(--hair-2)',
        ink: 'var(--ink)',
        // `body` is a Tailwind-safe token name for our --body text colour
        bodytext: 'var(--body)',
        muted: 'var(--muted)',
        chip: 'var(--chip)',
        field: 'var(--field)',
        hover: 'var(--hover)',
        // footer band
        footer: 'var(--footer)',
        'footer-txt': 'var(--footer-txt)',
        'footer-h': 'var(--footer-h)',
        'footer-mut': 'var(--footer-mut)',
        // legacy preview aliases still referenced by un-migrated pages
        surface: 'var(--surface)',
        line: 'var(--line)',
        'bg-2': 'var(--bg-2)',
        green: 'var(--green)',
        red: 'var(--red)',
        // placeholder brand palette (pre-existing; unused by customer)
        water: {
          50: '#eff9fb',
          100: '#d6eff4',
          500: '#0e94ad',
          600: '#0b7b90',
          700: '#0a6376',
        },
      },
      borderRadius: {
        sm: 'var(--r-sm)',
        DEFAULT: 'var(--r)',
        xl: 'var(--r-xl)',
        '2xl': 'var(--r-2xl)',
        lg: 'var(--r-xl)',
      },
      boxShadow: {
        e1: 'var(--e1)',
        e2: 'var(--e2)',
        e3: 'var(--e3)',
        ring: 'var(--ring)',
        'top-hi': 'var(--top-hi)',
      },
      fontFamily: {
        display: ['Space Grotesk', 'Inter', 'system-ui', 'sans-serif'],
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Hind Siliguri', 'sans-serif'],
        bangla: ['var(--font-hind-siliguri)', 'Hind Siliguri', 'sans-serif'],
        mono: ['var(--font-roboto-mono)', 'monospace'],
      },
      transitionTimingFunction: {
        ease: 'cubic-bezier(.2,.7,.3,1)',
      },
      transitionDuration: {
        dur: '220ms',
      },
      maxWidth: {
        wrap: 'var(--maxw)',
      },
      keyframes: {
        ddIn: {
          from: { opacity: '0', transform: 'translateY(-6px)' },
          to: { opacity: '1', transform: 'none' },
        },
        auroraDrift: {
          '0%': { transform: 'translate(0,0) rotate(0) scale(1)' },
          '50%': { transform: 'translate(3%,2%) rotate(8deg) scale(1.08)' },
          '100%': { transform: 'translate(0,0) rotate(0) scale(1)' },
        },
        float1: {
          '0%,100%': { transform: 'translate(0,0)' },
          '50%': { transform: 'translate(24px,-30px)' },
        },
        float2: {
          '0%,100%': { transform: 'translate(0,0)' },
          '50%': { transform: 'translate(-28px,22px)' },
        },
        float3: {
          '0%,100%': { transform: 'translate(0,0)' },
          '50%': { transform: 'translate(18px,26px)' },
        },
        heroZoom: {
          from: { transform: 'scale(1.06)' },
          to: { transform: 'scale(1)' },
        },
        mistDrift: {
          '0%': { transform: 'translateX(-8%)' },
          '100%': { transform: 'translateX(8%)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '120% 0' },
          '100%': { backgroundPosition: '-120% 0' },
        },
        wordRise: {
          to: { opacity: '1', transform: 'translateY(0) rotateX(0)' },
        },
        sheen: {
          to: { left: '160%' },
        },
        spinBorder: {
          to: { '--a': '360deg' },
        },
        pop: {
          '0%': { transform: 'scale(.6)', opacity: '0' },
          '60%': { transform: 'scale(1.1)' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        rise: {
          from: { opacity: '0', transform: 'translateY(12px)' },
          to: { opacity: '1', transform: 'none' },
        },
      },
      animation: {
        ddIn: 'ddIn .16s cubic-bezier(.2,.7,.3,1)',
        heroZoom: 'heroZoom 18s ease-out forwards',
        mistDrift: 'mistDrift 30s linear infinite',
        shimmer: 'shimmer 7s linear infinite',
        wordRise: 'wordRise .9s cubic-bezier(.2,.8,.2,1) forwards',
        spinBorder: 'spinBorder 6s linear infinite',
        pop: 'pop .5s cubic-bezier(.2,.8,.2,1) both',
        rise: 'rise .5s cubic-bezier(.2,.7,.3,1) both',
      },
    },
  },
  plugins: [],
};

export default config;
