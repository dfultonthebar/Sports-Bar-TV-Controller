'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/cards'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { logger } from '@sports-bar/logger'
import {
  Search,
  Radio,
  Star,
  Plus,
  Loader2,
  AlertCircle,
  CheckCircle2,
  TvMinimal,
  Zap
} from 'lucide-react'

interface DirecTVDevice {
  id: string
  name: string
  ipAddress: string
}

interface ChannelInfo {
  channelNumber: string
  callsign: string | null
  title: string | null
  isOffAir: boolean
  hasPreset: boolean
  presetName: string | null
}

export default function DirecTVChannelFinder() {
  const [devices, setDevices] = useState<DirecTVDevice[]>([])
  const [selectedDevice, setSelectedDevice] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [loadingDevices, setLoadingDevices] = useState(true)
  const [channels, setChannels] = useState<ChannelInfo[]>([])
  const [error, setError] = useState<string | null>(null)
  const [addingPreset, setAddingPreset] = useState<string | null>(null)

  // Range scan state
  const [startChannel, setStartChannel] = useState('1')
  const [endChannel, setEndChannel] = useState('100')

  // List scan state
  const [channelList, setChannelList] = useState('')

  // Load DirecTV devices
  useEffect(() => {
    loadDevices()
  }, [])

  const loadDevices = async () => {
    try {
      setLoadingDevices(true)
      const response = await fetch('/api/directv-devices')
      const data = await response.json()

      if (data.devices) {
        setDevices(data.devices)
        if (data.devices.length > 0) {
          setSelectedDevice(data.devices[0].id)
        }
      }
    } catch (err) {
      logger.error('[CHANNEL-FINDER] Error loading devices:', err)
      setError('Failed to load DirecTV devices')
    } finally {
      setLoadingDevices(false)
    }
  }

  const scanChannels = async (mode: 'range' | 'list' | 'sports') => {
    if (!selectedDevice) {
      setError('Please select a DirecTV device')
      return
    }

    setLoading(true)
    setError(null)
    setChannels([])

    try {
      let url = `/api/directv/scan-channels?deviceId=${selectedDevice}&mode=${mode}`

      if (mode === 'range') {
        const start = parseInt(startChannel, 10)
        const end = parseInt(endChannel, 10)

        if (isNaN(start) || isNaN(end) || start < 1 || end > 9999 || start > end) {
          setError('Invalid channel range. Start must be 1-9999 and less than or equal to end.')
          setLoading(false)
          return
        }

        url += `&start=${start}&end=${end}`
      } else if (mode === 'list') {
        if (!channelList.trim()) {
          setError('Please enter channel numbers')
          setLoading(false)
          return
        }
        url += `&channels=${encodeURIComponent(channelList)}`
      }

      const response = await fetch(url)
      const data = await response.json()

      if (data.success) {
        setChannels(data.channels || [])
      } else {
        setError(data.error || 'Failed to scan channels')
      }
    } catch (err) {
      logger.error('[CHANNEL-FINDER] Error scanning channels:', err)
      setError('Failed to scan channels')
    } finally {
      setLoading(false)
    }
  }

  const addPreset = async (channel: ChannelInfo) => {
    setAddingPreset(channel.channelNumber)
    setError(null)

    try {
      const name = channel.callsign || `Channel ${channel.channelNumber}`

      const response = await fetch('/api/channel-presets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          channelNumber: channel.channelNumber,
          deviceType: 'directv'
        })
      })

      const data = await response.json()

      if (data.success) {
        // Update local state to mark channel as having a preset
        setChannels(prev => prev.map(ch =>
          ch.channelNumber === channel.channelNumber
            ? { ...ch, hasPreset: true, presetName: name }
            : ch
        ))
      } else {
        setError(data.error || 'Failed to add preset')
      }
    } catch (err) {
      logger.error('[CHANNEL-FINDER] Error adding preset:', err)
      setError('Failed to add preset')
    } finally {
      setAddingPreset(null)
    }
  }

  const ChannelList = ({ channels }: { channels: ChannelInfo[] }) => {
    if (channels.length === 0) {
      return (
        <div className="text-center py-8 text-slate-400">
          <Radio className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>No channels found</p>
          <p className="text-sm mt-1">Try scanning a different range or mode</p>
        </div>
      )
    }

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {channels.map((channel) => (
          <div
            key={channel.channelNumber}
            className={`p-4 rounded-lg border ${
              channel.hasPreset
                ? 'bg-blue-900/20 border-blue-600/30'
                : 'bg-slate-800/50 border-slate-700/50'
            }`}
          >
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2">
                <TvMinimal className="w-4 h-4 text-blue-400" />
                <span className="font-bold text-lg text-white">
                  {channel.channelNumber}
                </span>
              </div>
              {channel.hasPreset ? (
                <Badge className="bg-blue-600/80 text-white border-blue-500">
                  <Star className="w-3 h-3 mr-1" />
                  Preset
                </Badge>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => addPreset(channel)}
                  disabled={addingPreset === channel.channelNumber}
                  className="h-7 text-xs"
                >
                  {addingPreset === channel.channelNumber ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <>
                      <Plus className="w-3 h-3 mr-1" />
                      Add
                    </>
                  )}
                </Button>
              )}
            </div>

            <div className="space-y-1">
              {channel.callsign && (
                <div className="text-sm font-semibold text-slate-200">
                  {channel.callsign}
                </div>
              )}
              {channel.title && (
                <div className="text-xs text-slate-400 line-clamp-2">
                  {channel.title}
                </div>
              )}
              {channel.hasPreset && channel.presetName && (
                <div className="text-xs text-blue-400 mt-1">
                  Saved as: {channel.presetName}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (loadingDevices) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-blue-400 mr-2" />
            <span className="text-slate-400">Loading DirecTV devices...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (devices.length === 0) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="text-center">
            <AlertCircle className="w-12 h-12 mx-auto mb-3 text-yellow-400" />
            <p className="text-slate-300 font-medium">No DirecTV devices found</p>
            <p className="text-sm text-slate-400 mt-1">
              Add a DirecTV device in the DirecTV tab first
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="w-5 h-5 text-blue-400" />
            DirecTV Channel Finder
          </CardTitle>
          <CardDescription>
            Discover sports channels you subscribe to but don't have presets for
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Device Selector */}
          <div className="mb-4">
            <Label htmlFor="device-select" className="text-sm font-medium text-slate-300">
              Select DirecTV Device
            </Label>
            <select
              id="device-select"
              value={selectedDevice}
              onChange={(e) => setSelectedDevice(e.target.value)}
              className="mt-1 w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={loading}
            >
              {devices.map((device) => (
                <option key={device.id} value={device.id}>
                  {device.name} ({device.ipAddress})
                </option>
              ))}
            </select>
          </div>

          {/* Tabs for different scan modes */}
          <Tabs defaultValue="sports" className="mt-6">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="sports" disabled={loading}>
                <Zap className="w-4 h-4 mr-2" />
                Sports Channels
              </TabsTrigger>
              <TabsTrigger value="range" disabled={loading}>
                <Search className="w-4 h-4 mr-2" />
                Scan Range
              </TabsTrigger>
              <TabsTrigger value="list" disabled={loading}>
                <Radio className="w-4 h-4 mr-2" />
                Specific Channels
              </TabsTrigger>
            </TabsList>

            <TabsContent value="sports" className="space-y-4">
              <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/50">
                <p className="text-sm text-slate-300 mb-3">
                  Scan common sports channels including ESPN, Fox Sports, NFL Network,
                  NBA TV, MLB Network, NHL Network, and regional sports networks.
                </p>
                <Button
                  onClick={() => scanChannels('sports')}
                  disabled={loading}
                  className="w-full"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Scanning...
                    </>
                  ) : (
                    <>
                      <Search className="w-4 h-4 mr-2" />
                      Scan Sports Channels
                    </>
                  )}
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="range" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="start-channel" className="text-sm font-medium text-slate-300">
                    Start Channel
                  </Label>
                  <Input
                    id="start-channel"
                    type="number"
                    min="1"
                    max="9999"
                    value={startChannel}
                    onChange={(e) => setStartChannel(e.target.value)}
                    disabled={loading}
                    className="mt-1 bg-slate-800 border-slate-700 text-white"
                  />
                </div>
                <div>
                  <Label htmlFor="end-channel" className="text-sm font-medium text-slate-300">
                    End Channel
                  </Label>
                  <Input
                    id="end-channel"
                    type="number"
                    min="1"
                    max="9999"
                    value={endChannel}
                    onChange={(e) => setEndChannel(e.target.value)}
                    disabled={loading}
                    className="mt-1 bg-slate-800 border-slate-700 text-white"
                  />
                </div>
              </div>
              <div className="text-xs text-slate-400">
                Maximum 100 channels per scan
              </div>
              <Button
                onClick={() => scanChannels('range')}
                disabled={loading}
                className="w-full"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Scanning...
                  </>
                ) : (
                  <>
                    <Search className="w-4 h-4 mr-2" />
                    Scan Range
                  </>
                )}
              </Button>
            </TabsContent>

            <TabsContent value="list" className="space-y-4">
              <div>
                <Label htmlFor="channel-list" className="text-sm font-medium text-slate-300">
                  Channel Numbers (comma-separated)
                </Label>
                <Input
                  id="channel-list"
                  type="text"
                  placeholder="206, 207, 212, 213, 215"
                  value={channelList}
                  onChange={(e) => setChannelList(e.target.value)}
                  disabled={loading}
                  className="mt-1 bg-slate-800 border-slate-700 text-white"
                />
              </div>
              <div className="text-xs text-slate-400">
                Maximum 50 channels per scan
              </div>
              <Button
                onClick={() => scanChannels('list')}
                disabled={loading}
                className="w-full"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Scanning...
                  </>
                ) : (
                  <>
                    <Search className="w-4 h-4 mr-2" />
                    Scan Channels
                  </>
                )}
              </Button>
            </TabsContent>
          </Tabs>

          {/* Error Message */}
          {error && (
            <div className="mt-4 p-3 bg-red-900/20 border border-red-600/30 rounded-lg flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-200">{error}</p>
            </div>
          )}

          {/* Success Message */}
          {!loading && channels.length > 0 && (
            <div className="mt-4 p-3 bg-green-900/20 border border-green-600/30 rounded-lg flex items-start gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-green-200">
                <p className="font-medium">Scan complete!</p>
                <p className="text-xs text-green-300 mt-1">
                  Found {channels.length} active channels.{' '}
                  {channels.filter(ch => !ch.hasPreset).length > 0 && (
                    <span>
                      {channels.filter(ch => !ch.hasPreset).length} without presets.
                    </span>
                  )}
                </p>
              </div>
            </div>
          )}

          {/* Results */}
          {!loading && channels.length > 0 && (
            <div className="mt-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-white">
                  Scan Results ({channels.length})
                </h3>
                <div className="flex gap-2">
                  <Badge variant="outline" className="text-xs">
                    {channels.filter(ch => ch.hasPreset).length} with presets
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    {channels.filter(ch => !ch.hasPreset).length} available
                  </Badge>
                </div>
              </div>
              <ChannelList channels={channels} />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
