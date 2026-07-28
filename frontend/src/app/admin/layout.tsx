import type { Metadata } from 'next';
// Self-hosted admin fonts (Inter + Space Grotesk Variable) — matches the approved preview.
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import '@fontsource/inter/800.css';
import '@fontsource/inter/900.css';
import '@fontsource-variable/space-grotesk';
import './admin.css';

export const metadata: Metadata = {
  title: 'HaorBoat Admin',
};

// Sets the persisted theme before paint to avoid a light/dark flash.
const themeScript = `(function(){try{var t=localStorage.getItem('hb-theme')||(matchMedia('(prefers-color-scheme:dark)').matches?'dark':'light');document.documentElement.setAttribute('data-theme',t);}catch(e){document.documentElement.setAttribute('data-theme','light');}})();`;

// Applies to every /admin/* route (console pages AND the bare login).
export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      {children}
    </>
  );
}
