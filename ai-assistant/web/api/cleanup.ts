
/**
 * API Route: Code Cleanup Operations
 */

import { NextRequest, NextResponse } from 'next/server'
import { cleanupOperations } from '../../../core/cleanup/cleanupOperations'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { operation, filePath, dirPath } = body
    
    switch (operation) {
      case 'remove-unused-imports':
        const importChange = await cleanupOperations.removeUnusedImports(filePath)
        return NextResponse.json({ success: true, change: importChange })
        
      case 'fix-lint':
        const lintChange = await cleanupOperations.fixLintErrors(filePath)
        return NextResponse.json({ success: true, change: lintChange })
        
      case 'add-docs':
        const docsChange = await cleanupOperations.addMissingDocs(filePath)
        return NextResponse.json({ success: true, change: docsChange })
        
      case 'scan':
        const operations = await cleanupOperations.scanForCleanup(dirPath)
        return NextResponse.json({ success: true, operations })
        
      default:
        return NextResponse.json(
          { error: 'Invalid operation' },
          { status: 400 }
        )
    }
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to perform cleanup operation' },
      { status: 500 }
    )
  }
}
