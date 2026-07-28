'use client';

import Link from 'next/link';
import useSWR from 'swr';
import { fetcher } from '@/lib/api';
import type { HouseboatListItem } from '@/lib/types';

export default function HomePage() {
  const { data, error, isLoading } = useSWR<HouseboatListItem[]>(
    '/houseboats',
    fetcher,
  );

  return (
    <div>
      <h1 className="mb-1 text-2xl font-semibold text-slate-900">
        Live houseboats
      </h1>
      <p className="mb-6 text-sm text-slate-500">
        Vertical slice — data comes live from the NestJS API.
      </p>

      {isLoading && <p className="text-slate-500">Loading boats…</p>}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Could not reach the API. Is the backend running on :4000 and the DB
          seeded?
        </div>
      )}

      {data && data.length === 0 && (
        <p className="text-slate-500">
          No live houseboats yet. Seed the database or approve a boat.
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {data?.map((boat) => (
          <Link
            key={boat.id}
            href={`/houseboat/${boat.slug}`}
            className="block rounded-xl border border-water-100 bg-white p-5 shadow-sm transition hover:shadow-md"
          >
            <h2 className="text-lg font-semibold text-water-700">
              {boat.name}
            </h2>
            {boat.routes.length > 0 && (
              <p className="mt-1 text-xs uppercase tracking-wide text-water-500">
                {boat.routes.map((r) => r.route.name).join(' · ')}
              </p>
            )}
            <p className="mt-2 line-clamp-2 text-sm text-slate-600">
              {boat.description}
            </p>
            <p className="mt-3 text-xs text-slate-400">
              {boat._count.reviews} review
              {boat._count.reviews === 1 ? '' : 's'}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
