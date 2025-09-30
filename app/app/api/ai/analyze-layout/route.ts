
import { NextRequest, NextResponse } from 'next/server'

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
    
    // Parse the AI-analyzed layout description to extract TV locations
    const tvLocations = await parseLayoutDescription(layoutDescription, imageUrl)
    console.log('AI Analysis - Parsed Locations:', tvLocations.length, tvLocations.slice(0, 3))
    
    // Get available (active) outputs from matrix configuration
    let activeOutputs = []
    if (availableOutputs && Array.isArray(availableOutputs)) {
      activeOutputs = availableOutputs.filter(output => 
        output.status === 'active' || !output.status // default to active if no status
      )
      console.log('AI Analysis - Active Outputs:', activeOutputs.length, 'of', availableOutputs.length, 'total')
    }
    
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
  }
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
    }).filter(n => n > 0 && n <= 50)
    
    if (numbers.length > 0) {
      return Math.max(...numbers)
    }
  }
  
  // Count distinct numbers mentioned
  const numberMatches = description.match(/\b\d+\b/g)
  if (numberMatches) {
    const numbersSet = new Set(numberMatches.map(n => parseInt(n)))
    const uniqueNumbers = Array.from(numbersSet)
      .filter(n => n > 0 && n <= 50)
    
    if (uniqueNumbers.length > 0) {
      return Math.max(...uniqueNumbers)
    }
  }
  
  // Fallback: estimate based on description length and complexity
  if (description.length > 2000) return 20
  if (description.length > 1000) return 15
  if (description.length > 500) return 10
  return 8
}

function generateFallbackPosition(number: number, total: number): { x: number, y: number, wall: string } {
  // Generate a reasonable grid layout
  const cols = Math.ceil(Math.sqrt(total))
  const rows = Math.ceil(total / cols)
  
  const col = (number - 1) % cols
  const row = Math.floor((number - 1) / cols)
  
  const MARGIN = 15
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
  const EDGE_MARGIN = 15 // 15% from edges
  const TV_SPACING = 18    // Minimum spacing between TVs
  
  switch (wallType) {
    case 'left':
      x = EDGE_MARGIN
      // Distribute left wall TVs vertically with proper spacing
      if (markerNumber <= 3) {
        y = 25 + (markerNumber - 1) * TV_SPACING // TVs 1-3 on main left wall
      } else if (markerNumber >= 13 && markerNumber <= 15) {
        y = 65 + (markerNumber - 13) * TV_SPACING // TVs 13-15 on bottom left section
      }
      break
      
    case 'right':
      x = 100 - EDGE_MARGIN
      // Distribute right wall TVs vertically with proper spacing
      if (markerNumber >= 6 && markerNumber <= 9) {
        y = 25 + (markerNumber - 6) * TV_SPACING // TVs 6-9 on right wall
      }
      break
      
    case 'top':
      y = EDGE_MARGIN
      // Distribute top wall TVs horizontally with proper spacing
      if (markerNumber === 4) { x = 30 } // Side Area 4 - moved away from corner
      else if (markerNumber === 16) { x = 20 } // TV 16 
      else if (markerNumber === 19) { x = 55 } // TV 19 - center area
      else if (markerNumber === 20) { x = 75 } // TV 20 - moved away from right corner
      break
      
    case 'bottom':
      y = 100 - EDGE_MARGIN
      // Distribute bottom wall TVs horizontally with proper spacing
      if (markerNumber === 10) { x = 25, y = 72 } // Internal wall - adjusted
      else if (markerNumber === 11) { x = 30 }
      else if (markerNumber === 12) { x = 40 }
      else if (markerNumber === 17) { x = 50 }
      else if (markerNumber === 18) { x = 60 }
      break
      
    case 'corner':
      // Corners positioned with safe margins to avoid overlapping
      if (markerNumber === 5) { // Main Bar Right 5
        x = 75 // Moved further from right edge
        y = 20 // Moved further from top edge
      }
      break
      
    default:
      // Improved fallback positioning with better spacing
      const colsPerRow = 6
      const col = (markerNumber - 1) % colsPerRow
      const row = Math.floor((markerNumber - 1) / colsPerRow)
      
      x = EDGE_MARGIN + (col * (100 - 2 * EDGE_MARGIN)) / (colsPerRow - 1)
      y = EDGE_MARGIN + (row * (100 - 2 * EDGE_MARGIN)) / 3
  }
  
  // Ensure positions stay within valid bounds
  x = Math.max(EDGE_MARGIN, Math.min(100 - EDGE_MARGIN, x))
  y = Math.max(EDGE_MARGIN, Math.min(100 - EDGE_MARGIN, y))
  
  return { x, y, wall: wallType }
}

function generateOutputMappings(locations: TVLocation[], matrixOutputs: number = 36, activeOutputs: any[] = []) {
  const suggestions = []
  
  // Get available output numbers (only active ones)
  let availableOutputNumbers = []
  if (activeOutputs.length > 0) {
    availableOutputNumbers = activeOutputs.map(output => output.channelNumber).sort((a, b) => a - b)
    console.log('Available output numbers (active only):', availableOutputNumbers)
  } else {
    // Fallback to all outputs 1-36 if no active output info provided
    availableOutputNumbers = Array.from({ length: matrixOutputs }, (_, i) => i + 1)
    console.log('Using all outputs as fallback:', availableOutputNumbers.slice(0, 5), '...')
  }
  
  // Limit locations to available outputs to prevent assigning TVs to unused outputs
  const maxLocations = Math.min(locations.length, availableOutputNumbers.length)
  const locationsToProcess = locations.slice(0, maxLocations)
  
  console.log(`Processing ${locationsToProcess.length} TV locations with ${availableOutputNumbers.length} active outputs`)
  
  for (let i = 0; i < locationsToProcess.length; i++) {
    const location = locationsToProcess[i]
    const priority = determineLocationPriority(location)
    
    // Generate smart labels based on position
    const label = generateSmartLabel(location)
    
    // Use available output numbers in order
    const outputNumber = availableOutputNumbers[i]
    
    // Get audio output info if available
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
      audioOutput: audioOutput
    })
  }
  
  if (locations.length > availableOutputNumbers.length) {
    console.log(`Warning: ${locations.length - availableOutputNumbers.length} TV locations could not be assigned due to insufficient active outputs`)
  }
  
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
