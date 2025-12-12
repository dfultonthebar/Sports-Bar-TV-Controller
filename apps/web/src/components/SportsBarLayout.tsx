
'use client'

interface SportsBarLayoutProps {
  children: React.ReactNode
  className?: string
}

export default function SportsBarLayout({ children, className = "" }: SportsBarLayoutProps) {
  return (
    <div className={`min-h-screen bg-sports-gradient ${className}`}>
      {children}
    </div>
  )
}
