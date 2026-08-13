import type { Metadata } from 'next';
import { THEME_SCRIPT } from '@/lib/theme-script';
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

export const metadata: Metadata = {
  title: 'HaorBoat — Book a houseboat on Bangladesh’s haors',
  description:
    'Book houseboats on Tanguar Haor, Nikli Haor, Padma River and more. Real-time cabin availability, honest ৳ pricing, instant confirmation.',
};

/**
 * Applies to every customer route: public funnel (/, /search, /boat/[slug],
 * /checkout, /booking/*) AND the gated account area (/account/*).
 *
 * THEME_SCRIPT is reused verbatim (its CSP hash is allowlisted in middleware.ts,
 * so any variant would be blocked). No nonce — same hydration-mismatch reason as
 * owner/admin.
 */
export default function CustomerRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      {children}
    </>
  );
}
