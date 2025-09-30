
'use client'

import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'

interface SportsBarHeaderProps {
  title: string
  subtitle: string
  icon: React.ReactNode
  showBackButton?: boolean
  actions?: React.ReactNode
}

export default function SportsBarHeader({ 
  title, 
  subtitle, 
  icon, 
  showBackButton = true, 
  actions 
}: SportsBarHeaderProps) {
  const currentTime = new Date().toLocaleTimeString('en-US', { 
    hour12: true, 
    hour: 'numeric', 
    minute: '2-digit'
  })

  return (
    <header className="sports-header sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center space-x-4">
            {showBackButton && (
              <Link
                href="/"
                className="flex items-center space-x-2 px-3 py-2 text-slate-300 hover:text-slate-100 hover:bg-sportsBar-700/50 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back</span>
              </Link>
            )}
            
            <div className="bg-primary-gradient rounded-xl p-2.5 shadow-lg">
              {icon}
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-100">{title}</h1>
              <p className="text-sm text-slate-300">{subtitle}</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-6">
            {/* Time Display */}
            <div className="text-sm text-slate-300">
              {currentTime}
            </div>
            
            {/* Custom Actions */}
            {actions && (
              <div className="flex items-center space-x-2">
                {actions}
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
