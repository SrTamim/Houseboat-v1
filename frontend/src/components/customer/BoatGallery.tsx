'use client';

import { useState } from 'react';
import { PhotoLightbox } from './PhotoLightbox';

/**
 * Boat photo mosaic (design: haorboat-boat.html `.gallery`, CSS 86–91,
 * markup 552–556): one tall lead photo spanning both rows on the left, two
 * stacked on the right, the last carrying a `+N photos` scrim. Clicking
 * anywhere opens the full set in the shared lightbox (preview line 1065).
 *
 * Takes exactly the photo list the caller resolved (real uploads, or the
 * deterministic Unsplash fallback) so this component never has to know where
 * the images came from.
 */
export function BoatGallery({
  photos,
  boatName,
}: {
  photos: string[];
  boatName: string;
}) {
  const [openAt, setOpenAt] = useState<number | null>(null);

  // The mosaic always draws three cells; with fewer photos the tiles repeat
  // rather than collapsing the grid, keeping the preview's 340px block intact.
  const tiles = [0, 1, 2].map((i) => photos[i] ?? photos[i % photos.length]);
  const extra = photos.length - 3;

  return (
    <>
      <div className="grid h-[340px] grid-cols-[2fr_1fr] grid-rows-2 gap-2 overflow-hidden rounded-2xl max-[640px]:h-60 max-[940px]:h-[300px]">
        {tiles.map((src, i) => (
          <button
            key={`${src}-${i}`}
            type="button"
            onClick={() => setOpenAt(i)}
            aria-label={
              i === 2 && extra > 0
                ? `View all ${photos.length} photos`
                : `View photo ${i + 1}`
            }
            className={`group relative overflow-hidden bg-chip ${
              i === 0 ? 'row-span-2' : ''
            }`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt={i === 0 ? boatName : ''}
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
            {i === 2 && extra > 0 ? (
              <span className="absolute inset-0 grid place-items-center bg-[rgba(15,36,64,.55)] text-[15px] font-extrabold text-white">
                +{extra} photos
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {openAt !== null ? (
        <PhotoLightbox
          photos={photos}
          title={`${boatName} · photos`}
          index={openAt}
          onIndexChange={setOpenAt}
          onClose={() => setOpenAt(null)}
        />
      ) : null}
    </>
  );
}
