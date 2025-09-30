
'use client'

import LogAnalyticsDashboard from '@/components/LogAnalyticsDashboard'
import SportsBarHeader from '@/components/SportsBarHeader'
import SportsBarLayout from '@/components/SportsBarLayout'
import { BarChart3 } from 'lucide-react'
import Link from 'next/link'

export default function LogsPage() {
  const headerActions = (
    <Link
      href="/remote"
      className="btn-primary"
    >
      <span>TV Remote</span>
    </Link>
  )

  return (
    <SportsBarLayout>
      <SportsBarHeader
        title="System Logs & Analytics"
        subtitle="Monitor system performance and AI insights"
        icon={<BarChart3 className="w-6 h-6 text-white" />}
        actions={headerActions}
      />
      
      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <LogAnalyticsDashboard />
      </main>
    </SportsBarLayout>
  )
}
