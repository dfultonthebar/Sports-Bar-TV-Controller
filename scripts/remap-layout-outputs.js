#!/usr/bin/env node
/**
 * Remap Layout Output Numbers
 *
 * This script remaps the outputNumber field in tv-layout.json to match
 * the OCR-extracted labels. Use this to fix incorrect mappings.
 *
 * Usage:
 *   node scripts/remap-layout-outputs.js
 *
 * Options:
 *   --dry-run    Show what would change without writing
 *   --backup     Create backup before applying changes (default: true)
 */

const fs = require('fs')
const path = require('path')

const LAYOUT_FILE = path.join(process.cwd(), 'data', 'tv-layout.json')
const BACKUP_DIR = path.join(process.cwd(), 'data', 'backups')
const OVERRIDES_FILE = path.join(process.cwd(), 'data', 'layout-overrides.json')

/**
 * Extract TV number from label
 */
function extractTVNumber(label) {
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
function createBackup(layoutPath) {
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
 * Load manual overrides
 */
function loadOverrides() {
  if (!fs.existsSync(OVERRIDES_FILE)) {
    return { overrides: {}, positionOverrides: { positions: [] } }
  }

  try {
    const data = fs.readFileSync(OVERRIDES_FILE, 'utf-8')
    return JSON.parse(data)
  } catch (error) {
    console.warn(`⚠ Warning: Could not load overrides file: ${error.message}`)
    return { overrides: {}, positionOverrides: { positions: [] } }
  }
}

/**
 * Check if position matches (within tolerance)
 */
function positionMatches(zone, posOverride, tolerance = 1.0) {
  const xDiff = Math.abs(zone.x - posOverride.x)
  const yDiff = Math.abs(zone.y - posOverride.y)
  return xDiff <= tolerance && yDiff <= tolerance
}

/**
 * Remap output numbers based on labels and positions
 */
function remapOutputNumbers(layout, dryRun = false) {
  const remappedZones = []
  const changes = []
  const overridesData = loadOverrides()
  const overrides = overridesData.overrides || {}
  const positionOverrides = overridesData.positionOverrides?.positions || []

  console.log('\n=== Analyzing Zones ===\n')

  if (Object.keys(overrides).length > 0) {
    console.log('📝 Using manual label overrides:')
    for (const [label, outputNum] of Object.entries(overrides)) {
      console.log(`  "${label}" → Output ${outputNum}`)
    }
    console.log()
  }

  if (positionOverrides.length > 0) {
    console.log('🎯 Using position-based overrides:')
    for (const posOverride of positionOverrides) {
      console.log(`  Position (${posOverride.x}%, ${posOverride.y}%) → Output ${posOverride.outputNumber}`)
      console.log(`    Description: ${posOverride.description}`)
    }
    console.log()
  }

  for (const zone of layout.zones) {
    let tvNumber = extractTVNumber(zone.label)
    let overrideSource = null

    // Check for position-based override first (higher priority)
    for (const posOverride of positionOverrides) {
      if (positionMatches(zone, posOverride)) {
        console.log(`  🎯 Position override: (${zone.x.toFixed(2)}%, ${zone.y.toFixed(2)}%) → Output ${posOverride.outputNumber}`)
        console.log(`    Reason: ${posOverride.description}`)
        tvNumber = posOverride.outputNumber
        overrideSource = 'position'
        break
      }
    }

    // Check for label-based override (if no position override)
    if (!overrideSource && overrides[zone.label]) {
      console.log(`  🔧 Label override: "${zone.label}" → Output ${overrides[zone.label]}`)
      tvNumber = overrides[zone.label]
      overrideSource = 'label'
    }

    if (tvNumber !== null && tvNumber !== zone.outputNumber) {
      // Output number doesn't match - needs remapping
      changes.push({
        zone,
        oldOutput: zone.outputNumber,
        newOutput: tvNumber,
        source: overrideSource || 'label-extraction'
      })

      remappedZones.push({
        ...zone,
        id: `tv${tvNumber}`,
        outputNumber: tvNumber,
        label: `TV ${String(tvNumber).padStart(2, '0')}`
      })

      console.log(`  Zone at (${zone.x.toFixed(2)}%, ${zone.y.toFixed(2)}%):`)
      console.log(`    OLD: label="${zone.label}", outputNumber=${zone.outputNumber}, id="${zone.id}"`)
      console.log(`    NEW: label="TV ${String(tvNumber).padStart(2, '0')}", outputNumber=${tvNumber}, id="tv${tvNumber}"`)
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

  // Check for unique TV numbers
  const tvNumbers = remappedZones.map(z => z.outputNumber).sort((a, b) => a - b)
  const uniqueTVs = [...new Set(tvNumbers)]
  const duplicates = tvNumbers.filter((num, idx) => tvNumbers.indexOf(num) !== idx)

  console.log(`\nUnique TV outputs: ${uniqueTVs.length}`)
  console.log(`Output numbers: ${uniqueTVs.join(', ')}`)

  if (duplicates.length > 0) {
    console.log(`\n⚠ WARNING: Duplicate outputs found: ${[...new Set(duplicates)].join(', ')}`)
  }

  // Check for missing TV numbers (1-25)
  const expectedTVs = Array.from({ length: 25 }, (_, i) => i + 1)
  const missingTVs = expectedTVs.filter(num => !uniqueTVs.includes(num))

  if (missingTVs.length > 0) {
    console.log(`⚠ WARNING: Missing TV outputs: ${missingTVs.join(', ')}`)
  }

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
  const layout = JSON.parse(layoutData)

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
