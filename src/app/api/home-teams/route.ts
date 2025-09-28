
import { NextRequest, NextResponse } from 'next/server'

// Configure route segment to be dynamic
export const dynamic = 'force-dynamic'

// Sample team data for different leagues and categories
export interface TeamSuggestion {
  name: string
  league: string
  category: string
  sport: string
  location: string
  conference?: string
}

const TEAM_SUGGESTIONS: TeamSuggestion[] = [
  // NFL Teams
  { name: 'Green Bay Packers', league: 'nfl', category: 'professional', sport: 'football', location: 'Green Bay, WI', conference: 'NFC North' },
  { name: 'Pittsburgh Steelers', league: 'nfl', category: 'professional', sport: 'football', location: 'Pittsburgh, PA', conference: 'AFC North' },
  { name: 'New England Patriots', league: 'nfl', category: 'professional', sport: 'football', location: 'Foxborough, MA', conference: 'AFC East' },
  { name: 'Dallas Cowboys', league: 'nfl', category: 'professional', sport: 'football', location: 'Dallas, TX', conference: 'NFC East' },
  { name: 'San Francisco 49ers', league: 'nfl', category: 'professional', sport: 'football', location: 'San Francisco, CA', conference: 'NFC West' },
  { name: 'Kansas City Chiefs', league: 'nfl', category: 'professional', sport: 'football', location: 'Kansas City, MO', conference: 'AFC West' },

  // NBA Teams
  { name: 'Los Angeles Lakers', league: 'nba', category: 'professional', sport: 'basketball', location: 'Los Angeles, CA', conference: 'Western Conference' },
  { name: 'Boston Celtics', league: 'nba', category: 'professional', sport: 'basketball', location: 'Boston, MA', conference: 'Eastern Conference' },
  { name: 'Golden State Warriors', league: 'nba', category: 'professional', sport: 'basketball', location: 'San Francisco, CA', conference: 'Western Conference' },
  { name: 'Milwaukee Bucks', league: 'nba', category: 'professional', sport: 'basketball', location: 'Milwaukee, WI', conference: 'Eastern Conference' },

  // MLB Teams
  { name: 'New York Yankees', league: 'mlb', category: 'professional', sport: 'baseball', location: 'New York, NY', conference: 'American League East' },
  { name: 'Los Angeles Dodgers', league: 'mlb', category: 'professional', sport: 'baseball', location: 'Los Angeles, CA', conference: 'National League West' },
  { name: 'Boston Red Sox', league: 'mlb', category: 'professional', sport: 'baseball', location: 'Boston, MA', conference: 'American League East' },

  // NHL Teams
  { name: 'Pittsburgh Penguins', league: 'nhl', category: 'professional', sport: 'hockey', location: 'Pittsburgh, PA', conference: 'Eastern Conference' },
  { name: 'Chicago Blackhawks', league: 'nhl', category: 'professional', sport: 'hockey', location: 'Chicago, IL', conference: 'Western Conference' },

  // College Football (Big Programs)
  { name: 'Alabama Crimson Tide', league: 'ncaa-fb', category: 'college', sport: 'football', location: 'Tuscaloosa, AL', conference: 'SEC' },
  { name: 'Georgia Bulldogs', league: 'ncaa-fb', category: 'college', sport: 'football', location: 'Athens, GA', conference: 'SEC' },
  { name: 'Michigan Wolverines', league: 'ncaa-fb', category: 'college', sport: 'football', location: 'Ann Arbor, MI', conference: 'Big Ten' },
  { name: 'Ohio State Buckeyes', league: 'ncaa-fb', category: 'college', sport: 'football', location: 'Columbus, OH', conference: 'Big Ten' },
  { name: 'Texas Longhorns', league: 'ncaa-fb', category: 'college', sport: 'football', location: 'Austin, TX', conference: 'SEC' },
  { name: 'USC Trojans', league: 'ncaa-fb', category: 'college', sport: 'football', location: 'Los Angeles, CA', conference: 'Big Ten' },
  { name: 'Wisconsin Badgers', league: 'ncaa-fb', category: 'college', sport: 'football', location: 'Madison, WI', conference: 'Big Ten' },
  { name: 'Penn State Nittany Lions', league: 'ncaa-fb', category: 'college', sport: 'football', location: 'University Park, PA', conference: 'Big Ten' },

  // College Basketball
  { name: 'Duke Blue Devils', league: 'ncaa-bb', category: 'college', sport: 'basketball', location: 'Durham, NC', conference: 'ACC' },
  { name: 'Kentucky Wildcats', league: 'ncaa-bb', category: 'college', sport: 'basketball', location: 'Lexington, KY', conference: 'SEC' },
  { name: 'North Carolina Tar Heels', league: 'ncaa-bb', category: 'college', sport: 'basketball', location: 'Chapel Hill, NC', conference: 'ACC' },
  { name: 'Kansas Jayhawks', league: 'ncaa-bb', category: 'college', sport: 'basketball', location: 'Lawrence, KS', conference: 'Big 12' },
  { name: 'Villanova Wildcats', league: 'ncaa-bb', category: 'college', sport: 'basketball', location: 'Villanova, PA', conference: 'Big East' },

  // High School Examples (Wisconsin focus only)
  { name: 'Bay Port Pirates', league: 'high-school', category: 'high-school', sport: 'football', location: 'Green Bay, WI', conference: 'FRCC' },
  { name: 'De Pere Redbirds', league: 'high-school', category: 'high-school', sport: 'football', location: 'De Pere, WI', conference: 'FRCC' },
  { name: 'Appleton North Lightning', league: 'high-school', category: 'high-school', sport: 'football', location: 'Appleton, WI', conference: 'FVA' },
  { name: 'Kimberly Papermakers', league: 'high-school', category: 'high-school', sport: 'football', location: 'Kimberly, WI', conference: 'FVA' },
  { name: 'Homestead Highlanders', league: 'high-school', category: 'high-school', sport: 'football', location: 'Mequon, WI', conference: 'North Shore' },
  { name: 'Green Bay Southwest Trojans', league: 'high-school', category: 'high-school', sport: 'football', location: 'Green Bay, WI', conference: 'FRCC' },
  { name: 'Ashwaubenon Jaguars', league: 'high-school', category: 'high-school', sport: 'football', location: 'Ashwaubenon, WI', conference: 'FRCC' },
  { name: 'Pulaski Red Raiders', league: 'high-school', category: 'high-school', sport: 'football', location: 'Pulaski, WI', conference: 'FRCC' },

  // High School Basketball (Wisconsin)
  { name: 'Monona Grove Silver Eagles', league: 'high-school', category: 'high-school', sport: 'basketball', location: 'Monona, WI', conference: 'Badger Conference' },
  { name: 'Sun Prairie Cardinals', league: 'high-school', category: 'high-school', sport: 'basketball', location: 'Sun Prairie, WI', conference: 'Big Eight Conference' },
  { name: 'Madison Memorial Spartans', league: 'high-school', category: 'high-school', sport: 'basketball', location: 'Madison, WI', conference: 'Big Eight Conference' },
  { name: 'Middleton Cardinals', league: 'high-school', category: 'high-school', sport: 'basketball', location: 'Middleton, WI', conference: 'Big Eight Conference' },

  // Soccer/International
  { name: 'Manchester City', league: 'premier', category: 'international', sport: 'soccer', location: 'Manchester, England', conference: 'Premier League' },
  { name: 'Liverpool FC', league: 'premier', category: 'international', sport: 'soccer', location: 'Liverpool, England', conference: 'Premier League' },
  { name: 'Real Madrid', league: 'la-liga', category: 'international', sport: 'soccer', location: 'Madrid, Spain', conference: 'La Liga' },
  { name: 'FC Barcelona', league: 'la-liga', category: 'international', sport: 'soccer', location: 'Barcelona, Spain', conference: 'La Liga' },

  // MLS
  { name: 'LAFC', league: 'mls', category: 'professional', sport: 'soccer', location: 'Los Angeles, CA', conference: 'Western Conference' },
  { name: 'Atlanta United', league: 'mls', category: 'professional', sport: 'soccer', location: 'Atlanta, GA', conference: 'Eastern Conference' },
  { name: 'Seattle Sounders', league: 'mls', category: 'professional', sport: 'soccer', location: 'Seattle, WA', conference: 'Western Conference' }
]

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q')?.toLowerCase() || ''
    const league = searchParams.get('league')
    const category = searchParams.get('category')
    const sport = searchParams.get('sport')

    let filteredTeams = TEAM_SUGGESTIONS

    // Apply filters
    if (query) {
      filteredTeams = filteredTeams.filter(team =>
        team.name.toLowerCase().includes(query) ||
        team.location.toLowerCase().includes(query) ||
        team.conference?.toLowerCase().includes(query)
      )
    }

    if (league) {
      filteredTeams = filteredTeams.filter(team => team.league === league)
    }

    if (category) {
      filteredTeams = filteredTeams.filter(team => team.category === category)
    }

    if (sport) {
      filteredTeams = filteredTeams.filter(team => team.sport === sport)
    }

    // Group by category for better organization
    const teamsByCategory = filteredTeams.reduce((acc, team) => {
      if (!acc[team.category]) acc[team.category] = []
      acc[team.category].push(team)
      return acc
    }, {} as Record<string, TeamSuggestion[]>)

    return NextResponse.json({
      success: true,
      data: {
        teams: filteredTeams.slice(0, 50), // Limit results
        teamsByCategory,
        total: filteredTeams.length
      }
    })
  } catch (error) {
    console.error('Error loading team suggestions:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to load team suggestions' },
      { status: 500 }
    )
  }
}
