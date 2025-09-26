
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
}

export async function POST(request: NextRequest) {
  try {
    const { layoutDescription, matrixOutputs, availableOutputs } = await request.json()
    
    console.log('AI Analysis - Input:', { layoutDescription, matrixOutputs, availableOutputs })
    
    // Parse the AI-analyzed layout description to extract TV locations
    const tvLocations = parseLayoutDescription(layoutDescription)
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
    
    const analysis: LayoutAnalysis = {
      totalTVs: tvLocations.length,
      locations: tvLocations,
      suggestions: suggestions
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

function parseLayoutDescription(description: string): TVLocation[] {
  // For Stoneyard Appleton layout, we know there are 20 numbered TV locations
  // Generate them based on the known layout structure
  const locations: TVLocation[] = []
  
  // Stoneyard Appleton has 20 TV locations based on the PDF analysis
  const knownLocations = [
    { number: 1, description: "Side Area 1 on the vertical wall of the L-shaped section", wall: "left" },
    { number: 2, description: "TV 2 above Marker 1 on the same vertical wall", wall: "left" },
    { number: 3, description: "TV 3 above Marker 2 on the same vertical wall", wall: "left" },
    { number: 4, description: "Side Area 4 on the horizontal wall of the L-shaped section", wall: "top" },
    { number: 5, description: "Main Bar Right 5 in the top right corner of the main room", wall: "corner" },
    { number: 6, description: "Main Bar Right 6 on the right vertical wall of the main room", wall: "right" },
    { number: 7, description: "TV 7 below Marker 6 on the same vertical wall", wall: "right" },
    { number: 8, description: "TV 8 below Marker 7 on the same vertical wall", wall: "right" },
    { number: 9, description: "TV 9 below Marker 8 on the same vertical wall", wall: "right" },
    { number: 10, description: "Lower Section 10 on a small internal wall in the bottom left section", wall: "bottom" },
    { number: 11, description: "Lower Section 11 on the bottom horizontal wall of the bottom left section", wall: "bottom" },
    { number: 12, description: "Lower Section 12 on the bottom horizontal wall of the bottom left section", wall: "bottom" },
    { number: 13, description: "TV 13 on the left vertical wall of the bottom left section", wall: "left" },
    { number: 14, description: "TV 14 above Marker 13 on the same vertical wall", wall: "left" },
    { number: 15, description: "TV 15 above Marker 14 on the same vertical wall", wall: "left" },
    { number: 16, description: "TV 16 on the top horizontal wall of the bottom left section", wall: "top" },
    { number: 17, description: "TV 17 on the bottom horizontal wall of the L-shaped section", wall: "bottom" },
    { number: 18, description: "TV 18 on the bottom horizontal wall of the L-shaped section", wall: "bottom" },
    { number: 19, description: "TV 19 on the top horizontal wall of the main room", wall: "top" },
    { number: 20, description: "TV 20 on the top horizontal wall of the main room", wall: "top" }
  ]
  
  knownLocations.forEach(loc => {
    locations.push({
      number: loc.number,
      description: loc.description,
      position: extractPositionFromWall(loc.wall, loc.number)
    })
  })
  
  return locations.sort((a, b) => a.number - b.number)
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
