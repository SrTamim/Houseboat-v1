/**
 * Resolve and validate the backend origin.
 *
 * This value becomes the destination of a rewrite that forwards credentialed
 * requests, so a misconfigured deploy would proxy auth cookies to whatever host
 * is named here. Fail the build instead of starting up pointed somewhere
 * unexpected.
 */
function resolveApiTarget() {
  const raw = process.env.API_PROXY_TARGET ?? 'http://localhost:4000';

  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`API_PROXY_TARGET is not a valid URL: ${raw}`);
  }

  const isLocal = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (process.env.NODE_ENV === 'production' && url.protocol !== 'https:' && !isLocal) {
    throw new Error(
      `API_PROXY_TARGET must use https in production (got ${url.protocol})`,
    );
  }
  return url.origin;
}

const API_TARGET = resolveApiTarget();

/**
 * Security headers.
 *
 * CSP is NOT here: it needs a per-request nonce, and values in this file are
 * static (identical on every response), which would make the nonce worthless.
 * It's set in middleware.ts instead. Everything below is genuinely static.
 */
const securityHeaders = [
  // Belt-and-braces with CSP frame-ancestors — an admin console must never be
  // framed (clickjacking onto destructive actions).
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), payment=()',
  },
  // 2 years + preload. Only meaningful over HTTPS; browsers ignore it on
  // plain-HTTP localhost.
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Don't advertise the framework version.
  poweredByHeader: false,
  // Proxy /api/* to the NestJS backend in dev so the browser talks to one
  // origin (cookies + CSRF stay simple). In prod, set NEXT_PUBLIC_API_URL.
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${API_TARGET}/api/:path*` }];
  },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

export default nextConfig;
