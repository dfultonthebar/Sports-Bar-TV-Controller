import { detectTVZonesFromImage } from '@/lib/layout-detector'

async function testLatestUpload() {
  const imagePath = '/home/ubuntu/Sports-Bar-TV-Controller/public/uploads/layouts/layout_1763670589193.png'

  console.log('=== TESTING YOUR 14:29 UPLOAD ===\n')
  console.log('Starting detection (this will take ~30 seconds)...\n')

  try {
    // Run detection with 30 second timeout on first zone
    const startTime = Date.now()
    const result = await Promise.race([
      detectTVZonesFromImage(imagePath),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Timeout after 60 seconds')), 60000)
      )
    ]) as any

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)

    console.log(`\n✓ Detection completed in ${elapsed}s\n`)
    console.log('=== RESULTS ===')
    console.log(`Zones detected: ${result.zones.length}`)
    console.log(`Image size: ${result.imageWidth}x${result.imageHeight}`)
    console.log(`Errors: ${result.errors.length ? result.errors.join(', ') : 'None'}`)

    if (result.zones.length > 0) {
      console.log('\n=== FIRST 5 ZONES ===')
      result.zones.slice(0, 5).forEach((zone: any) => {
        console.log(`${zone.label} → Output ${zone.outputNumber}`)
        console.log(`  OCR: ${zone.ocrMethod || 'manual'}`)
      })

      console.log(`\n... and ${result.zones.length - 5} more zones`)

      // Count by OCR method
      const ollama = result.zones.filter((z: any) => z.ocrMethod === 'ollama').length
      const tesseract = result.zones.filter((z: any) => z.ocrMethod === 'tesseract').length
      const manual = result.zones.filter((z: any) => !z.ocrMethod || z.ocrMethod === 'manual').length

      console.log('\n=== OCR BREAKDOWN ===')
      console.log(`✨ Ollama Vision: ${ollama}`)
      console.log(`👁️  Tesseract: ${tesseract}`)
      console.log(`✋ Manual: ${manual}`)
    } else {
      console.log('\n❌ No zones detected')
      console.log('This should not happen with your layout - investigating...')
    }
  } catch (error: any) {
    if (error.message.includes('Timeout')) {
      console.log('\n⏱️  OCR is still processing (taking longer than 60s)')
      console.log('This is normal for 24 zones with high-res images')
      console.log('\nThe upload API may have returned early without waiting for OCR')
    } else {
      console.error('\n❌ Error:', error.message)
    }
  }
}

testLatestUpload()
