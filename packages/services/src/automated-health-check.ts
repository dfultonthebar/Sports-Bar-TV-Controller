import { logger } from '@sports-bar/logger'
import { getAISportsContextProvider } from './ai-sports-context'
import { findMany, findFirst, eq, db, schema } from '@sports-bar/database'
import { getSoundtrackAPI } from '@sports-bar/soundtrack'

/**
 * Automated Health Check Service
 *
 * Runs comprehensive system checks automatically:
 * - Daily morning checks (8 AM)
 * - Pre-game checks (2 hours before major games)
 * - On-demand manual checks
 */

export interface HealthCheckResult {
  timestamp: Date
  checkType: 'daily' | 'pre_game' | 'manual'
  overallStatus: 'healthy' | 'warning' | 'critical'
  overallScore: number
  categories: {
    tvs: CategoryCheck
    cableBoxes: CategoryCheck
    audioZones: CategoryCheck
    matrix: CategoryCheck
    network: CategoryCheck
  }
  issues: Issue[]
  recommendations: string[]
  sportsContext?: {
    upcomingGamesCount: number
    nextGame: string | null
    hoursUntilNextGame: number | null
  }
}

interface CategoryCheck {
  status: 'healthy' | 'warning' | 'critical'
  score: number
  devicesTotal: number
  devicesOnline: number
  details: string
}

interface Issue {
  severity: 'critical' | 'high' | 'medium' | 'low'
  category: string
  device: string
  problem: string
  recommendation: string
}

export class AutomatedHealthCheckService {
  /**
   * Run comprehensive health check
   */
  async runHealthCheck(checkType: 'daily' | 'pre_game' | 'manual' = 'manual'): Promise<HealthCheckResult> {
    logger.info(`[Health Check] Starting ${checkType} health check`)

    const result: HealthCheckResult = {
      timestamp: new Date(),
      checkType,
      overallStatus: 'healthy',
      overallScore: 100,
      categories: {
        tvs: await this.checkTVs(),
        cableBoxes: await this.checkCableBoxes(),
        audioZones: await this.checkAudioZones(),
        matrix: await this.checkMatrix(),
        network: await this.checkNetwork()
      },
      issues: [],
      recommendations: []
    }

    // Collect issues from all categories
    this.collectIssues(result)

    // Calculate overall status and score
    this.calculateOverallStatus(result)

    // Add sports context
    if (checkType === 'daily' || checkType === 'pre_game') {
      result.sportsContext = await this.getSportsContext()
    }

    // Generate recommendations
    result.recommendations = this.generateRecommendations(result)

    // Log the check
    await this.logHealthCheck(result)

    logger.info(`[Health Check] Complete - Status: ${result.overallStatus}, Score: ${result.overallScore}%`)

    return result
  }

  /**
   * Check TV outputs
   */
  private async checkTVs(): Promise<CategoryCheck> {
    try {
      const outputs = await findMany('matrixOutputs', {
        where: eq(schema.matrixOutputs.isActive, true)
      })

      const devicesTotal = outputs.length
      const devicesOnline = outputs.length // Assume online if in active matrix

      return {
        status: devicesOnline === devicesTotal ? 'healthy' : 'warning',
        score: devicesTotal > 0 ? Math.round((devicesOnline / devicesTotal) * 100) : 100,
        devicesTotal,
        devicesOnline,
        details: `${devicesOnline}/${devicesTotal} TV outputs active`
      }
    } catch (error) {
      logger.error('[Health Check] Error checking TVs', { error })
      return {
        status: 'critical',
        score: 0,
        devicesTotal: 0,
        devicesOnline: 0,
        details: 'Failed to check TVs'
      }
    }
  }

  /**
   * Check cable boxes (DirectTV + FireTV)
   */
  private async checkCableBoxes(): Promise<CategoryCheck> {
    try {
      // Note: DirecTV devices are not in schema yet, using empty array
      const directvDevices: any[] = []

      const firetvDevices = await findMany('fireTVDevices', {})

      const devicesTotal = directvDevices.length + firetvDevices.length
      const directvOnline = directvDevices.filter((d: any) => d.isOnline).length
      const firetvOnline = firetvDevices.filter((d: any) => d.connectionStatus === 'connected').length
      const devicesOnline = directvOnline + firetvOnline

      const percentage = devicesTotal > 0 ? (devicesOnline / devicesTotal) * 100 : 100

      return {
        status: percentage >= 90 ? 'healthy' : percentage >= 70 ? 'warning' : 'critical',
        score: Math.round(percentage),
        devicesTotal,
        devicesOnline,
        details: `${devicesOnline}/${devicesTotal} cable boxes online (DirecTV: ${directvOnline}, FireTV: ${firetvOnline})`
      }
    } catch (error) {
      logger.error('[Health Check] Error checking cable boxes', { error })
      return {
        status: 'critical',
        score: 0,
        devicesTotal: 0,
        devicesOnline: 0,
        details: 'Failed to check cable boxes'
      }
    }
  }

  /**
   * Check audio zones
   */
  private async checkAudioZones(): Promise<CategoryCheck> {
    try {
      const config = await findFirst('soundtrackConfigs')

      if (!config?.isActive || !config.apiKey) {
        return {
          status: 'warning',
          score: 50,
          devicesTotal: 0,
          devicesOnline: 0,
          details: 'Soundtrack not configured'
        }
      }

      const api = getSoundtrackAPI(config.apiKey)
      const zones = await api.listSoundZones()

      const devicesTotal = zones.length
      const devicesOnline = zones.filter(z => z.currentPlayback).length

      const percentage = devicesTotal > 0 ? (devicesOnline / devicesTotal) * 100 : 100

      return {
        status: percentage >= 80 ? 'healthy' : percentage >= 60 ? 'warning' : 'critical',
        score: Math.round(percentage),
        devicesTotal,
        devicesOnline,
        details: `${devicesOnline}/${devicesTotal} audio zones responding`
      }
    } catch (error) {
      logger.error('[Health Check] Error checking audio zones', { error })
      return {
        status: 'warning',
        score: 50,
        devicesTotal: 0,
        devicesOnline: 0,
        details: 'Failed to check audio zones'
      }
    }
  }

  /**
   * Check matrix switcher
   */
  private async checkMatrix(): Promise<CategoryCheck> {
    try {
      const activeMatrix = await findFirst('matrixConfigurations', {
        where: eq(schema.matrixConfigurations.isActive, true)
      })

      if (!activeMatrix) {
        return {
          status: 'critical',
          score: 0,
          devicesTotal: 1,
          devicesOnline: 0,
          details: 'No active matrix configuration'
        }
      }

      // TODO: Add actual network check to matrix IP
      return {
        status: 'healthy',
        score: 100,
        devicesTotal: 1,
        devicesOnline: 1,
        details: `Wolf Pack Matrix configured at ${activeMatrix.ipAddress}`
      }
    } catch (error) {
      logger.error('[Health Check] Error checking matrix', { error })
      return {
        status: 'critical',
        score: 0,
        devicesTotal: 1,
        devicesOnline: 0,
        details: 'Failed to check matrix'
      }
    }
  }

  /**
   * Check network connectivity
   */
  private async checkNetwork(): Promise<CategoryCheck> {
    try {
      // Basic network check - verify app is running
      const uptime = process.uptime()

      return {
        status: 'healthy',
        score: 100,
        devicesTotal: 1,
        devicesOnline: 1,
        details: `System uptime: ${Math.round(uptime / 60)} minutes`
      }
    } catch (error) {
      return {
        status: 'critical',
        score: 0,
        devicesTotal: 1,
        devicesOnline: 0,
        details: 'Network check failed'
      }
    }
  }

  /**
   * Get sports context for health check
   */
  private async getSportsContext() {
    try {
      const provider = getAISportsContextProvider()
      const context = await provider.getSportsContext()

      return {
        upcomingGamesCount: context.upcomingGames.length,
        nextGame: context.nextBigGame?.eventName || (context.upcomingGames[0]?.eventName) || null,
        hoursUntilNextGame: context.nextBigGame?.hoursAway || (context.upcomingGames[0]?.hoursUntilGame) || null
      }
    } catch (error) {
      logger.error('[Health Check] Error getting sports context', { error })
      return {
        upcomingGamesCount: 0,
        nextGame: null,
        hoursUntilNextGame: null
      }
    }
  }

  /**
   * Collect issues from all categories
   */
  private collectIssues(result: HealthCheckResult) {
    // Check TVs
    if (result.categories.tvs.status !== 'healthy') {
      result.issues.push({
        severity: result.categories.tvs.status === 'critical' ? 'critical' : 'high',
        category: 'TVs',
        device: 'TV Outputs',
        problem: result.categories.tvs.details,
        recommendation: 'Check matrix configuration and TV connections'
      })
    }

    // Check cable boxes
    if (result.categories.cableBoxes.status !== 'healthy') {
      const severity = result.categories.cableBoxes.score < 50 ? 'critical' :
                      result.categories.cableBoxes.score < 80 ? 'high' : 'medium'

      result.issues.push({
        severity,
        category: 'Cable Boxes',
        device: 'DirecTV/FireTV Devices',
        problem: result.categories.cableBoxes.details,
        recommendation: 'Restart offline cable boxes or check network connectivity'
      })
    }

    // Check audio zones
    if (result.categories.audioZones.status === 'critical') {
      result.issues.push({
        severity: 'high',
        category: 'Audio',
        device: 'Soundtrack Zones',
        problem: result.categories.audioZones.details,
        recommendation: 'Check Soundtrack API configuration and network connectivity'
      })
    }

    // Check matrix
    if (result.categories.matrix.status !== 'healthy') {
      result.issues.push({
        severity: 'critical',
        category: 'Matrix',
        device: 'Wolf Pack Matrix',
        problem: result.categories.matrix.details,
        recommendation: 'Configure active matrix or check matrix network connection'
      })
    }
  }

  /**
   * Calculate overall status and score
   */
  private calculateOverallStatus(result: HealthCheckResult) {
    const scores = [
      result.categories.tvs.score,
      result.categories.cableBoxes.score,
      result.categories.audioZones.score,
      result.categories.matrix.score,
      result.categories.network.score
    ]

    result.overallScore = Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length)

    // Determine overall status
    if (result.overallScore >= 90) {
      result.overallStatus = 'healthy'
    } else if (result.overallScore >= 70) {
      result.overallStatus = 'warning'
    } else {
      result.overallStatus = 'critical'
    }

    // Critical issues override score
    const hasCriticalIssue = result.issues.some(i => i.severity === 'critical')
    if (hasCriticalIssue) {
      result.overallStatus = 'critical'
    }
  }

  /**
   * Generate recommendations based on check results
   */
  private generateRecommendations(result: HealthCheckResult): string[] {
    const recommendations: string[] = []

    // Critical issues first
    if (result.overallStatus === 'critical') {
      recommendations.push('URGENT: Critical system issues detected. Address immediately before opening.')
    }

    // Sports-aware recommendations
    if (result.sportsContext) {
      if (result.sportsContext.hoursUntilNextGame !== null && result.sportsContext.hoursUntilNextGame < 4) {
        recommendations.push(`Game in ${Math.round(result.sportsContext.hoursUntilNextGame)} hours: ${result.sportsContext.nextGame}`)

        if (result.overallStatus !== 'healthy') {
          recommendations.push('Fix system issues NOW before game time!')
        } else {
          recommendations.push('Systems ready for game day')
        }
      }

      if (result.sportsContext.upcomingGamesCount > 0) {
        recommendations.push(`${result.sportsContext.upcomingGamesCount} games scheduled this week`)
      }
    }

    // Category-specific recommendations
    if (result.categories.cableBoxes.score < 90 && result.categories.cableBoxes.score > 0) {
      recommendations.push(`Restart ${result.categories.cableBoxes.devicesTotal - result.categories.cableBoxes.devicesOnline} offline cable box(es)`)
    }

    if (result.categories.audioZones.status === 'warning') {
      recommendations.push('Check Soundtrack audio zones connectivity')
    }

    // General maintenance
    if (result.checkType === 'daily' && result.overallStatus === 'healthy') {
      recommendations.push('All systems operational. Good time for preventive maintenance if needed.')
    }

    return recommendations
  }

  /**
   * Log health check to database
   */
  private async logHealthCheck(result: HealthCheckResult) {
    try {
      await db.insert(schema.systemSettings).values({
        key: `health_check_${result.timestamp.getTime()}`,
        value: JSON.stringify({
          checkType: result.checkType,
          status: result.overallStatus,
          score: result.overallScore,
          issuesCount: result.issues.length,
          timestamp: result.timestamp.toISOString()
        }),
        updatedAt: result.timestamp.toISOString()
      })
    } catch (error) {
      logger.error('[Health Check] Failed to log check', { error })
    }
  }

  /**
   * Format health check as text report
   */
  formatReport(result: HealthCheckResult): string {
    const lines: string[] = []

    lines.push('═══════════════════════════════════════')
    lines.push(`  SYSTEM HEALTH CHECK REPORT`)
    lines.push(`  ${result.timestamp.toLocaleString()}`)
    lines.push('═══════════════════════════════════════')
    lines.push('')

    // Overall status
    const statusEmoji = result.overallStatus === 'healthy' ? '[OK]' :
                       result.overallStatus === 'warning' ? '[WARN]' : '[CRITICAL]'
    lines.push(`${statusEmoji} Overall Status: ${result.overallStatus.toUpperCase()}`)
    lines.push(`Health Score: ${result.overallScore}%`)
    lines.push('')

    // Sports context
    if (result.sportsContext) {
      lines.push('SPORTS SCHEDULE:')
      if (result.sportsContext.nextGame) {
        lines.push(`   Next Game: ${result.sportsContext.nextGame}`)
        lines.push(`   Time Until: ${result.sportsContext.hoursUntilNextGame} hours`)
      } else {
        lines.push('   No games scheduled')
      }
      lines.push('')
    }

    // Categories
    lines.push('SYSTEM CATEGORIES:')
    lines.push(`   TVs: ${result.categories.tvs.status} (${result.categories.tvs.score}%)`)
    lines.push(`   Cable Boxes: ${result.categories.cableBoxes.status} (${result.categories.cableBoxes.score}%)`)
    lines.push(`   Audio Zones: ${result.categories.audioZones.status} (${result.categories.audioZones.score}%)`)
    lines.push(`   Matrix: ${result.categories.matrix.status} (${result.categories.matrix.score}%)`)
    lines.push(`   Network: ${result.categories.network.status} (${result.categories.network.score}%)`)
    lines.push('')

    // Issues
    if (result.issues.length > 0) {
      lines.push('ISSUES FOUND:')
      result.issues.forEach((issue, idx) => {
        lines.push(`   ${idx + 1}. [${issue.severity.toUpperCase()}] ${issue.category}: ${issue.problem}`)
        lines.push(`      -> ${issue.recommendation}`)
      })
      lines.push('')
    }

    // Recommendations
    if (result.recommendations.length > 0) {
      lines.push('RECOMMENDATIONS:')
      result.recommendations.forEach((rec, idx) => {
        lines.push(`   ${idx + 1}. ${rec}`)
      })
      lines.push('')
    }

    lines.push('═══════════════════════════════════════')

    return lines.join('\n')
  }
}

// Singleton instance
let healthCheckService: AutomatedHealthCheckService | null = null

export function getAutomatedHealthCheckService(): AutomatedHealthCheckService {
  if (!healthCheckService) {
    healthCheckService = new AutomatedHealthCheckService()
  }
  return healthCheckService
}
