'use client'

import { Volume2 } from 'lucide-react'
import AtlasGroupsControl from './AtlasGroupsControl'
import WolfpackMatrixOutputControl from './WolfpackMatrixOutputControl'

interface BartenderRemoteAudioPanelProps {
  processorIp: string
  processorId?: string
  showZoneControls?: boolean
  zoneControlsComponent?: React.ReactNode
}

export default function BartenderRemoteAudioPanel({
  processorIp,
  processorId,
  showZoneControls = true,
  zoneControlsComponent
}: BartenderRemoteAudioPanelProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Left Side - Wolfpack Matrix Output Controls */}
      <div className="lg:col-span-1">
        <WolfpackMatrixOutputControl processorIp={processorIp} />
      </div>

      {/* Right Side - Audio Controls */}
      <div className="lg:col-span-2">
        <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl shadow-2xl p-6">
          <h3 className="text-xl font-bold mb-6 flex items-center bg-gradient-to-r from-teal-400 via-cyan-400 to-blue-400 bg-clip-text text-transparent">
            <Volume2 className="mr-3 w-6 h-6 text-teal-400" />
            Audio Control
          </h3>

          {/* Meters disabled - too slow to be useful */}
          <div className="w-full">
            <AtlasGroupsControl
              processorIp={processorIp}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
