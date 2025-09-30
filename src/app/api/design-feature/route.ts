
import { NextRequest, NextResponse } from 'next/server'
import { EnhancedAIClient, FeatureDesignRequest } from '@/lib/enhanced-ai-client'

export async function POST(request: NextRequest) {
  try {
    const designRequest: FeatureDesignRequest = await request.json()

    if (!designRequest.featureName || !designRequest.description || !designRequest.requirements) {
      return NextResponse.json({ 
        error: 'Feature name, description, and requirements are required' 
      }, { status: 400 })
    }

    const enhancedAI = new EnhancedAIClient()
    const result = await enhancedAI.designFeature(designRequest)

    if (result.error) {
      return NextResponse.json({ 
        error: `Feature design failed: ${result.error}` 
      }, { status: 500 })
    }

    return NextResponse.json({ design: result.content })
  } catch (error) {
    console.error('Feature design API error:', error)
    return NextResponse.json({ 
      error: 'Failed to design feature' 
    }, { status: 500 })
  }
}
