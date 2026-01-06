
'use client'

import { useState } from 'react'
import { Zap, ArrowLeft, Info } from 'lucide-react'
import Link from 'next/link'
import SportsBarLayout from '@/components/SportsBarLayout'
import SportsBarHeader from '@/components/SportsBarHeader'
import CECControl from '@/components/CECControl'

export default function CECControlPage() {
  return (
    <SportsBarLayout>
      <SportsBarHeader
        title="CEC TV Control"
        subtitle="HDMI-CEC power and input control for TVs"
        icon={<Zap className="w-8 h-8 text-indigo-400" />}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Control Panel */}
          <div className="lg:col-span-2">
            <CECControl />
          </div>

          {/* Info Panel */}
          <div className="space-y-6">
            <div className="card p-6">
              <div className="flex items-center space-x-2 mb-4">
                <Info className="w-5 h-5 text-indigo-400" />
                <h3 className="text-lg font-semibold text-slate-100">About CEC Control</h3>
              </div>
              
              <div className="space-y-4 text-sm text-slate-300">
                <div>
                  <h4 className="font-medium text-slate-100 mb-1">What is HDMI-CEC?</h4>
                  <p className="text-slate-400">
                    HDMI-CEC allows you to control TVs over HDMI connections. With a Pulse-Eight USB CEC adapter, 
                    you can send power on/off, input switching, and volume commands directly to TVs.
                  </p>
                </div>

                <div>
                  <h4 className="font-medium text-slate-100 mb-1">Hardware Setup</h4>
                  <ol className="list-decimal list-inside space-y-1 text-slate-400">
                    <li>Connect server to Wolfpack matrix via CEC adapter</li>
                    <li>Connect CEC adapter USB to server</li>
                    <li>Configure CEC input in Matrix Control settings</li>
                    <li>Route CEC input to TV outputs as needed</li>
                  </ol>
                </div>

                <div>
                  <h4 className="font-medium text-slate-100 mb-1">Features</h4>
                  <ul className="list-disc list-inside space-y-1 text-slate-400">
                    <li>Power on/off individual TVs</li>
                    <li>Switch TV inputs remotely</li>
                    <li>Mute/unmute TV audio</li>
                    <li>Centralized TV management</li>
                  </ul>
                </div>

                <div className="bg-blue-900/30 border border-blue-700 rounded p-3">
                  <h4 className="font-medium text-blue-200 mb-1">Integration with Matrix</h4>
                  <p className="text-blue-300 text-xs">
                    Configure which Wolfpack input has the CEC adapter in the Matrix Control page. 
                    When you need to control a TV, route that input to the TV's output, then send CEC commands.
                  </p>
                </div>
              </div>
            </div>

            <div className="card p-6">
              <h3 className="text-lg font-semibold text-slate-100 mb-4">Quick Links</h3>
              <div className="space-y-2">
                <Link 
                  href="/matrix-control"
                  className="block px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-md text-slate-200 text-sm"
                >
                  Configure Matrix CEC Input
                </Link>
                <Link 
                  href="/bartender-remote"
                  className="block px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-md text-slate-200 text-sm"
                >
                  Bartender Remote (with CEC)
                </Link>
                <Link 
                  href="/tv-control"
                  className="block px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-md text-slate-200 text-sm"
                >
                  TV Control Dashboard
                </Link>
              </div>
            </div>
          </div>
        </div>
      </main>
    </SportsBarLayout>
  )
}
