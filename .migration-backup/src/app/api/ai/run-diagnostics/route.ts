import { NextRequest, NextResponse } from 'next/server'
import { and, asc, desc, eq, findMany, or } from '@/lib/db-helpers'
import { schema } from '@/db'
import { logger } from '@/lib/logger'
import fs from 'fs/promises'
import path from 'path'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'


interface DiagnosticCheck {
  name: string
  category: string
  status: 'pass' | 'fail' | 'warning'
  message: string
  details?: any
  timestamp: string
}

export async function POST(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.AI)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  try {
    const body = await request.json()
    const { 
      checks = ['all'], // Which diagnostic checks to run
      detailed = false  // Whether to include detailed information
    } = body

    const diagnosticResults: DiagnosticCheck[] = []
    const startTime = Date.now()

    // Determine which checks to run
    const shouldRunCheck = (checkName: string) => {
      return checks.includes('all') || checks.includes(checkName)
    }

    // 1. Database Connectivity Check
    if (shouldRunCheck('database')) {
      try {
        await prisma.$queryRaw`SELECT 1`
        diagnosticResults.push({
          name: 'Database Connectivity',
          category: 'infrastructure',
          status: 'pass',
          message: 'Database connection is healthy',
          timestamp: new Date().toISOString()
        })
      } catch (error) {
        diagnosticResults.push({
          name: 'Database Connectivity',
          category: 'infrastructure',
          status: 'fail',
          message: 'Database connection failed',
          details: { error: error instanceof Error ? error.message : 'Unknown error' },
          timestamp: new Date().toISOString()
        })
      }
    }

    // 2. AI Providers Check
    if (shouldRunCheck('ai_providers')) {
      try {
        const apiKeys = await findMany('apiKeys')
        const activeProviders = apiKeys.filter(k => k.keyValue && k.keyValue.length > 0)
        
        diagnosticResults.push({
          name: 'AI Providers',
          category: 'ai_system',
          status: activeProviders.length > 0 ? 'pass' : 'warning',
          message: `${activeProviders.length} of ${apiKeys.length} AI providers have API keys configured`,
          details: detailed ? {
            total: apiKeys.length,
            active: activeProviders.length,
            providers: apiKeys.map(k => ({
              name: k.name,
              provider: k.provider,
              hasKey: !!(k.keyValue && k.keyValue.length > 0)
            }))
          } : undefined,
          timestamp: new Date().toISOString()
        })
      } catch (error) {
        diagnosticResults.push({
          name: 'AI Providers',
          category: 'ai_system',
          status: 'fail',
          message: 'Failed to check AI providers',
          details: { error: error instanceof Error ? error.message : 'Unknown error' },
          timestamp: new Date().toISOString()
        })
      }
    }

    // 3. Matrix Inputs Check
    if (shouldRunCheck('matrix_inputs')) {
      try {
        const matrixInputs = await findMany('matrixInputs')
        const activeInputs = matrixInputs.filter(i => i.isActive)
        
        diagnosticResults.push({
          name: 'Matrix Inputs',
          category: 'hardware',
          status: activeInputs.length > 0 ? 'pass' : 'warning',
          message: `${activeInputs.length} of ${matrixInputs.length} matrix inputs are active`,
          details: detailed ? {
            total: matrixInputs.length,
            active: activeInputs.length,
            inputs: matrixInputs.map(i => ({
              channelNumber: i.channelNumber,
              label: i.label,
              inputType: i.inputType,
              isActive: i.isActive
            }))
          } : undefined,
          timestamp: new Date().toISOString()
        })
      } catch (error) {
        diagnosticResults.push({
          name: 'Matrix Inputs',
          category: 'hardware',
          status: 'fail',
          message: 'Failed to check matrix inputs',
          details: { error: error instanceof Error ? error.message : 'Unknown error' },
          timestamp: new Date().toISOString()
        })
      }
    }

    // 4. IR Devices Check
    if (shouldRunCheck('ir_devices')) {
      try {
        const irDevicesPath = path.join(process.cwd(), 'data', 'ir-devices.json')
        const irDevicesData = await fs.readFile(irDevicesPath, 'utf8')
        const parsedData = JSON.parse(irDevicesData)
        const irDevices = parsedData.devices || []
        const activeDevices = irDevices.filter((d: any) => d.isActive)
        
        diagnosticResults.push({
          name: 'IR Devices',
          category: 'hardware',
          status: activeDevices.length > 0 ? 'pass' : 'warning',
          message: `${activeDevices.length} of ${irDevices.length} IR devices are active`,
          details: detailed ? {
            total: irDevices.length,
            active: activeDevices.length,
            devices: irDevices.map((d: any) => ({
              name: d.name,
              brand: d.brand,
              deviceType: d.deviceType,
              isActive: d.isActive,
              inputChannel: d.inputChannel
            }))
          } : undefined,
          timestamp: new Date().toISOString()
        })
      } catch (error) {
        diagnosticResults.push({
          name: 'IR Devices',
          category: 'hardware',
          status: 'warning',
          message: 'IR devices file not found or invalid',
          details: { error: error instanceof Error ? error.message : 'Unknown error' },
          timestamp: new Date().toISOString()
        })
      }
    }

    // 5. Device Mapping Check
    if (shouldRunCheck('device_mapping')) {
      try {
        const matrixInputs = await prisma.matrixInput.findMany({ where: { isActive: true } })
        const irDevicesPath = path.join(process.cwd(), 'data', 'ir-devices.json')
        const irDevicesData = await fs.readFile(irDevicesPath, 'utf8')
        const parsedData = JSON.parse(irDevicesData)
        const irDevices = parsedData.devices || []
        
        let mappedCount = 0
        for (const input of matrixInputs) {
          const hasMapping = irDevices.some((d: any) => d.inputChannel === input.channelNumber)
          if (hasMapping) mappedCount++
        }
        
        const mappingPercentage = matrixInputs.length > 0 
          ? Math.round((mappedCount / matrixInputs.length) * 100)
          : 0
        
        diagnosticResults.push({
          name: 'Device Mapping',
          category: 'configuration',
          status: mappingPercentage >= 80 ? 'pass' : mappingPercentage >= 50 ? 'warning' : 'fail',
          message: `${mappedCount} of ${matrixInputs.length} matrix inputs are mapped to IR devices (${mappingPercentage}%)`,
          details: detailed ? {
            totalInputs: matrixInputs.length,
            mappedInputs: mappedCount,
            mappingPercentage
          } : undefined,
          timestamp: new Date().toISOString()
        })
      } catch (error) {
        diagnosticResults.push({
          name: 'Device Mapping',
          category: 'configuration',
          status: 'fail',
          message: 'Failed to check device mapping',
          details: { error: error instanceof Error ? error.message : 'Unknown error' },
          timestamp: new Date().toISOString()
        })
      }
    }

    // 6. Knowledge Base Check
    if (shouldRunCheck('knowledge_base')) {
      try {
        const kbPath = path.join(process.cwd(), 'knowledge-base')
        const kbExists = await fs.access(kbPath).then(() => true).catch(() => false)
        
        if (kbExists) {
          const files = await fs.readdir(kbPath)
          const docFiles = files.filter(f => f.endsWith('.txt') || f.endsWith('.md'))
          
          diagnosticResults.push({
            name: 'Knowledge Base',
            category: 'ai_system',
            status: docFiles.length > 0 ? 'pass' : 'warning',
            message: `Knowledge base contains ${docFiles.length} documents`,
            details: detailed ? { documentCount: docFiles.length, files: docFiles } : undefined,
            timestamp: new Date().toISOString()
          })
        } else {
          diagnosticResults.push({
            name: 'Knowledge Base',
            category: 'ai_system',
            status: 'warning',
            message: 'Knowledge base directory not found',
            timestamp: new Date().toISOString()
          })
        }
      } catch (error) {
        diagnosticResults.push({
          name: 'Knowledge Base',
          category: 'ai_system',
          status: 'warning',
          message: 'Failed to check knowledge base',
          details: { error: error instanceof Error ? error.message : 'Unknown error' },
          timestamp: new Date().toISOString()
        })
      }
    }

    // 7. System Logs Check (using TestLog as proxy for system health)
    if (shouldRunCheck('system_logs')) {
      try {
        const recentLogs = await prisma.testLog.findMany({
          take: 100,
          orderBy: { timestamp: 'desc' }
        })
        
        const errorLogs = recentLogs.filter(l => l.status === 'failed' || l.status === 'error')
        const partialLogs = recentLogs.filter(l => l.status === 'partial')
        
        const errorRate = recentLogs.length > 0 
          ? (errorLogs.length / recentLogs.length) * 100
          : 0
        
        diagnosticResults.push({
          name: 'System Test Logs',
          category: 'monitoring',
          status: errorRate < 5 ? 'pass' : errorRate < 15 ? 'warning' : 'fail',
          message: `${errorLogs.length} failed tests and ${partialLogs.length} partial tests in last 100 logs (${errorRate.toFixed(1)}% failure rate)`,
          details: detailed ? {
            totalLogs: recentLogs.length,
            failedCount: errorLogs.length,
            partialCount: partialLogs.length,
            failureRate: errorRate.toFixed(2)
          } : undefined,
          timestamp: new Date().toISOString()
        })
      } catch (error) {
        diagnosticResults.push({
          name: 'System Test Logs',
          category: 'monitoring',
          status: 'warning',
          message: 'Failed to check system test logs',
          details: { error: error instanceof Error ? error.message : 'Unknown error' },
          timestamp: new Date().toISOString()
        })
      }
    }

    // 8. API Endpoints Health Check
    if (shouldRunCheck('api_health')) {
      const criticalEndpoints = [
        '/api/diagnostics/bartender-remote',
        '/api/diagnostics/device-mapping',
        '/api/devices/ai-analysis',
        '/api/ai-providers/status'
      ]
      
      const endpointResults = await Promise.allSettled(
        criticalEndpoints.map(endpoint => 
          fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3001'}${endpoint}`)
            .then(r => ({ endpoint, status: r.status, ok: r.ok }))
        )
      )
      
      const successfulEndpoints = endpointResults.filter(
        r => r.status === 'fulfilled' && r.value.ok
      ).length
      
      diagnosticResults.push({
        name: 'API Endpoints',
        category: 'infrastructure',
        status: successfulEndpoints === criticalEndpoints.length ? 'pass' : 
                successfulEndpoints >= criticalEndpoints.length / 2 ? 'warning' : 'fail',
        message: `${successfulEndpoints} of ${criticalEndpoints.length} critical API endpoints are responding`,
        details: detailed ? {
          total: criticalEndpoints.length,
          successful: successfulEndpoints,
          endpoints: endpointResults.map(r => 
            r.status === 'fulfilled' 
              ? { endpoint: r.value.endpoint, status: r.value.status, ok: r.value.ok }
              : { endpoint: 'unknown', status: 'error', ok: false }
          )
        } : undefined,
        timestamp: new Date().toISOString()
      })
    }

    // Calculate overall health
    const passCount = diagnosticResults.filter(d => d.status === 'pass').length
    const failCount = diagnosticResults.filter(d => d.status === 'fail').length
    const warnCount = diagnosticResults.filter(d => d.status === 'warning').length
    
    const overallHealth = failCount > 0 ? 'critical' : 
                         warnCount > passCount ? 'warning' : 'healthy'
    
    const healthScore = diagnosticResults.length > 0
      ? Math.round((passCount / diagnosticResults.length) * 100)
      : 0

    const executionTime = Date.now() - startTime

    return NextResponse.json({
      success: true,
      overallHealth,
      healthScore,
      summary: {
        total: diagnosticResults.length,
        passed: passCount,
        failed: failCount,
        warnings: warnCount
      },
      diagnostics: diagnosticResults,
      executionTime: `${executionTime}ms`,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    logger.error('Error running diagnostics:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to run diagnostics',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.AI)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  // GET endpoint for quick health check
  try {
    const { searchParams } = new URL(request.url)
    const quick = searchParams.get('quick') === 'true'

    if (quick) {
      // Quick health check - just database and AI providers
      const dbCheck = await prisma.$queryRaw`SELECT 1`.then(() => true).catch(() => false)
      const apiKeys = await findMany('apiKeys').catch(() => [] as any[])
      const activeProviders = apiKeys.filter(k => k.keyValue && k.keyValue.length > 0)

      return NextResponse.json({
        success: true,
        quickCheck: true,
        database: dbCheck ? 'healthy' : 'unhealthy',
        aiProviders: {
          active: activeProviders.length,
          total: apiKeys.length,
          status: activeProviders.length > 0 ? 'healthy' : 'warning'
        },
        timestamp: new Date().toISOString()
      })
    }

    // Return available diagnostic checks
    return NextResponse.json({
      success: true,
      availableChecks: [
        'all',
        'database',
        'ai_providers',
        'matrix_inputs',
        'ir_devices',
        'device_mapping',
        'knowledge_base',
        'system_logs',
        'api_health'
      ],
      usage: {
        method: 'POST',
        body: {
          checks: ['all'], // or specific checks like ['database', 'ai_providers']
          detailed: false
        }
      },
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    logger.error('Error in diagnostics GET:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get diagnostics info',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}
