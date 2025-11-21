import { detectTVZonesFromImage, autoMatchZonesToOutputs } from '@/lib/layout-detector'
import { db } from '@/db'
import { matrixOutputs } from '@/db/schema'
import { promises as fs } from 'fs'
import { join } from 'path'

// Temporarily disable Ollama to force Tesseract
const originalFetch = global.fetch
global.fetch = async (...args: any[]) => {
  if (args[0]?.includes('ollama')) {
    throw new Error('Ollama disabled - using Tesseract')
  }
  return originalFetch(...args)
}

async function redetectWithTesseract() {
  const imagePath = '/home/ubuntu/Sports-Bar-TV-Controller/public/uploads/layouts/layout_1763671093016.png'
  const imageUrl = '/api/uploads/layouts/layout_1763671093016.png'

  console.log('=== RE-DETECTING WITH TESSERACT OCR ===\n')
  console.log('Using Tesseract (faster, CPU-based OCR)')
  console.log('⏱️  Estimated time: 30-60 seconds\n')

  // Detect with OCR enabled (will use Tesseract since Ollama is disabled)
  const detectionResult = await detectTVZonesFromImage(imagePath, { skipOCR: false })

  console.log(`\n✓ Detection complete!`)
  console.log(`Zones found: ${detectionResult.zones.length}`)

  // Get matrix outputs for matching
  const outputs = await db.select().from(matrixOutputs)
  console.log(`Matrix outputs: ${outputs.length}\n`)

  // Auto-match to matrix outputs
  const matchedZones = autoMatchZonesToOutputs(
    detectionResult.zones,
    outputs.map(o => ({
      channelNumber: o.channelNumber,
      label: o.label
    }))
  )

  console.log('=== MATCHED ZONES (first 10) ===')
  matchedZones.slice(0, 10).forEach(zone => {
    console.log(`${zone.label} (Output ${zone.outputNumber}) - OCR: ${zone.ocrMethod}`)
  })

  // Save layout
  const layout = {
    name: 'Bar Layout',
    imageUrl,
    zones: matchedZones,
    imageWidth: detectionResult.imageWidth,
    imageHeight: detectionResult.imageHeight
  }

  const layoutFile = join(process.cwd(), 'data', 'tv-layout.json')
  await fs.writeFile(layoutFile, JSON.stringify(layout, null, 2))

  console.log(`\n✅ Layout saved with ${matchedZones.length} zones`)
  console.log('✅ Labels read via Tesseract and matched to matrix outputs')
  console.log('\n📍 Reload the Bartender Remote page to see the updated layout!')
}

redetectWithTesseract().catch(console.error).finally(() => {
  // Restore fetch
  global.fetch = originalFetch
})
