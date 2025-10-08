
import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import { join } from 'path'

/**
 * Layout Storage API - Enhanced to support background images
 * 
 * The layout object now supports:
 * - name: Layout name
 * - zones: Array of TV zones/positions
 * - backgroundImage: URL to the uploaded layout image (for visual reference)
 * 
 * This allows the frontend to display the uploaded layout image as a background
 * while positioning TV outputs on top of it.
 */

const LAYOUT_FILE = join(process.cwd(), 'data', 'tv-layout.json')

// Ensure data directory exists
async function ensureDataDir() {
  const dataDir = join(process.cwd(), 'data')
  try {
    await fs.access(dataDir)
  } catch {
    await fs.mkdir(dataDir, { recursive: true })
  }
}

export async function GET() {
  try {
    await ensureDataDir()
    const data = await fs.readFile(LAYOUT_FILE, 'utf8')
    const layout = JSON.parse(data)
    return NextResponse.json({ layout })
  } catch (error) {
    // Return default layout if file doesn't exist
    return NextResponse.json({ 
      layout: {
        name: 'Bar Layout',
        zones: [] as any[],
        backgroundImage: null // Support for layout background image
      }
    })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { layout } = await request.json()
    
    await ensureDataDir()
    await fs.writeFile(LAYOUT_FILE, JSON.stringify(layout, null, 2))
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error saving layout:', error)
    return NextResponse.json(
      { error: 'Failed to save layout' },
      { status: 500 }
    )
  }
}
