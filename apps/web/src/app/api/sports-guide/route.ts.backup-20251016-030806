
import { NextRequest, NextResponse } from 'next/server'
import { enhancedLiveSportsService } from '@/lib/sports-apis/enhanced-live-sports-service'
import { getEnhancedStreamingSportsData, getUserStreamingPlatformAccess } from '@/lib/enhanced-streaming-sports-service'
import { spectrumChannelService, type SpectrumChannelData } from '@/lib/spectrum-channel-service'

// Configure route segment to be dynamic
export const dynamic = 'force-dynamic'

export interface ChannelInfo {
  id: string
  name: string
  url?: string
  platforms: string[]
  type: 'cable' | 'streaming' | 'ota' | 'satellite'
  cost: 'free' | 'subscription' | 'premium'
  logoUrl?: string
  channelNumber?: string
  appCommand?: string
  deviceType?: 'cable' | 'satellite' | 'streaming' | 'gaming'
  userHasAccess?: boolean
}

export interface GameListing {
  id: string
  league: string
  homeTeam: string
  awayTeam: string
  gameTime: string
  gameDate: string
  channel: ChannelInfo
  description?: string
  priority?: 'high' | 'medium' | 'low'
  status?: 'upcoming' | 'live' | 'completed'
  homeScore?: string
  awayScore?: string
  venue?: string
  broadcast?: string[]
  source?: 'espn' | 'sportsdb' | 'sunday-ticket' | 'mock' | 'streaming-enhanced'
}

const CHANNELS: ChannelInfo[] = [
  {
    id: 'espn',
    name: 'ESPN',
    platforms: ['DirecTV Ch. 206', 'Spectrum Ch. 24', 'Hulu Live TV', 'YouTube TV', 'Sling TV'],
    type: 'cable',
    cost: 'subscription',
    url: 'https://www.espn.com/watch/',
    channelNumber: '24',
    deviceType: 'cable'
  },
  {
    id: 'espn2',
    name: 'ESPN2',
    platforms: ['DirecTV Ch. 209', 'Spectrum Ch. 25', 'Hulu Live TV', 'YouTube TV', 'Sling TV'],
    type: 'cable',
    cost: 'subscription',
    url: 'https://www.espn.com/watch/',
    channelNumber: '25',
    deviceType: 'cable'
  },
  {
    id: 'espnu',
    name: 'ESPNU',
    platforms: ['DirecTV Ch. 208', 'Spectrum Ch. 141', 'Hulu Live TV', 'YouTube TV', 'Sling TV'],
    type: 'cable',
    cost: 'subscription',
    url: 'https://www.espn.com/watch/',
    channelNumber: '141',
    deviceType: 'cable'
  },
  {
    id: 'espn-news',
    name: 'ESPN News',
    platforms: ['DirecTV Ch. 207', 'Spectrum Ch. 142', 'Hulu Live TV', 'YouTube TV', 'Sling TV'],
    type: 'cable',
    cost: 'subscription',
    url: 'https://www.espn.com/watch/',
    channelNumber: '142',
    deviceType: 'cable'
  },
  {
    id: 'fox-sports',
    name: 'Fox Sports 1 (FS1)',
    platforms: ['DirecTV Ch. 219', 'Spectrum Ch. 83', 'Hulu Live TV', 'YouTube TV', 'FuboTV'],
    type: 'cable',
    cost: 'subscription',
    url: 'https://www.foxsports.com/live',
    channelNumber: '83',
    deviceType: 'cable'
  },
  {
    id: 'fox-sports2',
    name: 'Fox Sports 2 (FS2)',
    platforms: ['DirecTV Ch. 618', 'Spectrum Ch. 84', 'Hulu Live TV', 'YouTube TV', 'FuboTV'],
    type: 'cable',
    cost: 'subscription',
    url: 'https://www.foxsports.com/live',
    channelNumber: '84',
    deviceType: 'cable'
  },
  {
    id: 'big-ten-network',
    name: 'Big Ten Network',
    platforms: ['DirecTV Ch. 610', 'Spectrum Ch. 143', 'Hulu Live TV', 'YouTube TV', 'FuboTV'],
    type: 'cable',
    cost: 'subscription',
    url: 'https://www.btn.com/watch/',
    channelNumber: '143',
    deviceType: 'cable'
  },
  {
    id: 'bally-sports',
    name: 'Bally Sports Wisconsin',
    platforms: ['DirecTV Ch. 671', 'Spectrum Ch. 33', 'FuboTV'],
    type: 'cable',
    cost: 'subscription',
    url: 'https://www.ballysports.com/',
    channelNumber: '33',
    deviceType: 'cable'
  },
  {
    id: 'golf-channel',
    name: 'Golf Channel',
    platforms: ['DirecTV Ch. 218', 'Spectrum Ch. 85', 'Hulu Live TV', 'YouTube TV', 'Peacock Premium'],
    type: 'cable',
    cost: 'subscription',
    url: 'https://www.golfchannel.com/watch',
    channelNumber: '85',
    deviceType: 'cable'
  },
  {
    id: 'nfl-network',
    name: 'NFL Network',
    platforms: ['DirecTV Ch. 212', 'Spectrum Ch. 144', 'Hulu Live TV', 'YouTube TV', 'Sling TV'],
    type: 'cable',
    cost: 'subscription',
    url: 'https://www.nfl.com/network/',
    channelNumber: '144',
    deviceType: 'cable'
  },
  {
    id: 'nfl-redzone',
    name: 'NFL RedZone',
    platforms: ['DirecTV Ch. 213', 'Spectrum Ch. 145', 'Hulu Live TV', 'YouTube TV'],
    type: 'cable',
    cost: 'premium',
    url: 'https://www.nfl.com/redzone/',
    channelNumber: '145',
    deviceType: 'cable'
  },
  {
    id: 'nba-tv',
    name: 'NBA TV',
    platforms: ['DirecTV Ch. 216', 'Spectrum Ch. 146', 'Hulu Live TV', 'YouTube TV', 'Sling TV'],
    type: 'cable',
    cost: 'subscription',
    url: 'https://www.nba.com/watch/',
    channelNumber: '146',
    deviceType: 'cable'
  },
  {
    id: 'mlb-network',
    name: 'MLB Network',
    platforms: ['DirecTV Ch. 213', 'Spectrum Ch. 147', 'Hulu Live TV', 'YouTube TV', 'FuboTV'],
    type: 'cable',
    cost: 'subscription',
    url: 'https://www.mlb.com/network',
    channelNumber: '147',
    deviceType: 'cable'
  },
  {
    id: 'nhl-network',
    name: 'NHL Network',
    platforms: ['DirecTV Ch. 215', 'Spectrum Ch. 148', 'Hulu Live TV', 'YouTube TV', 'FuboTV'],
    type: 'cable',
    cost: 'subscription',
    url: 'https://www.nhl.com/tv',
    channelNumber: '148',
    deviceType: 'cable'
  },
  {
    id: 'sec-network',
    name: 'SEC Network',
    platforms: ['DirecTV Ch. 611', 'Spectrum Ch. 149', 'Hulu Live TV', 'YouTube TV', 'FuboTV'],
    type: 'cable',
    cost: 'subscription',
    url: 'https://www.espn.com/watch/',
    channelNumber: '149',
    deviceType: 'cable'
  },
  {
    id: 'acc-network',
    name: 'ACC Network',
    platforms: ['DirecTV Ch. 612', 'Spectrum Ch. 150', 'Hulu Live TV', 'YouTube TV', 'FuboTV'],
    type: 'cable',
    cost: 'subscription',
    url: 'https://www.espn.com/watch/',
    channelNumber: '150',
    deviceType: 'cable'
  },
  {
    id: 'pac12-network',
    name: 'Pac-12 Network',
    platforms: ['DirecTV Ch. 613', 'Spectrum Ch. 151', 'FuboTV'],
    type: 'cable',
    cost: 'subscription',
    url: 'https://pac-12.com/live',
    channelNumber: '151',
    deviceType: 'cable'
  },
  {
    id: 'tennis-channel',
    name: 'Tennis Channel',
    platforms: ['DirecTV Ch. 217', 'Spectrum Ch. 86', 'Hulu Live TV', 'YouTube TV', 'FuboTV'],
    type: 'cable',
    cost: 'subscription',
    url: 'https://www.tennischannel.com/watch',
    channelNumber: '86',
    deviceType: 'cable'
  },
  {
    id: 'olympic-channel',
    name: 'Olympic Channel',
    platforms: ['DirecTV Ch. 388', 'Spectrum Ch. 152', 'FuboTV', 'Peacock Premium'],
    type: 'cable',
    cost: 'subscription',
    url: 'https://www.olympicchannel.com/',
    channelNumber: '152',
    deviceType: 'cable'
  },
  {
    id: 'nbc-sports',
    name: 'NBC Sports',
    platforms: ['DirecTV Ch. 220', 'Spectrum Ch. 87', 'Peacock Premium', 'Hulu Live TV'],
    type: 'cable',
    cost: 'subscription',
    url: 'https://www.nbcsports.com/live',
    channelNumber: '87',
    deviceType: 'cable'
  },
  {
    id: 'cbs-sports',
    name: 'CBS Sports Network',
    platforms: ['DirecTV Ch. 221', 'Spectrum Ch. 88', 'Paramount+', 'FuboTV'],
    type: 'cable',
    cost: 'subscription',
    url: 'https://www.cbssports.com/live-tv/',
    channelNumber: '88',
    deviceType: 'cable'
  },
  {
    id: 'tnt',
    name: 'TNT',
    platforms: ['DirecTV Ch. 245', 'Spectrum Ch. 32', 'Hulu Live TV', 'YouTube TV', 'Max'],
    type: 'cable',
    cost: 'subscription',
    url: 'https://www.tntdrama.com/watchtnt',
    channelNumber: '32',
    deviceType: 'cable'
  },
  {
    id: 'amazon-prime',
    name: 'Amazon Prime Video',
    platforms: ['Fire TV', 'Roku', 'Apple TV', 'Smart TVs', 'Mobile Apps'],
    type: 'streaming',
    cost: 'premium',
    url: 'https://www.amazon.com/gp/video/storefront',
    appCommand: 'HOME,DOWN,DOWN,RIGHT,RIGHT,OK',
    deviceType: 'streaming'
  },
  {
    id: 'netflix',
    name: 'Netflix',
    platforms: ['All Smart TVs', 'Fire TV', 'Roku', 'Apple TV', 'Mobile Apps'],
    type: 'streaming',
    cost: 'subscription',
    url: 'https://www.netflix.com',
    appCommand: 'HOME,DOWN,RIGHT,RIGHT,OK',
    deviceType: 'streaming'
  },
  {
    id: 'paramount-plus',
    name: 'Paramount+',
    platforms: ['All Smart TVs', 'Fire TV', 'Roku', 'Apple TV', 'Mobile Apps'],
    type: 'streaming',
    cost: 'subscription',
    url: 'https://www.paramountplus.com',
    appCommand: 'HOME,DOWN,DOWN,DOWN,RIGHT,OK',
    deviceType: 'streaming'
  },
  {
    id: 'peacock',
    name: 'Peacock Premium',
    platforms: ['All Smart TVs', 'Fire TV', 'Roku', 'Apple TV', 'Mobile Apps'],
    type: 'streaming',
    cost: 'subscription',
    url: 'https://www.peacocktv.com',
    appCommand: 'HOME,DOWN,RIGHT,DOWN,RIGHT,OK',
    deviceType: 'streaming'
  },
  {
    id: 'apple-tv',
    name: 'Apple TV+',
    platforms: ['Apple TV', 'Smart TVs', 'Fire TV', 'Roku', 'Mobile Apps'],
    type: 'streaming',
    cost: 'subscription',
    url: 'https://tv.apple.com',
    appCommand: 'HOME,RIGHT,RIGHT,DOWN,OK',
    deviceType: 'streaming'
  },
  {
    id: 'youtube-tv',
    name: 'YouTube TV',
    platforms: ['All Smart TVs', 'Fire TV', 'Roku', 'Chromecast', 'Mobile Apps'],
    type: 'streaming',
    cost: 'subscription',
    url: 'https://tv.youtube.com',
    appCommand: 'HOME,DOWN,DOWN,RIGHT,OK',
    deviceType: 'streaming'
  },
  {
    id: 'local-cbs',
    name: 'CBS (Local)',
    platforms: ['Antenna', 'Cable Ch. 2', 'DirecTV Ch. 2'],
    type: 'ota',
    cost: 'free',
    channelNumber: '2',
    deviceType: 'cable'
  },
  {
    id: 'local-nbc',
    name: 'NBC (Local)',
    platforms: ['Antenna', 'Cable Ch. 4', 'DirecTV Ch. 4'],
    type: 'ota',
    cost: 'free',
    channelNumber: '4',
    deviceType: 'cable'
  },
  {
    id: 'local-fox',
    name: 'FOX (Local)',
    platforms: ['Antenna', 'Cable Ch. 5', 'DirecTV Ch. 5'],
    type: 'ota',
    cost: 'free',
    channelNumber: '5',
    deviceType: 'cable'
  },
  {
    id: 'sunday-ticket',
    name: 'NFL Sunday Ticket',
    platforms: ['DirecTV', 'DirecTV Stream', 'Sunday Ticket App'],
    type: 'satellite',
    cost: 'premium',
    url: 'https://nflst.directv.com',
    channelNumber: '705-719',
    deviceType: 'satellite'
  },
  {
    id: 'sunday-ticket-redzone',
    name: 'NFL RedZone (Sunday Ticket)',
    platforms: ['DirecTV Ch. 213', 'Sunday Ticket Package'],
    type: 'satellite',
    cost: 'premium',
    channelNumber: '213',
    deviceType: 'satellite'
  }
]

// Enhanced channel information with live Spectrum data
const getEnhancedChannelInfo = async (channel: ChannelInfo): Promise<ChannelInfo> => {
  try {
    // Check if this is a Spectrum channel and get real data
    const spectrumChannel = await spectrumChannelService.findChannelByName(channel.name)
    
    if (spectrumChannel) {
      return {
        ...channel,
        channelNumber: spectrumChannel.channelNumber,
        platforms: channel.platforms.map(platform => 
          platform.includes('Spectrum') 
            ? `Spectrum Ch. ${spectrumChannel.channelNumber} (${spectrumChannel.isHD ? 'HD' : 'SD'})`
            : platform
        ),
        logoUrl: spectrumChannel.logoUrl || channel.logoUrl
      }
    }
    
    return channel
  } catch (error) {
    console.error(`Error enhancing channel info for ${channel.name}:`, error)
    return channel
  }
}

// No more mock data generation - only real data sources supported
// Mock data generation has been removed to ensure only live, real-time data is used

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { selectedLeagues, scheduledUpdate, timezone, dateRange, location } = body

    if (!selectedLeagues || !Array.isArray(selectedLeagues) || selectedLeagues.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No leagues selected' },
        { status: 400 }
      )
    }

    console.log(`🏆 Fetching enhanced sports data for leagues: ${selectedLeagues.join(', ')}`)
    
    let games: GameListing[] = []
    let dataSource = 'Live APIs (ESPN + TheSportsDB + Sunday Ticket + Streaming Platforms)'
    let apiSources: string[] = []
    let streamingEnhancedGames = 0
    let connectedPlatforms: string[] = []

    try {
      // First, get streaming platform access info
      const streamingAccess = getUserStreamingPlatformAccess()
      console.log(`🔐 Streaming platform access:`, streamingAccess)

      // Fetch enhanced streaming data first
      let streamingGames: any[] = []
      try {
        const streamingData = await getEnhancedStreamingSportsData(selectedLeagues)
        streamingGames = streamingData.games
        connectedPlatforms = streamingData.enhancedPlatforms
        streamingEnhancedGames = streamingData.totalEnhanced
        
        console.log(`📺 Retrieved ${streamingEnhancedGames} enhanced games from ${connectedPlatforms.length} streaming platforms`)
      } catch (streamingError) {
        console.error('❌ Error fetching streaming enhanced data:', streamingError)
      }

      // Attempt to fetch live data using the enhanced combined sports service
      const startDate = dateRange?.start || new Date().toISOString().split('T')[0]
      const endDate = dateRange?.end || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      
      console.log(`📅 Date range: ${startDate} to ${endDate}`)
      console.log(`📍 Location: ${location ? `${location.city || ''}, ${location.state || ''}` : 'Default (Wisconsin)'}`)
      
      const enhancedData = await enhancedLiveSportsService.getEnhancedLiveGames(
        selectedLeagues, 
        location || { state: 'WI', city: 'Madison' }, // Default to Wisconsin
        startDate, 
        endDate
      )
      
      if (enhancedData.games && enhancedData.games.length > 0) {
        // Convert enhanced live data to GameListing format with real channel info
        const enhancedGames = await Promise.all(
          enhancedData.games.map(async game => {
            const enhancedChannel = await getEnhancedChannelInfo(game.channel)
            return {
              id: game.id,
              league: game.league,
              homeTeam: game.homeTeam,
              awayTeam: game.awayTeam,
              gameTime: game.gameTime,
              gameDate: game.gameDate,
              channel: {
                ...enhancedChannel,
                userHasAccess: streamingAccess[game.channel.id] || false
              },
              description: game.description,
              priority: game.priority,
              status: game.status,
              homeScore: game.homeScore?.toString(),
              awayScore: game.awayScore?.toString(),
              venue: game.venue,
              broadcast: game.broadcast,
              source: game.source
            }
          })
        )
        
        games = enhancedGames
        
        apiSources = enhancedData.sources
        
        console.log(`✅ Successfully fetched ${enhancedData.totalGames} games from enhanced APIs`)
        console.log(`📊 Live: ${enhancedData.liveGames}, Upcoming: ${enhancedData.upcomingGames}, Completed: ${enhancedData.completedGames}`)
        console.log(`🏆 Professional: ${enhancedData.categories.professional}, College: ${enhancedData.categories.college}`)
        console.log(`🏫 High School: ${enhancedData.categories.highSchool}, International: ${enhancedData.categories.international}`)
        console.log(`📺 Sunday Ticket: ${enhancedData.sundayTicketGames}`)
        
      } else {
        console.log('ℹ️ No enhanced API data available - no real data sources returned results')
        games = []
        dataSource = streamingEnhancedGames > 0 ? 'Streaming Enhanced Only (No Live Sports Data Available)' : 'No Live Data Available'
        apiSources = streamingEnhancedGames > 0 ? ['Streaming Platforms'] : []
      }

      // Add streaming enhanced games to the results
      if (streamingGames.length > 0) {
        const convertedStreamingGames = streamingGames.map(game => ({
          id: game.id,
          league: game.league,
          homeTeam: game.homeTeam,
          awayTeam: game.awayTeam,
          gameTime: game.gameTime,
          gameDate: game.gameDate,
          channel: game.channel,
          description: game.description,
          priority: game.priority,
          status: game.status,
          homeScore: game.homeScore?.toString(),
          awayScore: game.awayScore?.toString(),
          venue: game.venue,
          broadcast: game.broadcast,
          source: game.source
        }))
        
        // Merge streaming games with regular games, prioritizing streaming enhanced games
        games = [...convertedStreamingGames, ...games]
        
        if (!apiSources.includes('Streaming Platforms')) {
          apiSources.unshift('Streaming Platforms')
        }
      }
      
    } catch (error) {
      console.error('❌ Error fetching enhanced sports data:', error)
      console.log('ℹ️ No fallback data available - returning empty results')
      games = []
      dataSource = 'Error: No Data Available (API Error)'
      apiSources = []
    }
    
    const response = {
      success: true,
      data: {
        games,
        generatedAt: new Date().toISOString(),
        selectedLeagues,
        totalGames: games.length,
        channels: Array.from(new Set(games.map(game => game.channel.name))),
        dataSource,
        apiSources,
        streamingEnhancements: {
          connectedPlatforms,
          enhancedGamesCount: streamingEnhancedGames,
          totalConnectedPlatforms: connectedPlatforms.length,
          userAccessibleGames: games.filter(game => game.channel.userHasAccess).length
        },
        summary: {
          liveGames: games.filter(game => game.status === 'live').length,
          upcomingGames: games.filter(game => game.status === 'upcoming').length,
          completedGames: games.filter(game => game.status === 'completed').length,
          platforms: Array.from(new Set(games.flatMap(game => game.channel.platforms))),
          streamingServices: games.filter(game => game.channel.type === 'streaming').length,
          cableChannels: games.filter(game => game.channel.type === 'cable').length,
          freeChannels: games.filter(game => game.channel.cost === 'free').length,
          enhancedStreamingGames: games.filter(game => game.source === 'streaming-enhanced').length
        }
      }
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('❌ Error in sports guide API:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to generate sports guide' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')
    
    // Special action to get Spectrum channel lineup
    if (action === 'spectrum-channels') {
      const channelLineup = await spectrumChannelService.getChannelLineup()
      return NextResponse.json(channelLineup)
    }
    
    // Special action to get sports channels only
    if (action === 'spectrum-sports') {
      const sportsChannels = await spectrumChannelService.getSportsChannels()
      return NextResponse.json({
        success: true,
        sportsChannels,
        totalCount: sportsChannels.length
      })
    }
    
    return NextResponse.json({
      success: true,
      message: 'Enhanced Live Sports Guide API is active',
      version: '3.1.0',
      dataSources: [
        'ESPN API (Free) - NFL, NBA, MLB, NHL, NCAA Football, NCAA Basketball, MLS',
        'TheSportsDB API (Free) - Premier League, Champions League, La Liga, Serie A, Bundesliga',
        'NFL Sunday Ticket Service - Out-of-market NFL games identification',
        'Spectrum Channel Service - Real-time channel lineup (Wisconsin/Madison Market)'
      ],
      endpoints: {
        'POST /api/sports-guide': 'Generate enhanced sports guide with selected leagues using live data',
        'GET /api/sports-guide': 'Get API information and status',
        'GET /api/sports-guide?action=spectrum-channels': 'Get current Spectrum channel lineup',
        'GET /api/sports-guide?action=spectrum-sports': 'Get Spectrum sports channels only',
        'POST /api/sports-guide/scheduled': 'Run scheduled update with all leagues',
        'GET /api/sports-guide/test-providers': 'Test live API connectivity'
      },
      availableChannels: CHANNELS.length,
      supportedLeagues: {
        'nfl': 'NFL (ESPN API)',
        'nba': 'NBA (ESPN API)', 
        'mlb': 'MLB (ESPN API)',
        'nhl': 'NHL (ESPN API)',
        'ncaa-fb': 'NCAA Football (ESPN API)',
        'ncaa-bb': 'NCAA Basketball (ESPN API)',
        'mls': 'MLS (ESPN API)',
        'premier': 'Premier League (TheSportsDB)',
        'champions': 'Champions League (TheSportsDB)',
        'la-liga': 'La Liga (TheSportsDB)',
        'serie-a': 'Serie A (TheSportsDB)',
        'bundesliga': 'Bundesliga (TheSportsDB)',
        'high-school': 'High School Sports'
      },
      specialFeatures: {
        'sundayTicket': 'NFL Sunday Ticket exclusive game identification',
        'locationBased': 'Location-based high school sports discovery',
        'multiCategory': 'Professional, College, High School, and International sports',
        'spectrumIntegration': 'Live Spectrum Business TV channel lineup integration',
        'realChannelNumbers': 'Accurate channel numbers for Wisconsin/Madison market'
      },
      features: [
        'Live game data from multiple real APIs only',
        'Real-time scores and game status',
        'NFL Sunday Ticket exclusive games identification',
        'Location-based sports discovery',
        'Multi-category sports coverage (real data only)',
        'No mock data fallbacks - only authentic live data',
        'Enhanced channel and broadcast information',
        'Real Spectrum channel lineup integration',
        'Accurate channel numbers and HD indicators',
        'Timezone-aware scheduling',
        'Multi-league support',
        'Returns empty results if no real data available'
      ]
    })
  } catch (error) {
    console.error('Error in enhanced sports guide API:', error)
    return NextResponse.json(
      { success: false, error: 'API error' },
      { status: 500 }
    )
  }
}
