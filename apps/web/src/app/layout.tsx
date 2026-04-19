
import './globals.css'
import { Inter } from 'next/font/google'
import { ErrorHandler } from './error-handler'
import { ClientLayout } from '@/components/ClientLayout'
import type { Metadata, Viewport } from 'next'

const inter = Inter({ subsets: ['latin'] })

// Location-aware browser tab title. Each location sets LOCATION_NAME in
// its own .env (per-host, gitignored). Format: "<LocationName>-Sports-Bar-
// TV-Controller" so operators with multiple locations open in browser
// tabs can tell them apart at a glance. Falls back to the plain name
// when LOCATION_NAME is unset (main branch, dev, etc.).
//
// We use generateMetadata (async, dynamic) rather than exporting a static
// `metadata` constant so the title is evaluated at REQUEST time, not
// build time. That matters because Next.js inlines process.env values at
// build time — if the build runs in a shell without LOCATION_NAME
// exported, the static path would bake "Sports Bar TV Controller" into
// the HTML regardless of what the PM2 process sees at runtime.
export async function generateMetadata(): Promise<Metadata> {
  const rawLocationName = process.env.LOCATION_NAME?.trim()
  const locationPrefix = rawLocationName ? rawLocationName.replace(/\s+/g, '-') : ''
  const tabTitle = locationPrefix
    ? `${locationPrefix}-Sports-Bar-TV-Controller`
    : 'Sports Bar TV Controller'

  return {
    title: tabTitle,
    description: 'Professional TV and audio control system for sports bars',
    manifest: '/manifest.json',
    icons: {
      icon: '/icon-192x192.png',
      apple: '/icon-192x192.png',
    },
    appleWebApp: {
      capable: true,
      statusBarStyle: 'black-translucent',
      title: 'TV Control',
    },
  }
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#7c3aed',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
      </head>
      <body className={inter.className}>
        <ErrorHandler />
        <ClientLayout>{children}</ClientLayout>
      </body>
    </html>
  )
}
