
'use client'

import { useState, useEffect } from 'react'
import { 
  Clock, 
  Tv, 
  Star, 
  Calendar,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Settings,
  Filter,
  Play
} from 'lucide-react'

interface Channel {
  number: string
  name: string
  callSign: string
  type: 'cable' | 'satellite' | 'streaming' | 'ota'
  category: 'sports' | 'news' | 'entertainment' | 'movies' | 'kids' | 'music'
}

interface Program {
  id: string
  title: string
  description?: string
  startTime: string
  endTime: string
  duration: number
  category: 'sports' | 'news' | 'movies' | 'series' | 'reality' | 'documentary' | 'kids' | 'music'
  isLive?: boolean
  isNew?: boolean
  rating?: string
}

interface ChannelProgram {
  channel: Channel
  programs: Program[]
}

interface TVGuideProps {
  selectedInput: number | null
  inputs: any[]
  sendIRCommand: (command: string) => void
}

interface GameListing {
  id: string
  league: string
  homeTeam: string
  awayTeam: string
  gameTime: string
  gameDate: string
  channel: {
    id: string
    name: string
    channelNumber?: string
    type: 'cable' | 'streaming' | 'ota' | 'satellite'
    platforms: string[]
  }
  description?: string
  status?: 'upcoming' | 'live' | 'completed'
  source?: string
}

interface ChannelInfo {
  id: string
  name: string
  channelNumber?: string
  type: 'cable' | 'streaming' | 'ota' | 'satellite'
  platforms: string[]
}

export default function TVGuide({ selectedInput, inputs, sendIRCommand }: TVGuideProps) {
  const [currentTime, setCurrentTime] = useState(new Date())
  const [timeSlotStart, setTimeSlotStart] = useState(16) // Start at 4:00 PM
  const [channelData, setChannelData] = useState<ChannelProgram[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [isLoading, setIsLoading] = useState(false)
  const [gamesData, setGamesData] = useState<GameListing[]>([])
  const [availableChannels, setAvailableChannels] = useState<ChannelInfo[]>([])

  useEffect(() => {
    // Update current time every minute
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 60000)

    // Load channel data
    loadChannelData()

    return () => clearInterval(timer)
  }, [selectedInput])

  // Generate channel programs when data is loaded
  useEffect(() => {
    if (availableChannels.length > 0 || gamesData.length > 0) {
      generateChannelPrograms()
    }
  }, [availableChannels, gamesData])

  const loadChannelData = async () => {
    setIsLoading(true)
    
    try {
      // First, try to get live sports data which includes channel information
      const sportsResponse = await fetch('/api/sports-guide', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          selectedLeagues: ['nfl', 'nba', 'mlb', 'nhl', 'ncaa-fb', 'ncaa-bb', 'premier'] 
        })
      })

      if (sportsResponse.ok) {
        const sportsResult = await sportsResponse.json()
        if (sportsResult.success && sportsResult.data?.games) {
          setGamesData(sportsResult.data.games)
          
          // Extract unique channels from games data
          const channelMap = new Map()
          sportsResult.data.games.forEach((game: GameListing) => {
            if (game.channel?.channelNumber) {
              channelMap.set(game.channel.id, game.channel)
            }
          })
          setAvailableChannels(Array.from(channelMap.values()))
        }
      }

      // Also try to get Spectrum sports channels for additional channel info
      try {
        const channelResponse = await fetch('/api/sports-guide?action=spectrum-sports')
        if (channelResponse.ok) {
          const channelResult = await channelResponse.json()
          if (channelResult.success && channelResult.sportsChannels) {
            // Merge with existing channels
            const additionalChannels = channelResult.sportsChannels.map((ch: any) => ({
              id: ch.name.toLowerCase().replace(/[^a-z0-9]/g, '-'),
              name: ch.name,
              channelNumber: ch.channelNumber,
              type: 'cable' as const,
              platforms: [`Spectrum Ch. ${ch.channelNumber}${ch.isHD ? ' (HD)' : ''}`]
            }))
            
            setAvailableChannels(prev => {
              const combined = [...prev, ...additionalChannels]
              const unique = Array.from(new Map(combined.map(ch => [ch.id, ch])).values())
              return unique
            })
          }
        }
      } catch (error) {
        console.error('Error fetching Spectrum channels:', error)
      }

    } catch (error) {
      console.error('Error loading channel data:', error)
      // Fallback to empty data
      setChannelData([])
    } finally {
      setIsLoading(false)
    }
  }

  const generateChannelPrograms = () => {
    const channelPrograms: ChannelProgram[] = []
    
    // Create a map of channels with their programs
    const channelMap = new Map<string, Program[]>()
    
    // Generate programs from games data
    gamesData.forEach(game => {
      if (!game.channel?.channelNumber) return
      
      const channelId = game.channel.id
      const gameTimeSlot = convertGameTimeToSlot(game.gameTime)
      
      if (!gameTimeSlot) return
      
      const program: Program = {
        id: game.id,
        title: `${game.awayTeam} vs ${game.homeTeam}`,
        description: `${game.league} - ${game.description || 'Live game'}`,
        startTime: gameTimeSlot,
        endTime: calculateEndTime(gameTimeSlot, 180), // 3 hours for games
        duration: 180,
        category: 'sports',
        isLive: game.status === 'live',
        isNew: true
      }
      
      if (!channelMap.has(channelId)) {
        channelMap.set(channelId, [])
      }
      channelMap.get(channelId)?.push(program)
    })
    
    // Add generic programming for channels without specific games
    availableChannels.forEach(channelInfo => {
      const existingPrograms = channelMap.get(channelInfo.id) || []
      
      // Fill empty time slots with generic programming
      const completePrograms = fillEmptyTimeSlots(channelInfo, existingPrograms)
      
      const channel: Channel = {
        number: channelInfo.channelNumber || '000',
        name: channelInfo.name,
        callSign: channelInfo.name.replace(/[^A-Z]/g, ''),
        type: channelInfo.type,
        category: getChannelCategory(channelInfo.name)
      }
      
      channelPrograms.push({
        channel,
        programs: completePrograms
      })
    })
    
    // Sort by channel number
    channelPrograms.sort((a, b) => {
      const numA = parseInt(a.channel.number) || 999
      const numB = parseInt(b.channel.number) || 999
      return numA - numB
    })
    
    setChannelData(channelPrograms)
  }

  const convertGameTimeToSlot = (gameTime: string): string | null => {
    try {
      // Parse times like "7:30 PM EST"
      const timeMatch = gameTime.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i)
      if (!timeMatch) return null
      
      let hour = parseInt(timeMatch[1])
      const minute = parseInt(timeMatch[2])
      const ampm = timeMatch[3].toUpperCase()
      
      // Convert to 24-hour format
      if (ampm === 'PM' && hour !== 12) hour += 12
      if (ampm === 'AM' && hour === 12) hour = 0
      
      // Round to nearest 30-minute slot
      const roundedMinute = minute >= 30 ? 30 : 0
      
      return `${hour}:${roundedMinute.toString().padStart(2, '0')}`
    } catch (error) {
      return null
    }
  }

  const calculateEndTime = (startTime: string, duration: number): string => {
    const [hour, minute] = startTime.split(':').map(Number)
    const startMinutes = hour * 60 + minute
    const endMinutes = startMinutes + duration
    const endHour = Math.floor(endMinutes / 60) % 24
    const endMinute = endMinutes % 60
    return `${endHour}:${endMinute.toString().padStart(2, '0')}`
  }

  const fillEmptyTimeSlots = (channel: ChannelInfo, existingPrograms: Program[]): Program[] => {
    const programs = [...existingPrograms]
    const timeSlots = getTimeSlots()
    
    timeSlots.forEach(slot => {
      const hasProgram = programs.some(p => p.startTime === slot.time24)
      if (!hasProgram) {
        // Add generic programming
        const genericProgram = generateGenericProgram(channel, slot.time24)
        programs.push(genericProgram)
      }
    })
    
    return programs.sort((a, b) => {
      const timeA = a.startTime.split(':').map(Number)
      const timeB = b.startTime.split(':').map(Number)
      return (timeA[0] * 60 + timeA[1]) - (timeB[0] * 60 + timeB[1])
    })
  }

  const generateGenericProgram = (channel: ChannelInfo, timeSlot: string): Program => {
    const hour = parseInt(timeSlot.split(':')[0])
    const channelName = channel.name
    
    // Generate appropriate generic programming based on channel and time
    let title = 'Regular Programming'
    let description = 'Scheduled programming'
    let category: Program['category'] = 'series'
    
    if (channelName.toLowerCase().includes('espn')) {
      if (hour < 12) {
        title = 'SportsCenter'
        description = 'Sports news and highlights'
      } else if (hour < 17) {
        title = 'First Take'
        description = 'Sports debate show'
      } else {
        title = 'NFL Live'
        description = 'NFL news and analysis'
      }
      category = 'sports'
    } else if (channelName.toLowerCase().includes('fox sports') || channelName.toLowerCase().includes('fs1')) {
      title = 'Fox Sports Programming'
      description = 'Sports analysis and highlights'
      category = 'sports'
    } else if (channelName.toLowerCase().includes('nfl')) {
      title = 'NFL Programming'
      description = 'NFL content and analysis'
      category = 'sports'
    } else if (channelName.toLowerCase().includes('nba')) {
      title = 'NBA Programming'  
      description = 'NBA content and highlights'
      category = 'sports'
    } else if (channelName.toLowerCase().includes('mlb')) {
      title = 'MLB Programming'
      description = 'Baseball content and highlights'  
      category = 'sports'
    } else if (channelName.toLowerCase().includes('news') || channelName.toLowerCase().includes('cbs') || channelName.toLowerCase().includes('nbc')) {
      if (hour >= 17) {
        title = 'Evening News'
        description = 'Local and national news'
      } else {
        title = 'News Programming'
        description = 'News and current events'
      }
      category = 'news'
    }

    return {
      id: `generic-${channel.id}-${timeSlot}`,
      title,
      description,
      startTime: timeSlot,
      endTime: calculateEndTime(timeSlot, 30),
      duration: 30,
      category
    }
  }

  const getChannelCategory = (channelName: string): Channel['category'] => {
    const name = channelName.toLowerCase()
    if (name.includes('espn') || name.includes('sports') || name.includes('nfl') || 
        name.includes('nba') || name.includes('mlb') || name.includes('nhl') ||
        name.includes('fox sports') || name.includes('btn') || name.includes('big ten')) {
      return 'sports'
    } else if (name.includes('news') || name.includes('cbs') || name.includes('nbc') || name.includes('abc')) {
      return 'news'
    } else if (name.includes('hbo') || name.includes('showtime') || name.includes('starz')) {
      return 'movies'
    } else if (name.includes('nick') || name.includes('disney') || name.includes('cartoon')) {
      return 'kids'
    } else if (name.includes('mtv') || name.includes('vh1') || name.includes('cmt')) {
      return 'music'
    }
    return 'entertainment'
  }

  const getTimeSlots = () => {
    const slots: any[] = []
    for (let i = 0; i < 5; i++) {
      const hour = timeSlotStart + i
      const hour12 = hour > 12 ? hour - 12 : hour
      const ampm = hour >= 12 ? 'PM' : 'AM'
      slots.push({
        time24: `${hour}:00`,
        time12: `${hour12}:00 ${ampm}`,
        halfHour12: `${hour12}:30 ${ampm}`
      })
    }
    return slots
  }

  const navigateTime = (direction: 'prev' | 'next') => {
    setTimeSlotStart(prev => {
      if (direction === 'prev' && prev > 0) {
        return prev - 2
      } else if (direction === 'next' && prev < 22) {
        return prev + 2
      }
      return prev
    })
  }

  const getProgramForTimeSlot = (programs: Program[], timeSlot: string) => {
    return programs.find(program => program.startTime === timeSlot) || null
  }

  const getProgramColor = (category: string, isLive?: boolean) => {
    if (isLive) return 'bg-red-500/80 text-white border-red-400'
    
    switch (category) {
      case 'sports': return 'bg-green-500/70 text-white border-green-400'
      case 'news': return 'bg-blue-500/70 text-white border-blue-400'
      case 'movies': return 'bg-purple-500/70 text-white border-purple-400'
      case 'series': return 'bg-indigo-500/70 text-white border-indigo-400'
      case 'kids': return 'bg-yellow-500/70 text-white border-yellow-400'
      case 'music': return 'bg-pink-500/70 text-white border-pink-400'
      default: return 'bg-gray-500/70 text-white border-gray-400'
    }
  }

  const filteredChannels = channelData.filter(item => 
    selectedCategory === 'all' || item.channel.category === selectedCategory
  )

  const handleChannelClick = (channelNumber: string) => {
    sendIRCommand(channelNumber)
  }

  const currentHour = currentTime.getHours()
  const currentTimeSlot = `${currentHour}:00`

  return (
    <div className="max-w-7xl mx-auto">
      <div className="bg-slate-900/95 backdrop-blur-sm rounded-lg border border-slate-700/50 shadow-2xl">
        {/* Header */}
        <div className="p-6 border-b border-slate-700/50">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-4">
              <div className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl p-3">
                <Tv className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white">TV Guide</h2>
                <p className="text-slate-300">
                  {selectedInput ? 
                    `Channel lineup for ${inputs.find(i => i.channelNumber === selectedInput)?.label || `Input ${selectedInput}`}` :
                    channelData.length > 0 ? `${channelData.length} channels loaded` : 'Select an input source to view guide'
                  }
                </p>
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              {/* Category Filter */}
              <div className="relative">
                <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4 pointer-events-none" />
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="pl-10 pr-8 py-2 bg-slate-800 border border-slate-600 text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm appearance-none cursor-pointer"
                >
                  <option value="all">All Categories</option>
                  <option value="sports">Sports</option>
                  <option value="news">News</option>
                  <option value="entertainment">Entertainment</option>
                  <option value="movies">Movies</option>
                </select>
              </div>
              
              <button
                onClick={loadChannelData}
                disabled={isLoading}
                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>
            </div>
          </div>
          
          {/* Time Navigation */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigateTime('prev')}
                className="p-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-colors"
                disabled={timeSlotStart <= 0}
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              
              <div className="text-white font-medium">
                {getTimeSlots()[0].time12} - {getTimeSlots()[getTimeSlots().length - 1].time12}
              </div>
              
              <button
                onClick={() => navigateTime('next')}
                className="p-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-colors"
                disabled={timeSlotStart >= 22}
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            
            <div className="flex items-center space-x-2 text-sm text-slate-300">
              <Clock className="w-4 h-4" />
              <span>Current Time: {currentTime.toLocaleTimeString('en-US', { 
                hour: 'numeric', 
                minute: '2-digit', 
                hour12: true 
              })}</span>
            </div>
          </div>
        </div>

        {/* Guide Grid */}
        {selectedInput ? (
          <div className="overflow-x-auto">
            <div className="min-w-[800px]">
              {/* Time Header */}
              <div className="sticky top-0 bg-slate-800 border-b border-slate-700 z-10">
                <div className="grid grid-cols-6 gap-0">
                  {/* Channel column header */}
                  <div className="bg-slate-700 p-3 border-r border-slate-600 font-semibold text-white text-center">
                    Channel
                  </div>
                  
                  {/* Time slot headers */}
                  {getTimeSlots().map((slot, index) => (
                    <div key={index} className="bg-slate-700 p-3 border-r border-slate-600 text-center text-white font-medium text-sm">
                      {slot.time12}
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Channel Rows */}
              <div className="divide-y divide-slate-700">
                {isLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="flex items-center space-x-3 text-slate-300">
                      <RefreshCw className="w-5 h-5 animate-spin" />
                      <span>Loading channel guide...</span>
                    </div>
                  </div>
                ) : filteredChannels.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="bg-slate-700/50 rounded-full p-4 w-16 h-16 mx-auto mb-4">
                      <Tv className="w-8 h-8 text-slate-400 mx-auto" />
                    </div>
                    <h3 className="text-lg font-medium text-white mb-2">Loading Channel Guide</h3>
                    <p className="text-slate-300">
                      {isLoading ? 'Fetching channel lineup and program data...' : 
                       channelData.length === 0 ? 'No channels available. Try refreshing or check Sports Guide configuration.' :
                       'Try selecting a different category or input source'}
                    </p>
                    {!isLoading && channelData.length === 0 && (
                      <button
                        onClick={loadChannelData}
                        className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                      >
                        Retry Loading Channels
                      </button>
                    )}
                  </div>
                ) : (
                  filteredChannels.map((item, channelIndex) => (
                    <div key={item.channel.number} className="grid grid-cols-6 gap-0 hover:bg-slate-800/50">
                      {/* Channel Info */}
                      <div 
                        className="bg-slate-800 p-3 border-r border-slate-600 cursor-pointer hover:bg-slate-700 transition-colors"
                        onClick={() => handleChannelClick(item.channel.number)}
                        title={`Click to tune to ${item.channel.name}`}
                      >
                        <div className="flex flex-col items-start">
                          <div className="text-yellow-400 font-bold text-sm">{item.channel.number}</div>
                          <div className="text-white font-medium text-xs">{item.channel.name}</div>
                          <div className="text-slate-400 text-xs">{item.channel.callSign}</div>
                        </div>
                      </div>
                      
                      {/* Program Slots */}
                      {getTimeSlots().map((slot, slotIndex) => {
                        const program = getProgramForTimeSlot(item.programs, slot.time24.replace(':', ':'))
                        const isCurrentTimeSlot = slot.time24 === currentTimeSlot
                        
                        return (
                          <div 
                            key={slotIndex} 
                            className={`p-2 border-r border-slate-600 min-h-[60px] relative ${
                              isCurrentTimeSlot ? 'ring-2 ring-blue-400' : ''
                            }`}
                          >
                            {program ? (
                              <div className={`h-full rounded p-2 border ${getProgramColor(program.category, program.isLive)}`}>
                                <div className="flex items-start justify-between">
                                  <div className="flex-1 min-w-0">
                                    <div className="font-medium text-xs leading-tight truncate">
                                      {program.title}
                                    </div>
                                    {program.description && (
                                      <div className="text-xs opacity-90 mt-1 leading-tight truncate">
                                        {program.description}
                                      </div>
                                    )}
                                    <div className="text-xs opacity-75 mt-1">
                                      {slot.time12}
                                    </div>
                                  </div>
                                  <div className="ml-1 flex flex-col space-y-1">
                                    {program.isLive && (
                                      <div className="bg-red-600 text-white text-xs px-1 rounded">
                                        LIVE
                                      </div>
                                    )}
                                    {program.isNew && (
                                      <div className="bg-yellow-600 text-white text-xs px-1 rounded">
                                        NEW
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <div className="h-full bg-slate-700/30 rounded p-2 flex items-center justify-center">
                                <span className="text-slate-500 text-xs">No Info</span>
                              </div>
                            )}
                            
                            {/* Current time indicator */}
                            {isCurrentTimeSlot && (
                              <div className="absolute top-0 left-0 w-full h-1 bg-blue-400"></div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        ) : (
          /* No Input Selected */
          <div className="text-center py-16">
            <div className="bg-slate-700/50 rounded-full p-4 w-16 h-16 mx-auto mb-4">
              <Tv className="w-8 h-8 text-slate-400 mx-auto" />
            </div>
            <h3 className="text-lg font-medium text-white mb-2">Select an Input Source</h3>
            <p className="text-slate-300">Choose a TV input from the Video tab to view the channel guide</p>
          </div>
        )}

        {/* Legend */}
        {selectedInput && !isLoading && (
          <div className="p-4 border-t border-slate-700 bg-slate-800/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4 text-xs">
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-green-500 rounded"></div>
                  <span className="text-slate-300">Sports</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-blue-500 rounded"></div>
                  <span className="text-slate-300">News</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-red-500 rounded"></div>
                  <span className="text-slate-300">Live</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-purple-500 rounded"></div>
                  <span className="text-slate-300">Movies</span>
                </div>
              </div>
              
              <div className="text-xs text-slate-400">
                Click channel numbers to tune • Use time navigation to browse schedule
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
