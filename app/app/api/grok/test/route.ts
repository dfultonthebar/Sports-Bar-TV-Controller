

import { NextRequest, NextResponse } from 'next/server'
import { grokService } from '@/lib/grok-service'

export async function POST(request: NextRequest) {
  try {
    const { prompt } = await request.json()
    
    if (!prompt) {
      return NextResponse.json(
        { error: 'Prompt is required' }, 
        { status: 400 }
      )
    }
    
    const analysis = await grokService.generateSportsAnalysis(prompt)
    
    return NextResponse.json({
      success: true,
      analysis,
      provider: 'Grok (xAI)',
      timestamp: new Date().toISOString()
    })
    
  } catch (error) {
    console.error('Grok API test error:', error)
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Unknown error',
        success: false
      }, 
      { status: 500 }
    )
  }
}

export async function GET() {
  try {
    // Simple test to check if API key is configured
    const testPrompt = "What are the top 3 sports to watch this week?"
    const analysis = await grokService.generateSportsAnalysis(testPrompt)
    
    return NextResponse.json({
      success: true,
      message: 'Grok API is working!',
      testAnalysis: analysis,
      provider: 'Grok (xAI)',
      timestamp: new Date().toISOString()
    })
    
  } catch (error) {
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Grok API key not configured',
        success: false,
        message: 'Add your Grok API key via Sports Guide Config → TV Guide APIs tab'
      }, 
      { status: 500 }
    )
  }
}

