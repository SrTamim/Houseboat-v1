import type { Metadata } from 'next';
import { THEME_SCRIPT } from '@/lib/theme-script';
// Self-hosted admin fonts (Inter + Space Grotesk Variable) — matches the approved preview.
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import '@fontsource/inter/800.css';
import '@fontsource/inter/900.css';
import '@fontsource-variable/space-grotesk';

export const metadata: Metadata = {
  title: 'HaorBoat Admin',
};

// Applies to every /admin/* route (console pages AND the bare login).
//
// No nonce on the theme script: it's allowed by hash instead (see
// lib/theme-script.ts). Setting a nonce here caused a hydration mismatch —
// the server can read request headers and rendered nonce="abc…", the client
// re-render cannot and produced nonce="", so React refused to patch the tree.
export default function AdminRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      {/* Scopes the admin element defaults + token-backed canvas (see the
          `.admin-scope` rules in globals.css) to the console subtree, so they
          never touch the customer surfaces. */}
      <div className="admin-scope min-h-screen">{children}</div>
    </>
  );
}
