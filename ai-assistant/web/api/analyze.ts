
/**
 * API Route: Code Analysis
 */

import { NextRequest, NextResponse } from 'next/server'
import { ollamaService } from '../../../services/ollamaService'
import fs from 'fs/promises'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { filePath, operation } = body
    
    // Read file content
    const content = await fs.readFile(filePath, 'utf-8')
    
    let result
    switch (operation) {
      case 'analyze':
        result = await ollamaService.analyzeCode(content, filePath)
        break
        
      case 'suggest':
        result = await ollamaService.suggestImprovements(content, body.context || '')
        break
        
      case 'explain':
        result = await ollamaService.explainCode(content)
        break
        
      case 'document':
        result = await ollamaService.generateDocumentation(content, body.functionName || '')
        break
        
      default:
        return NextResponse.json(
          { error: 'Invalid operation' },
          { status: 400 }
        )
    }
    
    return NextResponse.json({ success: true, result })
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to analyze code' },
      { status: 500 }
    )
  }
}
