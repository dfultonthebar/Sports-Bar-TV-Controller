
import { NextRequest, NextResponse } from 'next/server'

// Configure route segment to be dynamic
export const dynamic = 'force-dynamic'

export interface ChannelInfo {
  id: string
  name: string
  url?: string
  platforms: string[]
  type: 'cable' | 'streaming' | 'ota'
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
  }
]

// Mock game data generator - FIXED DATE/TIME HANDLING
const generateMockGames = (selectedLeagues: string[]): GameListing[] => {
  const games: GameListing[] = []
  
  // Get current date/time in correct timezone - FIXED
  const now = new Date()
  const today = new Date(now.toLocaleString("en-US", {timeZone: "America/New_York"}))
  
  const teams = {
    'nfl': ['Patriots', 'Cowboys', 'Packers', 'Chiefs', '49ers', 'Ravens', 'Bills', 'Rams'],
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
    'bundesliga': ['Bayern Munich', 'Borussia Dortmund', 'RB Leipzig', 'Bayer Leverkusen', 'Union Berlin', 'Frankfurt', 'Wolfsburg', 'Freiburg']
  }
  
  const leagueNames = {
    'nfl': 'NFL',
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
    'bundesliga': 'Bundesliga'
  }

  selectedLeagues.forEach(leagueId => {
    const leagueTeams = teams[leagueId as keyof typeof teams] || ['Team A', 'Team B', 'Team C', 'Team D']
    const leagueName = leagueNames[leagueId as keyof typeof leagueNames] || leagueId.toUpperCase()
    
    // Generate 3-5 games per league
    const gameCount = Math.floor(Math.random() * 3) + 3
    
    for (let i = 0; i < gameCount; i++) {
      // FIXED: Generate games for next 7 days from current date
      const gameDate = new Date(today)
      const daysOffset = Math.floor(Math.random() * 7)
      gameDate.setDate(gameDate.getDate() + daysOffset)
      
      const homeTeam = leagueTeams[Math.floor(Math.random() * leagueTeams.length)]
      let awayTeam = leagueTeams[Math.floor(Math.random() * leagueTeams.length)]
      while (awayTeam === homeTeam) {
        awayTeam = leagueTeams[Math.floor(Math.random() * leagueTeams.length)]
      }
      
      const channel = CHANNELS[Math.floor(Math.random() * CHANNELS.length)]
      
      // FIXED: Better time formatting and realistic game times
      const gameHour = Math.floor(Math.random() * 10) + 10 // Games between 10 AM and 8 PM
      const gameMinute = ['00', '15', '30', '45'][Math.floor(Math.random() * 4)]
      const displayHour = gameHour > 12 ? gameHour - 12 : gameHour === 0 ? 12 : gameHour
      const ampm = gameHour >= 12 ? 'PM' : 'AM'
      const gameTime = `${displayHour}:${gameMinute} ${ampm} EST`
      
      games.push({
        id: `${leagueId}-game-${i + 1}`,
        league: leagueName,
        homeTeam,
        awayTeam,
        gameTime,
        gameDate: gameDate.toISOString().split('T')[0],
        channel,
        description: `${leagueName} regular season matchup`,
        priority: Math.random() > 0.7 ? 'high' : Math.random() > 0.4 ? 'medium' : 'low'
      })
    }
  })
  
  // Sort games by date and time
  return games.sort((a, b) => {
    const dateA = new Date(`${a.gameDate} ${a.gameTime}`)
    const dateB = new Date(`${b.gameDate} ${b.gameTime}`)
    return dateA.getTime() - dateB.getTime()
  })
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { selectedLeagues } = body

    if (!selectedLeagues || !Array.isArray(selectedLeagues) || selectedLeagues.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No leagues selected' },
        { status: 400 }
      )
    }

    // Generate mock sports guide data
    const games = generateMockGames(selectedLeagues)
    
    const response = {
      success: true,
      data: {
        games,
        generatedAt: new Date().toISOString(),
        selectedLeagues,
        totalGames: games.length,
        channels: Array.from(new Set(games.map(game => game.channel.name))),
        summary: {
          upcomingGames: games.filter(game => {
            const gameDate = new Date(`${game.gameDate} ${game.gameTime}`)
            return gameDate > new Date()
          }).length,
          platforms: Array.from(new Set(games.flatMap(game => game.channel.platforms))),
          streamingServices: games.filter(game => game.channel.type === 'streaming').length,
          cableChannels: games.filter(game => game.channel.type === 'cable').length
        }
      }
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Error generating sports guide:', error)
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
      message: 'Sports Guide API is active',
      endpoints: {
        'POST /api/sports-guide': 'Generate sports guide with selected leagues',
        'GET /api/leagues': 'Get available sports leagues'
      },
      availableChannels: CHANNELS.length,
      supportedLeagues: Object.keys({
        'nfl': 'NFL',
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
        'bundesliga': 'Bundesliga'
      })
    })
  } catch (error) {
    console.error('Error in sports guide API:', error)
    return NextResponse.json(
      { success: false, error: 'API error' },
      { status: 500 }
    )
  }
}
