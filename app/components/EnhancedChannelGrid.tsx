
'use client'

import { useState, useEffect } from 'react'

interface TvProgram {
  startTime: string
  endTime: string
  title: string
  description: string
  type: string // live_sports, sports_talk, etc.
  sport: string
}

interface ChannelProgramming {
  channel: string
  programs: TvProgram[]
}

interface TvChannel {
  id: string
  channelNumber: string
  name: string
  displayName: string
  callSign?: string
  category: string
  subcategory?: string
  isHd: boolean
  is4k: boolean
  schedule?: string // JSON string of programs
  priority: number
}

export default function EnhancedChannelGrid() {
  const [channels, setChannels] = useState<TvChannel[]>([])
  const [programming, setProgramming] = useState<{[key: string]: TvProgram[]}>({})
  const [selectedTime, setSelectedTime] = useState<Date>(new Date())
  const [loading, setLoading] = useState(false)
  const [view, setView] = useState<'grid' | 'guide'>('guide')

  useEffect(() => {
    fetchChannels()
    fetchProgramming()
  }, [])

  const fetchChannels = async () => {
    try {
      // Mock channel data since we don't have a channels API in this project
      const mockChannels = [
        { id: '1', channelNumber: '206', name: 'ESPN', displayName: 'ESPN HD', category: 'sports', subcategory: 'general_sports', isHd: true, is4k: false, priority: 95, callSign: 'ESPN' },
        { id: '2', channelNumber: '207', name: 'ESPN2', displayName: 'ESPN2 HD', category: 'sports', subcategory: 'general_sports', isHd: true, is4k: false, priority: 90, callSign: 'ESPN2' },
        { id: '3', channelNumber: '213', name: 'Fox Sports 1', displayName: 'FS1 HD', category: 'sports', subcategory: 'general_sports', isHd: true, is4k: false, priority: 95, callSign: 'FS1' },
        { id: '4', channelNumber: '214', name: 'Fox Sports 2', displayName: 'FS2 HD', category: 'sports', subcategory: 'general_sports', isHd: true, is4k: false, priority: 85, callSign: 'FS2' },
        { id: '5', channelNumber: '215', name: 'MLB Network', displayName: 'MLB Network HD', category: 'sports', subcategory: 'baseball', isHd: true, is4k: false, priority: 85, callSign: 'MLBN' },
        { id: '6', channelNumber: '216', name: 'NBA TV', displayName: 'NBA TV HD', category: 'sports', subcategory: 'basketball', isHd: true, is4k: false, priority: 85, callSign: 'NBATV' },
        { id: '7', channelNumber: '217', name: 'NHL Network', displayName: 'NHL Network HD', category: 'sports', subcategory: 'hockey', isHd: true, is4k: false, priority: 80, callSign: 'NHLN' },
        { id: '8', channelNumber: '219', name: 'Golf Channel', displayName: 'Golf Channel HD', category: 'sports', subcategory: 'golf', isHd: true, is4k: false, priority: 80, callSign: 'GOLF' },
        { id: '9', channelNumber: '701', name: 'NFL Sunday Ticket 1', displayName: 'NFL ST 1', category: 'sports', subcategory: 'football', isHd: true, is4k: false, priority: 95, callSign: 'NFLST1' },
        { id: '10', channelNumber: '702', name: 'NFL Sunday Ticket 2', displayName: 'NFL ST 2', category: 'sports', subcategory: 'football', isHd: true, is4k: false, priority: 95, callSign: 'NFLST2' },
        { id: '11', channelNumber: '703', name: 'NFL Sunday Ticket 3', displayName: 'NFL ST 3', category: 'sports', subcategory: 'football', isHd: true, is4k: false, priority: 95, callSign: 'NFLST3' },
        { id: '12', channelNumber: '704', name: 'NFL Sunday Ticket 4', displayName: 'NFL ST 4', category: 'sports', subcategory: 'football', isHd: true, is4k: false, priority: 95, callSign: 'NFLST4' },
        { id: '13', channelNumber: '212-ST', name: 'NFL RedZone', displayName: 'NFL RedZone (ST)', category: 'sports', subcategory: 'football', isHd: true, is4k: false, priority: 100, callSign: 'NFLRZ' }
      ]
      setChannels(mockChannels.slice(0, 20))
    } catch (error) {
      console.error('Error fetching channels:', error)
    }
  }

  const fetchProgramming = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/tv-programming')
      if (response.ok) {
        const data = await response.json()
        setProgramming(data)
      }
    } catch (error) {
      console.error('Error fetching programming:', error)
    } finally {
      setLoading(false)
    }
  }

  const getCurrentProgram = (channelNumber: string, time: Date = new Date()) => {
    const channelPrograms = programming[channelNumber] || []
    
    return channelPrograms.find(program => {
      const startTime = new Date(program.startTime)
      const endTime = new Date(program.endTime)
      return time >= startTime && time <= endTime
    })
  }

  const getNextProgram = (channelNumber: string, time: Date = new Date()) => {
    const channelPrograms = programming[channelNumber] || []
    
    return channelPrograms.find(program => {
      const startTime = new Date(program.startTime)
      return startTime > time
    })
  }

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    })
  }

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    })
  }

  const getProgramIcon = (program: TvProgram) => {
    if (program.type === 'live_sports') {
      if (program.sport === 'football') return '🏈'
      if (program.sport === 'basketball') return '🏀'
      if (program.sport === 'baseball') return '⚾'
      if (program.sport === 'hockey') return '🏒'
      return '🏆'
    }
    if (program.type === 'sports_talk') return '🎙️'
    return '📺'
  }

  const getChannelIcon = (channel: TvChannel) => {
    if (channel.subcategory === 'football') return '🏈'
    if (channel.subcategory === 'basketball') return '🏀'
    if (channel.subcategory === 'baseball') return '⚾'
    if (channel.category === 'sports') return '🏆'
    return '📺'
  }

  const timeSlots = []
  const baseTime = new Date()
  baseTime.setHours(0, 0, 0, 0)
  
  for (let hour = 0; hour < 24; hour += 2) {
    const slotTime = new Date(baseTime)
    slotTime.setHours(hour)
    timeSlots.push(slotTime)
  }

  if (view === 'grid') {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">📺 Channel Grid</h3>
          <div className="flex space-x-2">
            <button
              onClick={() => setView('guide')}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md"
            >
              📋 TV Guide
            </button>
            <button
              onClick={fetchProgramming}
              disabled={loading}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md disabled:opacity-50"
            >
              {loading ? '⏳ Loading...' : '🔄 Refresh'}
            </button>
          </div>
        </div>

        {/* Grid Layout */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {channels.map((channel) => {
            const currentProgram = getCurrentProgram(channel.channelNumber)
            const nextProgram = getNextProgram(channel.channelNumber)

            return (
              <div key={channel.id} className="bg-white border border-gray-200 rounded-lg shadow-sm p-4 hover:shadow-md transition-shadow">
                <div className="text-center mb-3">
                  <div className="text-2xl mb-1">{getChannelIcon(channel)}</div>
                  <div className="text-lg font-bold text-blue-600">{channel.channelNumber}</div>
                  <div className="text-sm font-semibold">{channel.displayName}</div>
                  {channel.isHd && <span className="text-xs bg-blue-100 text-blue-800 px-1 rounded">HD</span>}
                  {channel.is4k && <span className="text-xs bg-purple-100 text-purple-800 px-1 rounded ml-1">4K</span>}
                </div>

                {currentProgram ? (
                  <div className="text-center">
                    <div className="text-xs font-medium text-green-600 mb-1">ON NOW</div>
                    <div className="text-sm font-semibold text-gray-900 mb-1">
                      {getProgramIcon(currentProgram)} {currentProgram.title}
                    </div>
                    <div className="text-xs text-gray-600">
                      {formatTime(currentProgram.startTime)} - {formatTime(currentProgram.endTime)}
                    </div>
                  </div>
                ) : (
                  <div className="text-center text-xs text-gray-500">
                    No current program
                  </div>
                )}

                {nextProgram && (
                  <div className="text-center mt-2 pt-2 border-t border-gray-100">
                    <div className="text-xs text-gray-500 mb-1">NEXT</div>
                    <div className="text-xs font-medium text-gray-700">
                      {nextProgram.title}
                    </div>
                    <div className="text-xs text-gray-500">
                      {formatTime(nextProgram.startTime)}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // TV Guide View
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">📋 Sports Programming Guide</h3>
          <p className="text-sm text-gray-600">{formatDate(selectedTime)}</p>
        </div>
        <div className="flex space-x-2">
          <button
            onClick={() => setView('grid')}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md"
          >
            📺 Channel Grid
          </button>
          <button
            onClick={fetchProgramming}
            disabled={loading}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md disabled:opacity-50"
          >
            {loading ? '⏳ Loading...' : '🔄 Refresh'}
          </button>
        </div>
      </div>

      {/* TV Guide Grid */}
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="p-3 text-left font-medium text-gray-700 w-32">Channel</th>
                {timeSlots.map((time) => (
                  <th key={time.getTime()} className="p-3 text-center font-medium text-gray-700 w-40">
                    {time.toLocaleTimeString('en-US', {
                      hour: 'numeric',
                      hour12: true
                    })}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {channels.slice(0, 10).map((channel) => (
                <tr key={channel.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="p-3">
                    <div className="flex items-center space-x-2">
                      <div className="text-lg">{getChannelIcon(channel)}</div>
                      <div>
                        <div className="font-semibold text-blue-600">{channel.channelNumber}</div>
                        <div className="text-xs text-gray-600">{channel.displayName}</div>
                      </div>
                    </div>
                  </td>
                  {timeSlots.map((timeSlot) => {
                    const program = getCurrentProgram(channel.channelNumber, timeSlot)
                    return (
                      <td key={timeSlot.getTime()} className="p-2 border-l border-gray-100">
                        {program ? (
                          <div className="text-xs">
                            <div className="font-medium text-gray-900 mb-1">
                              {getProgramIcon(program)} {program.title}
                            </div>
                            <div className="text-gray-600">
                              {formatTime(program.startTime)}
                            </div>
                            {program.type === 'live_sports' && (
                              <div className="text-red-600 font-medium">LIVE</div>
                            )}
                          </div>
                        ) : (
                          <div className="text-xs text-gray-400">-</div>
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-center space-x-2 mb-2">
          <span className="text-blue-900 font-medium">📌 Programming Legend</span>
        </div>
        <div className="flex flex-wrap gap-4 text-sm">
          <div className="flex items-center space-x-1">
            <span>🏈</span>
            <span className="text-blue-800">NFL/Football</span>
          </div>
          <div className="flex items-center space-x-1">
            <span>🏀</span>
            <span className="text-blue-800">Basketball</span>
          </div>
          <div className="flex items-center space-x-1">
            <span>⚾</span>
            <span className="text-blue-800">Baseball</span>
          </div>
          <div className="flex items-center space-x-1">
            <span>🎙️</span>
            <span className="text-blue-800">Sports Talk</span>
          </div>
          <div className="flex items-center space-x-1">
            <span className="text-red-600 font-bold">LIVE</span>
            <span className="text-blue-800">Live Sports</span>
          </div>
        </div>
      </div>
    </div>
  )
}
