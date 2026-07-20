'use client';

import { use } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { fetcher } from '@/lib/api';
import type { HouseboatDetail } from '@/lib/types';

export default function HouseboatDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const { data, error, isLoading } = useSWR<HouseboatDetail>(
    `/houseboats/${slug}`,
    fetcher,
  );

  if (isLoading) return <p className="text-slate-500">Loading…</p>;
  if (error || !data)
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        Boat not found.
      </div>
    );

  return (
    <article>
      <Link href="/" className="text-sm text-water-600 hover:underline">
        ← All boats
      </Link>
      <h1 className="mt-2 text-3xl font-semibold text-slate-900">
        {data.name}
      </h1>
      {data.routes.length > 0 && (
        <p className="mt-1 text-sm text-water-500">
          {data.routes
            .map((r) =>
              r.route.region
                ? `${r.route.name} (${r.route.region})`
                : r.route.name,
            )
            .join(' · ')}
        </p>
      )}
      <p className="mt-4 max-w-2xl text-slate-700">{data.description}</p>

      {data.safetyFeatures && (
        <section className="mt-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Safety
          </h2>
          <p className="mt-1 text-slate-700">{data.safetyFeatures}</p>
        </section>
      )}

      <section className="mt-8">
        <h2 className="mb-3 text-lg font-semibold text-slate-900">Cabins</h2>
        {data.decks.map((deck) => (
          <div key={deck.id} className="mb-6">
            <h3 className="mb-2 text-sm font-medium text-water-700">
              {deck.name}
            </h3>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {deck.cabins.map((cabin) => (
                <div
                  key={cabin.id}
                  className="rounded-lg border border-water-100 bg-white p-4"
                >
                  <p className="font-semibold text-slate-800">
                    Cabin {cabin.name}
                  </p>
                  <p className="text-xs text-slate-500">
                    {cabin.category.name}
                    {cabin.category.isAc ? ' · AC' : ''} · up to{' '}
                    {cabin.category.baseCapacity}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </section>
    </article>
  );
}
