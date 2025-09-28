
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

  // MLB Teams - Complete List
  { name: 'New York Yankees', league: 'mlb', category: 'professional', sport: 'baseball', location: 'New York, NY', conference: 'American League East' },
  { name: 'Boston Red Sox', league: 'mlb', category: 'professional', sport: 'baseball', location: 'Boston, MA', conference: 'American League East' },
  { name: 'Toronto Blue Jays', league: 'mlb', category: 'professional', sport: 'baseball', location: 'Toronto, ON', conference: 'American League East' },
  { name: 'Baltimore Orioles', league: 'mlb', category: 'professional', sport: 'baseball', location: 'Baltimore, MD', conference: 'American League East' },
  { name: 'Tampa Bay Rays', league: 'mlb', category: 'professional', sport: 'baseball', location: 'Tampa Bay, FL', conference: 'American League East' },
  
  { name: 'Houston Astros', league: 'mlb', category: 'professional', sport: 'baseball', location: 'Houston, TX', conference: 'American League West' },
  { name: 'Seattle Mariners', league: 'mlb', category: 'professional', sport: 'baseball', location: 'Seattle, WA', conference: 'American League West' },
  { name: 'Texas Rangers', league: 'mlb', category: 'professional', sport: 'baseball', location: 'Arlington, TX', conference: 'American League West' },
  { name: 'Los Angeles Angels', league: 'mlb', category: 'professional', sport: 'baseball', location: 'Anaheim, CA', conference: 'American League West' },
  { name: 'Oakland Athletics', league: 'mlb', category: 'professional', sport: 'baseball', location: 'Oakland, CA', conference: 'American League West' },
  
  { name: 'Cleveland Guardians', league: 'mlb', category: 'professional', sport: 'baseball', location: 'Cleveland, OH', conference: 'American League Central' },
  { name: 'Minnesota Twins', league: 'mlb', category: 'professional', sport: 'baseball', location: 'Minneapolis, MN', conference: 'American League Central' },
  { name: 'Detroit Tigers', league: 'mlb', category: 'professional', sport: 'baseball', location: 'Detroit, MI', conference: 'American League Central' },
  { name: 'Chicago White Sox', league: 'mlb', category: 'professional', sport: 'baseball', location: 'Chicago, IL', conference: 'American League Central' },
  { name: 'Kansas City Royals', league: 'mlb', category: 'professional', sport: 'baseball', location: 'Kansas City, MO', conference: 'American League Central' },
  
  { name: 'Los Angeles Dodgers', league: 'mlb', category: 'professional', sport: 'baseball', location: 'Los Angeles, CA', conference: 'National League West' },
  { name: 'San Diego Padres', league: 'mlb', category: 'professional', sport: 'baseball', location: 'San Diego, CA', conference: 'National League West' },
  { name: 'San Francisco Giants', league: 'mlb', category: 'professional', sport: 'baseball', location: 'San Francisco, CA', conference: 'National League West' },
  { name: 'Arizona Diamondbacks', league: 'mlb', category: 'professional', sport: 'baseball', location: 'Phoenix, AZ', conference: 'National League West' },
  { name: 'Colorado Rockies', league: 'mlb', category: 'professional', sport: 'baseball', location: 'Denver, CO', conference: 'National League West' },
  
  { name: 'Atlanta Braves', league: 'mlb', category: 'professional', sport: 'baseball', location: 'Atlanta, GA', conference: 'National League East' },
  { name: 'New York Mets', league: 'mlb', category: 'professional', sport: 'baseball', location: 'New York, NY', conference: 'National League East' },
  { name: 'Philadelphia Phillies', league: 'mlb', category: 'professional', sport: 'baseball', location: 'Philadelphia, PA', conference: 'National League East' },
  { name: 'Miami Marlins', league: 'mlb', category: 'professional', sport: 'baseball', location: 'Miami, FL', conference: 'National League East' },
  { name: 'Washington Nationals', league: 'mlb', category: 'professional', sport: 'baseball', location: 'Washington, DC', conference: 'National League East' },
  
  { name: 'Milwaukee Brewers', league: 'mlb', category: 'professional', sport: 'baseball', location: 'Milwaukee, WI', conference: 'National League Central' },
  { name: 'St. Louis Cardinals', league: 'mlb', category: 'professional', sport: 'baseball', location: 'St. Louis, MO', conference: 'National League Central' },
  { name: 'Chicago Cubs', league: 'mlb', category: 'professional', sport: 'baseball', location: 'Chicago, IL', conference: 'National League Central' },
  { name: 'Cincinnati Reds', league: 'mlb', category: 'professional', sport: 'baseball', location: 'Cincinnati, OH', conference: 'National League Central' },
  { name: 'Pittsburgh Pirates', league: 'mlb', category: 'professional', sport: 'baseball', location: 'Pittsburgh, PA', conference: 'National League Central' },

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
