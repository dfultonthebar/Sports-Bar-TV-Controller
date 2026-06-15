/** @type {import('next').NextConfig} */
const nextConfig = {
  // better-sqlite3 is a native module — must stay external to the server bundle
  serverExternalPackages: ['better-sqlite3'],
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: false },
}

module.exports = nextConfig
