#!/usr/bin/env npx tsx
/**
 * Setup Wolf Pack Input Labels (Drizzle ORM)
 *
 * Updates input labels and device types for an existing Wolf Pack configuration.
 * Run seed-wolfpack-config.ts first to create the configuration.
 *
 * Usage:
 *   npx tsx scripts/setup-wolfpack-inputs.ts
 *
 * Edit the inputConfig array below to match your location's devices.
 */

import { db, schema } from '@sports-bar/database'
import { eq, and } from 'drizzle-orm'

// ============================================================
// EDIT THIS ARRAY to match your location's input devices
// ============================================================
const inputConfig: Array<{
  channelNumber: number
  label: string
  deviceType: string  // Cable Box, Streaming Device, Fire TV, DirecTV, Gaming, Other
}> = [
  { channelNumber: 1, label: 'Fire TV Cube 1', deviceType: 'Fire TV' },
  { channelNumber: 2, label: 'Fire TV Cube 2', deviceType: 'Fire TV' },
  { channelNumber: 3, label: 'Fire TV Cube 3', deviceType: 'Fire TV' },
  { channelNumber: 4, label: 'Fire TV Cube 4', deviceType: 'Fire TV' },
  // Add more inputs as needed...
]

async function setupInputs() {
  // Get active matrix configuration
  const config = db.select()
    .from(schema.matrixConfigurations)
    .where(eq(schema.matrixConfigurations.isActive, true))
    .limit(1)
    .get()

  if (!config) {
    console.error('No active matrix configuration found. Run seed-wolfpack-config.ts first.')
    process.exit(1)
  }

  console.log(`Updating inputs for: ${config.name} (${config.ipAddress})\n`)

  let updated = 0
  for (const input of inputConfig) {
    const result = db.update(schema.matrixInputs)
      .set({
        label: input.label,
        deviceType: input.deviceType,
        updatedAt: new Date().toISOString(),
      })
      .where(
        and(
          eq(schema.matrixInputs.configId, config.id),
          eq(schema.matrixInputs.channelNumber, input.channelNumber)
        )
      )
      .run()

    if (result.changes > 0) {
      console.log(`  Input ${input.channelNumber}: ${input.label} (${input.deviceType})`)
      updated++
    } else {
      console.log(`  Input ${input.channelNumber}: NOT FOUND - skipped`)
    }
  }

  console.log(`\nUpdated ${updated} of ${inputConfig.length} inputs.`)
}

setupInputs()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Setup failed:', error)
    process.exit(1)
  })
