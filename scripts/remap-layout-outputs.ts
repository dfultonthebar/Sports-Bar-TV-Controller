#!/usr/bin/env ts-node
/**
 * Remap Layout Output Numbers
 *
 * This script remaps the outputNumber field in tv-layout.json to match
 * the OCR-extracted labels. Use this to fix incorrect mappings.
 *
 * Usage:
 *   ts-node scripts/remap-layout-outputs.ts
 *
 * Options:
 *   --dry-run    Show what would change without writing
 *   --backup     Create backup before applying changes (default: true)
 */

import * as fs from 'fs'
import * as path from 'path'

interface TVZone {
  id: string
  outputNumber: number
  x: number
  y: number
  width: number
  height: number
  label: string
  confidence: number
}

interface TVLayout {
  name: string
  imageUrl?: string
  originalFileUrl?: string
  fileType?: string
  zones: TVZone[]
}

const LAYOUT_FILE = path.join(process.cwd(), 'data', 'tv-layout.json')
const BACKUP_DIR = path.join(process.cwd(), 'data', 'backups')

/**
 * Extract TV number from label
 */
function extractTVNumber(label: string): number | null {
  const patterns = [
    /TV\s*0*(\d+)/i,  // TV 01, TV01, TV 1
    /#\s*0*(\d+)/,    // #01, # 1
    /(\d+)/           // Just numbers
  ]

  for (const pattern of patterns) {
    const match = label.match(pattern)
    if (match) {
      return parseInt(match[1], 10)
    }
  }

  return null
}

/**
 * Create backup of layout file
 */
function createBackup(layoutPath: string): string {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true })
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const backupPath = path.join(BACKUP_DIR, `tv-layout-${timestamp}.json`)

  fs.copyFileSync(layoutPath, backupPath)
  console.log(`✓ Backup created: ${backupPath}`)

  return backupPath
}

/**
 * Remap output numbers based on labels
 */
function remapOutputNumbers(layout: TVLayout, dryRun: boolean = false): TVLayout {
  const remappedZones: TVZone[] = []
  const changes: Array<{zone: TVZone, oldOutput: number, newOutput: number}> = []

  console.log('\n=== Analyzing Zones ===\n')

  for (const zone of layout.zones) {
    const tvNumber = extractTVNumber(zone.label)

    if (tvNumber !== null && tvNumber !== zone.outputNumber) {
      // Output number doesn't match label - needs remapping
      changes.push({
        zone,
        oldOutput: zone.outputNumber,
        newOutput: tvNumber
      })

      remappedZones.push({
        ...zone,
        id: `tv${tvNumber}`,
        outputNumber: tvNumber
      })

      console.log(`  Zone: label="${zone.label}"`)
      console.log(`    OLD: outputNumber=${zone.outputNumber}, id="${zone.id}"`)
      console.log(`    NEW: outputNumber=${tvNumber}, id="tv${tvNumber}"`)
      console.log(`    Position: (${zone.x.toFixed(2)}%, ${zone.y.toFixed(2)}%)`)
      console.log()
    } else if (tvNumber === null) {
      // Couldn't extract TV number from label - keep as-is
      console.log(`  ⚠ Zone "${zone.label}" - couldn't extract TV number, keeping outputNumber=${zone.outputNumber}`)
      remappedZones.push(zone)
    } else {
      // Already correct
      console.log(`  ✓ Zone "${zone.label}" - outputNumber=${zone.outputNumber} already correct`)
      remappedZones.push(zone)
    }
  }

  console.log(`\n=== Summary ===`)
  console.log(`Total zones: ${layout.zones.length}`)
  console.log(`Zones needing remapping: ${changes.length}`)
  console.log(`Zones already correct: ${layout.zones.length - changes.length}`)

  if (dryRun) {
    console.log('\n[DRY RUN] No changes written to file')
  }

  return {
    ...layout,
    zones: remappedZones
  }
}

/**
 * Main function
 */
function main() {
  const args = process.argv.slice(2)
  const dryRun = args.includes('--dry-run')
  const backup = !args.includes('--no-backup')

  console.log('=== TV Layout Output Number Remapper ===\n')
  console.log(`Layout file: ${LAYOUT_FILE}`)
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'APPLY CHANGES'}`)
  console.log(`Backup: ${backup ? 'Enabled' : 'Disabled'}`)

  // Read current layout
  if (!fs.existsSync(LAYOUT_FILE)) {
    console.error(`\n❌ Error: Layout file not found: ${LAYOUT_FILE}`)
    process.exit(1)
  }

  const layoutData = fs.readFileSync(LAYOUT_FILE, 'utf-8')
  const layout: TVLayout = JSON.parse(layoutData)

  // Create backup if requested
  if (backup && !dryRun) {
    createBackup(LAYOUT_FILE)
  }

  // Remap output numbers
  const remappedLayout = remapOutputNumbers(layout, dryRun)

  // Write updated layout
  if (!dryRun) {
    fs.writeFileSync(
      LAYOUT_FILE,
      JSON.stringify(remappedLayout, null, 2),
      'utf-8'
    )
    console.log(`\n✓ Layout file updated: ${LAYOUT_FILE}`)
  }

  console.log('\n✓ Done!')
}

main()
