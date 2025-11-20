import { detectTVZonesFromImage } from '@/lib/layout-detector'

async function testDetection() {
  const imagePath = '/home/ubuntu/Sports-Bar-TV-Controller/public/uploads/layouts/208d7de0-e7d5-48cc-bdb8-faa090ccd2c2.png'
  console.log('Testing detection on user uploaded image...')
  console.log('Image:', imagePath)

  try {
    const result = await detectTVZonesFromImage(imagePath)

    console.log('\n=== DETECTION RESULTS ===')
    console.log(`Zones found: ${result.zones.length}`)
    console.log(`Detections count: ${result.detectionsCount}`)
    console.log(`Image size: ${result.imageWidth}x${result.imageHeight}`)
    console.log(`Errors: ${result.errors.length ? result.errors.join(', ') : 'None'}`)

    if (result.zones.length > 0) {
      console.log('\n=== ZONES (first 5) ===')
      result.zones.slice(0, 5).forEach(zone => {
        console.log(`- ${zone.label} (${zone.id}): Output #${zone.outputNumber}`)
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
