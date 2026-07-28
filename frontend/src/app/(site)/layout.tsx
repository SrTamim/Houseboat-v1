import Link from 'next/link';

// Customer-facing site chrome (Tailwind). Applies to /, /houseboat/[slug], etc.
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="font-sans">
      <header className="border-b border-water-100 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <Link href="/" className="text-xl font-semibold text-water-700">
            🛥️ Houseboat
          </Link>
          <nav className="text-sm text-slate-500">Bangladesh haor cruises</nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}
