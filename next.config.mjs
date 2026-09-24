import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  // The landing route reads site/index.html at runtime; make sure it ships with the deployment.
  outputFileTracingIncludes: { '/': ['./site/**/*'], '/builder/[number]/opengraph-image': ['./public/assets/logo-mark.png'] },
  poweredByHeader: false,
  // this folder is the project root (there are other lockfiles higher up the disk)
  outputFileTracingRoot: root,
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
        ],
      },
      { source: '/admin/:path*', headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }] },
    ];
  },
};

export default nextConfig;
