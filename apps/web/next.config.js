// next-pwa removed in v2.54.34 (was disabled via `disable: true`, paying
// full workbox vuln surface for zero benefit). If PWA support is needed
// in the future, prefer @serwist/next (modern Workbox successor, Next 16
// + Turbopack compatible). v2.54.34 commit history has the full archived
// runtimeCaching config inline if reference is ever needed.
//
// /manifest.json in apps/web/src/app/layout.tsx is a plain static web app
// manifest at apps/web/public/manifest.json and does NOT depend on next-pwa.

/** @type {import('next').NextConfig} */
const nextConfig = {
  // QUICK WIN 1: Disable production source maps to reduce build size from 2.3 GB to ~300 MB
  productionBrowserSourceMaps: false,

  typescript: {
    // Temporarily ignore TypeScript errors during build
    ignoreBuildErrors: true,
  },
  // Note: eslint config removed in Next.js 16 - run ESLint separately
  // Fix lockfile detection warning by explicitly setting the root directory
  // output: 'standalone',  // Temporarily disabled due to build issues
  // Point to monorepo root for proper file tracing in turborepo
  outputFileTracingRoot: require('path').join(__dirname, '../../'),
  images: {
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '3001',
        pathname: '/uploads/**',
      },
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '',
        pathname: '/uploads/**',
      },
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
    // Use unoptimized images to avoid validation issues with local uploads
    unoptimized: true,
  },
  // Sports Guide admin consolidation (v2.4.0 Phase C)
  // Redirect old admin URLs to the corresponding tab on the consolidated
  // /sports-guide-admin page. Old page files remain on disk until Phase D
  // deletes them after the trial period.
  async redirects() {
    return [
      { source: '/sports-guide',        destination: '/sports-guide-admin?tab=guide',         permanent: false },
      { source: '/sports-guide-config', destination: '/sports-guide-admin?tab=configuration', permanent: false },
      { source: '/ai-gameplan',         destination: '/sports-guide-admin?tab=schedule',      permanent: false },
      { source: '/scheduling',          destination: '/sports-guide-admin?tab=games',         permanent: false },
    ]
  },
  // v2.54.41 — full Turbopack migration. Dropped --webpack flag from
  // dev+build scripts. The webpack: block is gone; native-module
  // externals are handled exclusively via serverExternalPackages
  // (Next 16's universal mechanism that works for both bundlers).
  //
  // Predecessor: v2.54.36 attempted this but hit Turbopack's static
  // analyzer choking on spawn() in /api/file-system/execute/route.ts.
  // v2.54.41 deleted that dead route (zero callers anywhere) which
  // unblocks the migration.
  //
  // Defense-in-depth: list ALL native modules we touch explicitly here,
  // even ones Next's default list claims to cover (isolated-vm,
  // better-sqlite3, sharp, postcss). Empirical evidence from v2.54.36
  // Appleton incident: the default list isn't always honored.
  serverExternalPackages: [
    'isolated-vm',
    'serialport',
    '@serialport/bindings-cpp',
    'ws',
    'bufferutil',
    'utf-8-validate',
    'better-sqlite3',
    'sharp',
  ],
};

module.exports = nextConfig;

