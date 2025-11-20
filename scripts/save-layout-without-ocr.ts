import { promises as fs } from 'fs'
import { join } from 'path'
import sharp from 'sharp'

// Quick save: detect rectangles only, no OCR
async function saveLayoutWithoutOCR() {
  const imagePath = '/home/ubuntu/Sports-Bar-TV-Controller/public/uploads/layouts/layout_1763670589193.png'
  const imageUrl = '/api/uploads/layouts/layout_1763670589193.png'

  console.log('Creating layout with manual labels (no OCR wait)...\n')

  // Detect rectangles (fast - 8 seconds)
  const { detectRedRectangles } = await import('@/lib/layout-detector')
  const image = sharp(imagePath)
  const metadata = await image.metadata()
  const { data, info } = await image.raw().toBuffer({ resolveWithObject: true })

  const width = metadata.width!
  const height = metadata.height!

  const rectangles = await detectRedRectangles(data, width, height, info.channels)

  console.log(`✓ Found ${rectangles.length} rectangles`)

  // Create zones with manual labels (TV 01, TV 02, etc.)
  const zones = rectangles.map((rect, i) => {
    const tvNum = i + 1
    return {
      id: `tv${tvNum}`,
      outputNumber: tvNum,
      x: Math.round((rect.x / width) * 10000) / 100,
      y: Math.round((rect.y / height) * 10000) / 100,
      width: Math.round((rect.width / width) * 10000) / 100,
      height: Math.round((rect.height / height) * 10000) / 100,
      label: `TV ${String(tvNum).padStart(2, '0')}`,
      confidence: 0.85,
      ocrMethod: 'manual' as const
    }
  }).sort((a, b) => {
    const yDiff = a.y - b.y
    if (Math.abs(yDiff) > 5) return yDiff
    return a.x - b.x
  })

  // Save layout
  const layout = {
    name: 'Bar Layout',
    imageUrl,
    zones,
    imageWidth: width,
    imageHeight: height
  }

  const layoutFile = join(process.cwd(), 'data', 'tv-layout.json')
  await fs.writeFile(layoutFile, JSON.stringify(layout, null, 2))

  console.log(`\n✓ Saved layout with ${zones.length} zones`)
  console.log('✓ All zones labeled manually (TV 01, TV 02, ...)')
  console.log('\n✅ Ready to use! Reload the Bartender Remote page')
}

saveLayoutWithoutOCR().catch(console.error)
