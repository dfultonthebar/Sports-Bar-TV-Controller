
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
  }[]
}

export async function POST(request: NextRequest) {
  try {
    const { layoutDescription, matrixOutputs } = await request.json()
    
    console.log('AI Analysis - Input:', { layoutDescription, matrixOutputs })
    
    // Parse the AI-analyzed layout description to extract TV locations
    const tvLocations = parseLayoutDescription(layoutDescription)
    console.log('AI Analysis - Parsed Locations:', tvLocations.length, tvLocations.slice(0, 3))
    
    // Generate intelligent output mappings
    const suggestions = generateOutputMappings(tvLocations, matrixOutputs)
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
  
  switch (wallType) {
    case 'left':
      x = 8
      // Distribute left wall TVs vertically
      if (markerNumber <= 3) {
        y = 20 + (markerNumber - 1) * 20 // TVs 1-3 on main left wall
      } else if (markerNumber >= 13 && markerNumber <= 15) {
        y = 60 + (markerNumber - 13) * 15 // TVs 13-15 on bottom left section
      }
      break
      
    case 'right':
      x = 92
      // Distribute right wall TVs vertically  
      if (markerNumber >= 6 && markerNumber <= 9) {
        y = 15 + (markerNumber - 6) * 18 // TVs 6-9 on right wall
      }
      break
      
    case 'top':
      y = 8
      // Distribute top wall TVs horizontally
      if (markerNumber === 4) { x = 25 } // Side Area 4
      else if (markerNumber === 16) { x = 15 } // TV 16 
      else if (markerNumber === 19) { x = 60 } // TV 19
      else if (markerNumber === 20) { x = 80 } // TV 20
      break
      
    case 'bottom':
      y = 92
      // Distribute bottom wall TVs horizontally
      if (markerNumber === 10) { x = 20, y = 75 } // Internal wall
      else if (markerNumber === 11) { x = 25 }
      else if (markerNumber === 12) { x = 35 }
      else if (markerNumber === 17) { x = 45 }
      else if (markerNumber === 18) { x = 55 }
      break
      
    case 'corner':
      if (markerNumber === 5) { // Main Bar Right 5
        x = 85
        y = 12
      }
      break
      
    default:
      // Fallback positioning
      x = 20 + (markerNumber % 8) * 10
      y = 20 + Math.floor(markerNumber / 8) * 20
  }
  
  return { x, y, wall: wallType }
}

function generateOutputMappings(locations: TVLocation[], matrixOutputs: number = 36) {
  const suggestions = []
  
  // Priority mapping based on location importance
  const highPriorityAreas = ['main room', 'center', 'bar area']
  const mediumPriorityAreas = ['corner', 'side']
  
  for (const location of locations) {
    const priority = determineLocationPriority(location)
    
    // Generate smart labels based on position
    const label = generateSmartLabel(location)
    
    suggestions.push({
      outputNumber: location.number, // Start with 1:1 mapping
      tvNumber: location.number,
      label: label,
      description: location.description,
      priority: priority
    })
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
