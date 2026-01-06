'use client'

import { useState, useEffect } from 'react'
import { Music } from 'lucide-react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import SportsBarLayout from '@/components/SportsBarLayout'
import SportsBarHeader from '@/components/SportsBarHeader'

// Dynamic import to prevent SSR hydration errors with Tabs
const AudioControlTabs = dynamic(() => import('@/components/AudioControlTabs'), {
  ssr: false,
  loading: () => (
    <div className="card p-6">
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-teal-500 mb-4"></div>
          <p className="text-slate-300">Loading Audio Control Center...</p>
        </div>
      </div>
    </div>
  )
})

export default function AudioControlCenterPage() {
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  const headerActions = (
    <Link href="/" className="btn-secondary">
      <span>← Back to Home</span>
    </Link>
  )

  return (
    <SportsBarLayout>
      <SportsBarHeader
        title="Audio Control Center"
        subtitle="Complete audio system management - Atlas, Zones, and Soundtrack"
        icon={<Music className="w-8 h-8 text-teal-400" />}
        actions={headerActions}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {isMounted && <AudioControlTabs />}
      </main>
    </SportsBarLayout>
  )
}
