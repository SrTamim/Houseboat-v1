'use client';

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
    <button className="icon-btn theme-btn" onClick={toggle} aria-label="Toggle theme">
      <span className="moon">🌙</span>
      <span className="sun">☀️</span>
    </button>
  );
}
