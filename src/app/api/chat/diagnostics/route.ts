
import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import fs from 'fs'
import path from 'path'

const prisma = new PrismaClient()

// System diagnostics prompt
const SYSTEM_PROMPT = `You are an AI diagnostics assistant for the Sports Bar TV Controller system. Your role is to help users understand system health, explain issues, recommend optimizations, and answer questions about the monitoring system.

SYSTEM ARCHITECTURE:
- Next.js 14 application running on Ubuntu server (135.131.39.26:223)
- SQLite database with Prisma ORM
- PM2 process manager for Node.js
- Monitoring daemon with light checks (every 5 min) and deep diagnostics (Sunday 5 AM)
- Self-healing capabilities for automatic issue resolution
- Learning system that identifies patterns and makes predictions

MONITORING COMPONENTS:
1. PM2 Process Health - monitors Node.js processes
2. API Health - checks endpoint availability and response times
3. Database - connectivity, size, integrity
4. System Resources - CPU, memory, disk usage
5. External Integrations - Wolf Pack matrix, Atlas audio, CEC control
6. Dependencies - npm packages, security vulnerabilities
7. Logs - error analysis and pattern detection

ISSUE TYPES:
- crash: Application or process crashes
- performance: Slow response times, high resource usage
- resource: Disk space, memory, CPU constraints
- connectivity: Network or external service issues
- dependency: Package or library problems
- security: Vulnerabilities or security concerns

SEVERITY LEVELS:
- low: Minor issues, no immediate impact
- medium: Noticeable issues, should be addressed soon
- high: Significant problems affecting functionality
- critical: System-breaking issues requiring immediate attention

SELF-HEALING ACTIONS:
- restart_pm2: Restart PM2 processes
- clear_disk: Clean up temporary files and logs
- reinstall_deps: Reinstall npm dependencies
- repair_db: Run database integrity checks and repairs
- optimize_db: Vacuum and optimize database
- clear_cache: Clear application caches

Your responses should be:
1. Clear and conversational - explain technical concepts in plain English
2. Actionable - provide specific recommendations when issues are found
3. Proactive - suggest preventive measures based on patterns
4. Contextual - reference actual system data when available
5. Helpful - guide users through troubleshooting steps

When asked about system health, query the database for recent checks, issues, and fixes. Explain what you find in a way that's easy to understand.`

async function getSystemContext() {
  try {
    // Get recent health checks
    const recentChecks = await prisma.systemHealthCheck.findMany({
      take: 10,
      orderBy: { timestamp: 'desc' }
    })

    // Get active issues
    const activeIssues = await prisma.issue.findMany({
      where: { status: 'open' },
      orderBy: { timestamp: 'desc' }
    })

    // Get recent fixes
    const recentFixes = await prisma.fix.findMany({
      take: 10,
      orderBy: { timestamp: 'desc' }
    })

    // Get learning patterns
    const patterns = await prisma.learningPattern.findMany({
      orderBy: { occurrences: 'desc' },
      take: 5
    })

    // Get recent metrics
    const recentMetrics = await prisma.systemMetric.findMany({
      where: {
        timestamp: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
        }
      },
      orderBy: { timestamp: 'desc' }
    })

    return {
      recentChecks,
      activeIssues,
      recentFixes,
      patterns,
      recentMetrics
    }
  } catch (error) {
    console.error('Error getting system context:', error)
    return null
  }
}

export async function POST(request: NextRequest) {
  try {
    const { message, history } = await request.json()

    if (!message) {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      )
    }

    // Get system context
    const context = await getSystemContext()

    // Build context string
    let contextString = '\n\nCURRENT SYSTEM STATE:\n'
    
    if (context) {
      contextString += `\nRecent Health Checks (${context.recentChecks.length}):\n`
      context.recentChecks.forEach(check => {
        contextString += `- ${check.component}: ${check.status} (${check.checkType} check at ${check.timestamp})\n`
      })

      contextString += `\nActive Issues (${context.activeIssues.length}):\n`
      if (context.activeIssues.length === 0) {
        contextString += '- No active issues detected\n'
      } else {
        context.activeIssues.forEach(issue => {
          contextString += `- [${issue.severity}] ${issue.title} - ${issue.description}\n`
        })
      }

      contextString += `\nRecent Fixes (${context.recentFixes.length}):\n`
      context.recentFixes.forEach(fix => {
        contextString += `- ${fix.action}: ${fix.success ? 'Success' : 'Failed'} (${fix.timestamp})\n`
      })

      if (context.patterns.length > 0) {
        contextString += `\nLearning Patterns:\n`
        context.patterns.forEach(pattern => {
          contextString += `- ${pattern.patternType} (${pattern.frequency}, ${pattern.occurrences} occurrences)\n`
          if (pattern.recommendation) {
            contextString += `  Recommendation: ${pattern.recommendation}\n`
          }
        })
      }

      // Add metrics summary
      const cpuMetrics = context.recentMetrics.filter(m => m.metricType === 'cpu')
      const memoryMetrics = context.recentMetrics.filter(m => m.metricType === 'memory')
      const diskMetrics = context.recentMetrics.filter(m => m.metricType === 'disk')

      if (cpuMetrics.length > 0 || memoryMetrics.length > 0 || diskMetrics.length > 0) {
        contextString += `\nRecent Metrics (24h):\n`
        if (cpuMetrics.length > 0) {
          const avgCpu = cpuMetrics.reduce((sum, m) => sum + m.value, 0) / cpuMetrics.length
          contextString += `- CPU: ${avgCpu.toFixed(1)}% average\n`
        }
        if (memoryMetrics.length > 0) {
          const avgMem = memoryMetrics.reduce((sum, m) => sum + m.value, 0) / memoryMetrics.length
          contextString += `- Memory: ${avgMem.toFixed(1)}% average\n`
        }
        if (diskMetrics.length > 0) {
          const avgDisk = diskMetrics.reduce((sum, m) => sum + m.value, 0) / diskMetrics.length
          contextString += `- Disk: ${avgDisk.toFixed(1)}% average\n`
        }
      }
    }

    // Try to use OpenAI first, fall back to simple responses
    const openaiKey = process.env.OPENAI_API_KEY
    
    if (openaiKey) {
      try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${openaiKey}`
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [
              { role: 'system', content: SYSTEM_PROMPT + contextString },
              ...(history || []).slice(-10),
              { role: 'user', content: message }
            ],
            temperature: 0.7,
            max_tokens: 1000
          })
        })

        if (response.ok) {
          const data = await response.json()
          return NextResponse.json({
            response: data.choices[0].message.content
          })
        }
      } catch (error) {
        console.error('OpenAI API error:', error)
      }
    }

    // Fallback: Simple rule-based responses
    const lowerMessage = message.toLowerCase()
    let response = ''

    if (lowerMessage.includes('health') || lowerMessage.includes('status') || lowerMessage.includes('ok')) {
      if (context && context.activeIssues.length === 0) {
        response = `✅ System is healthy! All components are running normally.\n\n`
        response += `Recent activity:\n`
        response += `- ${context.recentChecks.length} health checks completed\n`
        response += `- ${context.recentFixes.length} fixes applied recently\n`
        response += `- No active issues detected\n\n`
        response += `The monitoring system is running smoothly with light checks every 5 minutes and deep diagnostics on Sundays at 5 AM.`
      } else if (context) {
        response = `⚠️ System has ${context.activeIssues.length} active issue(s):\n\n`
        context.activeIssues.forEach(issue => {
          response += `- [${issue.severity.toUpperCase()}] ${issue.title}\n  ${issue.description}\n\n`
        })
        response += `The self-healing system is monitoring these issues and will attempt automatic fixes when possible.`
      }
    } else if (lowerMessage.includes('issue') || lowerMessage.includes('problem')) {
      if (context && context.activeIssues.length > 0) {
        response = `I found ${context.activeIssues.length} active issue(s):\n\n`
        context.activeIssues.forEach(issue => {
          response += `**${issue.title}** (${issue.severity})\n`
          response += `${issue.description}\n`
          response += `Component: ${issue.component}\n`
          response += `Status: ${issue.status}\n\n`
        })
      } else {
        response = `Good news! There are no active issues at the moment. The system is running smoothly.`
      }
    } else if (lowerMessage.includes('fix') || lowerMessage.includes('repair')) {
      if (context && context.recentFixes.length > 0) {
        response = `Recent fixes applied:\n\n`
        context.recentFixes.slice(0, 5).forEach(fix => {
          response += `- ${fix.action}: ${fix.success ? '✅ Success' : '❌ Failed'}\n`
          response += `  ${fix.description}\n`
          response += `  Applied: ${new Date(fix.timestamp).toLocaleString()}\n\n`
        })
      } else {
        response = `No fixes have been applied recently. The system has been stable.`
      }
    } else if (lowerMessage.includes('pattern') || lowerMessage.includes('learn')) {
      if (context && context.patterns.length > 0) {
        response = `The system has identified these patterns:\n\n`
        context.patterns.forEach(pattern => {
          response += `**${pattern.patternType}** (${pattern.frequency})\n`
          response += `Occurrences: ${pattern.occurrences}\n`
          if (pattern.recommendation) {
            response += `💡 Recommendation: ${pattern.recommendation}\n`
          }
          response += `\n`
        })
      } else {
        response = `The learning system is still gathering data. Patterns will be identified as more diagnostics are run.`
      }
    } else if (lowerMessage.includes('monitor') || lowerMessage.includes('diagnostic')) {
      response = `The diagnostics system monitors your Sports Bar TV Controller with:\n\n`
      response += `**Light Checks** (every 5 minutes):\n`
      response += `- PM2 process status\n`
      response += `- API health\n`
      response += `- Database connectivity\n`
      response += `- System resources (CPU, memory, disk)\n\n`
      response += `**Deep Diagnostics** (Sunday 5 AM):\n`
      response += `- Full dependency audit\n`
      response += `- Security vulnerability scan\n`
      response += `- Performance analysis\n`
      response += `- Log file analysis\n`
      response += `- External integration testing\n\n`
      response += `**Self-Healing**:\n`
      response += `Automatically attempts to fix detected issues using actions like process restarts, cache clearing, and dependency reinstalls.`
    } else {
      response = `I can help you with:\n\n`
      response += `- System health status\n`
      response += `- Active issues and their details\n`
      response += `- Recent fixes applied\n`
      response += `- Learning patterns identified\n`
      response += `- Monitoring system explanation\n`
      response += `- Performance optimization recommendations\n\n`
      response += `What would you like to know?`
    }

    return NextResponse.json({ response })

  } catch (error) {
    console.error('Error in diagnostics chat:', error)
    return NextResponse.json(
      { error: 'Failed to process message' },
      { status: 500 }
    )
  }
}
