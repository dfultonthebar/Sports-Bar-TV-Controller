
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
    
    // Parse the AI-analyzed layout description to extract TV locations
    const tvLocations = parseLayoutDescription(layoutDescription)
    
    // Generate intelligent output mappings
    const suggestions = generateOutputMappings(tvLocations, matrixOutputs)
    
    const analysis: LayoutAnalysis = {
      totalTVs: tvLocations.length,
      locations: tvLocations,
      suggestions: suggestions
    }
    
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
  const locations: TVLocation[] = []
  
  // Extract TV locations from the AI description
  // Based on the Stoneyard Appleton layout analysis
  const markerMatches = description.match(/Marker (\d+) is ([^.]+)\./g)
  
  if (markerMatches) {
    markerMatches.forEach(match => {
      const numberMatch = match.match(/Marker (\d+)/)
      const descMatch = match.match(/is (.+)\.$/)
      
      if (numberMatch && descMatch) {
        const number = parseInt(numberMatch[1])
        const desc = descMatch[1]
        
        // Extract position information and assign coordinates
        const location: TVLocation = {
          number: number,
          description: desc,
          position: extractPosition(desc, number)
        }
        
        locations.push(location)
      }
    })
  }
  
  return locations.sort((a, b) => a.number - b.number)
}

function extractPosition(description: string, markerNumber: number): { x: number, y: number, wall: string } {
  // Convert description to approximate coordinates (0-100 scale)
  const desc = description.toLowerCase()
  
  // Determine wall and position
  let wall = 'unknown'
  let x = 50, y = 50 // default center
  
  if (desc.includes('left vertical wall') || desc.includes('left') && desc.includes('wall')) {
    wall = 'left'
    x = 10
    if (desc.includes('bottom')) y = 80
    else if (desc.includes('top')) y = 20
    else if (desc.includes('near the bottom')) y = 70
    else if (desc.includes('near the top')) y = 30
    else y = 50
  } else if (desc.includes('right vertical wall') || desc.includes('right') && desc.includes('wall')) {
    wall = 'right'
    x = 90
    if (desc.includes('bottom')) y = 80
    else if (desc.includes('top')) y = 20
    else y = 30 + (markerNumber % 10) * 7 // Distribute vertically
  } else if (desc.includes('top horizontal wall') || desc.includes('top') && desc.includes('wall')) {
    wall = 'top'
    y = 10
    if (desc.includes('left')) x = 30
    else if (desc.includes('right')) x = 70
    else x = 50
  } else if (desc.includes('bottom horizontal wall') || desc.includes('bottom') && desc.includes('wall')) {
    wall = 'bottom'
    y = 90
    if (desc.includes('left')) x = 30
    else if (desc.includes('right')) x = 70
    else x = 50
  } else if (desc.includes('corner')) {
    if (desc.includes('top right')) {
      wall = 'corner'
      x = 85
      y = 15
    } else if (desc.includes('bottom left')) {
      wall = 'corner'
      x = 15
      y = 85
    }
  }
  
  return { x, y, wall }
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
  
  if (desc.includes('main room')) {
    if (desc.includes('right')) return `Main Bar Right ${location.number}`
    if (desc.includes('left')) return `Main Bar Left ${location.number}`
    if (desc.includes('top')) return `Main Bar Wall ${location.number}`
    return `Main Bar ${location.number}`
  }
  
  if (desc.includes('l-shaped')) {
    return `Side Area ${location.number}`
  }
  
  if (desc.includes('corner')) {
    return `Corner TV ${location.number}`
  }
  
  if (desc.includes('bottom left')) {
    return `Lower Section ${location.number}`
  }
  
  // Default naming
  return `TV ${location.number}`
}
