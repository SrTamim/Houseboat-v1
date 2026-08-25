import type { Metadata } from 'next';
import { THEME_SCRIPT } from '@/lib/theme-script';
// Self-hosted owner fonts — matches the approved design preview.
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import '@fontsource/inter/800.css';
import '@fontsource/inter/900.css';
import '@fontsource-variable/space-grotesk';
import '@fontsource/hind-siliguri/400.css';
import '@fontsource/hind-siliguri/600.css';
import '@fontsource/hind-siliguri/700.css';

export const metadata: Metadata = {
  title: 'HaorBoat Owner',
};

// Applies to every /owner/* route (console pages AND the bare login/signup).
//
// THEME_SCRIPT is reused verbatim from the admin console: its CSP hash is
// allowlisted in middleware.ts, so any owner-specific variant would be blocked.
// No nonce, for the same reason as admin — a nonce here caused a hydration
// mismatch, since the server can read request headers and the client re-render
// cannot.
export default function OwnerRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      {/* Scopes the owner element defaults + token-backed canvas (see the
          `.owner-scope` rules in globals.css) to the console subtree, so they
          never touch the customer or admin surfaces. */}
      <div className="owner-scope min-h-screen">{children}</div>
    </>
  );
}
