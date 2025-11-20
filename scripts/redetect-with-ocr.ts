import { detectTVZonesFromImage, autoMatchZonesToOutputs } from '@/lib/layout-detector'
import { db } from '@/db'
import { matrixOutputs } from '@/db/schema'
import { promises as fs } from 'fs'
import { join } from 'path'

async function redetectWithOCR() {
  const imagePath = '/home/ubuntu/Sports-Bar-TV-Controller/public/uploads/layouts/layout_1763671093016.png'
  const imageUrl = '/api/uploads/layouts/layout_1763671093016.png'

  console.log('=== RE-DETECTING WITH OCR ENABLED ===\n')
  console.log('This will read TV labels from your image (e.g., "TV 05", "TV 12")')
  console.log('and match them to the correct matrix outputs.\n')
  console.log('⏱️  This will take 2-4 minutes for Ollama Vision to process all zones...\n')

  // Detect with OCR enabled
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
    console.log(`  Position: (${zone.x.toFixed(2)}%, ${zone.y.toFixed(2)}%)`)
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
  console.log('✅ Labels read from image and matched to matrix outputs')
  console.log('\n📍 Reload the Bartender Remote page to see the updated layout!')
}

redetectWithOCR().catch(console.error)
