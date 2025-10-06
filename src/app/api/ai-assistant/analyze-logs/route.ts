
import { NextRequest, NextResponse } from 'next/server';
import { enhancedLogger } from '@/lib/enhanced-logger';
import { searchKnowledgeBase, buildContextFromDocs } from '@/lib/ai-knowledge';

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      hours = 24, 
      category,
      includeKnowledge = true,
      model = 'llama3.2:3b',
      focusArea
    } = body;
    
    // Fetch logs and analytics
    const logs = await enhancedLogger.getRecentLogs(hours, category);
    const analytics = await enhancedLogger.getLogAnalytics(hours);
    
    // Filter to most relevant logs
    const errorLogs = logs.filter(log => 
      log.level === 'error' || log.level === 'critical'
    ).slice(0, 30);
    
    const warningLogs = logs.filter(log => 
      log.level === 'warn'
    ).slice(0, 20);
    
    // Build context for AI
    let context = '=== SYSTEM LOG ANALYSIS REQUEST ===\n\n';
    
    // Add analytics summary
    context += `## System Health Summary (Last ${hours} hours)\n`;
    context += `- Total Operations: ${analytics.totalLogs}\n`;
    context += `- Error Rate: ${analytics.errorRate.toFixed(2)}%\n`;
    context += `- Average Response Time: ${analytics.performanceMetrics.averageResponseTime.toFixed(0)}ms\n\n`;
    
    // Add top errors
    if (analytics.topErrors.length > 0) {
      context += `## Top Errors:\n`;
      analytics.topErrors.slice(0, 5).forEach((error, idx) => {
        context += `${idx + 1}. ${error.message} (${error.count} occurrences)\n`;
        context += `   Last occurred: ${new Date(error.lastOccurred).toLocaleString()}\n`;
      });
      context += '\n';
    }
    
    // Add recent error logs with details
    if (errorLogs.length > 0) {
      context += `## Recent Error Logs (${errorLogs.length} errors):\n\n`;
      errorLogs.slice(0, 15).forEach((log, idx) => {
        context += `### Error ${idx + 1} [${log.level.toUpperCase()}]\n`;
        context += `Time: ${new Date(log.timestamp).toLocaleString()}\n`;
        context += `Source: ${log.source} - ${log.action}\n`;
        context += `Message: ${log.message}\n`;
        if (log.details) {
          context += `Details: ${JSON.stringify(log.details, null, 2)}\n`;
        }
        if (log.deviceType && log.deviceId) {
          context += `Device: ${log.deviceType} (${log.deviceId})\n`;
        }
        if (log.errorStack) {
          context += `Stack: ${log.errorStack.split('\n').slice(0, 3).join('\n')}\n`;
        }
        context += '\n';
      });
    }
    
    // Add warning logs
    if (warningLogs.length > 0) {
      context += `## Recent Warnings (${warningLogs.length} warnings):\n\n`;
      warningLogs.slice(0, 10).forEach((log, idx) => {
        context += `${idx + 1}. [${new Date(log.timestamp).toLocaleTimeString()}] ${log.message}\n`;
        if (log.details) {
          context += `   Details: ${JSON.stringify(log.details)}\n`;
        }
      });
      context += '\n';
    }
    
    // Add device usage patterns
    if (analytics.deviceUsage.length > 0) {
      context += `## Device Usage & Error Rates:\n`;
      analytics.deviceUsage.slice(0, 10).forEach(device => {
        context += `- ${device.device}: ${device.operations} operations, ${device.errorRate.toFixed(1)}% error rate\n`;
      });
      context += '\n';
    }
    
    // Add existing recommendations
    if (analytics.recommendations.length > 0) {
      context += `## System Recommendations:\n`;
      analytics.recommendations.forEach(rec => {
        context += `- ${rec}\n`;
      });
      context += '\n';
    }
    
    // Add knowledge base context if enabled
    let sources: any[] = [];
    if (includeKnowledge) {
      // Search for relevant troubleshooting docs
      const searchQuery = focusArea || 
        `troubleshooting ${errorLogs.map(l => l.source).join(' ')} errors`;
      const relevantDocs = searchKnowledgeBase(searchQuery, 3);
      
      if (relevantDocs.length > 0) {
        context += buildContextFromDocs(relevantDocs);
        sources = relevantDocs.map(doc => ({
          source: doc.source,
          title: doc.metadata.filename,
          type: doc.type
        }));
      }
    }
    
    // Build the AI prompt
    const prompt = context + `
Based on the above system logs and documentation, please provide:

1. **Root Cause Analysis**: Identify the primary issues causing errors
2. **Impact Assessment**: How these errors affect system operations
3. **Immediate Actions**: What should be done right now to address critical issues
4. **Preventive Measures**: How to prevent these issues in the future
5. **System Health Status**: Overall assessment of system health

Please be specific and actionable in your recommendations.`;
    
    // Call Ollama API
    const response = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        prompt,
        stream: false
      })
    });
    
    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    return NextResponse.json({
      analysis: data.response,
      model: data.model,
      sources,
      logsSummary: {
        totalLogs: logs.length,
        errorCount: errorLogs.length,
        warningCount: warningLogs.length,
        errorRate: analytics.errorRate,
        timeRange: `${hours} hours`,
        systemHealth: analytics.errorRate > 10 ? 'critical' : 
                     analytics.errorRate > 5 ? 'warning' : 'healthy'
      },
      recommendations: analytics.recommendations
    });
    
  } catch (error) {
    console.error('Error analyzing logs:', error);
    return NextResponse.json(
      { error: 'Failed to analyze logs' },
      { status: 500 }
    );
  }
}
