/**
 * Allowlisted video providers. This is the ONE place that decides whether a
 * user-supplied link is an acceptable video and how it may be shown.
 *
 * Security model: we never store or render a raw user URL. Every accepted link
 * is matched against a fixed provider pattern and rebuilt from the captured id
 * into a canonical URL (for link-out) and, where the provider supports safe
 * framing, an official embed URL (for a sandboxed iframe). Anything that
 * doesn't match a provider is rejected — there is no passthrough.
 *
 * `embed: null` means "no inline iframe" — the frontend link-outs to canonical
 * in a new tab instead (Instagram/Facebook, whose framing needs their JS SDK).
 */

export type VideoProvider =
  | 'youtube'
  | 'vimeo'
  | 'google_drive'
  | 'facebook'
  | 'instagram';

export interface ResolvedVideo {
  provider: VideoProvider;
  /** Canonical https URL, rebuilt from the captured id — safe to link out to. */
  canonicalUrl: string;
  /** Official embed URL for a sandboxed iframe, or null if inline isn't safe. */
  embedUrl: string | null;
}

interface ProviderRule {
  provider: VideoProvider;
  /** Each pattern's first capture group is the resource id. */
  patterns: RegExp[];
  canonical: (id: string) => string;
  embed: ((id: string) => string) | null;
}

const RULES: ProviderRule[] = [
  {
    provider: 'youtube',
    patterns: [
      /youtube\.com\/watch\?v=([\w-]{11})/,
      /youtu\.be\/([\w-]{11})/,
      /youtube\.com\/embed\/([\w-]{11})/,
      /youtube\.com\/shorts\/([\w-]{11})/,
    ],
    canonical: (id) => `https://www.youtube.com/watch?v=${id}`,
    embed: (id) => `https://www.youtube-nocookie.com/embed/${id}`,
  },
  {
    provider: 'vimeo',
    patterns: [/vimeo\.com\/(?:video\/)?(\d{6,12})/],
    canonical: (id) => `https://vimeo.com/${id}`,
    embed: (id) => `https://player.vimeo.com/video/${id}`,
  },
  {
    provider: 'google_drive',
    // /file/d/<id>/... or ?id=<id>. Drive ids are 25+ url-safe chars.
    patterns: [
      /drive\.google\.com\/file\/d\/([\w-]{20,})/,
      /drive\.google\.com\/[^]*[?&]id=([\w-]{20,})/,
    ],
    canonical: (id) => `https://drive.google.com/file/d/${id}/view`,
    embed: (id) => `https://drive.google.com/file/d/${id}/preview`,
  },
  {
    provider: 'facebook',
    // Match a real video URL shape; store canonical, link out (no safe iframe
    // without Meta's SDK).
    patterns: [
      /facebook\.com\/[^/]+\/videos\/(\d{5,})/,
      /facebook\.com\/watch\/?\?v=(\d{5,})/,
      /fb\.watch\/([\w-]+)/,
    ],
    canonical: (id) =>
      /^\d+$/.test(id)
        ? `https://www.facebook.com/watch/?v=${id}`
        : `https://fb.watch/${id}`,
    embed: null,
  },
  {
    provider: 'instagram',
    // Reels and video posts only.
    patterns: [
      /instagram\.com\/reel\/([\w-]+)/,
      /instagram\.com\/p\/([\w-]+)/,
      /instagram\.com\/tv\/([\w-]+)/,
    ],
    canonical: (id) => `https://www.instagram.com/reel/${id}/`,
    embed: null,
  },
];

/**
 * Resolve a user-supplied URL to an allowlisted provider, or return null if it
 * matches no provider (caller rejects). Requires an https URL up front so we
 * never process javascript:, data:, or other exotic schemes.
 */
export function resolveVideoUrl(raw: string): ResolvedVideo | null {
  const url = raw.trim();
  if (!/^https:\/\//i.test(url)) return null;
  for (const rule of RULES) {
    for (const re of rule.patterns) {
      const m = url.match(re);
      if (m && m[1]) {
        return {
          provider: rule.provider,
          canonicalUrl: rule.canonical(m[1]),
          embedUrl: rule.embed ? rule.embed(m[1]) : null,
        };
      }
    }
  }
  return null;
}
