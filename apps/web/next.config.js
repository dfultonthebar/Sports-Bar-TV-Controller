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
  // serverExternalPackages handles native-module bundling exclusions at the
  // top-level Next.js config. v2.54.36 trimmed this list trusting Next 16's
  // defaults to cover `isolated-vm` + others — but Appleton's auto-update
  // (2026-05-26 18:01) FAILED to build under --webpack with
  //   Module not found: ./out/isolated_vm
  //   at packages/ai-tools/node_modules/isolated-vm/isolated-vm.js
  // The webpack flag clearly does NOT honor Next's default external list
  // the same way Turbopack does. v2.54.38 puts every native module we
  // touch BACK in the explicit list (defense in depth) — the duplication
  // with Next's defaults is harmless.
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

  // Also explicitly externalize the same set in webpack — belt-and-suspenders
  // since v2.54.36's removal of this exact block is what broke Appleton.
  // Remove this block ONLY when we drop --webpack flag for Turbopack
  // (deferred — see file-system/execute spawn analyzer issue in v2.54.36).
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals = config.externals || [];
      config.externals.push(
        'isolated-vm',
        'serialport',
        '@serialport/bindings-cpp',
        'ws',
        'bufferutil',
        'utf-8-validate',
      );
    }
    return config;
  },
};

module.exports = nextConfig;

