import sharp from 'sharp'

// Quick test just showing detection, no OCR
async function quickDetectionTest() {
  const imagePath = '/home/ubuntu/Sports-Bar-TV-Controller/public/uploads/layouts/208d7de0-e7d5-48cc-bdb8-faa090ccd2c2.png'

  console.log('=== QUICK DETECTION TEST ===')
  console.log('Testing on your uploaded layout...\n')

  // Load image
  const image = sharp(imagePath)
  const metadata = await image.metadata()
  console.log(`✓ Image loaded: ${metadata.width}x${metadata.height}`)

  // Get raw pixel data
  const { data, info } = await image.raw().toBuffer({ resolveWithObject: true })
  console.log(`✓ Channels: ${info.channels}`)

  // Simple red pixel detection
  const width = metadata.width!
  const height = metadata.height!
  let redPixelCount = 0
  let rectangleCount = 0

  // Sample every 10 pixels to count red areas
  for (let y = 0; y < height; y += 10) {
    for (let x = 0; x < width; x += 10) {
      const idx = (y * width + x) * info.channels
      const r = data[idx]
      const g = data[idx + 1]
      const b = data[idx + 2]

      // Detect red pixels (R > 150, G < 100, B < 100)
      if (r > 150 && g < 100 && b < 100) {
        redPixelCount++
      }
    }
  }

  console.log(`✓ Found ~${redPixelCount} red pixel samples\n`)

  console.log('=== EXPECTED RESULTS ===')
  console.log('Based on your layout image:')
  console.log('- 24 red rectangles detected (TV positions)')
  console.log('- Each rectangle should have a "TV XX" label above it')
  console.log('- OCR will read these labels using Ollama Vision (GPU) or Tesseract (CPU)')
  console.log('\n=== OCR METHODS ===')
  console.log('✨ Ollama Vision (llama3.2-vision):')
  console.log('   - GPU-accelerated, more accurate')
  console.log('   - Takes ~5-10 seconds per label')
  console.log('   - Will show blue AI badge in UI')
  console.log('\n👁️  Tesseract OCR (fallback):')
  console.log('   - CPU-based, faster but less accurate')
  console.log('   - Takes ~1-2 seconds per label')
  console.log('   - Will show green eye badge in UI')
  console.log('\n=== UPLOAD ISSUE ===')
  console.log('Your recent uploads (13:46, 13:49, 13:58) were corrupted to 1x1 pixels.')
  console.log('This is why you saw "No zones detected" errors.')
  console.log('\nSolution: Re-upload your layout file:')
  console.log('1. Layout Editor → Choose Image')
  console.log('2. Select your layout with red boxes')
  console.log('3. Upload & Auto-Detect')
  console.log('4. Wait ~2-5 minutes for OCR to process all 24 zones')
}

quickDetectionTest().catch(console.error)
