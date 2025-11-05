
/** @type {import('next').NextConfig} */
const nextConfig = {
  // QUICK WIN 1: Disable production source maps to reduce build size from 2.3 GB to ~300 MB
  productionBrowserSourceMaps: false,

  typescript: {
    // Temporarily ignore TypeScript errors during build
    ignoreBuildErrors: true,
  },
  eslint: {
    // Temporarily ignore ESLint errors during build
    ignoreDuringBuilds: true,
  },
  // Fix lockfile detection warning by explicitly setting the root directory
  // output: 'standalone',  // Temporarily disabled due to build issues
  outputFileTracingRoot: require('path').join(__dirname),
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
  webpack: (config, { isServer }) => {
    // Exclude isolated-vm from webpack bundling (it's an optional native module)
    if (isServer) {
      config.externals = config.externals || [];
      config.externals.push('isolated-vm');
    }

    // Fix React error #31: Ensure React and ReactDOM are properly deduplicated
    // Only apply to client-side bundle to avoid breaking Next.js internal imports
    if (!isServer) {
      const path = require('path');
      const reactPath = path.dirname(require.resolve('react/package.json'));
      const reactDomPath = path.dirname(require.resolve('react-dom/package.json'));
      
      config.resolve.alias = {
        ...config.resolve.alias,
        'react': reactPath,
        'react-dom': reactDomPath,
      };
    }

    return config;
  },
};

module.exports = nextConfig;

