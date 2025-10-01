
'use client'

import React from 'react'
import SportsBarLayout from '@/components/SportsBarLayout'
import SportsBarHeader from '@/components/SportsBarHeader'
import SoundtrackConfiguration from '@/components/SoundtrackConfiguration'
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
        subtitle="Configure music streaming and bartender controls"
        icon={<Music className="w-8 h-8 text-purple-400" />}
        actions={headerActions}
      />
      
      <SoundtrackConfiguration />
    </SportsBarLayout>
  )
}
