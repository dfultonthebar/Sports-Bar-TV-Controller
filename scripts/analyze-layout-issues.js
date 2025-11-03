#!/usr/bin/env node
/**
 * Analyze TV Layout for Issues
 *
 * This script analyzes the current tv-layout.json file and reports:
 * - Duplicate output numbers
 * - Missing output numbers
 * - OCR errors
 * - Suggested corrections
 */

const fs = require('fs')
const path = require('path')

const LAYOUT_FILE = path.join(process.cwd(), 'data', 'tv-layout.json')

function analyzeLayout() {
  console.log('=== TV Layout Analysis ===\n')

  // Read layout
  if (!fs.existsSync(LAYOUT_FILE)) {
    console.error(`❌ Error: Layout file not found: ${LAYOUT_FILE}`)
    process.exit(1)
  }

  const layoutData = fs.readFileSync(LAYOUT_FILE, 'utf-8')
  const layout = JSON.parse(layoutData)
  const zones = layout.zones

  console.log(`Total zones detected: ${zones.length}\n`)

  // Group zones by output number
  const outputMap = {}
  for (const zone of zones) {
    if (!outputMap[zone.outputNumber]) {
      outputMap[zone.outputNumber] = []
    }
    outputMap[zone.outputNumber].push(zone)
  }

  // Find duplicates
  const duplicates = Object.entries(outputMap)
    .filter(([_, zones]) => zones.length > 1)
    .map(([outputNum, zones]) => ({
      outputNum: parseInt(outputNum),
      count: zones.length,
      zones
    }))

  // Find missing outputs (assuming 1-25 range)
  const expectedOutputs = Array.from({ length: 25 }, (_, i) => i + 1)
  const actualOutputs = Object.keys(outputMap).map(n => parseInt(n))
  const missing = expectedOutputs.filter(n => !actualOutputs.includes(n))

  // Find potential OCR errors (numbers > 25 or unusual patterns)
  const ocrErrors = zones.filter(z =>
    z.outputNumber > 25 ||
    z.label.includes('108') ||
    z.label.includes('109') ||
    z.label.includes('121')
  )

  // Report findings
  console.log('=== Duplicate Output Numbers ===')
  if (duplicates.length === 0) {
    console.log('✓ No duplicates found\n')
  } else {
    console.log(`⚠️  Found ${duplicates.length} output numbers assigned to multiple zones:\n`)
    for (const dup of duplicates) {
      console.log(`Output ${dup.outputNum} (${dup.count} zones):`)
      for (const zone of dup.zones) {
        console.log(`  - label="${zone.label}" at (${zone.x.toFixed(2)}%, ${zone.y.toFixed(2)}%)`)
      }
      console.log()
    }
  }

  console.log('=== Missing Output Numbers ===')
  if (missing.length === 0) {
    console.log('✓ No missing outputs (1-25)\n')
  } else {
    console.log(`⚠️  Missing ${missing.length} output numbers:\n`)
    console.log(`  ${missing.join(', ')}\n`)
  }

  console.log('=== Potential OCR Errors ===')
  if (ocrErrors.length === 0) {
    console.log('✓ No obvious OCR errors detected\n')
  } else {
    console.log(`⚠️  Found ${ocrErrors.length} zones with potential OCR errors:\n`)
    for (const zone of ocrErrors) {
      console.log(`  Output ${zone.outputNum}: label="${zone.label}"`)
      console.log(`    Position: (${zone.x.toFixed(2)}%, ${zone.y.toFixed(2)}%)`)

      // Suggest correction
      if (zone.label.includes('108')) {
        console.log(`    💡 Suggestion: Might be "TV 08" or "TV 07"`)
      } else if (zone.label.includes('109')) {
        console.log(`    💡 Suggestion: Might be "TV 09" or "TV 11"`)
      } else if (zone.label.includes('121')) {
        console.log(`    💡 Suggestion: Might be "TV 17" or "TV 21"`)
      }
      console.log()
    }
  }

  // Generate suggested overrides
  console.log('=== Suggested Actions ===\n')

  if (duplicates.length > 0) {
    console.log('1. Fix duplicate output numbers:')
    console.log('   You need to manually identify which TV each zone represents.')
    console.log('   Edit data/layout-overrides.json to map labels to correct outputs.\n')
    console.log('   Example:')
    console.log('   {')
    console.log('     "overrides": {')
    for (const dup of duplicates.slice(0, 2)) { // Show first 2 examples
      const firstZone = dup.zones[0]
      console.log(`       "${firstZone.label}": ${missing[0] || '??'},  // Assign to missing output`)
    }
    console.log('     }')
    console.log('   }\n')
  }

  if (missing.length > 0 && ocrErrors.length > 0) {
    console.log('2. Correct OCR errors in data/layout-overrides.json:')
    console.log('   {')
    console.log('     "overrides": {')
    for (const err of ocrErrors.slice(0, 3)) {
      const suggestedOutput = missing.find(m =>
        m === parseInt(err.label.match(/\d+/)?.[0]) ||
        Math.abs(m - err.outputNumber) <= 5
      ) || missing[0]
      console.log(`       "${err.label}": ${suggestedOutput},  // Currently at output ${err.outputNumber}`)
    }
    console.log('     }')
    console.log('   }\n')
  }

  console.log('3. Run remapping script:')
  console.log('   node scripts/remap-layout-outputs.js --dry-run  # Preview')
  console.log('   node scripts/remap-layout-outputs.js             # Apply\n')

  // Summary
  console.log('=== Summary ===')
  console.log(`Total zones: ${zones.length}`)
  console.log(`Unique outputs: ${actualOutputs.length}`)
  console.log(`Duplicate outputs: ${duplicates.length}`)
  console.log(`Missing outputs (1-25): ${missing.length}`)
  console.log(`Potential OCR errors: ${ocrErrors.length}`)

  if (duplicates.length === 0 && missing.length === 0 && ocrErrors.length === 0) {
    console.log('\n✅ Layout looks good! No issues detected.')
  } else {
    console.log(`\n⚠️  ${duplicates.length + missing.length + ocrErrors.length} issues found. See above for details.`)
  }
}

analyzeLayout()
