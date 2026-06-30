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

  // Hide unconfigured/placeholder-named entries (e.g. "Group 6", "Zone 5",
  // "Source 3") — only the ones the operator actually named are real.
  const isPlaceholderName = (n: string) =>
    /^(group|zone|source|input|output) ?\d+$/i.test((n || '').trim())
  const fOutputs = outputs.filter(m => !isPlaceholderName(m.name))
  const fInputs = inputs.filter(m => !isPlaceholderName(m.name))
  const fGroups = groups.filter(m => !isPlaceholderName(m.name))
  // Groups XOR zones: a group-based location (real groups configured, e.g. the
  // Stoneyards' Bar Group/Gaming Group/Dance Floor) shows its GROUP meters, not
  // the underlying per-zone outputs. A zone-based location (no real groups)
  // shows its zone outputs.
  const groupBased = fGroups.length > 0

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
      {showOutputs && !groupBased && fOutputs.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-slate-300 flex items-center gap-2">
            <Volume2 className="w-4 h-4" />
            Zone Output Levels
          </h4>
          <div className={compact ? "grid grid-cols-4 gap-2" : "space-y-1"}>
            {fOutputs.map((meter, i) => (
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
      {showInputs && fInputs.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-slate-300 flex items-center gap-2">
            <Activity className="w-4 h-4" />
            Source Input Levels
          </h4>
          <div className={compact ? "grid grid-cols-4 gap-2" : "space-y-1"}>
            {fInputs.map((meter, i) => (
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
      {showGroups && fGroups.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-slate-300">Group Levels</h4>
          <div className={compact ? "grid grid-cols-4 gap-2" : "space-y-1"}>
            {fGroups.map((meter, i) => (
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
            className="h-full transition-all duration-50 ease-out rounded-full"
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
        {muted && <VolumeX className="w-3 h-3 text-red-400 shrink-0" />}
        <span className={muted ? 'text-slate-500' : ''}>{name}</span>
      </div>
      <div className="flex-1 h-3 bg-slate-800 rounded-full overflow-hidden relative">
        <div
          className="h-full transition-all duration-50 ease-out rounded-full"
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
