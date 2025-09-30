
import { NextRequest, NextResponse } from 'next/server'
import { operationLogger } from '@/lib/operation-logger'
import { documentSearch } from '@/lib/enhanced-document-search'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const { searchParams } = url
    const hours = parseInt(searchParams.get('hours') || '24')

    // Get system activity summary
    const operationSummary = await operationLogger.getOperationSummary(hours)
    const recentErrors = await operationLogger.getRecentErrors(6) // Last 6 hours of errors

    // Get document processing status
    const documentStatus = await getDocumentStatus()
    
    // Get database health
    const dbHealth = await getDatabaseHealth()
    
    // Analyze error patterns for AI recommendations
    const errorAnalysis = await analyzeErrorPatterns(recentErrors)
    
    // Get system recommendations
    const recommendations = await generateSystemRecommendations(
      operationSummary, 
      recentErrors, 
      documentStatus
    )

    return NextResponse.json({
      systemHealth: {
        status: determineOverallHealth(operationSummary, recentErrors, dbHealth),
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage(),
        timestamp: new Date().toISOString()
      },
      operations: operationSummary,
      errors: {
        recent: recentErrors.slice(0, 10),
        analysis: errorAnalysis
      },
      documents: documentStatus,
      database: dbHealth,
      recommendations,
      monitoring: {
        logsGenerated: operationSummary.totalOperations > 0,
        errorTracking: recentErrors.length >= 0,
        documentProcessing: documentStatus.totalDocuments > 0,
        aiSearchEnabled: documentStatus.documentsWithContent > 0
      }
    })
  } catch (error) {
    console.error('Error getting system status:', error)
    
    await operationLogger.logError({
      level: 'error',
      source: 'system-status-api',
      message: 'Failed to generate system status',
      stack: error instanceof Error ? error.stack : undefined,
      details: { error: error instanceof Error ? error.message : error }
    })
    
    return NextResponse.json(
      { error: 'Failed to get system status' },
      { status: 500 }
    )
  }
}

async function getDocumentStatus() {
  try {
    const totalDocs = await prisma.document.count()
    const docsWithContent = await prisma.document.count({
      where: {
        content: {
          not: null
        }
      }
    })
    
    return {
      totalDocuments: totalDocs,
      documentsWithContent: docsWithContent,
      documentsNeedingReprocess: totalDocs - docsWithContent,
      searchEnabled: docsWithContent > 0
    }
  } catch (error) {
    return {
      totalDocuments: 0,
      documentsWithContent: 0,
      documentsNeedingReprocess: 0,
      searchEnabled: false,
      error: 'Database connection failed'
    }
  }
}

async function getDatabaseHealth() {
  try {
    // Test database connectivity
    await prisma.$queryRaw`SELECT 1`
    
    // Get table counts
    const documentCount = await prisma.document.count()
    const sessionCount = await prisma.chatSession.count()
    const keyCount = await prisma.apiKey.count()
    
    return {
      status: 'healthy',
      connectivity: true,
      tables: {
        documents: documentCount,
        chatSessions: sessionCount,
        apiKeys: keyCount
      }
    }
  } catch (error) {
    return {
      status: 'error',
      connectivity: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

async function analyzeErrorPatterns(errors: any[]) {
  const errorsBySource = errors.reduce((acc, error) => {
    acc[error.source] = (acc[error.source] || 0) + 1
    return acc
  }, {} as Record<string, number>)
  
  const errorsByLevel = errors.reduce((acc, error) => {
    acc[error.level] = (acc[error.level] || 0) + 1
    return acc
  }, {} as Record<string, number>)
  
  const commonMessages = errors.reduce((acc, error) => {
    const key = error.message.substring(0, 50) // First 50 chars
    acc[key] = (acc[key] || 0) + 1
    return acc
  }, {} as Record<string, number>)
  
  return {
    totalErrors: errors.length,
    errorsBySource,
    errorsByLevel,
    mostCommonMessages: Object.entries(commonMessages)
      .sort(([,a], [,b]) => (b as number) - (a as number))
      .slice(0, 5)
      .map(([message, count]) => ({ message, count: count as number })),
    criticalIssues: errors.filter(e => e.level === 'error').length,
    warningCount: errors.filter(e => e.level === 'warning').length
  }
}

async function generateSystemRecommendations(
  operations: any, 
  errors: any[], 
  documentStatus: any
) {
  const recommendations = []
  
  // Performance recommendations
  if (operations.successRate < 90) {
    recommendations.push({
      type: 'performance',
      priority: 'high',
      title: 'Low Success Rate Detected',
      description: `System success rate is ${operations.successRate.toFixed(1)}%. This indicates connectivity or configuration issues.`,
      action: 'Check network connections and device configurations',
      category: 'system_health'
    })
  }
  
  // Error pattern recommendations
  if (errors.length > 10) {
    recommendations.push({
      type: 'error_management',
      priority: 'medium',
      title: 'High Error Volume',
      description: `${errors.length} errors detected in the last 6 hours.`,
      action: 'Review error logs and address recurring issues',
      category: 'error_handling'
    })
  }
  
  // Document processing recommendations
  if (documentStatus.documentsNeedingReprocess > 0) {
    recommendations.push({
      type: 'document_processing',
      priority: 'medium',
      title: 'Documents Need Reprocessing',
      description: `${documentStatus.documentsNeedingReprocess} documents lack text content for AI search.`,
      action: 'Run document reprocessing to enable full AI search capabilities',
      category: 'ai_functionality'
    })
  }
  
  // Usage pattern recommendations
  if (operations.patterns) {
    const eveningOps = operations.patterns.find(p => p.pattern === 'evening_operation')
    const highVolumeOps = operations.patterns.find(p => p.pattern === 'high_volume_request')
    
    if (eveningOps && eveningOps.count > (operations.totalOperations || 0) * 0.6) {
      recommendations.push({
        type: 'usage_optimization',
        priority: 'low',
        title: 'Peak Usage During Evening Hours',
        description: 'Most operations occur during evening hours.',
        action: 'Consider scheduling maintenance during off-peak hours (morning)',
        category: 'optimization'
      })
    }
    
    if (highVolumeOps && highVolumeOps.count > 5) {
      recommendations.push({
        type: 'equipment_check',
        priority: 'medium',
        title: 'Frequent High Volume Requests',
        description: 'Multiple requests for high volume levels detected.',
        action: 'Check audio equipment for potential issues or customer satisfaction',
        category: 'equipment_health'
      })
    }
  }
  
  return recommendations
}

function determineOverallHealth(operations: any, errors: any[], dbHealth: any) {
  if (!dbHealth.connectivity) return 'critical'
  if (errors.filter(e => e.level === 'error').length > 5) return 'warning'
  if (operations.successRate < 80) return 'warning'
  if (operations.totalOperations === 0) return 'inactive'
  return 'healthy'
}
