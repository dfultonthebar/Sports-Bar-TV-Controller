'use client'

import { useAtlasMetersSSE, dbToPercent, getMeterColor } from '@/hooks/useAtlasMetersSSE'
import { Volume2, VolumeX, Activity, Wifi, WifiOff } from 'lucide-react'

interface AtlasRealtimeMetersProps {
  processorIp: string
  showInputs?: boolean
  showOutputs?: boolean
  showGroups?: boolean
  compact?: boolean
}

/**
 * Real-time audio meter display using SSE streaming
 *
 * Updates at ~20 FPS for smooth, responsive meter visualization.
 * Much faster than the old HTTP polling approach.
 */
export default function AtlasRealtimeMeters({
  processorIp,
  showInputs = false,
  showOutputs = true,
  showGroups = false,
  compact = false
}: AtlasRealtimeMetersProps) {
  const { outputs, inputs, groups, connected, error, timestamp } = useAtlasMetersSSE(processorIp)

  // Calculate time since last update for staleness indicator
  const timeSinceUpdate = Date.now() - timestamp
  const isStale = timeSinceUpdate > 1000 // More than 1 second old

  return (
    <div className="space-y-4">
      {/* Connection Status */}
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          {connected ? (
            <>
              <Wifi className="w-3 h-3 text-green-400" />
              <span className="text-green-400">Live</span>
            </>
          ) : (
            <>
              <WifiOff className="w-3 h-3 text-red-400" />
              <span className="text-red-400">{error || 'Disconnected'}</span>
            </>
          )}
        </div>
        {connected && !isStale && (
          <div className="flex items-center gap-1 text-slate-500">
            <Activity className="w-3 h-3 animate-pulse" />
            <span>20 FPS</span>
          </div>
        )}
      </div>

      {/* Output Meters (Zones) */}
      {showOutputs && outputs.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-slate-300 flex items-center gap-2">
            <Volume2 className="w-4 h-4" />
            Zone Output Levels
          </h4>
          <div className={compact ? "grid grid-cols-4 gap-2" : "space-y-1"}>
            {outputs.map((meter, i) => (
              <MeterBar
                key={`output-${i}`}
                name={meter.name}
                level={meter.level}
                muted={meter.muted}
                compact={compact}
              />
            ))}
          </div>
        </div>
      )}

      {/* Input Meters (Sources) */}
      {showInputs && inputs.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-slate-300 flex items-center gap-2">
            <Activity className="w-4 h-4" />
            Source Input Levels
          </h4>
          <div className={compact ? "grid grid-cols-4 gap-2" : "space-y-1"}>
            {inputs.map((meter, i) => (
              <MeterBar
                key={`input-${i}`}
                name={meter.name}
                level={meter.level}
                compact={compact}
              />
            ))}
          </div>
        </div>
      )}

      {/* Group Meters */}
      {showGroups && groups.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-slate-300">Group Levels</h4>
          <div className={compact ? "grid grid-cols-4 gap-2" : "space-y-1"}>
            {groups.map((meter, i) => (
              <MeterBar
                key={`group-${i}`}
                name={meter.name}
                level={meter.level}
                compact={compact}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

interface MeterBarProps {
  name: string
  level: number
  muted?: boolean
  compact?: boolean
}

function MeterBar({ name, level, muted = false, compact = false }: MeterBarProps) {
  const percent = dbToPercent(level)
  const color = getMeterColor(level)
  const isClipping = level > -3

  if (compact) {
    return (
      <div className="relative">
        <div className="text-[10px] text-slate-400 truncate mb-0.5">{name}</div>
        <div className="h-2 bg-slate-800 rounded-full overflow-hidden relative">
          <div
            className="h-full transition-all duration-[50ms] ease-out rounded-full"
            style={{
              width: `${percent}%`,
              backgroundColor: muted ? 'rgb(100, 116, 139)' : color
            }}
          />
          {isClipping && !muted && (
            <div className="absolute right-0 top-0 h-full w-1 bg-red-500 animate-pulse" />
          )}
        </div>
        {muted && (
          <VolumeX className="absolute right-0 top-0 w-3 h-3 text-red-400" />
        )}
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <div className="w-20 text-xs text-slate-400 truncate flex items-center gap-1">
        {muted && <VolumeX className="w-3 h-3 text-red-400 flex-shrink-0" />}
        <span className={muted ? 'text-slate-500' : ''}>{name}</span>
      </div>
      <div className="flex-1 h-3 bg-slate-800 rounded-full overflow-hidden relative">
        <div
          className="h-full transition-all duration-[50ms] ease-out rounded-full"
          style={{
            width: `${percent}%`,
            backgroundColor: muted ? 'rgb(100, 116, 139)' : color
          }}
        />
        {isClipping && !muted && (
          <div className="absolute right-0 top-0 h-full w-1 bg-red-500 animate-pulse" />
        )}
      </div>
      <div className="w-12 text-right text-xs font-mono text-slate-500">
        {level > -80 ? `${level.toFixed(0)} dB` : '-∞'}
      </div>
    </div>
  )
}
