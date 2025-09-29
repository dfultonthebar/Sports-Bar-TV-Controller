
// Wolfpack Matrix AI Analysis API Route

import { NextRequest, NextResponse } from 'next/server'
import WolfpackMatrixAIAnalyzer from '@/lib/wolfpack-ai-analyzer'

export async function POST(request: NextRequest) {
  try {
    const { matrixData } = await request.json()
    
    if (!matrixData) {
      return NextResponse.json(
        { error: 'Matrix data is required' },
        { status: 400 }
      )
    }

    const analyzer = new WolfpackMatrixAIAnalyzer()
    const insights = await analyzer.analyzeMatrixSystem(matrixData)

    return NextResponse.json({
      success: true,
      insights,
      analysisTimestamp: new Date().toISOString(),
      systemInfo: {
        analyzer: 'Wolfpack Matrix AI v1.0',
        capabilities: [
          'Connection Analysis',
          'Configuration Review', 
          'Routing Optimization',
          'Layout Mapping',
          'Audio Routing Analysis',
          'Performance Monitoring',
          'Channel Utilization'
        ]
      }
    })

  } catch (error) {
    console.error('Wolfpack AI Analysis Error:', error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Analysis failed',
      insights: [{
        type: 'error',
        category: 'performance',
        title: 'AI Analysis Error',
        message: `Failed to analyze matrix system: ${error instanceof Error ? error.message : 'Unknown error'}`,
        confidence: 95,
        priority: 'medium',
        timestamp: new Date().toISOString()
      }]
    }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({
    service: 'Wolfpack Matrix AI Analysis',
    version: '1.0.0',
    capabilities: [
      'Real-time matrix analysis',
      'Configuration optimization',
      'Connection troubleshooting',
      'Routing pattern analysis',
      'Layout integration insights',
      'Audio routing recommendations',
      'Performance monitoring',
      'Channel utilization analysis'
    ],
    supportedProtocols: ['TCP', 'UDP'],
    supportedCommands: [
      'YAll. (Input to all outputs)',
      'All1. (One-to-one mapping)', 
      'YXZ. (Input to output)',
      'YXZ&Q&W. (Input to multiple outputs)',
      'SaveY./RecallY. (Scene management)',
      'BeepON./BeepOFF. (Buzzer control)',
      'Y?. (Status query)'
    ]
  })
}
