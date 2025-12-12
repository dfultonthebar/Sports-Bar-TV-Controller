

'use client'

import { useState, useEffect } from 'react'
import { ArrowLeft, Save, Settings, Cable, Monitor, Zap } from 'lucide-react'
import Link from 'next/link'
import MatrixControl from '@/components/MatrixControl'
import SportsBarLayout from '@/components/SportsBarLayout'
import SportsBarHeader from '@/components/SportsBarHeader'

export default function MatrixControlPage() {
  return (
    <SportsBarLayout>
      <SportsBarHeader
        title="Matrix Control"
        subtitle="Video switching & routing management"
        icon={<Cable className="w-8 h-8 text-indigo-400" />}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="card p-6">
          <div className="flex items-center space-x-3 mb-6">
            <Monitor className="w-6 h-6 text-indigo-400" />
            <h2 className="text-2xl font-bold text-slate-100">Video Matrix Configuration</h2>
          </div>
          
          <MatrixControl />
        </div>
      </main>
    </SportsBarLayout>
  )
}
