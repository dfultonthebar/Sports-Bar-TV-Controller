import type { ReactNode } from 'react'

export const metadata = {
  title: 'SBCC Hub',
  description: 'Sports Bar Command Center — fleet monitoring',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          background: '#0b1220',
          color: '#e2e8f0',
          fontFamily: 'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
        }}
      >
        {children}
      </body>
    </html>
  )
}
