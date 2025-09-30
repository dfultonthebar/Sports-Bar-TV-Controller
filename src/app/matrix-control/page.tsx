

'use client'

import { useState, useEffect } from 'react'
import { ArrowLeft, Save, Settings, Cable, Monitor, Zap } from 'lucide-react'
import Link from 'next/link'
import MatrixControl from '@/components/MatrixControl'

export default function MatrixControlPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <header className="bg-white/90 backdrop-blur-sm border-b border-slate-200/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <Link href="/" className="p-2 rounded-lg hover:bg-slate-100 transition-colors">
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div className="bg-gradient-to-br from-indigo-600 to-purple-600 rounded-xl p-2.5 shadow-lg">
                <Cable className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900">Matrix Control</h1>
                <p className="text-sm text-slate-500">Video switching & routing management</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-6">
          <div className="flex items-center space-x-3 mb-6">
            <Monitor className="w-6 h-6 text-indigo-600" />
            <h2 className="text-2xl font-bold text-slate-900">Video Matrix Configuration</h2>
          </div>
          
          <MatrixControl />
        </div>
      </main>
    </div>
  )
}
