
import { NextRequest, NextResponse } from 'next/server'
import { EnhancedAIClient, ScriptGenerationRequest } from '../../../lib/enhanced-ai-client'

export async function POST(request: NextRequest) {
  try {
    const scriptRequest: ScriptGenerationRequest = await request.json()

    if (!scriptRequest.description || !scriptRequest.scriptType) {
      return NextResponse.json({ 
        error: 'Description and script type are required' 
      }, { status: 400 })
    }

    const enhancedAI = new EnhancedAIClient()
    const result = await enhancedAI.generateScript(scriptRequest)

    if (result.error) {
      return NextResponse.json({ 
        error: `Script generation failed: ${result.error}` 
      }, { status: 500 })
    }

    return NextResponse.json({ script: result.content })
  } catch (error) {
    console.error('Script generation API error:', error)
    return NextResponse.json({ 
      error: 'Failed to generate script' 
    }, { status: 500 })
  }
}
