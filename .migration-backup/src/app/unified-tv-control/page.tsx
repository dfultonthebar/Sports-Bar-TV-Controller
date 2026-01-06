
'use client'

import SportsBarLayout from '@/components/SportsBarLayout'
import SportsBarHeader from '@/components/SportsBarHeader'
import UnifiedTVControl from '@/components/UnifiedTVControl'
import { Tv } from 'lucide-react'

export default function UnifiedTVControlPage() {
  return (
    <SportsBarLayout>
      <SportsBarHeader 
        title="Unified TV Control"
        subtitle="Advanced CEC + IR control with intelligent fallback"
        icon={<Tv className="w-6 h-6" />}
      />
      <div className="p-6">
        <UnifiedTVControl />
      </div>
    </SportsBarLayout>
  )
}
