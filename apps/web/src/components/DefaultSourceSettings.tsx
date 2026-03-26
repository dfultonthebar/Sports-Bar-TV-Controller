'use client'

/**
 * Default Source Settings Component
 *
 * Configures default sources for TV outputs when no games are scheduled.
 * Supports global defaults, per-room defaults, and per-output overrides.
 *
 * Designed for the Schedule tab, iPad-friendly with generous touch targets.
 * Follows the dark theme styling conventions (no white backgrounds).
 */

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@sports-bar/ui-utils'
import {
  Tv,
  Monitor,
  Save,
  Loader2,
  RefreshCw,
  Play,
  CheckCircle2,
  AlertTriangle,
  Settings2,
  Layers,
  Globe,
} from 'lucide-react'

// --- Types ---

interface SourceConfig {
  inputNumber: number
  inputLabel?: string
  channelNumber?: string
}

interface DefaultSourcesConfig {
  globalDefault?: SourceConfig
  roomDefaults?: Record<string, SourceConfig>
  outputDefaults?: Record<string, SourceConfig>
}

interface MatrixInput {
  id: string
  channelNumber: number
  label: string
  inputType: string
  deviceType: string
  isActive: boolean
}

interface MatrixOutput {
  id: string
  channelNumber: number
  label: string
  isActive: boolean
  tvGroupId?: string | null
}

interface ApplyResult {
  outputNum: number
  outputLabel: string
  inputNumber: number
  inputLabel?: string
  status: 'routed' | 'skipped_allocated' | 'skipped_no_default' | 'failed'
  error?: string
}

// Value used to indicate "no override / inherit from parent"
const INHERIT_VALUE = '__inherit__'
// Value used to indicate "no source / none configured"
const NONE_VALUE = '__none__'

export default function DefaultSourceSettings() {
  const [config, setConfig] = useState<DefaultSourcesConfig>({})
  const [inputs, setInputs] = useState<MatrixInput[]>([])
  const [outputs, setOutputs] = useState<MatrixOutput[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [applying, setApplying] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [applyResults, setApplyResults] = useState<ApplyResult[] | null>(null)
  const [hasChanges, setHasChanges] = useState(false)

  // --- Data Loading ---

  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const [defaultsRes, inputsRes] = await Promise.all([
        fetch('/api/settings/default-sources'),
        fetch('/api/matrix/inputs'),
      ])

      if (!defaultsRes.ok) throw new Error('Failed to load default source settings')
      if (!inputsRes.ok) throw new Error('Failed to load matrix inputs')

      const defaultsData = await defaultsRes.json()
      const inputsData = await inputsRes.json()

      setConfig(defaultsData.defaults || {})
      setInputs((inputsData.inputs || []).filter((i: MatrixInput) => i.isActive))

      // Also load outputs to display per-output settings
      const outputsRes = await fetch('/api/matrix/outputs')
      if (outputsRes.ok) {
        const outputsData = await outputsRes.json()
        setOutputs((outputsData.outputs || []).filter((o: MatrixOutput) => o.isActive))
      }

      setHasChanges(false)
    } catch (err: any) {
      console.error('Error loading default source settings:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  // --- Helpers ---

  function getInputLabel(inputNumber: number): string {
    const input = inputs.find((i) => i.channelNumber === inputNumber)
    return input ? input.label : `Input ${inputNumber}`
  }

  /** Get distinct rooms from outputs that have tvGroupId set */
  function getRooms(): Array<{ id: string; name: string; outputCount: number }> {
    const roomMap = new Map<string, number>()
    for (const output of outputs) {
      if (output.tvGroupId) {
        roomMap.set(output.tvGroupId, (roomMap.get(output.tvGroupId) || 0) + 1)
      }
    }
    return Array.from(roomMap.entries())
      .map(([id, count]) => ({
        id,
        name: id.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
        outputCount: count,
      }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }

  /** Convert a select value to a SourceConfig or undefined */
  function selectValueToSource(value: string): SourceConfig | undefined {
    if (value === NONE_VALUE || value === INHERIT_VALUE) return undefined
    const inputNum = parseInt(value, 10)
    if (isNaN(inputNum)) return undefined
    return {
      inputNumber: inputNum,
      inputLabel: getInputLabel(inputNum),
    }
  }

  /** Get the current select value for a SourceConfig */
  function sourceToSelectValue(source: SourceConfig | undefined): string {
    if (!source) return NONE_VALUE
    return String(source.inputNumber)
  }

  // --- Config Updates ---

  function updateGlobalDefault(value: string) {
    const source = selectValueToSource(value)
    setConfig((prev) => ({ ...prev, globalDefault: source }))
    setHasChanges(true)
    setSuccess(null)
  }

  function updateRoomDefault(roomId: string, value: string) {
    setConfig((prev) => {
      const roomDefaults = { ...(prev.roomDefaults || {}) }
      if (value === INHERIT_VALUE || value === NONE_VALUE) {
        delete roomDefaults[roomId]
      } else {
        const source = selectValueToSource(value)
        if (source) roomDefaults[roomId] = source
      }
      return { ...prev, roomDefaults }
    })
    setHasChanges(true)
    setSuccess(null)
  }

  function updateOutputDefault(outputNum: number, value: string) {
    setConfig((prev) => {
      const outputDefaults = { ...(prev.outputDefaults || {}) }
      const key = String(outputNum)
      if (value === INHERIT_VALUE || value === NONE_VALUE) {
        delete outputDefaults[key]
      } else {
        const source = selectValueToSource(value)
        if (source) outputDefaults[key] = source
      }
      return { ...prev, outputDefaults }
    })
    setHasChanges(true)
    setSuccess(null)
  }

  // --- Save ---

  async function handleSave() {
    try {
      setSaving(true)
      setError(null)
      setSuccess(null)

      const res = await fetch('/api/settings/default-sources', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      })

      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to save')
      }

      setConfig(data.defaults || config)
      setHasChanges(false)
      setSuccess('Default source configuration saved successfully')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  // --- Apply Now ---

  async function handleApplyNow() {
    try {
      setApplying(true)
      setError(null)
      setSuccess(null)
      setApplyResults(null)

      // Save first if there are unsaved changes
      if (hasChanges) {
        const saveRes = await fetch('/api/settings/default-sources', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(config),
        })
        const saveData = await saveRes.json()
        if (!saveRes.ok || !saveData.success) {
          throw new Error(saveData.error || 'Failed to save before applying')
        }
        setHasChanges(false)
      }

      const res = await fetch('/api/settings/default-sources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })

      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to apply defaults')
      }

      setApplyResults(data.results || [])
      setSuccess(data.message)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setApplying(false)
    }
  }

  // --- Input Selector Component ---

  function InputSelector({
    value,
    onChange,
    allowInherit = false,
    inheritLabel = 'Use global default',
  }: {
    value: string
    onChange: (value: string) => void
    allowInherit?: boolean
    inheritLabel?: string
  }) {
    return (
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="bg-slate-800 border-slate-600 min-h-[44px] text-sm">
          <SelectValue placeholder="Select default source..." />
        </SelectTrigger>
        <SelectContent className="bg-slate-800 border-slate-600">
          {allowInherit && (
            <SelectItem value={INHERIT_VALUE} className="min-h-[44px] text-sm">
              {inheritLabel}
            </SelectItem>
          )}
          <SelectItem value={NONE_VALUE} className="min-h-[44px] text-sm text-slate-400">
            No default configured
          </SelectItem>
          {inputs.map((input) => (
            <SelectItem
              key={input.channelNumber}
              value={String(input.channelNumber)}
              className="min-h-[44px] text-sm"
            >
              <span className="flex items-center gap-2">
                <span className="text-slate-400 font-mono text-xs w-6 text-right">
                  {input.channelNumber}
                </span>
                <span>{input.label}</span>
                <Badge
                  variant="outline"
                  className="text-[10px] px-1.5 py-0 border-slate-600 text-slate-400"
                >
                  {input.deviceType}
                </Badge>
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    )
  }

  // --- Render ---

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 gap-3 text-slate-400">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span>Loading default source settings...</span>
      </div>
    )
  }

  const rooms = getRooms()

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Settings2 className="h-5 w-5 text-blue-400" />
          <h3 className="text-lg font-semibold text-white">Default Source Configuration</h3>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="border-slate-600 hover:bg-slate-700 min-h-[44px] px-4"
            onClick={loadData}
            disabled={loading}
          >
            <RefreshCw className={cn('h-4 w-4 mr-2', loading && 'animate-spin')} />
            Refresh
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="border-slate-600 hover:bg-slate-700 min-h-[44px] px-4"
            onClick={handleSave}
            disabled={saving || !hasChanges}
          >
            {saving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            {hasChanges ? 'Save Changes' : 'Saved'}
          </Button>
          <Button
            size="sm"
            className="bg-green-600 hover:bg-green-700 text-white min-h-[44px] px-4"
            onClick={handleApplyNow}
            disabled={applying}
          >
            {applying ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Play className="h-4 w-4 mr-2" />
            )}
            Apply Defaults Now
          </Button>
        </div>
      </div>

      {/* Status Messages */}
      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-950/30 p-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
          <p className="text-sm text-red-300">{error}</p>
        </div>
      )}
      {success && (
        <div className="rounded-lg border border-green-500/30 bg-green-950/30 p-4 flex items-start gap-3">
          <CheckCircle2 className="h-5 w-5 text-green-400 shrink-0 mt-0.5" />
          <p className="text-sm text-green-300">{success}</p>
        </div>
      )}

      {/* Description */}
      <div className="rounded-lg border border-slate-700 bg-slate-800/30 p-4">
        <p className="text-sm text-slate-400">
          Configure what each TV shows when no game is scheduled. Set a global default for all TVs,
          override by room/zone, or set individual TV overrides. Priority: Output override &gt; Room
          override &gt; Global default.
        </p>
      </div>

      {/* Global Default */}
      <div className="rounded-lg border border-slate-700 p-6">
        <h4 className="text-base font-semibold text-white flex items-center gap-2 mb-4">
          <Globe className="h-5 w-5 text-blue-400" />
          Global Default
        </h4>
        <p className="text-sm text-slate-400 mb-3">
          All TVs without a room or output override will use this source.
        </p>
        <div className="max-w-md">
          <InputSelector
            value={sourceToSelectValue(config.globalDefault)}
            onChange={updateGlobalDefault}
          />
        </div>
        {config.globalDefault && (
          <p className="text-xs text-slate-500 mt-2">
            Currently: Input {config.globalDefault.inputNumber} &mdash;{' '}
            {config.globalDefault.inputLabel || getInputLabel(config.globalDefault.inputNumber)}
          </p>
        )}
      </div>

      {/* Room Defaults */}
      {rooms.length > 0 && (
        <div className="rounded-lg border border-slate-700 p-6">
          <h4 className="text-base font-semibold text-white flex items-center gap-2 mb-4">
            <Layers className="h-5 w-5 text-purple-400" />
            Room / Zone Defaults
          </h4>
          <p className="text-sm text-slate-400 mb-4">
            Override the global default for specific rooms or zones.
          </p>
          <div className="space-y-4">
            {rooms.map((room) => {
              const currentVal =
                config.roomDefaults && config.roomDefaults[room.id]
                  ? sourceToSelectValue(config.roomDefaults[room.id])
                  : INHERIT_VALUE
              return (
                <div key={room.id} className="flex items-center gap-4 flex-wrap">
                  <div className="w-48 shrink-0">
                    <span className="text-sm font-medium text-white">{room.name}</span>
                    <span className="text-xs text-slate-500 ml-2">
                      ({room.outputCount} TV{room.outputCount !== 1 ? 's' : ''})
                    </span>
                  </div>
                  <div className="flex-1 min-w-[250px] max-w-md">
                    <InputSelector
                      value={currentVal}
                      onChange={(v) => updateRoomDefault(room.id, v)}
                      allowInherit
                      inheritLabel="Use global default"
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Per-Output Defaults */}
      <div className="rounded-lg border border-slate-700 p-6">
        <h4 className="text-base font-semibold text-white flex items-center gap-2 mb-4">
          <Monitor className="h-5 w-5 text-cyan-400" />
          Individual TV Overrides
        </h4>
        <p className="text-sm text-slate-400 mb-4">
          Override the default for specific TVs. Only TVs with overrides are shown; select a TV
          below to add one.
        </p>

        {/* Existing overrides */}
        {config.outputDefaults && Object.keys(config.outputDefaults).length > 0 && (
          <div className="space-y-3 mb-6">
            {Object.entries(config.outputDefaults)
              .sort(([a], [b]) => parseInt(a) - parseInt(b))
              .map(([outputKey, source]) => {
                const outputNum = parseInt(outputKey)
                const output = outputs.find((o) => o.channelNumber === outputNum)
                return (
                  <div key={outputKey} className="flex items-center gap-4 flex-wrap">
                    <div className="w-48 shrink-0 flex items-center gap-2">
                      <Tv className="h-4 w-4 text-slate-500" />
                      <span className="text-sm font-medium text-white">
                        {output ? output.label : `Output ${outputNum}`}
                      </span>
                    </div>
                    <div className="flex-1 min-w-[250px] max-w-md">
                      <InputSelector
                        value={sourceToSelectValue(source)}
                        onChange={(v) => updateOutputDefault(outputNum, v)}
                        allowInherit
                        inheritLabel="Remove override"
                      />
                    </div>
                  </div>
                )
              })}
          </div>
        )}

        {/* Add override selector */}
        <div className="rounded-lg bg-slate-800/50 p-4">
          <label className="text-xs font-medium text-slate-400 block mb-2">
            Add TV Override
          </label>
          <Select
            onValueChange={(value) => {
              const outputNum = parseInt(value)
              if (!isNaN(outputNum)) {
                // Set to global default initially, or first input
                const defaultInput = config.globalDefault?.inputNumber || inputs[0]?.channelNumber
                if (defaultInput) {
                  updateOutputDefault(outputNum, String(defaultInput))
                }
              }
            }}
          >
            <SelectTrigger className="bg-slate-800 border-slate-600 min-h-[44px] text-sm max-w-md">
              <SelectValue placeholder="Select a TV to add an override..." />
            </SelectTrigger>
            <SelectContent className="bg-slate-800 border-slate-600 max-h-[300px]">
              {outputs
                .filter(
                  (o) =>
                    !config.outputDefaults ||
                    !config.outputDefaults[String(o.channelNumber)]
                )
                .map((output) => (
                  <SelectItem
                    key={output.channelNumber}
                    value={String(output.channelNumber)}
                    className="min-h-[44px] text-sm"
                  >
                    <span className="flex items-center gap-2">
                      <span className="text-slate-400 font-mono text-xs w-6 text-right">
                        {output.channelNumber}
                      </span>
                      <span>{output.label}</span>
                      {output.tvGroupId && (
                        <Badge
                          variant="outline"
                          className="text-[10px] px-1.5 py-0 border-slate-600 text-slate-400"
                        >
                          {output.tvGroupId}
                        </Badge>
                      )}
                    </span>
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Apply Results */}
      {applyResults && applyResults.length > 0 && (
        <div className="rounded-lg border border-slate-700 p-6">
          <h4 className="text-base font-semibold text-white flex items-center gap-2 mb-4">
            <CheckCircle2 className="h-5 w-5 text-green-400" />
            Apply Results
          </h4>

          {/* Summary stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            <div className="rounded-lg bg-green-500/10 p-3 text-center">
              <p className="text-xl font-bold text-green-400">
                {applyResults.filter((r) => r.status === 'routed').length}
              </p>
              <p className="text-xs text-slate-400">Routed</p>
            </div>
            <div className="rounded-lg bg-blue-500/10 p-3 text-center">
              <p className="text-xl font-bold text-blue-400">
                {applyResults.filter((r) => r.status === 'skipped_allocated').length}
              </p>
              <p className="text-xs text-slate-400">Games Active</p>
            </div>
            <div className="rounded-lg bg-slate-500/10 p-3 text-center">
              <p className="text-xl font-bold text-slate-400">
                {applyResults.filter((r) => r.status === 'skipped_no_default').length}
              </p>
              <p className="text-xs text-slate-400">No Default</p>
            </div>
            <div className="rounded-lg bg-red-500/10 p-3 text-center">
              <p className="text-xl font-bold text-red-400">
                {applyResults.filter((r) => r.status === 'failed').length}
              </p>
              <p className="text-xs text-slate-400">Failed</p>
            </div>
          </div>

          {/* Detailed results table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-800">
                <tr>
                  <th className="text-left p-3 text-slate-300 font-medium">Output</th>
                  <th className="text-left p-3 text-slate-300 font-medium">Source</th>
                  <th className="text-left p-3 text-slate-300 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {applyResults.map((result, idx) => (
                  <tr
                    key={result.outputNum}
                    className={idx % 2 === 0 ? 'bg-slate-800/30' : 'bg-slate-800/50'}
                  >
                    <td className="p-3 text-white">
                      <span className="font-mono text-xs text-slate-400 mr-2">
                        {result.outputNum}
                      </span>
                      {result.outputLabel}
                    </td>
                    <td className="p-3 text-slate-300">
                      {result.status === 'routed' || result.status === 'failed'
                        ? `Input ${result.inputNumber} - ${result.inputLabel || '?'}`
                        : '-'}
                    </td>
                    <td className="p-3">
                      {result.status === 'routed' && (
                        <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                          Routed
                        </Badge>
                      )}
                      {result.status === 'skipped_allocated' && (
                        <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">
                          Game Active
                        </Badge>
                      )}
                      {result.status === 'skipped_no_default' && (
                        <Badge className="bg-slate-500/20 text-slate-400 border-slate-500/30">
                          No Default
                        </Badge>
                      )}
                      {result.status === 'failed' && (
                        <Badge className="bg-red-500/20 text-red-400 border-red-500/30">
                          Failed: {result.error}
                        </Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
