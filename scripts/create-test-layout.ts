import sharp from 'sharp'
import { writeFileSync } from 'fs'

async function createTestLayout() {
  // Create a white 800x600 canvas
  const width = 800
  const height = 600

  // Create white background
  const background = await sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 255, g: 255, b: 255 }
    }
  }).png().toBuffer()

  // Create red rectangles with labels
  const svg = `
    <svg width="${width}" height="${height}">
      <!-- TV 1 -->
      <rect x="100" y="100" width="150" height="100" fill="red" stroke="red" stroke-width="3"/>
      <text x="175" y="85" font-size="20" text-anchor="middle" fill="black" font-weight="bold">TV 01</text>

      <!-- TV 2 -->
      <rect x="300" y="100" width="150" height="100" fill="red" stroke="red" stroke-width="3"/>
      <text x="375" y="85" font-size="20" text-anchor="middle" fill="black" font-weight="bold">TV 02</text>

      <!-- TV 3 -->
      <rect x="500" y="100" width="150" height="100" fill="red" stroke="red" stroke-width="3"/>
      <text x="575" y="85" font-size="20" text-anchor="middle" fill="black" font-weight="bold">TV 03</text>
    </svg>
  `

  // Composite SVG on background
  const output = await sharp(background)
    .composite([{
      input: Buffer.from(svg),
      top: 0,
      left: 0
    }])
    .png()
    .toFile('/home/ubuntu/Sports-Bar-TV-Controller/public/uploads/layouts/test-layout-working.png')

  console.log('Test layout created:', output)
  console.log('Path: /home/ubuntu/Sports-Bar-TV-Controller/public/uploads/layouts/test-layout-working.png')
}

createTestLayout().catch(console.error)
