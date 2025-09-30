
import React from 'react'
import UnifiedTVGuideViewer from '@/components/tv-guide/UnifiedTVGuideViewer'
import SportsBarLayout from '@/components/SportsBarLayout'
import SportsBarHeader from '@/components/SportsBarHeader'
import { Tv } from 'lucide-react'

export default function TVGuidePage() {
  return (
    <SportsBarLayout>
      <SportsBarHeader
        title="TV Guide"
        subtitle="Unified programming guide from all sources"
        icon={<Tv className="w-8 h-8 text-blue-400" />}
      />
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-7xl mx-auto">
          <UnifiedTVGuideViewer />
        </div>
      </div>
    </SportsBarLayout>
  )
}
