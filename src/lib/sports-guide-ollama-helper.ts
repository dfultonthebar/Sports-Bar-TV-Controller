/**
 * Sports Guide Ollama Integration Helper
 * 
 * Provides local AI (Ollama) access to sports guide logs and functionality
 * for intelligent querying and analysis of sports programming data.
 * 
 * Version: 1.0.0
 * Last Updated: October 16, 2025
 */

import { exec } from 'child_process'
import { promisify } from 'util'
import { getSportsGuideApi } from './sportsGuideApi'

const execAsync = promisify(exec)

// Ollama configuration
const OLLAMA_HOST = process.env.OLLAMA_HOST || 'http://localhost:11434'
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'phi3:mini'

// Log file paths
const PM2_LOG_PATH = process.env.HOME + '/.pm2/logs/sports-bar-tv-out.log'
const PM2_ERROR_LOG_PATH = process.env.HOME + '/.pm2/logs/sports-bar-tv-error.log'

/**
 * Fetch recent sports guide logs from PM2
 */
export async function getSportsGuideLogs(lines: number = 100): Promise<string> {
  try {
    const { stdout } = await execAsync(`tail -${lines} ${PM2_LOG_PATH} | grep "Sports-Guide"`)
    return stdout
  } catch (error) {
    console.error('[Ollama-Helper] Error fetching sports guide logs:', error)
    return ''
  }
}

/**
 * Fetch sports guide error logs from PM2
 */
export async function getSportsGuideErrorLogs(lines: number = 50): Promise<string> {
  try {
    const { stdout } = await execAsync(`tail -${lines} ${PM2_ERROR_LOG_PATH} | grep "Sports-Guide"`)
    return stdout
  } catch (error) {
    console.error('[Ollama-Helper] Error fetching sports guide error logs:', error)
    return ''
  }
}

/**
 * Query Ollama with sports guide context
 */
export async function queryOllamaWithContext(
  query: string,
  includeRecentLogs: boolean = true
): Promise<{ success: boolean; response?: string; error?: string }> {
  try {
    console.log(`[Ollama-Helper] Querying Ollama with: "${query}"`)
    
    // Build context
    let context = `You are a helpful AI assistant with access to a Sports Bar TV Controller system's sports guide functionality.

The sports guide uses The Rail Media API as its ONLY data source for sports programming information.

System Information:
- API Provider: The Rail Media (https://guide.thedailyrail.com)
- Data Source: Single source of truth - The Rail Media API only
- Features: Date range filtering, lineup filtering, search functionality
- Supported Lineups: SAT (Satellite), DRTV (DirecTV), DISH (Dish Network), CABLE, STREAM
- Logging: Comprehensive verbose logging enabled

`

    // Add recent logs if requested
    if (includeRecentLogs) {
      const recentLogs = await getSportsGuideLogs(50)
      if (recentLogs) {
        context += `\nRecent Sports Guide Logs:\n${recentLogs}\n`
      }
      
      const errorLogs = await getSportsGuideErrorLogs(20)
      if (errorLogs) {
        context += `\nRecent Error Logs:\n${errorLogs}\n`
      }
    }

    context += `\nUser Query: ${query}\n\nProvide a helpful response based on the sports guide functionality and logs above.`

    // Query Ollama
    const response = await fetch(`${OLLAMA_HOST}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        prompt: context,
        stream: false
      })
    })

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.statusText}`)
    }

    const data = await response.json()
    console.log(`[Ollama-Helper] Ollama response received (${data.response?.length || 0} chars)`)
    
    return {
      success: true,
      response: data.response
    }

  } catch (error) {
    console.error('[Ollama-Helper] Error querying Ollama:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Analyze sports guide logs with Ollama
 */
export async function analyzeSportsGuideLogs(): Promise<{
  success: boolean
  analysis?: string
  error?: string
  logsSummary?: {
    totalLines: number
    errorCount: number
    requestCount: number
    recentActivity: string
  }
}> {
  try {
    console.log('[Ollama-Helper] Analyzing sports guide logs with Ollama...')
    
    // Fetch logs
    const logs = await getSportsGuideLogs(200)
    const errorLogs = await getSportsGuideErrorLogs(50)
    
    // Calculate statistics
    const logLines = logs.split('\n')
    const errorLines = errorLogs.split('\n')
    
    const requestCount = logLines.filter(line => line.includes('New sports guide request received')).length
    const errorCount = errorLines.filter(line => line.includes('ERROR')).length
    
    const logsSummary = {
      totalLines: logLines.length,
      errorCount,
      requestCount,
      recentActivity: logLines.slice(-10).join('\n')
    }

    // Build analysis prompt
    const prompt = `Analyze the following sports guide system logs and provide insights:

Recent Activity Logs (last 200 lines):
${logs}

Error Logs (last 50 lines):
${errorLogs}

Please provide:
1. Overall system health assessment
2. Any errors or issues detected
3. Usage patterns and trends
4. Recommendations for improvement

Be concise and focus on actionable insights.`

    // Query Ollama
    const response = await fetch(`${OLLAMA_HOST}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        prompt,
        stream: false
      })
    })

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.statusText}`)
    }

    const data = await response.json()
    
    console.log('[Ollama-Helper] Log analysis completed successfully')
    
    return {
      success: true,
      analysis: data.response,
      logsSummary
    }

  } catch (error) {
    console.error('[Ollama-Helper] Error analyzing logs:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Get sports guide recommendations from Ollama
 */
export async function getSportsGuideRecommendations(
  userPreferences?: {
    favoriteTeams?: string[]
    favoriteLeagues?: string[]
    location?: string
  }
): Promise<{
  success: boolean
  recommendations?: string
  error?: string
}> {
  try {
    console.log('[Ollama-Helper] Getting sports guide recommendations...')
    
    // Fetch current guide data
    const api = getSportsGuideApi()
    const guide = await api.fetchTodayGuide()
    
    // Build recommendation prompt
    let prompt = `Based on the following sports programming guide data, provide personalized recommendations:

Total Listing Groups: ${guide.listing_groups?.length || 0}
`

    if (userPreferences?.favoriteTeams?.length) {
      prompt += `\nUser's Favorite Teams: ${userPreferences.favoriteTeams.join(', ')}`
    }
    
    if (userPreferences?.favoriteLeagues?.length) {
      prompt += `\nUser's Favorite Leagues: ${userPreferences.favoriteLeagues.join(', ')}`
    }
    
    if (userPreferences?.location) {
      prompt += `\nUser's Location: ${userPreferences.location}`
    }

    prompt += `\n\nProvide 3-5 specific sports programming recommendations for today, including:
1. Time and channel information
2. Why you recommend it (based on user preferences)
3. How to watch (lineup/channel)

Be concise and helpful.`

    // Query Ollama
    const response = await fetch(`${OLLAMA_HOST}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        prompt,
        stream: false
      })
    })

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.statusText}`)
    }

    const data = await response.json()
    
    console.log('[Ollama-Helper] Recommendations generated successfully')
    
    return {
      success: true,
      recommendations: data.response
    }

  } catch (error) {
    console.error('[Ollama-Helper] Error getting recommendations:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Test Ollama connectivity
 */
export async function testOllamaConnection(): Promise<{
  success: boolean
  message: string
  model?: string
  responseTime?: number
}> {
  const startTime = Date.now()
  
  try {
    console.log('[Ollama-Helper] Testing Ollama connection...')
    
    const response = await fetch(`${OLLAMA_HOST}/api/tags`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    })

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.statusText}`)
    }

    const data = await response.json()
    const responseTime = Date.now() - startTime
    
    console.log(`[Ollama-Helper] Ollama connection successful (${responseTime}ms)`)
    
    return {
      success: true,
      message: 'Ollama is online and accessible',
      model: OLLAMA_MODEL,
      responseTime
    }

  } catch (error) {
    console.error('[Ollama-Helper] Ollama connection failed:', error)
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Connection failed'
    }
  }
}
