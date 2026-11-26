/** @type {import('next').NextConfig} */
const cspDirectives = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://static.cloudflareinsights.com https://*.cloudflareinsights.com https://cloudflareinsights.com",
  "script-src-elem 'self' 'unsafe-inline' https://static.cloudflareinsights.com https://*.cloudflareinsights.com https://cloudflareinsights.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://*.tile.openstreetmap.org https://tile.openstreetmap.org https://*.basemaps.cartocdn.com https://basemaps.cartocdn.com https://server.arcgisonline.com https://services.arcgisonline.com https://*.arcgisonline.com https://gis.bnpb.go.id https://*.tile.opentopomap.org https://flagcdn.com https://*.tile.stamen.com https://*.stadiamaps.com https://purecatamphetamine.github.io https://*.inaturalist.org https://static.inaturalist.org https://inaturalist-open-data.s3.amazonaws.com https://*.gbif.org https://inaturalist-open-data.s3.amazonaws.com",
  "font-src 'self' data:",
  "connect-src 'self' data: blob: https://*.tile.openstreetmap.org https://tile.openstreetmap.org https://*.basemaps.cartocdn.com https://basemaps.cartocdn.com https://server.arcgisonline.com https://services.arcgisonline.com https://*.arcgisonline.com https://gis.bnpb.go.id https://*.tile.opentopomap.org https://cloudflareinsights.com https://*.cloudflareinsights.com https://static.cloudflareinsights.com https://sipkk-new.mediaciptainformasi.co.id https://opsroom.sipongidata.my.id https://router.project-osrm.org https://nominatim.openstreetmap.org https://api.gbif.org https://api.inaturalist.org",
  "worker-src 'self' blob:",
  "child-src 'self' blob: https://app.heygen.com https://www.heygen.com",
  "frame-src 'self' https://lookerstudio.google.com https://datastudio.google.com https://app.heygen.com https://www.heygen.com",
  "frame-ancestors 'self'",
].join('; ');

// Base path and backend URL come from env.
const backend = process.env.BACKEND_INTERNAL_URL;
if (backend) {
  console.info(`[puskris] Backend API proxy enabled -> ${backend}`);
}

const nextConfig = {
  output: process.env.VERCEL ? undefined : 'standalone',
  basePath: process.env.NEXT_PUBLIC_BASE_PATH || '',
  assetPrefix: process.env.NEXT_PUBLIC_ASSET_PREFIX || undefined,
  experimental: {
    proxyTimeout: 90_000,
  },
  images: {
    unoptimized: true,
  },
  // GeoJSON kab/kota dibaca di server untuk memetakan kode kab/kota API Peta Risiko PIE ke kode Kemendagri.
  outputFileTracingIncludes: {
    '/api/puskris/live/[sumber]': ['./public/data/indonesia-kabupaten.geojson'],
  },
  async headers() {
    return [{ source: '/:path*', headers: [{ key: 'Content-Security-Policy', value: cspDirectives }] }];
  },
  async redirects() {
    const bp = process.env.NEXT_PUBLIC_BASE_PATH || '';
    if (!bp) return [];
    return [
      // PR 037: redirect bare root '/' (e.g. localhost:3200/) to basePath landing page (/skdr)
      { source: '/', destination: bp, basePath: false, permanent: false },
    ];
  },
  async rewrites() {
    if (!backend) return [];
    return [
      { source: '/api/v1/:path*', destination: `${backend}/api/v1/:path*` },
      { source: '/api/auth/:path*', destination: `${backend}/api/auth/:path*` },
    ];
  },
};

export default nextConfig;
