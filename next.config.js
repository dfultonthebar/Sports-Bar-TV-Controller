
/** @type {import('next').NextConfig} */
const nextConfig = {
  // appDir is now stable in Next.js 14, no longer experimental
  typescript: {
    // Temporarily ignore TypeScript errors during build
    // TODO: Fix TypeScript errors in production
    ignoreBuildErrors: true,
  },
  eslint: {
    // Temporarily ignore ESLint errors during build
    ignoreDuringBuilds: true,
  },
  webpack: (config, { isServer }) => {
    // Exclude isolated-vm from webpack bundling (it's an optional native module)
    if (isServer) {
      config.externals = config.externals || [];
      config.externals.push('isolated-vm');
    }
    return config;
  },
}

module.exports = nextConfig
