import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import Anthropic from '@anthropic-ai/sdk'
import { promises as fs } from 'fs'
import { join } from 'path'

/**
 * AI Vision Layout Analysis API
 * 
 * Uses GPT-4 Vision or Claude Vision to analyze uploaded layout images
 * and detect TV positions with accurate x/y coordinates.
 * 
 * This replaces the hardcoded position logic with actual image analysis.
 */

interface TVDetection {
  number: number
  label: string
  position: {
    x: number  // Percentage from left (0-100)
    y: number  // Percentage from top (0-100)
  }
  confidence: number
  description: string
}

interface VisionAnalysisResult {
  totalTVs: number
  detections: TVDetection[]
  imageWidth: number
  imageHeight: number
  analysisMethod: 'openai' | 'anthropic' | 'fallback'
}

export async function POST(request: NextRequest) {
  try {
    const { imageUrl, imagePath } = await request.json()
    
    console.log('Vision Analysis - Input:', { imageUrl, imagePath })
    
    if (!imageUrl && !imagePath) {
      return NextResponse.json(
        { error: 'No image URL or path provided' },
        { status: 400 }
      )
    }
    
    // Try OpenAI GPT-4 Vision first
    let result: VisionAnalysisResult | null = null
    
    if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'your-openai-api-key') {
      console.log('Attempting OpenAI Vision analysis...')
      result = await analyzeWithOpenAI(imageUrl, imagePath)
    }
    
    // Fallback to Anthropic Claude Vision
    if (!result && process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_API_KEY !== 'your-anthropic-api-key') {
      console.log('Attempting Anthropic Vision analysis...')
      result = await analyzeWithAnthropic(imageUrl, imagePath)
    }
    
    // Fallback to basic detection if no API keys configured
    if (!result) {
      console.log('No AI API keys configured, using fallback detection')
      result = await fallbackAnalysis(imageUrl, imagePath)
    }
    
    console.log('Vision Analysis - Result:', { 
      totalTVs: result.totalTVs, 
      method: result.analysisMethod 
    })
    
    return NextResponse.json({ analysis: result })
  } catch (error) {
    console.error('Error in vision analysis:', error)
    return NextResponse.json(
      { error: 'Failed to analyze image' },
      { status: 500 }
    )
  }
}

async function analyzeWithOpenAI(imageUrl?: string, imagePath?: string): Promise<VisionAnalysisResult | null> {
  try {
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    })
    
    // Prepare image for analysis
    let imageContent: string
    if (imagePath) {
      // Read local file and convert to base64
      const fullPath = join(process.cwd(), 'public', imagePath.replace(/^\//, ''))
      const imageBuffer = await fs.readFile(fullPath)
      const base64Image = imageBuffer.toString('base64')
      const mimeType = imagePath.endsWith('.png') ? 'image/png' : 'image/jpeg'
      imageContent = `data:${mimeType};base64,${base64Image}`
    } else if (imageUrl) {
      // Use URL directly
      imageContent = imageUrl.startsWith('http') ? imageUrl : `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}${imageUrl}`
    } else {
      return null
    }
    
    const response = await openai.chat.completions.create({
      model: 'gpt-4-vision-preview',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Analyze this bar/restaurant floor plan layout image and detect all TV positions.

For each TV/screen/display you detect:
1. Identify the TV number or label (if visible)
2. Determine its position as a percentage from the top-left corner (x: 0-100% from left, y: 0-100% from top)
3. Provide a brief description of its location

Return your analysis as a JSON object with this exact structure:
{
  "totalTVs": <number>,
  "imageWidth": <width in pixels if detectable>,
  "imageHeight": <height in pixels if detectable>,
  "detections": [
    {
      "number": <TV number>,
      "label": "TV <number with leading zero>",
      "position": {
        "x": <percentage 0-100>,
        "y": <percentage 0-100>
      },
      "confidence": <0-100>,
      "description": "<location description>"
    }
  ]
}

Important:
- Look for numbered markers, TV icons, screen symbols, or labeled positions
- Calculate positions accurately based on where the TV appears in the image
- If you see "TV 01", "TV 02", etc., use the exact label format with leading zeros
- If you see "TV 1", "1", "Marker 1", etc., convert to "TV 01" format with leading zero
- The label format MUST be "TV 01", "TV 02", ..., "TV 25" (with leading zeros for numbers 1-9)
- Be precise with x/y coordinates - they should reflect actual positions in the image
- If no numbers are visible, number them sequentially from 1 using the "TV 01" format
- Confidence should be 90-100 if clearly visible, 70-89 if partially visible, below 70 if uncertain`
            },
            {
              type: 'image_url',
              image_url: {
                url: imageContent,
                detail: 'high'
              }
            }
          ]
        }
      ]
    })
    
    const content = response.choices[0]?.message?.content
    if (!content) {
      console.error('OpenAI returned no content')
      return null
    }
    
    // Parse JSON response
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      console.error('Could not extract JSON from OpenAI response')
      return null
    }
    
    const analysisData = JSON.parse(jsonMatch[0])
    
    return {
      totalTVs: analysisData.totalTVs || analysisData.detections?.length || 0,
      detections: analysisData.detections || [],
      imageWidth: analysisData.imageWidth || 1920,
      imageHeight: analysisData.imageHeight || 1080,
      analysisMethod: 'openai'
    }
  } catch (error) {
    console.error('OpenAI Vision analysis failed:', error)
    return null
  }
}

async function analyzeWithAnthropic(imageUrl?: string, imagePath?: string): Promise<VisionAnalysisResult | null> {
  try {
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY
    })
    
    // Prepare image for analysis
    let imageData: { type: string; source: any }
    if (imagePath) {
      // Read local file and convert to base64
      const fullPath = join(process.cwd(), 'public', imagePath.replace(/^\//, ''))
      const imageBuffer = await fs.readFile(fullPath)
      const base64Image = imageBuffer.toString('base64')
      const mediaType = imagePath.endsWith('.png') ? 'image/png' : 'image/jpeg'
      
      imageData = {
        type: 'image',
        source: {
          type: 'base64',
          media_type: mediaType,
          data: base64Image
        }
      }
    } else if (imageUrl) {
      // For URLs, we need to fetch and convert to base64
      const fullUrl = imageUrl.startsWith('http') ? imageUrl : `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}${imageUrl}`
      const response = await fetch(fullUrl)
      const arrayBuffer = await response.arrayBuffer()
      const base64Image = Buffer.from(arrayBuffer).toString('base64')
      const mediaType = imageUrl.endsWith('.png') ? 'image/png' : 'image/jpeg'
      
      imageData = {
        type: 'image',
        source: {
          type: 'base64',
          media_type: mediaType,
          data: base64Image
        }
      }
    } else {
      return null
    }
    
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: [
            imageData,
            {
              type: 'text',
              text: `Analyze this bar/restaurant floor plan layout image and detect all TV positions.

For each TV/screen/display you detect:
1. Identify the TV number or label (if visible)
2. Determine its position as a percentage from the top-left corner (x: 0-100% from left, y: 0-100% from top)
3. Provide a brief description of its location

Return your analysis as a JSON object with this exact structure:
{
  "totalTVs": <number>,
  "imageWidth": <width in pixels if detectable>,
  "imageHeight": <height in pixels if detectable>,
  "detections": [
    {
      "number": <TV number>,
      "label": "TV <number with leading zero>",
      "position": {
        "x": <percentage 0-100>,
        "y": <percentage 0-100>
      },
      "confidence": <0-100>,
      "description": "<location description>"
    }
  ]
}

Important:
- Look for numbered markers, TV icons, screen symbols, or labeled positions
- Calculate positions accurately based on where the TV appears in the image
- If you see "TV 01", "TV 02", etc., use the exact label format with leading zeros
- If you see "TV 1", "1", "Marker 1", etc., convert to "TV 01" format with leading zero
- The label format MUST be "TV 01", "TV 02", ..., "TV 25" (with leading zeros for numbers 1-9)
- Be precise with x/y coordinates - they should reflect actual positions in the image
- If no numbers are visible, number them sequentially from 1 using the "TV 01" format
- Confidence should be 90-100 if clearly visible, 70-89 if partially visible, below 70 if uncertain`
            }
          ]
        }
      ]
    })
    
    const content = message.content[0]
    if (content.type !== 'text') {
      console.error('Anthropic returned non-text content')
      return null
    }
    
    // Parse JSON response
    const jsonMatch = content.text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      console.error('Could not extract JSON from Anthropic response')
      return null
    }
    
    const analysisData = JSON.parse(jsonMatch[0])
    
    return {
      totalTVs: analysisData.totalTVs || analysisData.detections?.length || 0,
      detections: analysisData.detections || [],
      imageWidth: analysisData.imageWidth || 1920,
      imageHeight: analysisData.imageHeight || 1080,
      analysisMethod: 'anthropic'
    }
  } catch (error) {
    console.error('Anthropic Vision analysis failed:', error)
    return null
  }
}

async function fallbackAnalysis(imageUrl?: string, imagePath?: string): Promise<VisionAnalysisResult> {
  console.warn('Using fallback analysis - no AI vision available')
  
  // Return a basic grid layout as fallback
  // This maintains backward compatibility but warns the user
  const detections: TVDetection[] = []
  const totalTVs = 25 // Default assumption for Graystone layout
  
  // Generate a reasonable grid layout
  const cols = 5
  const rows = 5
  
  for (let i = 0; i < totalTVs; i++) {
    const col = i % cols
    const row = Math.floor(i / cols)
    
    // Format label with leading zero to match Wolfpack output format (TV 01, TV 02, etc.)
    const tvNumber = i + 1
    const formattedLabel = `TV ${tvNumber.toString().padStart(2, '0')}`
    
    detections.push({
      number: tvNumber,
      label: formattedLabel,
      position: {
        x: 15 + (col * 70 / (cols - 1)),
        y: 15 + (row * 70 / (rows - 1))
      },
      confidence: 50,
      description: `Fallback position (AI vision not configured)`
    })
  }
  
  return {
    totalTVs,
    detections,
    imageWidth: 1920,
    imageHeight: 1080,
    analysisMethod: 'fallback'
  }
}
