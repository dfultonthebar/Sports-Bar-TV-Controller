const path = require('path')

/** @type {import('next').NextConfig} */
const nextConfig = {
  // self-contained server bundle so the hub VM needs no monorepo / npm ci
  output: 'standalone',
  // trace workspace deps from the repo root (monorepo)
  outputFileTracingRoot: path.join(__dirname, '../../'),
  // better-sqlite3 is a native module — must stay external to the server bundle
  serverExternalPackages: ['better-sqlite3'],
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: false },
}

module.exports = nextConfig
