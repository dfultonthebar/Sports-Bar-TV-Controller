#!/usr/bin/env tsx

import { promises as fs } from 'fs'
import { join } from 'path'
import sharp from 'sharp'

/**
 * Create a complete professional SVG layout from scratch
 */
function createProfessionalLayoutSVG(zones: any[], width: number, height: number): string {
  // Modern color scheme
  const colors = {
    background: '#1a1f2e', // Dark professional background
    gridLines: '#2d3748', // Subtle grid lines
    tvBorder: '#4299e1', // Professional blue border
    labelText: '#e2e8f0',
  }

  // TV icon SVG path
  const tvIconPath = `M4 6h16v10H4z M7 18h10 M9 16v2 M15 16v2`

  const zoneElements = zones.map((zone: any) => {
    const x = (zone.x / 100) * width
    const y = (zone.y / 100) * height
    const w = (zone.width / 100) * width
    const h = (zone.height / 100) * height

    // Calculate positions
    const centerX = x + w / 2
    const centerY = y + h / 2
    const iconSize = Math.min(w, h) * 0.4
    const iconX = centerX - iconSize / 2
    const iconY = centerY - iconSize / 2

    return `
      <!-- TV Zone ${zone.outputNumber} -->
      <g id="zone-${zone.outputNumber}">
        <!-- TV Icon -->
        <svg x="${iconX}" y="${iconY}" width="${iconSize}" height="${iconSize}" viewBox="0 0 24 24">
          <path d="${tvIconPath}"
                stroke="${colors.tvBorder}"
                stroke-width="2"
                fill="white"
                fill-opacity="0.9"
                stroke-linecap="round"
                stroke-linejoin="round"/>
        </svg>

        <!-- Output Number Label -->
        <text
          x="${centerX}"
          y="${iconY + iconSize + 20}"
          text-anchor="middle"
          font-family="'Inter', 'SF Pro Display', -apple-system, sans-serif"
          font-size="16"
          font-weight="700"
          fill="${colors.labelText}"
        >${zone.outputNumber}</text>
      </g>
    `
  }).join('\n')

  // Optional: Add subtle grid
  const gridSize = 100
  const gridLines = []
  for (let x = 0; x <= width; x += gridSize) {
    gridLines.push(`<line x1="${x}" y1="0" x2="${x}" y2="${height}" stroke="${colors.gridLines}" stroke-width="1" opacity="0.2"/>`)
  }
  for (let y = 0; y <= height; y += gridSize) {
    gridLines.push(`<line x1="0" y1="${y}" x2="${width}" y2="${y}" stroke="${colors.gridLines}" stroke-width="1" opacity="0.2"/>`)
  }

  return `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <!-- Background -->
      <rect width="${width}" height="${height}" fill="${colors.background}"/>

      <!-- Optional grid -->
      ${gridLines.join('\n')}

      <!-- Title -->
      <text
        x="30"
        y="40"
        font-family="'Inter', 'SF Pro Display', -apple-system, sans-serif"
        font-size="28"
        font-weight="700"
        fill="${colors.labelText}"
      >TV Layout</text>

      <text
        x="30"
        y="65"
        font-family="'Inter', 'SF Pro Display', -apple-system, sans-serif"
        font-size="14"
        font-weight="400"
        fill="${colors.labelText}"
        opacity="0.6"
      >${zones.length} TVs Detected</text>

      <!-- TV Zones -->
      ${zoneElements}
    </svg>
  `
}

async function main() {
  const layoutPath = '/home/ubuntu/Sports-Bar-TV-Controller/data/tv-layout.json'
  const outputPath = '/home/ubuntu/Sports-Bar-TV-Controller/public/uploads/layouts/273188b2-ecfc-47ab-94a7-05d5d03bd3b0_professional.png'

  console.log('Reading layout data from:', layoutPath)
  const layoutData = JSON.parse(await fs.readFile(layoutPath, 'utf-8'))

  const zones = layoutData.zones
  console.log(`Found ${zones.length} TV zones`)

  // Target size for tablets
  const TARGET_WIDTH = 1920
  const TARGET_HEIGHT = 1440

  console.log('Generating professional SVG...')
  const svg = createProfessionalLayoutSVG(zones, TARGET_WIDTH, TARGET_HEIGHT)

  console.log('Converting SVG to PNG...')
  await sharp(Buffer.from(svg))
    .png({ quality: 95 })
    .toFile(outputPath)

  console.log('✓ Professional layout image generated:', outputPath)
  console.log('✓ Image size: 1920x1440')
  console.log(`✓ Output numbers should be visible below each of the ${zones.length} TV icons`)
}

main().catch(console.error)
