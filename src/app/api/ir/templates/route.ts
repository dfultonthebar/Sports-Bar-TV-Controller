import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

export async function GET() {
  try {
    const templatesPath = path.join(process.cwd(), 'src/data/ir-command-templates.json')
    const templatesData = fs.readFileSync(templatesPath, 'utf-8')
    const templates = JSON.parse(templatesData)

    return NextResponse.json({
      success: true,
      templates: templates.templates
    })
  } catch (error) {
    console.error('Error loading IR command templates:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to load IR command templates' },
      { status: 500 }
    )
  }
}
