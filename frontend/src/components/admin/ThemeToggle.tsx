'use client';

import { ICON_BTN } from './styles';

// Dark/light toggle. Persists to localStorage['hb-theme'] and sets data-theme
// on <html>. The pre-hydration script in the layout sets the initial value to
// avoid a flash; this only handles the click.
export function ThemeToggle() {
  const toggle = () => {
    const root = document.documentElement;
    const next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    try {
      localStorage.setItem('hb-theme', next);
    } catch {}
  };
  return (
    <button className={ICON_BTN} onClick={toggle} aria-label="Toggle theme">
      {/* moon in light, sun in dark (was `.theme-btn .sun{display:none}` +
          the `[data-theme=dark]` overrides). */}
      <span className="dark:hidden">🌙</span>
      <span className="hidden dark:block">☀️</span>
    </button>
  );
}
