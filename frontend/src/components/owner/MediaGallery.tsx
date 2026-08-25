'use client';

import { useRef, useState } from 'react';
import useSWR from 'swr';
import { api, fetcher } from '@/lib/api';
import { Note } from '@/components/owner/ui';
import {
  BTN_O,
  BTN_SM,
  MEDIA_ACTIONS,
  MEDIA_BADGE,
  MEDIA_DEL,
  MEDIA_GRID,
  MEDIA_LINKOUT,
  MEDIA_LINKOUT_LABEL,
  MEDIA_TILE,
  MEDIA_TILE_VIDEO,
  MEDIA_VIDEO_ADD,
  MEDIA_VIDEO_FALLBACK,
  SKEL,
} from '@/components/owner/styles';
import { apiErrorMessage } from '@/lib/owner/format';

/** Small grey caption (was owner.css `.t2`). */
const T2 = 'text-[12px] text-muted';
const BTN_OS = `${BTN_O} ${BTN_SM}`;

export type VideoProvider =
  | 'youtube'
  | 'vimeo'
  | 'google_drive'
  | 'facebook'
  | 'instagram';

export interface MediaItem {
  id: string;
  cabinId: string | null;
  kind: 'image' | 'video';
  storageKey: string | null;
  /** Video: canonical provider URL. Image: the served image URL. */
  url: string;
  videoProvider: VideoProvider | null;
  /** Video: official embed URL for a sandboxed iframe, or null (link-out). */
  embedUrl: string | null;
  sortOrder: number;
}

/** Videos per gallery (boat and cabin alike) — mirrors the backend cap. */
export const MAX_VIDEOS = 5;

const PROVIDER_LABEL: Record<VideoProvider, string> = {
  youtube: 'YouTube',
  vimeo: 'Vimeo',
  google_drive: 'Google Drive',
  facebook: 'Facebook',
  instagram: 'Instagram',
};

/** YouTube thumbnail for a link-out tile (only YouTube exposes a clean one). */
function youtubeThumb(url: string): string | null {
  const m = url.match(/[?&]v=([\w-]{11})/) ?? url.match(/youtu\.be\/([\w-]{11})/);
  return m ? `https://img.youtube.com/vi/${m[1]}/mqdefault.jpg` : null;
}

/**
 * Upload one image to a boat/cabin gallery. Multipart — the shared axios
 * instance sets the boundary and attaches CSRF automatically.
 */
export async function uploadMediaImage(
  houseboatId: string,
  file: File,
  cabinId?: string,
): Promise<void> {
  const form = new FormData();
  form.append('file', file);
  if (cabinId) form.append('cabinId', cabinId);
  await api.post(`/houseboats/${houseboatId}/media/images`, form);
}

/**
 * Boat logo — a single square image (backend crops to 512×512 WebP) shown as a
 * circle. Separate from the gallery: it lives on `Houseboat.logoStorageKey`, not
 * in the media list. `logoUrl` seeds the preview; `onChange` refetches after a
 * mutation.
 */
export function BoatLogo({
  houseboatId,
  logoUrl,
  onChange,
}: {
  houseboatId: string;
  logoUrl: string | null;
  onChange: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function upload(file: File) {
    setErr(null);
    setBusy(true);
    try {
      const form = new FormData();
      form.append('file', file);
      await api.post(`/houseboats/${houseboatId}/media/logo`, form);
      onChange();
    } catch (e) {
      setErr(apiErrorMessage(e, 'Could not upload logo'));
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  async function remove() {
    setErr(null);
    setBusy(true);
    try {
      await api.delete(`/houseboats/${houseboatId}/media/logo`);
      onChange();
    } catch (e) {
      setErr(apiErrorMessage(e, 'Could not remove logo'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <div
          aria-hidden
          style={{
            width: 96,
            height: 96,
            borderRadius: '50%',
            overflow: 'hidden',
            flexShrink: 0,
            background: 'var(--surface-2, #eee)',
            display: 'grid',
            placeItems: 'center',
          }}
        >
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoUrl}
              alt="Boat logo"
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            <span className={T2}>No logo</span>
          )}
        </div>
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void upload(f);
            }}
          />
          <button
            type="button"
            className={BTN_OS}
            disabled={busy}
            onClick={() => inputRef.current?.click()}
          >
            {busy ? 'Working…' : logoUrl ? 'Replace' : 'Upload logo'}
          </button>
          {logoUrl ? (
            <button
              type="button"
              className={BTN_OS}
              disabled={busy}
              onClick={() => void remove()}
            >
              Remove
            </button>
          ) : null}
        </div>
      </div>
      {err ? <Note kind="danger">{err}</Note> : null}
    </div>
  );
}

/**
 * In-memory image queue for the add-cabin flow, where no cabinId exists yet.
 * Holds Files locally with object-URL previews; the parent uploads them after
 * the cabin is created. Enforces `max` in the UI.
 */
export function MediaQueue({
  files,
  onChange,
  max,
}: {
  files: File[];
  onChange: (next: File[]) => void;
  max: number;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const remaining = Math.max(0, max - files.length);
  const atCap = remaining === 0;

  function add(list: FileList | null) {
    if (!list) return;
    const chosen = Array.from(list)
      .filter((f) => f.type.startsWith('image/'))
      .slice(0, remaining);
    onChange([...files, ...chosen]);
    if (fileRef.current) fileRef.current.value = '';
  }

  return (
    <div className="flex flex-col gap-3">
      {files.length > 0 ? (
        <div className={MEDIA_GRID}>
          {files.map((f, i) => {
            const url = URL.createObjectURL(f);
            return (
              <div key={i} className={MEDIA_TILE}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="" onLoad={() => URL.revokeObjectURL(url)} />
                <button
                  type="button"
                  className={MEDIA_DEL}
                  title="Remove image"
                  aria-label="Remove image"
                  onClick={() => onChange(files.filter((_, idx) => idx !== i))}
                >
                  ✕
                </button>
              </div>
            );
          })}
        </div>
      ) : null}

      <div className={MEDIA_ACTIONS}>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => add(e.target.files)}
        />
        <button
          type="button"
          className={BTN_OS}
          disabled={atCap}
          onClick={() => fileRef.current?.click()}
        >
          {atCap ? `Maximum ${max} images` : '＋ Add images'}
        </button>
        <span className={T2}>
          {files.length}/{max} images · uploaded after the cabin is created
        </span>
      </div>
    </div>
  );
}

/**
 * Live boat/cabin gallery: thumbnails with corner-✕ delete, a multi-file image
 * uploader, and a YouTube-URL add box. Enforces `max` images in the UI (the
 * backend is the backstop). Pass `cabinId` for a cabin gallery; omit for boat.
 */
export function MediaGallery({
  houseboatId,
  cabinId,
  max,
}: {
  houseboatId: string;
  cabinId?: string;
  max: number;
}) {
  const key = `/houseboats/${houseboatId}/media${cabinId ? `?cabinId=${cabinId}` : ''}`;
  const { data, mutate, isLoading } = useSWR<MediaItem[]>(key, fetcher, {
    revalidateOnFocus: false,
  });

  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState('');

  const items = data ?? [];
  const images = items.filter((m) => m.kind === 'image');
  const videos = items.filter((m) => m.kind === 'video');
  const remaining = Math.max(0, max - images.length);
  const atCap = remaining === 0;
  const videosAtCap = videos.length >= MAX_VIDEOS;

  async function onFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError(null);
    setBusy(true);
    // Only upload up to the remaining slots; the rest are dropped with a note.
    const chosen = Array.from(files).slice(0, remaining);
    const dropped = files.length - chosen.length;
    try {
      for (const file of chosen) {
        await uploadMediaImage(houseboatId, file, cabinId);
      }
      if (dropped > 0) {
        setError(`Only ${chosen.length} added — this gallery holds ${max} images.`);
      }
      await mutate();
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not upload that image.'));
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function addVideo() {
    const url = videoUrl.trim();
    if (!url || busy) return;
    setError(null);
    setBusy(true);
    try {
      await api.post(`/houseboats/${houseboatId}/media/videos`, {
        videoUrl: url,
        ...(cabinId ? { cabinId } : {}),
      });
      setVideoUrl('');
      await mutate();
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not add that video.'));
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    setError(null);
    try {
      await api.delete(`/houseboats/${houseboatId}/media/${id}`);
      await mutate();
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not remove that.'));
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {error ? <Note kind="danger">{error}</Note> : null}

      {isLoading ? (
        <div className={MEDIA_GRID}>
          {[0, 1, 2].map((i) => (
            <div key={i} className={`${MEDIA_TILE} ${SKEL} aspect-square h-auto`} />
          ))}
        </div>
      ) : items.length === 0 ? (
        <Note kind="info">No photos or video yet — add some so guests can see the boat.</Note>
      ) : (
        <div className={MEDIA_GRID}>
          {images.map((m) => (
            <div key={m.id} className={MEDIA_TILE}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={m.url} alt="" loading="lazy" />
              <button
                type="button"
                className={MEDIA_DEL}
                title="Remove image"
                aria-label="Remove image"
                onClick={() => remove(m.id)}
              >
                ✕
              </button>
            </div>
          ))}
          {videos.map((m) => {
            const label = m.videoProvider ? PROVIDER_LABEL[m.videoProvider] : 'Video';
            const thumb = m.videoProvider === 'youtube' ? youtubeThumb(m.url) : null;
            return (
              <div key={m.id} className={`${MEDIA_TILE} ${MEDIA_TILE_VIDEO}`}>
                {m.embedUrl ? (
                  <iframe
                    src={m.embedUrl}
                    title={`${label} video`}
                    loading="lazy"
                    allow="accelerometer; encrypted-media; picture-in-picture"
                    referrerPolicy="strict-origin-when-cross-origin"
                    sandbox="allow-scripts allow-same-origin allow-presentation allow-popups"
                  />
                ) : (
                  // Providers we don't inline-embed (Instagram/Facebook): a
                  // link-out card that opens the canonical URL in a new tab.
                  <a
                    className={MEDIA_LINKOUT}
                    href={m.url}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                  >
                    {thumb ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={thumb} alt="" loading="lazy" />
                    ) : (
                      <div className={MEDIA_VIDEO_FALLBACK}>▶</div>
                    )}
                    <span className={MEDIA_LINKOUT_LABEL}>Open on {label} ↗</span>
                  </a>
                )}
                <span className={MEDIA_BADGE}>{label}</span>
                <button
                  type="button"
                  className={MEDIA_DEL}
                  title="Remove video"
                  aria-label="Remove video"
                  onClick={() => remove(m.id)}
                >
                  ✕
                </button>
              </div>
            );
          })}
        </div>
      )}

      <div className={MEDIA_ACTIONS}>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => onFiles(e.target.files)}
        />
        <button
          type="button"
          className={BTN_OS}
          disabled={busy || atCap}
          onClick={() => fileRef.current?.click()}
        >
          {busy ? 'Uploading…' : atCap ? `Maximum ${max} images` : '＋ Add images'}
        </button>
        <span className={T2}>
          {images.length}/{max} images
        </span>
      </div>

      <div className={MEDIA_VIDEO_ADD}>
        <input
          value={videoUrl}
          onChange={(e) => setVideoUrl(e.target.value)}
          placeholder="Paste a YouTube, Vimeo, Google Drive, Facebook or Instagram video link"
          disabled={videosAtCap}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              void addVideo();
            }
          }}
        />
        <button
          type="button"
          className={BTN_OS}
          disabled={busy || videosAtCap || !videoUrl.trim()}
          onClick={() => void addVideo()}
        >
          {videosAtCap ? `Max ${MAX_VIDEOS} videos` : 'Add video'}
        </button>
      </div>
      <span className={T2}>
        {videos.length}/{MAX_VIDEOS} videos · YouTube, Vimeo &amp; Drive play inline;
        Facebook &amp; Instagram open in a new tab.
      </span>
    </div>
  );
}
