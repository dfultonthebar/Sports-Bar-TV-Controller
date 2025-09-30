
'use client'

import SportsGuide from '@/components/SportsGuide'
import { Calendar, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

export default function SportsGuidePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-orange-50 to-red-50">
      {/* Header */}
      <header className="bg-white/90 backdrop-blur-sm border-b border-slate-200/50 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <Link
                href="/"
                className="flex items-center space-x-2 px-3 py-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back</span>
              </Link>
              
              <div className="bg-gradient-to-br from-orange-500 to-red-600 rounded-xl p-2.5 shadow-lg">
                <Calendar className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900">Sports Viewing Guide</h1>
                <p className="text-sm text-slate-500">Find where to watch your favorite sports</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-6">
              {/* Time Display */}
              <div className="text-sm text-slate-500">
                {new Date().toLocaleTimeString('en-US', { 
                  hour12: true, 
                  hour: 'numeric', 
                  minute: '2-digit'
                })}
              </div>
              
              {/* Quick Actions */}
              <div className="flex items-center space-x-2">
                <Link
                  href="/remote"
                  className="inline-flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-emerald-500 to-green-600 text-white rounded-lg hover:from-emerald-600 hover:to-green-700 transition-all duration-200 shadow-md hover:shadow-lg text-sm font-medium"
                >
                  <span>TV Remote</span>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <SportsGuide />
      </main>
    </div>
  )
}
