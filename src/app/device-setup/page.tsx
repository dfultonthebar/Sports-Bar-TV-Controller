
'use client'

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/cards'
import { Button } from '@/components/ui/button'
import GlobalCacheControl from '@/components/globalcache/GlobalCacheControl'
import { IRDeviceSetup } from '@/components/ir/IRDeviceSetup'
import { 
  Radio, 
  Wifi,
  Settings,
  Info
} from 'lucide-react'

export default function DeviceSetupPage() {
  const [activeTab, setActiveTab] = useState<'global-cache' | 'ir-devices'>('global-cache')

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="container mx-auto px-4 py-8">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-slate-100 mb-2">
            Device Setup & Configuration
          </h1>
          <p className="text-slate-400 text-lg">
            Configure Global Cache IR controllers and IR-controlled devices
          </p>
        </div>

        {/* Info Card */}
        <Card className="mb-6 border-blue-500/20 bg-blue-500/10">
          <CardContent className="py-4">
            <div className="flex items-start gap-3">
              <Info className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-slate-300">
                <p className="font-semibold text-blue-400 mb-1">Device Setup Workflow:</p>
                <ol className="list-decimal list-inside space-y-1">
                  <li>
                    <span className="font-medium">Step 1:</span> Add your Global Cache iTach devices 
                    (IP2IR, WF2IR, etc.) and test connectivity
                  </li>
                  <li>
                    <span className="font-medium">Step 2:</span> Add IR-controlled devices 
                    (Cable boxes, AV receivers, etc.) and link them to Global Cache ports
                  </li>
                  <li>
                    <span className="font-medium">Step 3:</span> Download IR commands from the 
                    Global Cache database for each device
                  </li>
                  <li>
                    <span className="font-medium">Step 4:</span> Assign Global Cache ports to 
                    your IR devices and specify matrix input connections
                  </li>
                </ol>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tab Navigation */}
        <div className="mb-6 flex gap-2">
          <Button
            variant={activeTab === 'global-cache' ? 'default' : 'outline'}
            onClick={() => setActiveTab('global-cache')}
            className="flex items-center gap-2"
          >
            <Wifi className="w-4 h-4" />
            Global Cache Devices
          </Button>
          <Button
            variant={activeTab === 'ir-devices' ? 'default' : 'outline'}
            onClick={() => setActiveTab('ir-devices')}
            className="flex items-center gap-2"
          >
            <Radio className="w-4 h-4" />
            IR Controlled Devices
          </Button>
        </div>

        {/* Content */}
        <div className="space-y-6">
          {activeTab === 'global-cache' && <GlobalCacheControl />}
          {activeTab === 'ir-devices' && <IRDeviceSetup />}
        </div>

        {/* Footer */}
        <div className="mt-12 text-center text-slate-500 text-sm">
          <p>
            For support with Global Cache devices, visit{' '}
            <a 
              href="https://www.globalcache.com/support/" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-blue-400 hover:underline"
            >
              Global Cache Support
            </a>
          </p>
          <p className="mt-1">
            IR Database account required for downloading IR codes.{' '}
            <a 
              href="https://irdb.globalcache.com" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-blue-400 hover:underline"
            >
              Create account
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}
