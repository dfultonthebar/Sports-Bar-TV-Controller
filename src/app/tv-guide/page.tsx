

'use client'

import { useState, useEffect } from 'react'
import { Calendar, Settings, RefreshCw, Tv, Satellite, MonitorPlay } from 'lucide-react'
import UnifiedGuideViewer from '@/components/UnifiedGuideViewer'

export default function TVGuidePage() {
  const [devices, setDevices] = useState([])
  const [loading, setLoading] = useState(true)
  const [autoRefresh, setAutoRefresh] = useState(true)

  useEffect(() => {
    loadDevices()
  }, [])

  const loadDevices = async () => {
    setLoading(true)
    try {
      // Load DirecTV devices
      const directvResponse = await fetch('/api/directv-devices')
      const directvData = await directvResponse.json()
      const directvDevices = (directvData.devices || []).map((device: any) => ({
        ...device,
        type: 'directv'
      }))

      // Load Fire TV devices
      const firetvResponse = await fetch('/api/firetv-devices')
      const firetvData = await firetvResponse.json()
      const firetvDevices = (firetvData.devices || []).map((device: any) => ({
        ...device,
        type: 'firetv'
      }))

      const allDevices = [...directvDevices, ...firetvDevices]
      setDevices(allDevices)
      console.log(`📺 Loaded ${allDevices.length} devices for guide data`)
    } catch (error) {
      console.error('Error loading devices:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Page Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Calendar className="w-8 h-8 text-purple-600" />
            TV Guide Dashboard
          </h1>
          <p className="text-gray-600 mt-2">
            Unified program guide from all connected DirecTV and Fire TV devices
          </p>
        </div>
        
        <div className="flex items-center space-x-4">
          {/* Auto Refresh Toggle */}
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded"
            />
            <span className="text-sm">Auto-refresh</span>
            <RefreshCw className="w-4 h-4 text-purple-600" />
          </label>

          {/* Device Count */}
          <div className="flex items-center space-x-4 px-4 py-2 bg-gray-100 rounded-lg">
            <div className="flex items-center space-x-1">
              <Satellite className="w-4 h-4 text-blue-600" />
              <span className="text-sm font-medium">
                {devices.filter((d: any) => d.type === 'directv').length} DirecTV
              </span>
            </div>
            <div className="flex items-center space-x-1">
              <MonitorPlay className="w-4 h-4 text-orange-600" />
              <span className="text-sm font-medium">
                {devices.filter((d: any) => d.type === 'firetv').length} Fire TV
              </span>
            </div>
          </div>

          {/* Settings Link */}
          <a
            href="/device-config"
            className="flex items-center space-x-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
          >
            <Settings className="w-4 h-4" />
            <span>Configure Devices</span>
          </a>
        </div>
      </div>

      {/* Device Status Overview */}
      {!loading && devices.length > 0 && (
        <div className="bg-white p-6 rounded-lg border mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Connected Devices</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {devices.map((device: any) => (
              <div key={device.id} className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                {device.type === 'directv' ? (
                  <Satellite className="w-6 h-6 text-blue-600" />
                ) : (
                  <MonitorPlay className="w-6 h-6 text-orange-600" />
                )}
                <div>
                  <div className="font-medium text-gray-900">{device.name}</div>
                  <div className="text-sm text-gray-500">
                    {device.ipAddress}
                    {device.inputChannel && ` • Input ${device.inputChannel}`}
                  </div>
                </div>
                <div className={`w-3 h-3 rounded-full ${device.isOnline ? 'bg-green-500' : 'bg-gray-400'}`} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="w-8 h-8 animate-spin text-purple-600" />
          <span className="ml-2 text-gray-600">Loading devices...</span>
        </div>
      )}

      {/* No Devices State */}
      {!loading && devices.length === 0 && (
        <div className="text-center py-12">
          <Tv className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Devices Configured</h3>
          <p className="text-gray-600 mb-6">
            Configure DirecTV and Fire TV devices to view their program guides
          </p>
          <a
            href="/device-config"
            className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
          >
            Configure Devices
          </a>
        </div>
      )}

      {/* Unified Guide Viewer */}
      {!loading && devices.length > 0 && (
        <UnifiedGuideViewer 
          devices={devices}
          autoRefresh={autoRefresh}
          refreshInterval={300000} // 5 minutes
        />
      )}
    </div>
  )
}

