
/**
 * API Route: Manage Code Changes
 */

import { NextRequest, NextResponse } from 'next/server'
import { changeManager } from '../../services/changeManager'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type')
    
    let changes
    switch (type) {
      case 'pending':
        changes = changeManager.getPendingChanges()
        break
      case 'applied':
        changes = changeManager.getAppliedChanges()
        break
      case 'history':
        changes = changeManager.getChangeHistory()
        break
      default:
        changes = changeManager.getPendingChanges()
    }
    
    return NextResponse.json({ changes })
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch changes' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, changeId, ...data } = body
    
    switch (action) {
      case 'approve':
        await changeManager.approveChange(changeId)
        return NextResponse.json({ success: true, message: 'Change approved' })
        
      case 'reject':
        await changeManager.rejectChange(changeId, data.reason)
        return NextResponse.json({ success: true, message: 'Change rejected' })
        
      case 'rollback':
        await changeManager.rollbackChange(changeId)
        return NextResponse.json({ success: true, message: 'Change rolled back' })
        
      case 'propose':
        const result = await changeManager.proposeChange(
          data.filePath,
          data.type,
          data.description,
          data.newContent,
          data.aiModel,
          data.reasoning
        )
        return NextResponse.json({ success: true, ...result })
        
      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        )
    }
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    )
  }
}
