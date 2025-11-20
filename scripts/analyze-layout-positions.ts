import sharp from 'sharp'

async function analyzeLayout() {
  const imagePath = '/home/ubuntu/Sports-Bar-TV-Controller/public/uploads/layouts/layout_1763671093016.png'

  console.log('=== ANALYZING LAYOUT POSITIONS ===\n')

  // Get image metadata
  const image = sharp(imagePath)
  const metadata = await image.metadata()
  const width = metadata.width!
  const height = metadata.height!

  console.log(`Image size: ${width}x${height}`)

  // Get raw pixel data
  const { data, info } = await image.raw().toBuffer({ resolveWithObject: true })

  // Find red pixels and group into rectangles
  const redPixels: Array<{x: number, y: number}> = []

  for (let y = 0; y < height; y += 5) {
    for (let x = 0; x < width; x += 5) {
      const idx = (y * width + x) * info.channels
      const r = data[idx]
      const g = data[idx + 1]
      const b = data[idx + 2]

      if (r > 180 && g < 150 && b < 150) {
        redPixels.push({x, y})
      }
    }
  }

  console.log(`\nFound ${redPixels.length} red pixel samples\n`)

  // Group into clusters (approximate rectangles)
  const rectangles: Array<{minX: number, maxX: number, minY: number, maxY: number}> = []
  const visited = new Set<string>()

  for (const pixel of redPixels) {
    const key = `${pixel.x},${pixel.y}`
    if (visited.has(key)) continue

    // Find all nearby red pixels (within 50px)
    const cluster: typeof redPixels = [pixel]
    visited.add(key)

    for (const other of redPixels) {
      const otherKey = `${other.x},${other.y}`
      if (visited.has(otherKey)) continue

      const dist = Math.sqrt(
        Math.pow(other.x - pixel.x, 2) + Math.pow(other.y - pixel.y, 2)
      )

      if (dist < 500) {
        cluster.push(other)
        visited.add(otherKey)
      }
    }

    if (cluster.length > 10) {
      const xs = cluster.map(p => p.x)
      const ys = cluster.map(p => p.y)
      rectangles.push({
        minX: Math.min(...xs),
        maxX: Math.max(...xs),
        minY: Math.min(...ys),
        maxY: Math.max(...ys)
      })
    }
  }

  console.log(`Detected ${rectangles.length} red rectangle clusters:\n`)

  // Sort by position (top to bottom, left to right)
  rectangles.sort((a, b) => {
    const yDiff = a.minY - b.minY
    if (Math.abs(yDiff) > 200) return yDiff
    return a.minX - b.minX
  })

  rectangles.slice(0, 10).forEach((rect, i) => {
    const centerX = ((rect.minX + rect.maxX) / 2 / width * 100).toFixed(2)
    const centerY = ((rect.minY + rect.maxY) / 2 / height * 100).toFixed(2)
    const w = ((rect.maxX - rect.minX) / width * 100).toFixed(2)
    const h = ((rect.maxY - rect.minY) / height * 100).toFixed(2)

    console.log(`${i + 1}. Center: (${centerX}%, ${centerY}%) - Size: ${w}% x ${h}%`)
  })

  console.log(`\n... and ${rectangles.length - 10} more rectangles`)
}

analyzeLayout().catch(console.error)
