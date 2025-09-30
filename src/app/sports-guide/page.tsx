
'use client'

import SportsGuide from '@/components/SportsGuide'
import SportsBarHeader from '@/components/SportsBarHeader'
import SportsBarLayout from '@/components/SportsBarLayout'
import { Calendar } from 'lucide-react'
import Link from 'next/link'

export default function SportsGuidePage() {
  const headerActions = (
    <Link
      href="/remote"
      className="btn-success"
    >
      <span>TV Remote</span>
    </Link>
  )

  return (
    <SportsBarLayout>
      <SportsBarHeader
        title="Sports Viewing Guide"
        subtitle="Find where to watch your favorite sports"
        icon={<Calendar className="w-6 h-6 text-white" />}
        actions={headerActions}
      />
      
      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <SportsGuide />
      </main>
    </SportsBarLayout>
  )
}
