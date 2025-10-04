
/** @type {import('next').NextConfig} */
const nextConfig = {
  // appDir is now stable in Next.js 14, no longer experimental
  webpack: (config, { isServer }) => {
    // Externalize puppeteer and related packages to avoid webpack bundling issues
    if (isServer) {
      config.externals = [
        ...config.externals,
        'puppeteer',
        'puppeteer-core',
        'puppeteer-extra',
        'puppeteer-extra-plugin-stealth',
      ]
    }
    
    // Ignore puppeteer dynamic requires in client-side builds
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
      }
    }
    
    // Ignore specific problematic modules
    config.resolve.alias = {
      ...config.resolve.alias,
      'clone-deep': false,
    }
    
    return config
  },
}

module.exports = nextConfig
