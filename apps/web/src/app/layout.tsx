
import './globals.css'
import { Inter } from 'next/font/google'
import { ErrorHandler } from './error-handler'
import { ClientLayout } from '@/components/ClientLayout'
import type { Metadata, Viewport } from 'next'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Sports Bar TV Controller',
  description: 'Professional TV and audio control system for sports bars',
  manifest: '/manifest.json',
  themeColor: '#7c3aed',
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
