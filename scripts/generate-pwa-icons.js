#!/usr/bin/env node

/**
 * Generate PWA Icons using Sharp
 * Creates placeholder icons for all required PWA sizes
 */

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const sizes = [72, 96, 128, 144, 152, 192, 384, 512];
const publicDir = path.join(__dirname, '../public');

// Create SVG with TV icon
const createSVG = (size) => `
<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#7c3aed;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#5b21b6;stop-opacity:1" />
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" rx="${size * 0.15}" fill="url(#grad)"/>
  <g transform="translate(${size * 0.25}, ${size * 0.25})">
    <!-- TV Screen -->
    <rect x="${size * 0.05}" y="${size * 0.05}" width="${size * 0.4}" height="${size * 0.3}"
          fill="white" opacity="0.95" rx="${size * 0.02}"/>
    <!-- TV Stand -->
    <rect x="${size * 0.2}" y="${size * 0.38}" width="${size * 0.1}" height="${size * 0.04}"
          fill="white" opacity="0.95" rx="${size * 0.01}"/>
    <!-- Base -->
    <ellipse cx="${size * 0.25}" cy="${size * 0.43}" rx="${size * 0.08}" ry="${size * 0.02}"
             fill="white" opacity="0.95"/>
    <!-- Signal waves -->
    <path d="M ${size * 0.42} ${size * 0.15} Q ${size * 0.45} ${size * 0.12} ${size * 0.48} ${size * 0.15}"
          stroke="white" stroke-width="${size * 0.015}" fill="none" opacity="0.7"/>
    <path d="M ${size * 0.4} ${size * 0.18} Q ${size * 0.45} ${size * 0.12} ${size * 0.5} ${size * 0.18}"
          stroke="white" stroke-width="${size * 0.015}" fill="none" opacity="0.7"/>
  </g>
</svg>
`;

async function generateIcons() {
  console.log('🎨 Generating PWA icons...\n');

  for (const size of sizes) {
    const svg = createSVG(size);
    const outputPath = path.join(publicDir, `icon-${size}x${size}.png`);

    try {
      await sharp(Buffer.from(svg))
        .resize(size, size)
        .png()
        .toFile(outputPath);

      console.log(`✓ Generated icon-${size}x${size}.png`);
    } catch (error) {
      console.error(`✗ Failed to generate icon-${size}x${size}.png:`, error.message);
    }
  }

  console.log('\n✅ PWA icon generation complete!');
  console.log('\nNext steps:');
  console.log('1. Review icons in /public/ directory');
  console.log('2. Replace with custom branded icons if desired');
  console.log('3. Run: npm run build');
  console.log('4. Test PWA installation in Chrome DevTools');
}

generateIcons().catch(console.error);
