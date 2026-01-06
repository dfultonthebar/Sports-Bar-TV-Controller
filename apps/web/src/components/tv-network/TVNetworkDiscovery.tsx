'use client'

import { useState, useEffect } from 'react'
import {
  Tv,
  Power,
  RefreshCw,
  Search,
  Wifi,
  CheckCircle,
  AlertCircle,
  Loader2
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/cards'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { logger } from '@sports-bar/logger'

interface NetworkTVDevice {
  id: string
  ipAddress: string
  brand: string
  model?: string
  port: number
  macAddress?: string
  status: string
  lastSeen: string
  supportsPower: boolean
  supportsVolume: boolean
  supportsInput: boolean
  createdAt: string
  updatedAt: string
}

export default function TVNetworkDiscovery() {
  const [devices, setDevices] = useState<NetworkTVDevice[]>([])
  const [isScanning, setIsScanning] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [powerLoading, setPowerLoading] = useState<string | null>(null)

  useEffect(() => {
    loadDevices()
  }, [])

  const loadDevices = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/tv-discovery/devices')

      if (response.ok) {
        const data = await response.json()
        setDevices(data.devices || [])
        logger.info('[TV-DISCOVERY] Loaded devices', { count: data.count })
      } else {
        const errorData = await response.json()
        setError(errorData.error || 'Failed to load TV devices')
      }
    } catch (err: any) {
      logger.error('[TV-DISCOVERY] Failed to load devices:', err)
      setError('Failed to connect to server')
    } finally {
      setIsLoading(false)
    }
  }

  const startNetworkScan = async () => {
    setIsScanning(true)
    setError(null)
    setSuccessMessage(null)

    try {
      // Default scan parameters matching the requirements
      const scanParams = new URLSearchParams({
        ipRange: '192.168.5.1-192.168.5.254',
        ports: '8001,8002,80,8060',
        timeout: '2000'
      })

      logger.info('[TV-DISCOVERY] Starting network scan')

      const response = await fetch(`/api/tv-discovery/scan?${scanParams}`, {
        method: 'POST'
      })

      if (response.ok) {
        const data = await response.json()
        setSuccessMessage(data.message || `Scan complete. Found ${data.devicesFound} TV(s)`)

        // Reload device list to show newly discovered TVs
        await loadDevices()

        // Auto-dismiss success message after 5 seconds
        setTimeout(() => setSuccessMessage(null), 5000)
      } else {
        const errorData = await response.json()
        setError(errorData.error || 'Network scan failed')
      }
    } catch (err: any) {
      logger.error('[TV-DISCOVERY] Scan error:', err)
      setError('Network scan failed. Check network connectivity.')
    } finally {
      setIsScanning(false)
    }
  }

  const sendPowerCommand = async (deviceId: string, action: 'on' | 'off' | 'toggle') => {
    setPowerLoading(deviceId)
    setError(null)

    try {
      const response = await fetch(`/api/tv-control/${deviceId}/power`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action })
      })

      const data = await response.json()

      if (response.ok && data.success) {
        setSuccessMessage(`Power ${action} sent to ${data.deviceBrand} TV`)
        setTimeout(() => setSuccessMessage(null), 3000)
      } else {
        setError(data.error || `Power ${action} failed`)
      }
    } catch (err: any) {
      logger.error('[TV-DISCOVERY] Power command error:', err)
      setError('Failed to send power command')
    } finally {
      setPowerLoading(null)
    }
  }

  const getBrandColor = (brand: string) => {
    switch (brand.toLowerCase()) {
      case 'roku': return 'text-purple-400'
      case 'samsung': return 'text-blue-400'
      case 'lg': return 'text-red-400'
      case 'sony': return 'text-green-400'
      case 'vizio': return 'text-orange-400'
      default: return 'text-slate-400'
    }
  }

  const getBrandBadgeColor = (brand: string) => {
    switch (brand.toLowerCase()) {
      case 'roku': return 'bg-purple-900/50 text-purple-200 border-purple-800'
      case 'samsung': return 'bg-blue-900/50 text-blue-200 border-blue-800'
      case 'lg': return 'bg-red-900/50 text-red-200 border-red-800'
      case 'sony': return 'bg-green-900/50 text-green-200 border-green-800'
      case 'vizio': return 'bg-orange-900/50 text-orange-200 border-orange-800'
      default: return 'bg-slate-900/50 text-slate-200 border-slate-800'
    }
  }

  return (
    <div className="space-y-6">
      {/* Header Controls */}
      <Card className="bg-[#1e3a5f]">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Wifi className="w-6 h-6 text-blue-400" />
              <div>
                <CardTitle className="text-white">Network TV Discovery</CardTitle>
                <CardDescription className="text-blue-200">
                  Scan your network for IP-controlled TVs and manage power settings
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button
                onClick={loadDevices}
                disabled={isLoading || isScanning}
                variant="outline"
                size="sm"
                className="flex items-center gap-2"
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <Button
                onClick={startNetworkScan}
                disabled={isScanning || isLoading}
                className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
              >
                {isScanning ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Scanning Network...
                  </>
                ) : (
                  <>
                    <Search className="w-4 h-4" />
                    Start Network Scan
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Messages */}
      {error && (
        <div className="bg-red-900/40 border border-red-500/50 rounded-lg p-4">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-400" />
            <p className="text-red-200">{error}</p>
          </div>
        </div>
      )}

      {successMessage && (
        <div className="bg-green-900/40 border border-green-500/50 rounded-lg p-4">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-400" />
            <p className="text-green-200">{successMessage}</p>
          </div>
        </div>
      )}

      {/* Scan Info */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-start gap-3 p-4 bg-blue-900/30 rounded-lg border border-blue-500/30">
            <Search className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
            <div className="space-y-2">
              <p className="text-sm text-blue-200 font-medium">
                Network Scan Configuration
              </p>
              <p className="text-sm text-blue-300">
                Scanning IP range: <code className="bg-blue-950/50 px-2 py-0.5 rounded">192.168.5.1-254</code> on ports{' '}
                <code className="bg-blue-950/50 px-2 py-0.5 rounded">8001, 8002, 80, 8060</code>
              </p>
              <p className="text-xs text-blue-400 mt-2">
                Supported: Roku (8060), Samsung (8001/8002), Generic HTTP (80)
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Discovered Devices */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Tv className="w-5 h-5 text-blue-400" />
            Discovered TVs ({devices.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading && devices.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
            </div>
          ) : devices.length === 0 ? (
            <div className="text-center py-12">
              <Wifi className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <p className="text-slate-400 text-lg font-medium">No TVs discovered yet</p>
              <p className="text-slate-500 text-sm mt-1">Click "Start Network Scan" to find TVs on your network</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {devices.map((device) => (
                <div
                  key={device.id}
                  className="border-2 border-slate-700 rounded-lg p-4 bg-slate-800/50 hover:bg-slate-800/80 transition-all"
                >
                  {/* Device Header */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Tv className={`w-5 h-5 ${getBrandColor(device.brand)}`} />
                      <Badge className={getBrandBadgeColor(device.brand)}>
                        {device.brand.toUpperCase()}
                      </Badge>
                    </div>
                    {device.status === 'online' ? (
                      <CheckCircle className="w-4 h-4 text-green-500" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-red-500" />
                    )}
                  </div>

                  {/* Device Info */}
                  <div className="space-y-2 mb-4">
                    {device.model && (
                      <p className="font-medium text-slate-100">{device.model}</p>
                    )}
                    <p className="text-sm text-slate-300 font-mono">
                      {device.ipAddress}:{device.port}
                    </p>
                    {device.macAddress && (
                      <p className="text-xs text-slate-400">MAC: {device.macAddress}</p>
                    )}
                    <div className="flex flex-wrap gap-1 mt-2">
                      {device.supportsPower && (
                        <Badge variant="outline" className="bg-green-900/30 text-green-300 border-green-700 text-xs">
                          Power Control
                        </Badge>
                      )}
                      {device.supportsVolume && (
                        <Badge variant="outline" className="bg-blue-900/30 text-blue-300 border-blue-700 text-xs">
                          Volume
                        </Badge>
                      )}
                      {device.supportsInput && (
                        <Badge variant="outline" className="bg-purple-900/30 text-purple-300 border-purple-700 text-xs">
                          Input
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Power Controls */}
                  {device.supportsPower && (
                    <div className="flex gap-2 mt-3 pt-3 border-t border-slate-700">
                      <Button
                        onClick={() => sendPowerCommand(device.id, 'on')}
                        disabled={powerLoading === device.id}
                        size="sm"
                        className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                      >
                        {powerLoading === device.id ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <>
                            <Power className="w-3 h-3 mr-1" />
                            On
                          </>
                        )}
                      </Button>
                      <Button
                        onClick={() => sendPowerCommand(device.id, 'off')}
                        disabled={powerLoading === device.id}
                        size="sm"
                        className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                      >
                        {powerLoading === device.id ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <>
                            <Power className="w-3 h-3 mr-1" />
                            Off
                          </>
                        )}
                      </Button>
                      <Button
                        onClick={() => sendPowerCommand(device.id, 'toggle')}
                        disabled={powerLoading === device.id}
                        size="sm"
                        variant="outline"
                        className="flex-1"
                      >
                        {powerLoading === device.id ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <>
                            <Power className="w-3 h-3 mr-1" />
                            Toggle
                          </>
                        )}
                      </Button>
                    </div>
                  )}

                  {/* Last Seen */}
                  <p className="text-xs text-slate-500 mt-2">
                    Last seen: {new Date(device.lastSeen).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
