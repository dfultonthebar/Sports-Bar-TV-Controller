
import { NextRequest, NextResponse } from 'next/server'
import { operationLogger } from '../../../../lib/operation-logger'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const hours = parseInt(searchParams.get('hours') || '24')
    const type = searchParams.get('type') || 'all'

    switch (type) {
      case 'operations':
        const operations = await operationLogger.getRecentOperations(hours)
        return NextResponse.json({ operations })
      
      case 'errors':
        const errors = await operationLogger.getRecentErrors(hours)
        return NextResponse.json({ errors })
      
      case 'learning':
        const learningData = await operationLogger.getLearningData(hours)
        return NextResponse.json({ learningData })
      
      case 'summary':
        const summary = await operationLogger.getOperationSummary(hours)
        return NextResponse.json({ summary })
      
      default:
        const allOperations = await operationLogger.getRecentOperations(hours)
        const allErrors = await operationLogger.getRecentErrors(hours)
        const allSummary = await operationLogger.getOperationSummary(hours)
        
        return NextResponse.json({
          operations: allOperations,
          errors: allErrors,
          summary: allSummary
        })
    }
  } catch (error) {
    console.error('Error fetching logs:', error)
    return NextResponse.json(
      { error: 'Failed to fetch logs' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const logData = await request.json()
    
    if (logData.type === 'operation') {
      await operationLogger.logOperation(logData)
    } else if (logData.type === 'error') {
      await operationLogger.logError(logData)
    } else {
      return NextResponse.json(
        { error: 'Invalid log type' },
        { status: 400 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error logging data:', error)
    return NextResponse.json(
      { error: 'Failed to log data' },
      { status: 500 }
    )
  }
}
