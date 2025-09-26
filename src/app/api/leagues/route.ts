
import { NextRequest, NextResponse } from 'next/server'

// Configure route segment to be dynamic
export const dynamic = 'force-dynamic'

export interface League {
  id: string
  name: string
  description: string
  category: 'professional' | 'college' | 'international'
  season: string
  logo?: string
}

const LEAGUES: League[] = [
  { 
    id: 'nfl', 
    name: 'NFL', 
    description: 'National Football League', 
    category: 'professional', 
    season: '2024-25'
  },
  { 
    id: 'nba', 
    name: 'NBA', 
    description: 'National Basketball Association', 
    category: 'professional', 
    season: '2024-25'
  },
  { 
    id: 'mlb', 
    name: 'MLB', 
    description: 'Major League Baseball', 
    category: 'professional', 
    season: '2024'
  },
  { 
    id: 'nhl', 
    name: 'NHL', 
    description: 'National Hockey League', 
    category: 'professional', 
    season: '2024-25'
  },
  { 
    id: 'ncaa-fb', 
    name: 'NCAA Football', 
    description: 'College Football', 
    category: 'college', 
    season: '2024'
  },
  { 
    id: 'ncaa-bb', 
    name: 'NCAA Basketball', 
    description: 'College Basketball', 
    category: 'college', 
    season: '2024-25'
  },
  { 
    id: 'mls', 
    name: 'MLS', 
    description: 'Major League Soccer', 
    category: 'professional', 
    season: '2024'
  },
  { 
    id: 'premier', 
    name: 'Premier League', 
    description: 'English Premier League', 
    category: 'international', 
    season: '2024-25'
  },
  { 
    id: 'champions', 
    name: 'Champions League', 
    description: 'UEFA Champions League', 
    category: 'international', 
    season: '2024-25'
  },
  { 
    id: 'la-liga', 
    name: 'La Liga', 
    description: 'Spanish Primera División', 
    category: 'international', 
    season: '2024-25'
  },
  { 
    id: 'serie-a', 
    name: 'Serie A', 
    description: 'Italian Serie A', 
    category: 'international', 
    season: '2024-25'
  },
  { 
    id: 'bundesliga', 
    name: 'Bundesliga', 
    description: 'German Bundesliga', 
    category: 'international', 
    season: '2024-25'
  }
]

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')
    const search = searchParams.get('search')

    let filteredLeagues = LEAGUES

    if (category && category !== 'all') {
      filteredLeagues = filteredLeagues.filter(league => league.category === category)
    }

    if (search) {
      const searchLower = search.toLowerCase()
      filteredLeagues = filteredLeagues.filter(league =>
        league.name.toLowerCase().includes(searchLower) ||
        league.description.toLowerCase().includes(searchLower)
      )
    }

    return NextResponse.json({
      success: true,
      data: filteredLeagues,
      total: filteredLeagues.length
    })
  } catch (error) {
    console.error('Error fetching leagues:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch leagues' },
      { status: 500 }
    )
  }
}
