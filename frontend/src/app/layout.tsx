import type { Metadata } from 'next';
import Link from 'next/link';
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

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="font-sans">
        <header className="border-b border-water-100 bg-white">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
            <Link href="/" className="text-xl font-semibold text-water-700">
              🛥️ Houseboat
            </Link>
            <nav className="text-sm text-slate-500">Bangladesh haor cruises</nav>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
      </body>
    </html>
  );
}
