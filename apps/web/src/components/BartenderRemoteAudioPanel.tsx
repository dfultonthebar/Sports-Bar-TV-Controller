'use client'

import { useState, useEffect } from 'react'
import { Volume2, Activity, ChevronDown, ChevronUp, Speaker, Mic } from 'lucide-react'
import { Switch } from './ui/switch'
import AtlasGroupsControl from './AtlasGroupsControl'
import WolfpackMatrixOutputControl from './WolfpackMatrixOutputControl'
import AtlasRealtimeMeters from './AtlasRealtimeMeters'

// LocalStorage keys for persisting meter toggle settings
const METERS_OUTPUT_KEY = 'bartender-audio-meters-output-enabled'
const METERS_INPUT_KEY = 'bartender-audio-meters-input-enabled'

interface BartenderRemoteAudioPanelProps {
  processorIp: string
  processorId?: string
  showZoneControls?: boolean
  zoneControlsComponent?: React.ReactNode
  showMeters?: boolean
}

export default function BartenderRemoteAudioPanel({
  processorIp,
  processorId,
  showZoneControls = true,
  zoneControlsComponent,
  showMeters = true
}: BartenderRemoteAudioPanelProps) {
  const [metersExpanded, setMetersExpanded] = useState(true)
  const [outputMetersEnabled, setOutputMetersEnabled] = useState(true)
  const [inputMetersEnabled, setInputMetersEnabled] = useState(true)

  // Load saved meter toggle preferences from localStorage
  useEffect(() => {
    const savedOutput = localStorage.getItem(METERS_OUTPUT_KEY)
    const savedInput = localStorage.getItem(METERS_INPUT_KEY)
    if (savedOutput !== null) setOutputMetersEnabled(savedOutput === 'true')
    if (savedInput !== null) setInputMetersEnabled(savedInput === 'true')
  }, [])

  // Save output meter preference
  const handleOutputToggle = (enabled: boolean) => {
    setOutputMetersEnabled(enabled)
    localStorage.setItem(METERS_OUTPUT_KEY, String(enabled))
  }

  // Save input meter preference
  const handleInputToggle = (enabled: boolean) => {
    setInputMetersEnabled(enabled)
    localStorage.setItem(METERS_INPUT_KEY, String(enabled))
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Left Side - Wolfpack Matrix Output Controls */}
      <div className="lg:col-span-1">
        <WolfpackMatrixOutputControl processorIp={processorIp} />
      </div>

      {/* Right Side - Audio Controls */}
      <div className="lg:col-span-2 space-y-4">
        {/* Real-time Audio Meters */}
        {showMeters && (
          <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
            <button
              onClick={() => setMetersExpanded(!metersExpanded)}
              className="w-full p-4 flex items-center justify-between hover:bg-white/5 transition-colors"
            >
              <h3 className="text-lg font-bold flex items-center bg-gradient-to-r from-green-400 via-emerald-400 to-teal-400 bg-clip-text text-transparent">
                <Activity className="mr-3 w-5 h-5 text-green-400" />
                Real-time Audio Meters
              </h3>
              {metersExpanded ? (
                <ChevronUp className="w-5 h-5 text-slate-400" />
              ) : (
                <ChevronDown className="w-5 h-5 text-slate-400" />
              )}
            </button>
            {metersExpanded && (
              <div className="px-4 pb-4 space-y-4">
                {/* Meter Toggle Controls */}
                <div className="flex flex-wrap items-center gap-4 p-3 bg-slate-800/50 rounded-lg border border-slate-700/50">
                  {/* Output Meters Toggle */}
                  <div className="flex items-center gap-2">
                    <Speaker className={`w-4 h-4 ${outputMetersEnabled ? 'text-green-400' : 'text-slate-500'}`} />
                    <span className={`text-sm font-medium ${outputMetersEnabled ? 'text-white' : 'text-slate-500'}`}>
                      Output Meters
                    </span>
                    <Switch
                      checked={outputMetersEnabled}
                      onCheckedChange={handleOutputToggle}
                    />
                  </div>

                  {/* Divider */}
                  <div className="h-6 w-px bg-slate-600" />

                  {/* Input Meters Toggle */}
                  <div className="flex items-center gap-2">
                    <Mic className={`w-4 h-4 ${inputMetersEnabled ? 'text-blue-400' : 'text-slate-500'}`} />
                    <span className={`text-sm font-medium ${inputMetersEnabled ? 'text-white' : 'text-slate-500'}`}>
                      Input Meters
                    </span>
                    <Switch
                      checked={inputMetersEnabled}
                      onCheckedChange={handleInputToggle}
                    />
                  </div>
                </div>

                {/* Show meters only if at least one is enabled */}
                {(outputMetersEnabled || inputMetersEnabled) ? (
                  <AtlasRealtimeMeters
                    processorIp={processorIp}
                    showOutputs={outputMetersEnabled}
                    showInputs={inputMetersEnabled}
                    showGroups={false}
                    compact={false}
                  />
                ) : (
                  <div className="text-center py-6 text-slate-500">
                    <Activity className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Enable output or input meters above to view audio levels</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Audio Control Panel */}
        <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl shadow-2xl p-6">
          <h3 className="text-xl font-bold mb-6 flex items-center bg-gradient-to-r from-teal-400 via-cyan-400 to-blue-400 bg-clip-text text-transparent">
            <Volume2 className="mr-3 w-6 h-6 text-teal-400" />
            Audio Control
          </h3>

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
