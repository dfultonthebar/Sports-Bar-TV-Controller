
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

// Get API key from database for the specified provider
async function getApiKey(provider: string): Promise<string | null> {
  try {
    const { prisma } = await import('@/lib/db')
    const { decrypt } = await import('@/lib/encryption')
    
    const apiKeyRecord = await prisma.apiKey.findFirst({
      where: {
        provider,
        isActive: true,
      },
      select: { keyValue: true }
    })

    if (apiKeyRecord?.keyValue) {
      return decrypt(apiKeyRecord.keyValue)
    }
  } catch (error) {
    console.error(`Error getting API key for ${provider}:`, error)
  }
  return null
}

// AI provider configurations
interface AIProvider {
  name: string
  endpoint: string
  model: string
  headers: (apiKey: string) => Record<string, string>
  bodyFormat: (prompt: string, model: string) => any
  extractResponse: (data: any) => string | null
}

const AI_PROVIDERS: Record<string, AIProvider> = {
  abacus: {
    name: 'Abacus AI',
    endpoint: 'https://apps.abacus.ai/v1/chat/completions',
    model: 'gpt-4.1-mini',
    headers: (apiKey) => ({
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    }),
    bodyFormat: (prompt, model) => ({
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 2000
    }),
    extractResponse: (data) => data.choices?.[0]?.message?.content
  },
  openai: {
    name: 'OpenAI',
    endpoint: 'https://api.openai.com/v1/chat/completions',
    model: 'gpt-4o-mini',
    headers: (apiKey) => ({
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    }),
    bodyFormat: (prompt, model) => ({
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 2000
    }),
    extractResponse: (data) => data.choices?.[0]?.message?.content
  },
  claude: {
    name: 'Claude (Anthropic)',
    endpoint: 'https://api.anthropic.com/v1/messages',
    model: 'claude-3-haiku-20240307',
    headers: (apiKey) => ({
      'x-api-key': apiKey,
      'Content-Type': 'application/json',
      'anthropic-version': '2023-06-01'
    }),
    bodyFormat: (prompt, model) => ({
      model,
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }]
    }),
    extractResponse: (data) => data.content?.[0]?.text
  },
  grok: {
    name: 'Grok (X.AI)',
    endpoint: 'https://api.x.ai/v1/chat/completions',
    model: 'grok-beta',
    headers: (apiKey) => ({
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    }),
    bodyFormat: (prompt, model) => ({
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 2000
    }),
    extractResponse: (data) => data.choices?.[0]?.message?.content
  },
  ollama: {
    name: 'Ollama (Local)',
    endpoint: 'http://localhost:11434/api/generate',
    model: 'llama3.2:3b', // Default model, can be configured
    headers: () => ({
      'Content-Type': 'application/json',
    }),
    bodyFormat: (prompt, model) => ({
      model,
      prompt,
      stream: false,
      options: {
        temperature: 0.3,
        num_predict: 2000
      }
    }),
    extractResponse: (data) => data.response
  },
  localai: {
    name: 'LocalAI',
    endpoint: 'http://localhost:8080/v1/chat/completions',
    model: 'gpt-3.5-turbo', // Default model, can be configured
    headers: () => ({
      'Content-Type': 'application/json',
    }),
    bodyFormat: (prompt, model) => ({
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 2000
    }),
    extractResponse: (data) => data.choices?.[0]?.message?.content
  },
  'custom-local': {
    name: 'Custom Local AI',
    endpoint: 'http://localhost:8000/v1/chat/completions',
    model: 'default',
    headers: () => ({
      'Content-Type': 'application/json',
    }),
    bodyFormat: (prompt, model) => ({
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 2000
    }),
    extractResponse: (data) => data.choices?.[0]?.message?.content || data.response
  }
}

// AI-powered team search supporting multiple providers
async function searchTeamsWithAI(query: string): Promise<TeamSuggestion[]> {
  if (!query || query.trim().length < 2) {
    return []
  }

  const searchPrompt = `You are a sports team search assistant. Find teams that match the search query: "${query}"

Please search for teams that might match this query, including:
- Exact name matches
- Partial name matches
- Nickname variations (e.g., "Red Birds" vs "Redbirds")
- Location-based matches
- Alternative spellings or common variations

Focus on:
- Professional teams (NFL, NBA, MLB, NHL, MLS, etc.)
- College teams (NCAA Football, Basketball, etc.)  
- High school teams (especially Wisconsin area teams if location seems relevant)
- International teams if relevant

For each team found, provide this exact JSON format:
{
  "name": "Full Team Name",
  "league": "league-code",
  "category": "professional|college|high-school|international", 
  "sport": "football|basketball|baseball|hockey|soccer|etc",
  "location": "City, State/Country",
  "conference": "Conference/Division Name"
}

Return up to 20 relevant teams as a JSON array. If no teams match, return an empty array.`

  // Try providers in order of preference
  const providerOrder = ['abacus', 'openai', 'claude', 'grok', 'custom-local', 'localai', 'ollama']
  
  for (const providerId of providerOrder) {
    const provider = AI_PROVIDERS[providerId]
    if (!provider) continue

    try {
      let apiKey = null
      
      // Try to get API key from database first
      if (['abacus', 'openai', 'claude', 'grok'].includes(providerId)) {
        apiKey = await getApiKey(providerId)
        
        // Fallback to environment variables
        if (!apiKey) {
          switch (providerId) {
            case 'abacus':
              apiKey = process.env.ABACUSAI_API_KEY
              break
            case 'openai':
              apiKey = process.env.OPENAI_API_KEY
              break
            case 'claude':
              apiKey = process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY
              break
            case 'grok':
              apiKey = process.env.GROK_API_KEY || process.env.XAI_API_KEY
              break
          }
        }
        
        if (!apiKey) {
          console.log(`No API key found for ${provider.name}, trying next provider`)
          continue
        }
      }

      console.log(`Trying AI search with ${provider.name}...`)

      const headers = provider.headers(apiKey || '')
      const body = provider.bodyFormat(searchPrompt, provider.model)

      const response = await fetch(provider.endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(30000) // 30 second timeout
      })

      if (!response.ok) {
        console.error(`${provider.name} API request failed:`, response.status, response.statusText)
        continue
      }

      const data = await response.json()
      const aiResponse = provider.extractResponse(data)

      if (!aiResponse) {
        console.log(`No response content from ${provider.name}, trying next provider`)
        continue
      }

      // Try to parse JSON response
      try {
        // Extract JSON from response if it's wrapped in text
        const jsonMatch = aiResponse.match(/\[[\s\S]*\]/)
        const jsonStr = jsonMatch ? jsonMatch[0] : aiResponse
        
        const teams = JSON.parse(jsonStr)
        
        if (Array.isArray(teams) && teams.length > 0) {
          const validTeams = teams.filter(team => 
            team.name && team.league && team.category && team.sport && team.location
          )
          
          console.log(`AI search with ${provider.name} found ${validTeams.length} teams`)
          return validTeams
        }
      } catch (parseError) {
        console.error(`Error parsing ${provider.name} response:`, parseError)
        console.log('Raw response:', aiResponse)
        continue
      }
    } catch (error) {
      console.error(`Error with ${provider.name}:`, error.message)
      continue
    }
  }

  console.log('All AI providers failed or returned no results')
  return []
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
  { name: 'De Pere Red Birds', league: 'high-school', category: 'high-school', sport: 'football', location: 'De Pere, WI', conference: 'FRCC' },
  { name: 'DePere Red Birds', league: 'high-school', category: 'high-school', sport: 'football', location: 'De Pere, WI', conference: 'FRCC' },
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

// Improved fuzzy matching function
function fuzzyMatch(text: string, query: string): boolean {
  const textLower = text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim()
  const queryLower = query.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim()
  
  // Direct inclusion
  if (textLower.includes(queryLower)) return true
  
  // Word-based matching
  const queryWords = queryLower.split(' ')
  const textWords = textLower.split(' ')
  
  // Check if all query words are found in text (order doesn't matter)
  const allWordsFound = queryWords.every(qWord => 
    textWords.some(tWord => 
      tWord.includes(qWord) || qWord.includes(tWord) || 
      (qWord.length > 3 && tWord.length > 3 && levenshteinDistance(qWord, tWord) <= 1)
    )
  )
  
  return allWordsFound
}

// Simple Levenshtein distance for typo tolerance
function levenshteinDistance(str1: string, str2: string): number {
  const matrix = []
  
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i]
  }
  
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j
  }
  
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1]
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        )
      }
    }
  }
  
  return matrix[str2.length][str1.length]
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q') || ''
    const league = searchParams.get('league')
    const category = searchParams.get('category')
    const sport = searchParams.get('sport')

    let allTeams: TeamSuggestion[] = []
    
    // If there's a query, try AI search first
    if (query.trim().length > 0) {
      try {
        const aiTeams = await searchTeamsWithAI(query)
        allTeams = [...aiTeams]
        console.log(`AI search found ${aiTeams.length} teams for query: "${query}"`)
      } catch (error) {
        console.error('AI search failed:', error)
      }
    }

    // Always include static search with improved fuzzy matching
    let staticTeams = TEAM_SUGGESTIONS

    // Apply improved query filtering
    if (query.trim()) {
      staticTeams = staticTeams.filter(team => {
        return fuzzyMatch(team.name, query) ||
               fuzzyMatch(team.location, query) ||
               (team.conference && fuzzyMatch(team.conference, query)) ||
               fuzzyMatch(team.sport, query) ||
               fuzzyMatch(team.league, query)
      })
    }

    // Apply additional filters
    if (league) {
      staticTeams = staticTeams.filter(team => team.league === league)
    }

    if (category) {
      staticTeams = staticTeams.filter(team => team.category === category)
    }

    if (sport) {
      staticTeams = staticTeams.filter(team => team.sport === sport)
    }

    // Combine results and remove duplicates
    const combinedTeams = [...allTeams]
    
    for (const staticTeam of staticTeams) {
      const exists = combinedTeams.some(team => 
        team.name.toLowerCase() === staticTeam.name.toLowerCase() &&
        team.location.toLowerCase() === staticTeam.location.toLowerCase()
      )
      if (!exists) {
        combinedTeams.push(staticTeam)
      }
    }

    // Sort by relevance (exact matches first, then partial matches)
    if (query.trim()) {
      const queryLower = query.toLowerCase()
      combinedTeams.sort((a, b) => {
        const aExact = a.name.toLowerCase().includes(queryLower) ? 1 : 0
        const bExact = b.name.toLowerCase().includes(queryLower) ? 1 : 0
        
        if (aExact !== bExact) return bExact - aExact
        
        // Then by category priority (high-school, college, professional, international)
        const categoryPriority = { 'high-school': 4, 'college': 3, 'professional': 2, 'international': 1 }
        const aPriority = categoryPriority[a.category as keyof typeof categoryPriority] || 0
        const bPriority = categoryPriority[b.category as keyof typeof categoryPriority] || 0
        
        return bPriority - aPriority
      })
    }

    // Group by category for better organization
    const teamsByCategory = combinedTeams.reduce((acc, team) => {
      if (!acc[team.category]) acc[team.category] = []
      acc[team.category].push(team)
      return acc
    }, {} as Record<string, TeamSuggestion[]>)

    const finalTeams = combinedTeams.slice(0, 50) // Limit results

    return NextResponse.json({
      success: true,
      data: {
        teams: finalTeams,
        teamsByCategory,
        total: finalTeams.length,
        searchInfo: {
          query,
          aiResultsCount: allTeams.length,
          staticResultsCount: staticTeams.length,
          totalCombined: combinedTeams.length
        }
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
