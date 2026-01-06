import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

/**
 * Create a test layout image with red rectangles
 * This shows what a real layout image should look like
 */
async function createTestLayoutImage() {
  // Create a 1024x768 white canvas
  const width = 1024;
  const height = 768;

  // Create image with background
  let image = sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 240, g: 240, b: 240 } // Light gray background
    }
  });

  // Create SVG with red rectangles marking TV zones
  const svg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <!-- Background -->
      <rect width="${width}" height="${height}" fill="#F0F0F0"/>

      <!-- Bar wall with TVs in 4x2 grid -->

      <!-- Top Row -->
      <!-- TV 01 -->
      <rect x="50" y="50" width="180" height="280" fill="#ED1C24" stroke="#000" stroke-width="2"/>
      <text x="140" y="200" font-size="48" font-weight="bold" fill="#FFF" text-anchor="middle">01</text>

      <!-- TV 02 -->
      <rect x="270" y="50" width="180" height="280" fill="#ED1C24" stroke="#000" stroke-width="2"/>
      <text x="360" y="200" font-size="48" font-weight="bold" fill="#FFF" text-anchor="middle">02</text>

      <!-- TV 03 -->
      <rect x="490" y="50" width="180" height="280" fill="#ED1C24" stroke="#000" stroke-width="2"/>
      <text x="580" y="200" font-size="48" font-weight="bold" fill="#FFF" text-anchor="middle">03</text>

      <!-- TV 04 -->
      <rect x="710" y="50" width="180" height="280" fill="#ED1C24" stroke="#000" stroke-width="2"/>
      <text x="800" y="200" font-size="48" font-weight="bold" fill="#FFF" text-anchor="middle">04</text>

      <!-- Bottom Row -->
      <!-- TV 05 -->
      <rect x="50" y="370" width="180" height="280" fill="#ED1C24" stroke="#000" stroke-width="2"/>
      <text x="140" y="520" font-size="48" font-weight="bold" fill="#FFF" text-anchor="middle">05</text>

      <!-- TV 06 -->
      <rect x="270" y="370" width="180" height="280" fill="#ED1C24" stroke="#000" stroke-width="2"/>
      <text x="360" y="520" font-size="48" font-weight="bold" fill="#FFF" text-anchor="middle">06</text>

      <!-- TV 07 -->
      <rect x="490" y="370" width="180" height="280" fill="#ED1C24" stroke="#000" stroke-width="2"/>
      <text x="580" y="520" font-size="48" font-weight="bold" fill="#FFF" text-anchor="middle">07</text>

      <!-- TV 08 -->
      <rect x="710" y="370" width="180" height="280" fill="#ED1C24" stroke="#000" stroke-width="2"/>
      <text x="800" y="520" font-size="48" font-weight="bold" fill="#FFF" text-anchor="middle">08</text>
    </svg>
  `;

  // Create output directory
  const outputDir = '/tmp/test-layouts';
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Compose image with SVG overlay
  const outputPath = path.join(outputDir, 'test-layout-8tvs.png');

  try {
    await image
      .composite([
        {
          input: Buffer.from(svg),
          top: 0,
          left: 0
        }
      ])
      .png()
      .toFile(outputPath);

    console.log(`Created test layout image: ${outputPath}`);
    console.log(`Size: ${width}x${height}px`);
    console.log(`Contains: 8 red rectangles (TV zones) with numbered labels`);
    console.log(`\nThis image demonstrates what a proper layout should look like:`);
    console.log(`- Red rectangles (RGB 237, 28, 36) marking TV positions`);
    console.log(`- Numbers 01-08 inside rectangles for OCR detection`);
    console.log(`- Clear contrast against background`);
    console.log(`- Sufficient size for detection (180x280 each)`);
    console.log(`\nWhen uploaded, the system should detect 8 zones.`);

    // Also create a smaller version for reference
    const smallPath = path.join(outputDir, 'test-layout-8tvs-small.png');
    await sharp(outputPath)
      .resize(512, 384)
      .png()
      .toFile(smallPath);

    console.log(`\nAlso created thumbnail: ${smallPath}`);

  } catch (error) {
    console.error('Error creating test image:', error);
  }
}

createTestLayoutImage().catch(console.error);
