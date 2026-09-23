import type { Metadata, Viewport } from 'next';
import { THEME_SCRIPT } from '@/lib/theme-script';
import { AuthModalProvider } from '@/components/customer/AuthModalProvider';
// Self-hosted customer fonts — matches the approved design previews.
// Space Grotesk (display) + Inter (body) + Hind Siliguri (Bangla). Loaded here,
// NOT via Google Fonts CDN, so CSP font-src 'self' is satisfied.
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
import './customer.css';
import './_home/home-effects.css';

export const metadata: Metadata = {
  title: 'HaorBoat — Book a houseboat on Bangladesh’s haors',
  description:
    'Book houseboats on Tanguar Haor, Nikli Haor, Padma River and more. Real-time cabin availability, honest ৳ pricing, instant confirmation.',
};

// Without this, the App Router does NOT emit a viewport meta tag, so phones fall
// back to a ~980px desktop viewport and every responsive breakpoint below stays
// dormant. Scoped to the customer group on purpose — admin/owner are
// desktop-only consoles and keep their current (viewport-less) rendering.
export const viewport: Viewport = { width: 'device-width', initialScale: 1 };

/**
 * Applies to every customer route: public funnel (/, /search, /boat/[slug],
 * /checkout, /booking/*) AND the gated account area (/account/*).
 *
 * THEME_SCRIPT is reused verbatim (its CSP hash is allowlisted in middleware.ts,
 * so any variant would be blocked). No nonce — same hydration-mismatch reason as
 * owner/admin.
 *
 * AuthModalProvider is the client boundary for sign-in. It wraps every customer
 * route because the modal can be opened from anywhere — the nav, the checkout
 * pay wall, the boat waitlist — and must render above whatever page is showing.
 */
export default function CustomerRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      <AuthModalProvider>{children}</AuthModalProvider>
    </>
  );
}
