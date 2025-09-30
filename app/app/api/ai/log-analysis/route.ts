
import { NextRequest, NextResponse } from 'next/server'
import { operationLogger } from '@/lib/operation-logger'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const hours = parseInt(searchParams.get('hours') || '24')
    
    // Get comprehensive log data
    const operations = await operationLogger.getRecentOperations(hours)
    const errors = await operationLogger.getRecentErrors(hours)
    const learningData = await operationLogger.getLearningData(hours)
    const summary = await operationLogger.getOperationSummary(hours)
    
    // AI Analysis Insights
    const insights = await generateAIInsights({
      operations,
      errors,
      learningData,
      summary
    })
    
    return NextResponse.json({
      summary,
      insights,
      recommendations: insights.recommendations
    })
  } catch (error) {
    console.error('Error in AI log analysis:', error)
    return NextResponse.json(
      { error: 'Failed to analyze logs' },
      { status: 500 }
    )
  }
}

async function generateAIInsights(logData: any) {
  const { operations, errors, learningData, summary } = logData
  
  // Pattern Analysis
  const timePatterns = analyzeTimePatterns(operations)
  const devicePatterns = analyzeDeviceUsage(operations)
  const errorPatterns = analyzeErrorPatterns(errors)
  
  // Sports-specific insights
  const sportsInsights = analyzeSportsPatterns(operations, learningData)
  
  // Peak usage prediction
  const peakTimes = predictPeakTimes(operations)
  
  return {
    timePatterns,
    devicePatterns,
    errorPatterns,
    sportsInsights,
    peakTimes,
    recommendations: generateRecommendations({
      summary,
      timePatterns,
      devicePatterns,
      errorPatterns,
      sportsInsights
    })
  }
}

function analyzeTimePatterns(operations: any[]) {
  const hourlyUsage = new Map<number, number>()
  const dayOfWeekUsage = new Map<number, number>()
  
  operations.forEach(op => {
    const date = new Date(op.timestamp)
    const hour = date.getHours()
    const dayOfWeek = date.getDay()
    
    hourlyUsage.set(hour, (hourlyUsage.get(hour) || 0) + 1)
    dayOfWeekUsage.set(dayOfWeek, (dayOfWeekUsage.get(dayOfWeek) || 0) + 1)
  })
  
  return {
    peakHour: Array.from(hourlyUsage.entries()).sort((a, b) => b[1] - a[1])[0],
    peakDay: Array.from(dayOfWeekUsage.entries()).sort((a, b) => b[1] - a[1])[0],
    hourlyDistribution: Object.fromEntries(hourlyUsage),
    dayDistribution: Object.fromEntries(dayOfWeekUsage)
  }
}

function analyzeDeviceUsage(operations: any[]) {
  const deviceUsage = new Map<string, number>()
  const actionTypes = new Map<string, number>()
  
  operations.forEach(op => {
    if (op.device) {
      deviceUsage.set(op.device, (deviceUsage.get(op.device) || 0) + 1)
    }
    actionTypes.set(op.type, (actionTypes.get(op.type) || 0) + 1)
  })
  
  return {
    mostUsedDevice: Array.from(deviceUsage.entries()).sort((a, b) => b[1] - a[1])[0],
    mostCommonAction: Array.from(actionTypes.entries()).sort((a, b) => b[1] - a[1])[0],
    deviceDistribution: Object.fromEntries(deviceUsage),
    actionDistribution: Object.fromEntries(actionTypes)
  }
}

function analyzeErrorPatterns(errors: any[]) {
  const errorTypes = new Map<string, number>()
  const errorSources = new Map<string, number>()
  
  errors.forEach(error => {
    errorTypes.set(error.level, (errorTypes.get(error.level) || 0) + 1)
    errorSources.set(error.source, (errorSources.get(error.source) || 0) + 1)
  })
  
  return {
    mostCommonErrorLevel: Array.from(errorTypes.entries()).sort((a, b) => b[1] - a[1])[0],
    mostProblematicSource: Array.from(errorSources.entries()).sort((a, b) => b[1] - a[1])[0],
    errorTrends: Object.fromEntries(errorTypes)
  }
}

function analyzeSportsPatterns(operations: any[], learningData: any[]) {
  const sportsOperations = operations.filter(op => 
    op.details?.channel?.toLowerCase().includes('sport') ||
    op.details?.content?.toLowerCase().includes('sport') ||
    op.action.toLowerCase().includes('sport')
  )
  
  const gameTimePatterns = learningData.filter(data => 
    data.patterns.includes('sports_content_request')
  )
  
  return {
    sportsOperationCount: sportsOperations.length,
    sportsPercentage: (sportsOperations.length / operations.length) * 100,
    gameTimePatterns: gameTimePatterns.length,
    peakSportsHours: analyzePeakSportsHours(sportsOperations)
  }
}

function analyzePeakSportsHours(sportsOperations: any[]) {
  const hourlyCount = new Map<number, number>()
  
  sportsOperations.forEach(op => {
    const hour = new Date(op.timestamp).getHours()
    hourlyCount.set(hour, (hourlyCount.get(hour) || 0) + 1)
  })
  
  return Array.from(hourlyCount.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
}

function predictPeakTimes(operations: any[]) {
  // Simple prediction based on historical patterns
  const now = new Date()
  const currentHour = now.getHours()
  const currentDay = now.getDay()
  
  // Analyze similar time periods
  const similarOperations = operations.filter(op => {
    const opDate = new Date(op.timestamp)
    const hourDiff = Math.abs(opDate.getHours() - currentHour)
    const dayMatch = opDate.getDay() === currentDay
    
    return hourDiff <= 2 && dayMatch
  })
  
  return {
    expectedOperations: Math.ceil(similarOperations.length / 7), // Weekly average
    confidence: similarOperations.length > 10 ? 'high' : 'medium',
    timeframe: 'next 2 hours'
  }
}

function generateRecommendations(analysisData: any) {
  const recommendations = []
  
  // Error-based recommendations
  if (analysisData.errorPatterns.errorTrends.error > 5) {
    recommendations.push({
      type: 'error_reduction',
      priority: 'high',
      message: `High error rate detected (${analysisData.errorPatterns.errorTrends.error} errors). Consider system maintenance.`
    })
  }
  
  // Usage-based recommendations
  if (analysisData.devicePatterns.mostUsedDevice) {
    const [device, count] = analysisData.devicePatterns.mostUsedDevice
    recommendations.push({
      type: 'device_optimization',
      priority: 'medium',
      message: `${device} is your most used device (${count} operations). Consider optimizing its controls.`
    })
  }
  
  // Time-based recommendations
  if (analysisData.timePatterns.peakHour) {
    const [hour, count] = analysisData.timePatterns.peakHour
    recommendations.push({
      type: 'staffing',
      priority: 'medium',
      message: `Peak usage at ${hour}:00 (${count} operations). Ensure adequate bartender coverage.`
    })
  }
  
  // Sports-specific recommendations
  if (analysisData.sportsInsights.sportsPercentage > 70) {
    recommendations.push({
      type: 'sports_optimization',
      priority: 'high',
      message: `${analysisData.sportsInsights.sportsPercentage.toFixed(1)}% of operations are sports-related. Consider sports-focused interface improvements.`
    })
  }
  
  return recommendations
}
