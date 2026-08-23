import type { Metadata } from 'next';
import '@fontsource/dm-sans/400.css';
import '@fontsource/dm-sans/600.css';
import '@fontsource/hind-siliguri/400.css';
import '@fontsource/roboto-mono/400.css';
import './globals.css';

export const metadata: Metadata = {
  title: 'Houseboat — Book your haor cruise',
  description:
    'Book houseboats on Tanguar Haor, Nikli Haor and more. Real-time availability, instant confirmation.',
};

// Root layout is intentionally minimal so each route group owns its own chrome:
//  - (site)  → customer marketing/booking header (Tailwind)
//  - admin   → platform console shell (Tailwind; tokens in globals.css)
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
