
import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

/**
 * Layout Analysis API - Fixed to support 25+ TV layouts
 * 
 * Key features:
 * 1. Removed 12-output limit - now creates outputs for ALL detected TVs
 * 2. Improved position mapping to handle 25+ TVs with better spacing
 * 3. Enhanced TV detection to support larger layouts (up to 100 TVs)
 * 4. Better fallback positioning for grid layouts
 * 5. **NEW**: Reads actual Wolfpack output configuration from database
 * 6. **NEW**: Maps TVs only to configured/active Wolfpack outputs
 * 
 * The API now:
 * - Detects all TVs from layout descriptions/images
 * - Queries actual Wolfpack outputs from MatrixConfiguration database
 * - Creates output mappings using real Wolfpack output numbers (not arbitrary)
 * - Positions TVs intelligently based on wall locations
 * - Supports layouts with 25+ TVs like the Graystone layout
 * - Warns if more TVs detected than available Wolfpack outputs
 */

interface TVLocation {
  number: number
  description: string
  position: {
    x: number
    y: number
    wall: string
  }
}

interface InputMapping {
  outputNumber: number
  suggestedInput: string
  confidence: number
  reasoning: string
}

interface LayoutAnalysis {
  totalTVs: number
  locations: TVLocation[]
  suggestions: {
    outputNumber: number
    tvNumber: number
    label: string
    description: string
    priority: 'high' | 'medium' | 'low'
    audioOutput?: string
  }[]
  inputMappingSuggestions?: InputMapping[]
}

export async function POST(request: NextRequest) {
  try {
    const { layoutDescription, matrixOutputs, availableOutputs, imageUrl, availableInputs } = await request.json()
    
    console.log('AI Analysis - Input:', { layoutDescription, matrixOutputs, availableOutputs, imageUrl })
    
    // NEW: Use AI Vision to detect TV positions from the actual image
    let tvLocations: TVLocation[] = []
    
    if (imageUrl) {
      console.log('AI Analysis - Using Vision API to detect TV positions from image')
      try {
        const visionResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/ai/vision-analyze-layout`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageUrl })
        })
        
        if (visionResponse.ok) {
          const visionData = await visionResponse.json()
          if (visionData.analysis && visionData.analysis.detections) {
            // Convert vision detections to TVLocation format
            tvLocations = visionData.analysis.detections.map((detection: any) => ({
              number: detection.number,
              description: detection.description || `TV ${detection.number}`,
              position: {
                x: detection.position.x,
                y: detection.position.y,
                wall: determineWallFromPosition(detection.position.x, detection.position.y)
              }
            }))
            console.log('AI Analysis - Vision detected', tvLocations.length, 'TVs with accurate positions')
          }
        } else {
          console.warn('AI Analysis - Vision API failed, falling back to description parsing')
        }
      } catch (visionError) {
        console.error('AI Analysis - Vision API error:', visionError)
        console.log('AI Analysis - Falling back to description parsing')
      }
    }
    
    // Fallback: Parse the layout description if vision analysis failed or no image provided
    if (tvLocations.length === 0) {
      console.log('AI Analysis - Using description parsing (fallback)')
      tvLocations = await parseLayoutDescription(layoutDescription, imageUrl)
    }
    
    console.log('AI Analysis - Final Locations:', tvLocations.length, tvLocations.slice(0, 3))
    
    // Get actual Wolfpack outputs from database configuration
    let activeOutputs: any[] = []
    try {
      const config = await prisma.matrixConfiguration.findFirst({
        where: { isActive: true },
        include: {
          outputs: {
            where: { 
              isActive: true,
              status: 'active'
            },
            orderBy: { channelNumber: 'asc' }
          }
        }
      })
      
      if (config && config.outputs) {
        activeOutputs = config.outputs
        console.log('AI Analysis - Loaded Wolfpack Outputs from DB:', activeOutputs.length, 'active outputs')
      } else {
        console.log('AI Analysis - No active Wolfpack configuration found, using fallback')
        // Fallback to provided outputs if database query fails
        if (availableOutputs && Array.isArray(availableOutputs)) {
          activeOutputs = availableOutputs.filter(output => 
            output.status === 'active' || !output.status
          )
        }
      }
    } catch (dbError) {
      console.error('AI Analysis - Database query failed:', dbError)
      // Fallback to provided outputs
      if (availableOutputs && Array.isArray(availableOutputs)) {
        activeOutputs = availableOutputs.filter(output => 
          output.status === 'active' || !output.status
        )
      }
    }
    
    console.log('AI Analysis - Active Outputs:', activeOutputs.length, 'outputs available')
    
    // Generate intelligent output mappings only for active outputs
    const suggestions = generateOutputMappings(tvLocations, matrixOutputs, activeOutputs)
    console.log('AI Analysis - Generated Suggestions:', suggestions.length, suggestions.slice(0, 3))
    
    // Generate AI input mapping suggestions
    let inputMappingSuggestions: InputMapping[] = []
    if (availableInputs && Array.isArray(availableInputs) && availableInputs.length > 0) {
      inputMappingSuggestions = generateInputMappingSuggestions(suggestions, availableInputs)
      console.log('AI Analysis - Generated Input Mapping:', inputMappingSuggestions.length, inputMappingSuggestions.slice(0, 3))
    }
    
    const analysis: LayoutAnalysis = {
      totalTVs: tvLocations.length,
      locations: tvLocations,
      suggestions: suggestions,
      inputMappingSuggestions: inputMappingSuggestions
    }
    
    console.log('AI Analysis - Final Result:', { totalTVs: analysis.totalTVs, suggestionsCount: analysis.suggestions.length })
    
    return NextResponse.json({ analysis })
  } catch (error) {
    console.error('Error analyzing layout:', error)
    return NextResponse.json(
      { error: 'Failed to analyze layout' },
      { status: 500 }
    )
  } finally {
    await prisma.$disconnect()
  }
}

function determineWallFromPosition(x: number, y: number): string {
  // Determine wall based on position percentages
  const EDGE_THRESHOLD = 20 // Within 20% of edge is considered a wall
  
  if (x < EDGE_THRESHOLD) return 'left'
  if (x > 100 - EDGE_THRESHOLD) return 'right'
  if (y < EDGE_THRESHOLD) return 'top'
  if (y > 100 - EDGE_THRESHOLD) return 'bottom'
  
  // Check corners
  if (x < EDGE_THRESHOLD * 1.5 && y < EDGE_THRESHOLD * 1.5) return 'corner'
  if (x > 100 - EDGE_THRESHOLD * 1.5 && y < EDGE_THRESHOLD * 1.5) return 'corner'
  if (x < EDGE_THRESHOLD * 1.5 && y > 100 - EDGE_THRESHOLD * 1.5) return 'corner'
  if (x > 100 - EDGE_THRESHOLD * 1.5 && y > 100 - EDGE_THRESHOLD * 1.5) return 'corner'
  
  return 'center'
}

async function parseLayoutDescription(description: string, imageUrl?: string): Promise<TVLocation[]> {
  console.log('Parsing layout description with image:', !!imageUrl)
  
  // Extract TV/marker numbers from the description using regex
  const markerRegex = /marker (\d+)/gi
  const tvRegex = /tv (\d+)/gi
  const numberedRegex = /(\d+)\s+(?:is|are|located)/gi
  
  const foundNumbers = new Set<number>()
  
  // Find all mentioned numbers in the description
  let match
  while ((match = markerRegex.exec(description)) !== null) {
    foundNumbers.add(parseInt(match[1]))
  }
  
  while ((match = tvRegex.exec(description)) !== null) {
    foundNumbers.add(parseInt(match[1]))
  }
  
  while ((match = numberedRegex.exec(description)) !== null) {
    foundNumbers.add(parseInt(match[1]))
  }
  
  // If no numbers found in description, try to extract from common patterns
  if (foundNumbers.size === 0) {
    // Look for patterns like "20 numbered markers", "15 TVs", etc.
    const countRegex = /(\d+)\s+(?:numbered|markers|tvs|screens|displays)/gi
    while ((match = countRegex.exec(description)) !== null) {
      const count = parseInt(match[1])
      if (count <= 50) { // Reasonable limit for TVs
        for (let i = 1; i <= count; i++) {
          foundNumbers.add(i)
        }
      }
    }
  }
  
  const locations: TVLocation[] = []
  const sortedNumbers = Array.from(foundNumbers).sort((a, b) => a - b)
  
  console.log('Found TV/marker numbers:', sortedNumbers)
  
  // Parse each number and try to determine its position from the description
  for (const number of sortedNumbers) {
    const tvLocation = extractTVLocationFromDescription(description, number)
    locations.push(tvLocation)
  }
  
  // If still no locations found, create a fallback based on description analysis
  if (locations.length === 0) {
    console.log('No specific numbers found, creating fallback locations')
    // Analyze description for general layout info
    const estimatedCount = estimateTVCountFromDescription(description)
    for (let i = 1; i <= estimatedCount; i++) {
      locations.push({
        number: i,
        description: `TV ${i} (estimated from layout)`,
        position: generateFallbackPosition(i, estimatedCount)
      })
    }
  }
  
  console.log('Generated locations:', locations.length)
  return locations.sort((a, b) => a.number - b.number)
}

function extractTVLocationFromDescription(description: string, number: number): TVLocation {
  // Find the context around this specific number
  const patterns = [
    new RegExp(`marker\\s+${number}[^.]*?([^.]*?)(?=marker\\s+\\d+|$)`, 'gi'),
    new RegExp(`tv\\s+${number}[^.]*?([^.]*?)(?=tv\\s+\\d+|$)`, 'gi'),
    new RegExp(`${number}\\s+is\\s+([^.]*?)(?=\\d+\\s+is|$)`, 'gi')
  ]
  
  let locationDesc = `TV ${number} location`
  let wall = 'center'
  
  for (const pattern of patterns) {
    const match = pattern.exec(description)
    if (match && match[1]) {
      locationDesc = match[1].trim()
      break
    }
  }
  
  // Analyze the description to determine wall position
  const lowerDesc = locationDesc.toLowerCase()
  if (lowerDesc.includes('left') || lowerDesc.includes('vertical wall') && lowerDesc.includes('left')) {
    wall = 'left'
  } else if (lowerDesc.includes('right') || lowerDesc.includes('vertical wall') && lowerDesc.includes('right')) {
    wall = 'right'
  } else if (lowerDesc.includes('top') || lowerDesc.includes('upper') || lowerDesc.includes('horizontal wall') && lowerDesc.includes('top')) {
    wall = 'top'
  } else if (lowerDesc.includes('bottom') || lowerDesc.includes('lower') || lowerDesc.includes('horizontal wall') && lowerDesc.includes('bottom')) {
    wall = 'bottom'
  } else if (lowerDesc.includes('corner')) {
    wall = 'corner'
  }
  
  return {
    number,
    description: locationDesc || `TV ${number}`,
    position: extractPositionFromWall(wall, number)
  }
}

function estimateTVCountFromDescription(description: string): number {
  // Try to estimate TV count from description
  const countMatches = description.match(/(\d+)\s+(?:numbered|markers|tvs|screens|displays)/gi)
  if (countMatches) {
    const numbers = countMatches.map(match => {
      const num = parseInt(match.match(/\d+/)?.[0] || '0')
      return num
    }).filter(n => n > 0 && n <= 100) // Increased limit to support larger layouts
    
    if (numbers.length > 0) {
      return Math.max(...numbers)
    }
  }
  
  // Count distinct numbers mentioned
  const numberMatches = description.match(/\b\d+\b/g)
  if (numberMatches) {
    const numbersSet = new Set(numberMatches.map(n => parseInt(n)))
    const uniqueNumbers = Array.from(numbersSet)
      .filter(n => n > 0 && n <= 100) // Increased limit to support larger layouts
    
    if (uniqueNumbers.length > 0) {
      return Math.max(...uniqueNumbers)
    }
  }
  
  // Fallback: estimate based on description length and complexity
  if (description.length > 3000) return 30 // Support larger layouts
  if (description.length > 2000) return 25
  if (description.length > 1000) return 15
  if (description.length > 500) return 10
  return 8
}

function generateFallbackPosition(number: number, total: number): { x: number, y: number, wall: string } {
  // Generate a reasonable grid layout that scales well for 25+ TVs
  const cols = Math.min(7, Math.ceil(Math.sqrt(total))) // Max 7 columns for better spacing
  const rows = Math.ceil(total / cols)
  
  const col = (number - 1) % cols
  const row = Math.floor((number - 1) / cols)
  
  const MARGIN = 12 // Slightly smaller margin for more space
  const x = MARGIN + (col * (100 - 2 * MARGIN)) / (cols - 1 || 1)
  const y = MARGIN + (row * (100 - 2 * MARGIN)) / (rows - 1 || 1)
  
  return {
    x: Math.max(MARGIN, Math.min(100 - MARGIN, x)),
    y: Math.max(MARGIN, Math.min(100 - MARGIN, y)),
    wall: 'center'
  }
}

function extractPositionFromWall(wallType: string, markerNumber: number): { x: number, y: number, wall: string } {
  let x = 50, y = 50 // default center
  
  // Minimum distances from edges to prevent corner overlapping
  const EDGE_MARGIN = 12 // 12% from edges for more space
  const TV_SPACING = 15    // Spacing between TVs
  
  switch (wallType) {
    case 'left':
      x = EDGE_MARGIN
      // Distribute left wall TVs vertically with proper spacing
      if (markerNumber <= 3) {
        y = 25 + (markerNumber - 1) * TV_SPACING // TVs 1-3 on main left wall
      } else if (markerNumber >= 13 && markerNumber <= 15) {
        y = 65 + (markerNumber - 13) * TV_SPACING // TVs 13-15 on bottom left section
      } else if (markerNumber >= 20 && markerNumber <= 22) {
        y = 35 + (markerNumber - 20) * TV_SPACING // TVs 20-22 on party east
      }
      break
      
    case 'right':
      x = 100 - EDGE_MARGIN
      // Distribute right wall TVs vertically with proper spacing
      if (markerNumber >= 5 && markerNumber <= 10) {
        y = 20 + (markerNumber - 5) * TV_SPACING // TVs 5-10 on dining/right wall
      } else if (markerNumber === 3 || markerNumber === 4) {
        y = 75 + (markerNumber - 3) * TV_SPACING // TVs 3-4 on west/bottom right
      }
      break
      
    case 'top':
      y = EDGE_MARGIN
      // Distribute top wall TVs horizontally with proper spacing
      if (markerNumber === 1 || markerNumber === 2) {
        x = 70 + (markerNumber - 1) * 15 // TVs 1-2 in EAST section
      } else if (markerNumber >= 13 && markerNumber <= 15) {
        x = 35 + (markerNumber - 13) * 12 // TVs 13-15 in bar area
      } else if (markerNumber === 19) { x = 55 } // TV 19 - center bar
      else if (markerNumber === 20) { x = 25 } // TV 20 - party east
      break
      
    case 'bottom':
      y = 100 - EDGE_MARGIN
      // Distribute bottom wall TVs horizontally with proper spacing
      if (markerNumber >= 23 && markerNumber <= 25) {
        x = 15 + (markerNumber - 23) * 15 // TVs 23-25 on patio/party west
      } else if (markerNumber === 12) { x = 45, y = 70 } // TV 12 - central area
      else if (markerNumber === 16) { x = 40, y = 75 } // TV 16 - central area
      else if (markerNumber === 18) { x = 50 } // TV 18 - bar area
      break
      
    case 'corner':
      // Corners positioned with safe margins to avoid overlapping
      if (markerNumber === 5) { 
        x = 75 
        y = 20 
      } else if (markerNumber === 21) {
        x = 20
        y = 50
      } else if (markerNumber === 22) {
        x = 25
        y = 65
      }
      break
      
    default:
      // Improved fallback positioning with better spacing for 25+ TVs
      const colsPerRow = 7 // Support more TVs per row
      const col = (markerNumber - 1) % colsPerRow
      const row = Math.floor((markerNumber - 1) / colsPerRow)
      
      x = EDGE_MARGIN + (col * (100 - 2 * EDGE_MARGIN)) / (colsPerRow - 1)
      y = EDGE_MARGIN + (row * (100 - 2 * EDGE_MARGIN)) / 4 // More rows
  }
  
  // Ensure positions stay within valid bounds
  x = Math.max(EDGE_MARGIN, Math.min(100 - EDGE_MARGIN, x))
  y = Math.max(EDGE_MARGIN, Math.min(100 - EDGE_MARGIN, y))
  
  return { x, y, wall: wallType }
}

function generateOutputMappings(locations: TVLocation[], matrixOutputs: number = 36, activeOutputs: any[] = []) {
  const suggestions: any[] = []
  
  // Use actual Wolfpack output numbers from the database configuration
  let availableOutputNumbers: number[] = []
  
  if (activeOutputs.length > 0) {
    // Extract actual output channel numbers from Wolfpack configuration
    availableOutputNumbers = activeOutputs.map(output => output.channelNumber).sort((a, b) => a - b)
    console.log(`Using ${availableOutputNumbers.length} actual Wolfpack output numbers:`, availableOutputNumbers)
  } else {
    // Fallback: generate output numbers if no active outputs configured
    console.warn('No active Wolfpack outputs found - generating fallback output numbers')
    const maxOutputs = Math.max(matrixOutputs, locations.length)
    availableOutputNumbers = Array.from({ length: maxOutputs }, (_, i) => i + 1)
    console.log(`Generated ${availableOutputNumbers.length} fallback output numbers for ${locations.length} TV locations`)
  }
  
  // Limit locations to available outputs to prevent mapping to non-existent outputs
  const locationsToProcess = locations.slice(0, availableOutputNumbers.length)
  
  if (locations.length > availableOutputNumbers.length) {
    console.warn(`Warning: ${locations.length} TVs detected but only ${availableOutputNumbers.length} Wolfpack outputs available. Mapping first ${availableOutputNumbers.length} TVs only.`)
  }
  
  console.log(`Processing ${locationsToProcess.length} TV locations with ${availableOutputNumbers.length} available Wolfpack outputs`)
  
  for (let i = 0; i < locationsToProcess.length; i++) {
    const location = locationsToProcess[i]
    const priority = determineLocationPriority(location)
    
    // Generate smart labels based on position
    // Note: Vision API should return labels in "TV 01", "TV 02" format (with leading zeros)
    // to match Wolfpack output labels
    const label = generateSmartLabel(location)
    
    // Use output numbers in order (1-to-1 mapping with TV numbers when possible)
    const outputNumber = availableOutputNumbers[i]
    
    // Get audio output info if available from active outputs
    let audioOutput = ''
    if (activeOutputs.length > 0) {
      const outputConfig = activeOutputs.find(output => output.channelNumber === outputNumber)
      if (outputConfig && outputConfig.audioOutput) {
        audioOutput = outputConfig.audioOutput
      }
    }
    
    suggestions.push({
      outputNumber: outputNumber,
      tvNumber: location.number,
      label: label,
      description: location.description,
      priority: priority,
      audioOutput: audioOutput,
      position: location.position  // Include position data from vision detection
    })
  }
  
  console.log(`Successfully created ${suggestions.length} output mappings for all TV locations`)
  
  return suggestions
}

function determineLocationPriority(location: TVLocation): 'high' | 'medium' | 'low' {
  const desc = location.description.toLowerCase()
  
  // High priority: Main viewing areas, central locations
  if (desc.includes('main room') || 
      desc.includes('center') || 
      location.number <= 10) {
    return 'high'
  }
  
  // Medium priority: Secondary viewing areas
  if (desc.includes('corner') || 
      desc.includes('side') || 
      location.number <= 15) {
    return 'medium'
  }
  
  // Low priority: Peripheral locations
  return 'low'
}

function generateSmartLabel(location: TVLocation): string {
  const desc = location.description.toLowerCase()
  
  // Direct matches for known areas
  if (desc.includes('main bar right')) {
    return `Main Bar Right ${location.number}`
  }
  
  if (desc.includes('side area')) {
    return `Side Area ${location.number}`
  }
  
  if (desc.includes('lower section')) {
    return `Lower Section ${location.number}`
  }
  
  if (desc.includes('corner') && desc.includes('main room')) {
    return `Main Bar Right ${location.number}`
  }
  
  if (desc.includes('l-shaped')) {
    return `Side Area ${location.number}`
  }
  
  if (desc.includes('bottom left section')) {
    return `Lower Section ${location.number}`
  }
  
  if (desc.includes('main room')) {
    return `Main Bar ${location.number}`
  }
  
  // Default naming based on TV number
  return `TV ${location.number}`
}

function generateInputMappingSuggestions(suggestions: any[], availableInputs: any[]): InputMapping[] {
  const inputMappings: InputMapping[] = []
  
  // Create a pool of inputs based on their types and labels
  const inputsByType = {
    cable: availableInputs.filter(input => input.inputType.toLowerCase().includes('cable')),
    satellite: availableInputs.filter(input => input.inputType.toLowerCase().includes('satellite')),
    streaming: availableInputs.filter(input => input.inputType.toLowerCase().includes('streaming')),
    gaming: availableInputs.filter(input => input.inputType.toLowerCase().includes('gaming')),
    other: availableInputs.filter(input => 
      !input.inputType.toLowerCase().includes('cable') &&
      !input.inputType.toLowerCase().includes('satellite') &&
      !input.inputType.toLowerCase().includes('streaming') &&
      !input.inputType.toLowerCase().includes('gaming')
    )
  }
  
  // Sort suggestions by priority (high priority areas get better inputs)
  const sortedSuggestions = [...suggestions].sort((a, b) => {
    const priorityOrder = { high: 3, medium: 2, low: 1 }
    return (priorityOrder[b.priority as keyof typeof priorityOrder] || 0) - (priorityOrder[a.priority as keyof typeof priorityOrder] || 0)
  })
  
  // Track assigned inputs to avoid duplicates
  const assignedInputs = new Set<string>()
  
  for (const suggestion of sortedSuggestions) {
    const location = suggestion.label.toLowerCase()
    let recommendedInput: any = null
    let confidence = 70 // Base confidence
    let reasoning = 'AI-based location analysis'
    
    // High priority locations get premium content
    if (suggestion.priority === 'high') {
      // Main areas get satellite/cable for sports
      if (location.includes('main') || location.includes('bar')) {
        recommendedInput = findAvailableInput(inputsByType.satellite, assignedInputs) ||
                          findAvailableInput(inputsByType.cable, assignedInputs)
        confidence = 90
        reasoning = 'Main viewing area - prioritized for sports content'
      }
    }
    
    // Medium priority locations get diverse content
    else if (suggestion.priority === 'medium') {
      if (location.includes('side') || location.includes('corner')) {
        recommendedInput = findAvailableInput(inputsByType.streaming, assignedInputs) ||
                          findAvailableInput(inputsByType.cable, assignedInputs)
        confidence = 80
        reasoning = 'Secondary viewing area - suitable for varied content'
      }
    }
    
    // Low priority locations get remaining inputs
    else {
      recommendedInput = findAvailableInput(inputsByType.other, assignedInputs) ||
                        findAvailableInput(inputsByType.streaming, assignedInputs) ||
                        findAvailableInput([...availableInputs], assignedInputs)
      confidence = 60
      reasoning = 'Peripheral location - assigned available input'
    }
    
    // Fallback: assign any available input
    if (!recommendedInput) {
      recommendedInput = findAvailableInput([...availableInputs], assignedInputs)
      confidence = 50
      reasoning = 'Fallback assignment - any available input'
    }
    
    if (recommendedInput) {
      assignedInputs.add(recommendedInput.label)
      inputMappings.push({
        outputNumber: suggestion.outputNumber,
        suggestedInput: recommendedInput.label,
        confidence: confidence,
        reasoning: reasoning
      })
    }
  }
  
  return inputMappings
}

function findAvailableInput(inputPool: any[], assignedInputs: Set<string>): any | null {
  return inputPool.find(input => !assignedInputs.has(input.label)) || null
}
