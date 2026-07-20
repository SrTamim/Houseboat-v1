/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Proxy /api/* to the NestJS backend in dev so the browser talks to one
  // origin (cookies + CSRF stay simple). In prod, set NEXT_PUBLIC_API_URL.
  async rewrites() {
    const api = process.env.API_PROXY_TARGET ?? 'http://localhost:4000';
    return [{ source: '/api/:path*', destination: `${api}/api/:path*` }];
  },
};

export default nextConfig;
