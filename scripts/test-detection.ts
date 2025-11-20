import { detectTVZonesFromImage } from '@/lib/layout-detector'

async function testDetection() {
  console.log('Testing detection on known-good test image...')
  console.log('Image: /home/ubuntu/Sports-Bar-TV-Controller/public/uploads/layouts/test-layout-working.png')

  try {
    const result = await detectTVZonesFromImage(
      '/home/ubuntu/Sports-Bar-TV-Controller/public/uploads/layouts/test-layout-working.png'
    )

    console.log('\n=== DETECTION RESULTS ===')
    console.log(`Zones found: ${result.zones.length}`)
    console.log(`Detections count: ${result.detectionsCount}`)
    console.log(`Image size: ${result.imageWidth}x${result.imageHeight}`)
    console.log(`Errors: ${result.errors.length ? result.errors.join(', ') : 'None'}`)

    if (result.zones.length > 0) {
      console.log('\n=== ZONES ===')
      result.zones.forEach(zone => {
        console.log(`- ${zone.label} (${zone.id}): Output #${zone.outputNumber}`)
        console.log(`  Position: ${zone.x.toFixed(2)}%, ${zone.y.toFixed(2)}%`)
        console.log(`  Size: ${zone.width.toFixed(2)}% x ${zone.height.toFixed(2)}%`)
        console.log(`  Confidence: ${zone.confidence}`)
        console.log(`  OCR Method: ${zone.ocrMethod || 'N/A'}`)
      })
    }
  } catch (error: any) {
    console.error('\n=== ERROR ===')
    console.error(error.message)
    console.error(error.stack)
  }
}

testDetection()
