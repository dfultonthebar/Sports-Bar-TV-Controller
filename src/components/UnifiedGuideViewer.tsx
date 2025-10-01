

'use client'

import { useState, useEffect } from 'react'
import { 
  Calendar,
  Clock,
  Tv,
  Satellite,
  MonitorPlay,
  Play,
  Radio,
  RefreshCw,
  Filter,
  Search,
  Star,
  TrendingUp,
  Grid,
  List,
  Eye,
  CheckCircle,
  AlertCircle,
  Zap,
  Target
} from 'lucide-react'

interface Program {
  id: string
  source: string
  deviceId: string
  deviceName: string
  deviceType: 'directv' | 'firetv'
  channel?: string
  channelName?: string
  appName?: string
  title: string
  description: string
  startTime: string
  endTime: string
  duration: number
  category: string
  rating?: string
  isHD?: boolean
  isNew?: boolean
  isLive?: boolean
  priority?: number
  timeUntilStart?: number
  matrixInput?: number
  streamingService?: string
  recordable?: boolean
}

interface UnifiedGuideData {
  lastUpdated: string
  timeRange: { start: string, end: string }
  devices: Record<string, any>
  programs: Program[]
  summary: {
    totalDevices: number
    totalPrograms: number
    directvDevices: number
    firetvDevices: number
    successfulFetches: number
    failedFetches: number
    programsByCategory: Record<string, number>
    programsBySource: Record<string, number>
  }
}

interface UnifiedGuideViewerProps {
  devices?: any[]
  autoRefresh?: boolean
  refreshInterval?: number
}

export default function UnifiedGuideViewer({ 
  devices = [], 
  autoRefresh = false, 
  refreshInterval = 300000 // 5 minutes
}: UnifiedGuideViewerProps) {
  const [guideData, setGuideData] = useState<UnifiedGuideData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastFetch, setLastFetch] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'grid' | 'list' | 'timeline'>('grid')
  const [filterCategory, setFilterCategory] = useState<string>('All')
  const [filterDevice, setFilterDevice] = useState<string>('All')
  const [searchQuery, setSearchQuery] = useState('')
  const [showLiveOnly, setShowLiveOnly] = useState(false)

  // Auto-refresh functionality
  useEffect(() => {
    if (autoRefresh && refreshInterval > 0) {
      const interval = setInterval(fetchGuideData, refreshInterval)
      return () => clearInterval(interval)
    }
  }, [autoRefresh, refreshInterval])

  // Load cached data on mount
  useEffect(() => {
    loadCachedData()
  }, [])

  const loadCachedData = async () => {
    try {
      const response = await fetch('/api/unified-guide?action=cache')
      const result = await response.json()
      
      if (result.success && result.data.programs) {
        setGuideData(result.data)
        setLastFetch(result.data.lastUpdated || 'Never')
      }
    } catch (error) {
      console.warn('No cached guide data available')
    }
  }

  const fetchGuideData = async () => {
    if (devices.length === 0) {
      setError('No devices configured for guide data fetching')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/unified-guide', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceList: devices,
          timeRange: {
            start: new Date().toISOString(),
            end: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 hours
          }
        })
      })

      const result = await response.json()
      
      if (result.success) {
        setGuideData(result.data)
        setLastFetch(new Date().toLocaleString())
        console.log(`✅ Fetched guide data: ${result.data.summary.totalPrograms} programs from ${result.data.summary.successfulFetches} devices`)
      } else {
        setError(result.error || 'Failed to fetch guide data')
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Network error')
    } finally {
      setLoading(false)
    }
  }

  const getFilteredPrograms = () => {
    if (!guideData?.programs) return []
    
    return guideData.programs.filter(program => {
      // Category filter
      if (filterCategory !== 'All' && program.category !== filterCategory) return false
      
      // Device filter
      if (filterDevice !== 'All' && program.deviceType !== filterDevice) return false
      
      // Search filter
      if (searchQuery && !program.title.toLowerCase().includes(searchQuery.toLowerCase()) &&
          !program.description.toLowerCase().includes(searchQuery.toLowerCase())) return false
          
      // Live only filter
      if (showLiveOnly && !program.isLive) return false
      
      return true
    })
  }

  const formatTime = (timeString: string) => {
    return new Date(timeString).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    })
  }

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`
  }

  const getDeviceIcon = (deviceType: string) => {
    switch (deviceType) {
      case 'directv': return <Satellite className="w-4 h-4 text-blue-600" />
      case 'firetv': return <MonitorPlay className="w-4 h-4 text-orange-600" />
      default: return <Tv className="w-4 h-4 text-gray-600" />
    }
  }

  const getPriorityColor = (priority: number = 1) => {
    if (priority >= 7) return 'bg-red-100 text-red-800'
    if (priority >= 4) return 'bg-yellow-100 text-yellow-800'
    return 'bg-slate-800 or bg-slate-900 text-slate-100'
  }

  const filteredPrograms = getFilteredPrograms()
  const categories = guideData ? Object.keys(guideData.summary.programsByCategory) : []

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
            <Calendar className="w-6 h-6 text-purple-600" />
            Unified TV Guide
          </h2>
          <p className="text-gray-600 mt-1">
            Combined guide data from DirecTV and Fire TV devices
          </p>
        </div>
        
        <div className="flex items-center space-x-3">
          {lastFetch && (
            <div className="text-sm text-slate-400">
              Last updated: {typeof lastFetch === 'string' && lastFetch !== 'Never' 
                ? new Date(lastFetch).toLocaleString()
                : lastFetch}
            </div>
          )}
          <button
            onClick={fetchGuideData}
            disabled={loading || devices.length === 0}
            className="flex items-center space-x-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh Guide</span>
          </button>
        </div>
      </div>

      {/* Summary Stats */}
      {guideData && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-slate-800 or bg-slate-900 p-4 rounded-lg border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-300">Total Programs</p>
                <p className="text-2xl font-bold text-purple-600">{guideData.summary.totalPrograms}</p>
              </div>
              <Tv className="w-8 h-8 text-purple-600" />
            </div>
          </div>
          
          <div className="bg-slate-800 or bg-slate-900 p-4 rounded-lg border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-300">Connected Devices</p>
                <p className="text-2xl font-bold text-green-600">
                  {guideData.summary.successfulFetches}/{guideData.summary.totalDevices}
                </p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
          </div>
          
          <div className="bg-slate-800 or bg-slate-900 p-4 rounded-lg border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-300">DirecTV Devices</p>
                <p className="text-2xl font-bold text-blue-600">{guideData.summary.directvDevices}</p>
              </div>
              <Satellite className="w-8 h-8 text-blue-600" />
            </div>
          </div>
          
          <div className="bg-slate-800 or bg-slate-900 p-4 rounded-lg border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-300">Fire TV Devices</p>
                <p className="text-2xl font-bold text-orange-600">{guideData.summary.firetvDevices}</p>
              </div>
              <MonitorPlay className="w-8 h-8 text-orange-600" />
            </div>
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="bg-slate-800 or bg-slate-900 p-4 rounded-lg border">
        <div className="flex flex-wrap items-center gap-4">
          {/* Search */}
          <div className="flex items-center space-x-2 flex-1 min-w-64">
            <Search className="w-4 h-4 text-slate-500" />
            <input
              type="text"
              placeholder="Search programs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 px-3 py-1 border border-slate-700 rounded focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          {/* Category Filter */}
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="px-3 py-1 border border-slate-700 rounded focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            <option value="All">All Categories</option>
            {categories.map(category => (
              <option key={category} value={category}>{category}</option>
            ))}
          </select>

          {/* Device Filter */}
          <select
            value={filterDevice}
            onChange={(e) => setFilterDevice(e.target.value)}
            className="px-3 py-1 border border-slate-700 rounded focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            <option value="All">All Devices</option>
            <option value="directv">DirecTV Only</option>
            <option value="firetv">Fire TV Only</option>
          </select>

          {/* Live Only Toggle */}
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={showLiveOnly}
              onChange={(e) => setShowLiveOnly(e.target.checked)}
              className="rounded"
            />
            <span className="text-sm">Live Only</span>
            <Radio className="w-4 h-4 text-red-600" />
          </label>

          {/* View Mode */}
          <div className="flex items-center space-x-1 border border-slate-700 rounded">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 ${viewMode === 'grid' ? 'bg-purple-100 text-purple-600' : 'hover:bg-slate-800 or bg-slate-900'}`}
            >
              <Grid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 ${viewMode === 'list' ? 'bg-purple-100 text-purple-600' : 'hover:bg-slate-800 or bg-slate-900'}`}
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="mt-2 text-sm text-slate-300">
          Showing {filteredPrograms.length} of {guideData?.summary.totalPrograms || 0} programs
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 p-4 rounded-lg">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-5 h-5 text-red-600" />
            <span className="text-red-800 font-medium">Error: {error}</span>
          </div>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-8">
          <RefreshCw className="w-8 h-8 animate-spin text-purple-600" />
          <span className="ml-2 text-gray-600">Fetching guide data...</span>
        </div>
      )}

      {/* Programs Display */}
      {!loading && filteredPrograms.length > 0 && (
        <div className={viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4' : 'space-y-3'}>
          {filteredPrograms.map((program) => (
            <div
              key={program.id}
              className={`bg-slate-800 or bg-slate-900 p-4 rounded-lg border hover:shadow-md transition-shadow ${
                viewMode === 'list' ? 'flex items-center space-x-4' : ''
              }`}
            >
              {/* Program Info */}
              <div className="flex-1">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    {getDeviceIcon(program.deviceType)}
                    <span className="font-medium text-slate-100 truncate">{program.title}</span>
                    {program.isLive && (
                      <span className="flex items-center px-2 py-1 bg-red-100 text-red-800 text-xs font-medium rounded-full">
                        <Radio className="w-3 h-3 mr-1" />
                        LIVE
                      </span>
                    )}
                    {program.isNew && (
                      <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded-full">
                        NEW
                      </span>
                    )}
                  </div>
                  {program.priority && program.priority > 3 && (
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${getPriorityColor(program.priority)}`}>
                      <Star className="w-3 h-3 inline mr-1" />
                      {program.priority}
                    </span>
                  )}
                </div>

                <p className="text-sm text-slate-300 mb-2 line-clamp-2">{program.description}</p>

                <div className="grid grid-cols-2 gap-2 text-xs text-slate-400">
                  <div className="flex items-center space-x-1">
                    <Clock className="w-3 h-3" />
                    <span>{formatTime(program.startTime)} - {formatTime(program.endTime)}</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <Target className="w-3 h-3" />
                    <span>{formatDuration(program.duration)}</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <Tv className="w-3 h-3" />
                    <span>{program.channelName || program.appName || 'Unknown'}</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <span className="w-3 h-3 rounded-full bg-gray-400"></span>
                    <span>{program.category}</span>
                  </div>
                </div>

                <div className="mt-2 flex items-center justify-between">
                  <span className="text-xs text-slate-400">{program.deviceName}</span>
                  {program.matrixInput && (
                    <span className="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded">
                      Input {program.matrixInput}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* No Data State */}
      {!loading && !error && filteredPrograms.length === 0 && (
        <div className="text-center py-12">
          <Calendar className="w-16 h-16 text-slate-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-slate-100 mb-2">No Guide Data Available</h3>
          <p className="text-gray-600 mb-6">
            {devices.length === 0 
              ? 'Configure DirecTV and Fire TV devices to get started'
              : 'Click "Refresh Guide" to fetch program data from your devices'
            }
          </p>
          {devices.length > 0 && (
            <button
              onClick={fetchGuideData}
              className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
            >
              Fetch Guide Data
            </button>
          )}
        </div>
      )}
    </div>
  )
}

