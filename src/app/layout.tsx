
import './globals.css'
import { Inter } from 'next/font/google'
import { ErrorHandler } from './error-handler'

const inter = Inter({ subsets: ['latin'] })

export const metadata = {
  title: 'Sports Bar AI Assistant',
  description: 'AI-powered assistant for sports bar AV system management',
  icons: {
    icon: '/favicon.svg',
  },
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
        {children}
      </body>
    </html>
  )
}
