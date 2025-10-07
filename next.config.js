
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
}

module.exports = nextConfig
