
import React from 'react'
import UnifiedTVGuideViewer from '@/components/tv-guide/UnifiedTVGuideViewer'

export default function TVGuidePage() {
  return (
    <div className="min-h-screen bg-gray-100">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-7xl mx-auto">
          <UnifiedTVGuideViewer />
        </div>
      </div>
    </div>
  )
}
