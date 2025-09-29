
/**
 * Atlas AI Analysis API Route
 * Provides AI-powered analysis specifically for Atlas audio processors
 */

import { NextRequest, NextResponse } from 'next/server'
import { atlasAIAnalyzer, AtlasMonitoringData } from '../../../../lib/atlas-ai-analyzer'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const monitoringData: AtlasMonitoringData = await request.json()
    
    // Validate required data
    if (!monitoringData.processorId || !monitoringData.processorModel) {
      return NextResponse.json(
        { error: 'Processor ID and model are required' },
        { status: 400 }
      )
    }
    
    // Perform Atlas AI analysis
    const analysis = await atlasAIAnalyzer.analyzeAtlasData(monitoringData)
    
    return NextResponse.json({
      success: true,
      analysis,
      timestamp: new Date().toISOString()
    })
    
  } catch (error) {
    console.error('Atlas AI analysis API error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to analyze Atlas data',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const processorId = searchParams.get('processorId')
    const hours = parseInt(searchParams.get('hours') || '24')
    
    if (!processorId) {
      return NextResponse.json(
        { error: 'Processor ID is required' },
        { status: 400 }
      )
    }
    
    // Get historical Atlas analysis data
    const historicalData = await getAtlasAnalysisHistory(processorId, hours)
    
    return NextResponse.json({
      success: true,
      processorId,
      hours,
      data: historicalData,
      summary: generateAtlasSummary(historicalData)
    })
    
  } catch (error) {
    console.error('Atlas AI history API error:', error)
    return NextResponse.json(
      { error: 'Failed to retrieve Atlas analysis history' },
      { status: 500 }
    )
  }
}

/**
 * Get historical Atlas analysis data
 */
async function getAtlasAnalysisHistory(processorId: string, hours: number) {
  // Implementation would read from Atlas AI logs
  // For now, return mock historical data
  return [
    {
      timestamp: new Date(Date.now() - 3600000).toISOString(),
      severity: 'optimal',
      signalQuality: 95,
      processingLoad: 45,
      networkStability: 98
    },
    {
      timestamp: new Date(Date.now() - 7200000).toISOString(),
      severity: 'minor',
      signalQuality: 87,
      processingLoad: 52,
      networkStability: 95
    }
  ]
}

/**
 * Generate summary from historical data
 */
function generateAtlasSummary(historicalData: any[]) {
  if (!historicalData.length) {
    return {
      message: 'No historical data available',
      trend: 'unknown'
    }
  }
  
  const latest = historicalData[0]
  const avgSignalQuality = historicalData.reduce((sum, d) => sum + d.signalQuality, 0) / historicalData.length
  const avgProcessingLoad = historicalData.reduce((sum, d) => sum + d.processingLoad, 0) / historicalData.length
  
  return {
    message: `Atlas processor showing ${latest.severity} performance`,
    currentStatus: latest.severity,
    averageSignalQuality: Math.round(avgSignalQuality),
    averageProcessingLoad: Math.round(avgProcessingLoad),
    trend: latest.signalQuality > avgSignalQuality ? 'improving' : 'declining',
    recommendations: generateSummaryRecommendations(historicalData)
  }
}

/**
 * Generate recommendations based on trends
 */
function generateSummaryRecommendations(data: any[]): string[] {
  const recommendations: string[] = []
  
  const avgLoad = data.reduce((sum, d) => sum + d.processingLoad, 0) / data.length
  if (avgLoad > 80) {
    recommendations.push('Consider reducing DSP processing load')
  }
  
  const avgSignal = data.reduce((sum, d) => sum + d.signalQuality, 0) / data.length
  if (avgSignal < 85) {
    recommendations.push('Review input gain structure for optimal signal levels')
  }
  
  const hasNetworkIssues = data.some(d => d.networkStability < 90)
  if (hasNetworkIssues) {
    recommendations.push('Monitor Dante network performance and switch configuration')
  }
  
  return recommendations
}
