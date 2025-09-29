
import { NextRequest, NextResponse } from 'next/server'
import { enhancedLiveSportsService } from '../../../lib/sports-apis/enhanced-live-sports-service'

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
  source?: 'espn' | 'sportsdb' | 'nfhs' | 'sunday-ticket' | 'mock'
}

const CHANNELS: ChannelInfo[] = [
  {
    id: 'espn',
    name: 'ESPN',
    platforms: ['DirecTV Ch. 206', 'Spectrum Ch. 300', 'Hulu Live TV', 'YouTube TV', 'Sling TV'],
    type: 'cable',
    cost: 'subscription',
    url: 'https://www.espn.com/watch/',
    channelNumber: '206',
    deviceType: 'cable'
  },
  {
    id: 'espn2',
    name: 'ESPN2',
    platforms: ['DirecTV Ch. 209', 'Spectrum Ch. 301', 'Hulu Live TV', 'YouTube TV', 'Sling TV'],
    type: 'cable',
    cost: 'subscription',
    url: 'https://www.espn.com/watch/',
    channelNumber: '209',
    deviceType: 'cable'
  },
  {
    id: 'espnu',
    name: 'ESPNU',
    platforms: ['DirecTV Ch. 208', 'Spectrum Ch. 302', 'Hulu Live TV', 'YouTube TV', 'Sling TV'],
    type: 'cable',
    cost: 'subscription',
    url: 'https://www.espn.com/watch/',
    channelNumber: '208',
    deviceType: 'cable'
  },
  {
    id: 'espn-news',
    name: 'ESPN News',
    platforms: ['DirecTV Ch. 207', 'Spectrum Ch. 303', 'Hulu Live TV', 'YouTube TV', 'Sling TV'],
    type: 'cable',
    cost: 'subscription',
    url: 'https://www.espn.com/watch/',
    channelNumber: '207',
    deviceType: 'cable'
  },
  {
    id: 'fox-sports',
    name: 'Fox Sports 1 (FS1)',
    platforms: ['DirecTV Ch. 219', 'Spectrum Ch. 311', 'Hulu Live TV', 'YouTube TV', 'FuboTV'],
    type: 'cable',
    cost: 'subscription',
    url: 'https://www.foxsports.com/live',
    channelNumber: '219',
    deviceType: 'satellite'
  },
  {
    id: 'fox-sports2',
    name: 'Fox Sports 2 (FS2)',
    platforms: ['DirecTV Ch. 618', 'Spectrum Ch. 312', 'Hulu Live TV', 'YouTube TV', 'FuboTV'],
    type: 'cable',
    cost: 'subscription',
    url: 'https://www.foxsports.com/live',
    channelNumber: '618',
    deviceType: 'satellite'
  },
  {
    id: 'big-ten-network',
    name: 'Big Ten Network',
    platforms: ['DirecTV Ch. 610', 'Spectrum Ch. 320', 'Hulu Live TV', 'YouTube TV', 'FuboTV'],
    type: 'cable',
    cost: 'subscription',
    url: 'https://www.btn.com/watch/',
    channelNumber: '610',
    deviceType: 'satellite'
  },
  {
    id: 'bally-sports',
    name: 'Bally Sports Regional',
    platforms: ['DirecTV Ch. 671', 'Spectrum Regional', 'FuboTV'],
    type: 'cable',
    cost: 'subscription',
    url: 'https://www.ballysports.com/',
    channelNumber: '671',
    deviceType: 'satellite'
  },
  {
    id: 'golf-channel',
    name: 'Golf Channel',
    platforms: ['DirecTV Ch. 218', 'Spectrum Ch. 400', 'Hulu Live TV', 'YouTube TV', 'Peacock Premium'],
    type: 'cable',
    cost: 'subscription',
    url: 'https://www.golfchannel.com/watch',
    channelNumber: '218',
    deviceType: 'satellite'
  },
  {
    id: 'nfl-network',
    name: 'NFL Network',
    platforms: ['DirecTV Ch. 212', 'Spectrum Ch. 304', 'Hulu Live TV', 'YouTube TV', 'Sling TV'],
    type: 'cable',
    cost: 'subscription',
    url: 'https://www.nfl.com/network/',
    channelNumber: '212',
    deviceType: 'satellite'
  },
  {
    id: 'nfl-redzone',
    name: 'NFL RedZone',
    platforms: ['DirecTV Ch. 213', 'Spectrum Premium', 'Hulu Live TV', 'YouTube TV'],
    type: 'cable',
    cost: 'premium',
    url: 'https://www.nfl.com/redzone/',
    channelNumber: '213',
    deviceType: 'satellite'
  },
  {
    id: 'nba-tv',
    name: 'NBA TV',
    platforms: ['DirecTV Ch. 216', 'Spectrum Ch. 305', 'Hulu Live TV', 'YouTube TV', 'Sling TV'],
    type: 'cable',
    cost: 'subscription',
    url: 'https://www.nba.com/watch/',
    channelNumber: '216',
    deviceType: 'satellite'
  },
  {
    id: 'mlb-network',
    name: 'MLB Network',
    platforms: ['DirecTV Ch. 213', 'Spectrum Ch. 306', 'Hulu Live TV', 'YouTube TV', 'FuboTV'],
    type: 'cable',
    cost: 'subscription',
    url: 'https://www.mlb.com/network',
    channelNumber: '213',
    deviceType: 'satellite'
  },
  {
    id: 'nhl-network',
    name: 'NHL Network',
    platforms: ['DirecTV Ch. 215', 'Spectrum Ch. 307', 'Hulu Live TV', 'YouTube TV', 'FuboTV'],
    type: 'cable',
    cost: 'subscription',
    url: 'https://www.nhl.com/tv',
    channelNumber: '215',
    deviceType: 'satellite'
  },
  {
    id: 'sec-network',
    name: 'SEC Network',
    platforms: ['DirecTV Ch. 611', 'Spectrum Ch. 321', 'Hulu Live TV', 'YouTube TV', 'FuboTV'],
    type: 'cable',
    cost: 'subscription',
    url: 'https://www.espn.com/watch/',
    channelNumber: '611',
    deviceType: 'satellite'
  },
  {
    id: 'acc-network',
    name: 'ACC Network',
    platforms: ['DirecTV Ch. 612', 'Spectrum Ch. 322', 'Hulu Live TV', 'YouTube TV', 'FuboTV'],
    type: 'cable',
    cost: 'subscription',
    url: 'https://www.espn.com/watch/',
    channelNumber: '612',
    deviceType: 'satellite'
  },
  {
    id: 'pac12-network',
    name: 'Pac-12 Network',
    platforms: ['DirecTV Ch. 613', 'Spectrum Ch. 323', 'FuboTV'],
    type: 'cable',
    cost: 'subscription',
    url: 'https://pac-12.com/live',
    channelNumber: '613',
    deviceType: 'satellite'
  },
  {
    id: 'tennis-channel',
    name: 'Tennis Channel',
    platforms: ['DirecTV Ch. 217', 'Spectrum Ch. 401', 'Hulu Live TV', 'YouTube TV', 'FuboTV'],
    type: 'cable',
    cost: 'subscription',
    url: 'https://www.tennischannel.com/watch',
    channelNumber: '217',
    deviceType: 'satellite'
  },
  {
    id: 'olympic-channel',
    name: 'Olympic Channel',
    platforms: ['DirecTV Ch. 388', 'Spectrum Ch. 402', 'FuboTV', 'Peacock Premium'],
    type: 'cable',
    cost: 'subscription',
    url: 'https://www.olympicchannel.com/',
    channelNumber: '388',
    deviceType: 'satellite'
  },
  {
    id: 'nbc-sports',
    name: 'NBC Sports',
    platforms: ['DirecTV Ch. 220', 'Spectrum Ch. 312', 'Peacock Premium', 'Hulu Live TV'],
    type: 'cable',
    cost: 'subscription',
    url: 'https://www.nbcsports.com/live',
    channelNumber: '220',
    deviceType: 'satellite'
  },
  {
    id: 'cbs-sports',
    name: 'CBS Sports Network',
    platforms: ['DirecTV Ch. 221', 'Spectrum Ch. 313', 'Paramount+', 'FuboTV'],
    type: 'cable',
    cost: 'subscription',
    url: 'https://www.cbssports.com/live-tv/',
    channelNumber: '221',
    deviceType: 'satellite'
  },
  {
    id: 'tnt',
    name: 'TNT',
    platforms: ['DirecTV Ch. 245', 'Spectrum Ch. 32', 'Hulu Live TV', 'YouTube TV', 'Max'],
    type: 'cable',
    cost: 'subscription',
    url: 'https://www.tntdrama.com/watchtnt',
    channelNumber: '245',
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
    id: 'nfhs-network',
    name: 'NFHS Network',
    platforms: ['NFHS Network App', 'Web Browser', 'Roku', 'Apple TV', 'Smart TVs'],
    type: 'streaming',
    cost: 'subscription',
    url: 'https://www.nfhsnetwork.com',
    appCommand: 'HOME,APPS,NFHS,OK',
    deviceType: 'streaming'
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

// Fallback mock game generator for when APIs are unavailable
const generateMockGames = (selectedLeagues: string[]): GameListing[] => {
  console.log('⚠️ Falling back to mock data generation')
  const games: GameListing[] = []
  
  const now = new Date()
  const today = new Date(now.toLocaleString("en-US", {timeZone: "America/New_York"}))
  
  const teams = {
    'nfl': ['Patriots', 'Cowboys', 'Packers', 'Chiefs', '49ers', 'Ravens', 'Bills', 'Rams'],
    'nfl-sunday-ticket': ['Chargers', 'Raiders', 'Cardinals', 'Panthers', 'Jaguars', 'Titans', 'Bengals', 'Browns'],
    'nba': ['Lakers', 'Warriors', 'Celtics', 'Nets', 'Bucks', 'Heat', 'Suns', 'Nuggets'],
    'mlb': ['Yankees', 'Dodgers', 'Red Sox', 'Giants', 'Cubs', 'Astros', 'Phillies', 'Braves'],
    'nhl': ['Bruins', 'Rangers', 'Blackhawks', 'Kings', 'Penguins', 'Lightning', 'Capitals', 'Avalanche'],
    'ncaa-fb': ['Alabama', 'Georgia', 'Michigan', 'Ohio State', 'Clemson', 'USC', 'Texas', 'Oklahoma'],
    'ncaa-bb': ['Duke', 'Kentucky', 'North Carolina', 'Kansas', 'Gonzaga', 'Villanova', 'UCLA', 'Michigan State'],
    'mls': ['LAFC', 'Atlanta United', 'Seattle Sounders', 'NYCFC', 'Portland Timbers', 'Toronto FC', 'Galaxy', 'Austin FC'],
    'premier': ['Manchester City', 'Arsenal', 'Liverpool', 'Chelsea', 'Manchester United', 'Tottenham', 'Newcastle', 'Brighton'],
    'champions': ['Real Madrid', 'Barcelona', 'Bayern Munich', 'PSG', 'Manchester City', 'Liverpool', 'AC Milan', 'Inter Milan'],
    'la-liga': ['Real Madrid', 'Barcelona', 'Atletico Madrid', 'Sevilla', 'Real Betis', 'Villarreal', 'Valencia', 'Athletic Bilbao'],
    'serie-a': ['Juventus', 'AC Milan', 'Inter Milan', 'Napoli', 'Roma', 'Lazio', 'Atalanta', 'Fiorentina'],
    'bundesliga': ['Bayern Munich', 'Borussia Dortmund', 'RB Leipzig', 'Bayer Leverkusen', 'Union Berlin', 'Frankfurt', 'Wolfsburg', 'Freiburg'],
    'high-school': ['Madison West Regents', 'Milwaukee Hamilton Chargers', 'Green Bay East Red Devils', 'Appleton North Lightning', 'Stevens Point Panthers', 'Oshkosh North Spartans'],
    'nfhs': ['La Crosse Central Red Raiders', 'Eau Claire Memorial Old Abes', 'Waukesha West Wolverines', 'Kenosha Bradford Red Devils']
  }
  
  const leagueNames = {
    'nfl': 'NFL',
    'nfl-sunday-ticket': 'NFL Sunday Ticket',
    'nba': 'NBA', 
    'mlb': 'MLB',
    'nhl': 'NHL',
    'ncaa-fb': 'NCAA Football',
    'ncaa-bb': 'NCAA Basketball',
    'mls': 'MLS',
    'premier': 'Premier League',
    'champions': 'Champions League',
    'la-liga': 'La Liga',
    'serie-a': 'Serie A',
    'bundesliga': 'Bundesliga',
    'high-school': 'High School Sports',
    'nfhs': 'NFHS Network'
  }

  selectedLeagues.forEach(leagueId => {
    const leagueTeams = teams[leagueId as keyof typeof teams] || ['Team A', 'Team B', 'Team C', 'Team D']
    const leagueName = leagueNames[leagueId as keyof typeof leagueNames] || leagueId.toUpperCase()
    
    const gameCount = Math.floor(Math.random() * 3) + 2 // Reduced to 2-4 games per league
    
    for (let i = 0; i < gameCount; i++) {
      const gameDate = new Date(today)
      const daysOffset = Math.floor(Math.random() * 7)
      gameDate.setDate(gameDate.getDate() + daysOffset)
      
      const homeTeam = leagueTeams[Math.floor(Math.random() * leagueTeams.length)]
      let awayTeam = leagueTeams[Math.floor(Math.random() * leagueTeams.length)]
      while (awayTeam === homeTeam) {
        awayTeam = leagueTeams[Math.floor(Math.random() * leagueTeams.length)]
      }
      
      const channel = CHANNELS[Math.floor(Math.random() * CHANNELS.length)]
      
      const gameHour = Math.floor(Math.random() * 10) + 10
      const gameMinute = ['00', '15', '30', '45'][Math.floor(Math.random() * 4)]
      const displayHour = gameHour > 12 ? gameHour - 12 : gameHour === 0 ? 12 : gameHour
      const ampm = gameHour >= 12 ? 'PM' : 'AM'
      const gameTime = `${displayHour}:${gameMinute} ${ampm} EST`
      
      games.push({
        id: `mock-${leagueId}-game-${i + 1}`,
        league: leagueName,
        homeTeam,
        awayTeam,
        gameTime,
        gameDate: gameDate.toISOString().split('T')[0],
        channel,
        description: `${leagueName} regular season matchup (Mock Data)`,
        priority: Math.random() > 0.7 ? 'high' : Math.random() > 0.4 ? 'medium' : 'low',
        status: 'upcoming',
        source: 'mock'
      })
    }
  })
  
  return games.sort((a, b) => {
    const dateA = new Date(`${a.gameDate} ${a.gameTime}`)
    const dateB = new Date(`${b.gameDate} ${b.gameTime}`)
    return dateA.getTime() - dateB.getTime()
  })
}

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
    let dataSource = 'Live APIs (ESPN + TheSportsDB + NFHS + Sunday Ticket)'
    let apiSources: string[] = []

    try {
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
        // Convert enhanced live data to GameListing format
        games = enhancedData.games.map(game => ({
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
        
        apiSources = enhancedData.sources
        
        console.log(`✅ Successfully fetched ${enhancedData.totalGames} games from enhanced APIs`)
        console.log(`📊 Live: ${enhancedData.liveGames}, Upcoming: ${enhancedData.upcomingGames}, Completed: ${enhancedData.completedGames}`)
        console.log(`🏆 Professional: ${enhancedData.categories.professional}, College: ${enhancedData.categories.college}`)
        console.log(`🏫 High School: ${enhancedData.categories.highSchool}, International: ${enhancedData.categories.international}`)
        console.log(`📺 Sunday Ticket: ${enhancedData.sundayTicketGames}, NFHS Streams: ${enhancedData.nfhsStreamingGames}`)
        
      } else {
        console.log('⚠️ No enhanced data available, falling back to mock data')
        games = generateMockGames(selectedLeagues)
        dataSource = 'Mock Data (Fallback)'
        apiSources = ['Mock Generator']
      }
      
    } catch (error) {
      console.error('❌ Error fetching enhanced sports data:', error)
      console.log('⚠️ Falling back to mock data due to API error')
      games = generateMockGames(selectedLeagues)
      dataSource = 'Mock Data (API Error Fallback)'
      apiSources = ['Mock Generator']
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
        summary: {
          liveGames: games.filter(game => game.status === 'live').length,
          upcomingGames: games.filter(game => game.status === 'upcoming').length,
          completedGames: games.filter(game => game.status === 'completed').length,
          platforms: Array.from(new Set(games.flatMap(game => game.channel.platforms))),
          streamingServices: games.filter(game => game.channel.type === 'streaming').length,
          cableChannels: games.filter(game => game.channel.type === 'cable').length,
          freeChannels: games.filter(game => game.channel.cost === 'free').length
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
    return NextResponse.json({
      success: true,
      message: 'Enhanced Live Sports Guide API is active',
      version: '3.0.0',
      dataSources: [
        'ESPN API (Free) - NFL, NBA, MLB, NHL, NCAA Football, NCAA Basketball, MLS',
        'TheSportsDB API (Free) - Premier League, Champions League, La Liga, Serie A, Bundesliga',
        'NFHS Network API - High School Sports (all sports, location-based)',
        'NFL Sunday Ticket Service - Out-of-market NFL games identification'
      ],
      endpoints: {
        'POST /api/sports-guide': 'Generate enhanced sports guide with selected leagues using live data',
        'GET /api/sports-guide': 'Get API information and status',
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
        'high-school': 'High School Sports (NFHS Network)',
        'nfhs': 'NFHS Network Streaming Games'
      },
      specialFeatures: {
        'sundayTicket': 'NFL Sunday Ticket exclusive game identification',
        'nfhsStreaming': 'NFHS Network live streaming games',
        'locationBased': 'Location-based high school sports discovery',
        'multiCategory': 'Professional, College, High School, and International sports'
      },
      features: [
        'Live game data from multiple free APIs',
        'Real-time scores and game status',
        'NFL Sunday Ticket exclusive games identification',
        'NFHS Network high school sports integration',
        'Location-based sports discovery',
        'Multi-category sports coverage',
        'Automatic fallback to mock data if APIs unavailable',
        'Enhanced channel and broadcast information',
        'Timezone-aware scheduling',
        'Multi-league support',
        'No API keys required for basic functionality'
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
