
'use client'

import React from 'react'
import SportsBarLayout from '@/components/SportsBarLayout'
import SportsBarHeader from '@/components/SportsBarHeader'
import SoundtrackControl from '@/components/SoundtrackControl'
import { Music } from 'lucide-react'
import Link from 'next/link'

export default function SoundtrackPage() {
  const headerActions = (
    <Link href="/" className="btn-secondary">
      <span>← Back to Home</span>
    </Link>
  )

  return (
    <SportsBarLayout>
      <SportsBarHeader
        title="Soundtrack Your Brand"
        subtitle="Professional music streaming for your venue"
        icon={<Music className="w-8 h-8 text-purple-400" />}
        actions={headerActions}
      />
      
      <div className="space-y-6 p-6">
        {/* Main Control */}
        <SoundtrackControl zoneName="Main Audio System" />

        {/* Zone Controls Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <SoundtrackControl zoneId="mainbar" zoneName="Main Bar" compact />
          <SoundtrackControl zoneId="pavilion" zoneName="Pavilion" compact />
          <SoundtrackControl zoneId="partyroom" zoneName="Party Room" compact />
          <SoundtrackControl zoneId="upstairs" zoneName="Upstairs" compact />
          <SoundtrackControl zoneId="patio" zoneName="Patio" compact />
        </div>
      </div>
    </SportsBarLayout>
  )
}
