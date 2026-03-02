#!/usr/bin/env npx tsx
/**
 * Seed Wolf Pack Matrix Configuration (Drizzle ORM)
 *
 * Creates a complete Wolf Pack matrix configuration including:
 * - MatrixConfiguration (connection settings, HTTP protocol)
 * - MatrixInputs (up to 36 inputs)
 * - MatrixOutputs (TVs + audio matrix outputs)
 *
 * Usage:
 *   npx tsx scripts/seed-wolfpack-config.ts
 *   npx tsx scripts/seed-wolfpack-config.ts --name "Lucky's 1313" --ip 192.168.10.100 --model WP-16X16
 *
 * Options:
 *   --name    Location name (default: prompts or "Wolf Pack Matrix")
 *   --ip      Wolf Pack IP address (default: prompts or "192.168.1.50")
 *   --model   Wolf Pack model (default: WP-36X36)
 *   --offset  Output offset for audio outputs (default: 0)
 */

import { db, schema } from '@sports-bar/database'
import { eq, and, count as dbCount } from 'drizzle-orm'
import { randomUUID } from 'crypto'

// Parse CLI args
function getArg(name: string): string | undefined {
  const idx = process.argv.indexOf(`--${name}`)
  return idx !== -1 && process.argv[idx + 1] ? process.argv[idx + 1] : undefined
}

// Model definitions: model -> { inputs, outputs }
const MODELS: Record<string, { inputs: number; outputs: number }> = {
  'WP-4X4':   { inputs: 4,  outputs: 4 },
  'WP-8X8':   { inputs: 8,  outputs: 8 },
  'WP-16X16': { inputs: 16, outputs: 16 },
  'WP-18X18': { inputs: 18, outputs: 18 },
  'WP-36X36': { inputs: 36, outputs: 36 },
  'WP-64X64': { inputs: 64, outputs: 64 },
  'WP-80X80': { inputs: 80, outputs: 80 },
}

async function seedWolfPackConfig() {
  const name = getArg('name') || 'Wolf Pack Matrix'
  const ipAddress = getArg('ip') || '192.168.1.50'
  const model = getArg('model') || 'WP-36X36'
  const outputOffset = parseInt(getArg('offset') || '0', 10)
  const audioOutputCount = 4

  const modelSpec = MODELS[model]
  if (!modelSpec) {
    console.error(`Unknown model: ${model}. Valid models: ${Object.keys(MODELS).join(', ')}`)
    process.exit(1)
  }

  console.log('Seeding Wolf Pack Matrix Configuration...\n')
  console.log(`  Name:          ${name}`)
  console.log(`  IP Address:    ${ipAddress}`)
  console.log(`  Model:         ${model} (${modelSpec.inputs}x${modelSpec.outputs})`)
  console.log(`  Protocol:      HTTP`)
  console.log(`  Output Offset: ${outputOffset}`)
  console.log(`  Audio Outputs: ${audioOutputCount}\n`)

  // Check if active configuration already exists
  const existingConfig = db.select()
    .from(schema.matrixConfigurations)
    .where(eq(schema.matrixConfigurations.isActive, true))
    .limit(1)
    .get()

  let configId: string

  if (existingConfig) {
    console.log(`Active config already exists: "${existingConfig.name}" (${existingConfig.ipAddress})`)
    console.log('Updating configuration and refreshing inputs/outputs...\n')
    configId = existingConfig.id

    db.update(schema.matrixConfigurations)
      .set({
        name,
        model,
        ipAddress,
        protocol: 'HTTP',
        outputOffset,
        audioOutputCount,
        inputCount: modelSpec.inputs,
        outputCount: modelSpec.outputs,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(schema.matrixConfigurations.id, configId))
      .run()
  } else {
    configId = randomUUID()
    const now = new Date().toISOString()

    db.insert(schema.matrixConfigurations)
      .values({
        id: configId,
        name,
        model,
        ipAddress,
        tcpPort: 23,
        udpPort: 4000,
        protocol: 'HTTP',
        inputCount: modelSpec.inputs,
        outputCount: modelSpec.outputs,
        outputOffset,
        audioOutputCount,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      })
      .run()

    console.log(`Created MatrixConfiguration: ${configId}\n`)
  }

  // Clear existing inputs and outputs for this config
  const deletedInputs = db.delete(schema.matrixInputs)
    .where(eq(schema.matrixInputs.configId, configId))
    .run()
  const deletedOutputs = db.delete(schema.matrixOutputs)
    .where(eq(schema.matrixOutputs.configId, configId))
    .run()

  console.log(`Cleared ${deletedInputs.changes} inputs and ${deletedOutputs.changes} outputs\n`)

  // Create inputs
  const now = new Date().toISOString()
  console.log(`Creating ${modelSpec.inputs} inputs...`)

  for (let i = 1; i <= modelSpec.inputs; i++) {
    db.insert(schema.matrixInputs)
      .values({
        configId,
        channelNumber: i,
        label: `Input ${i}`,
        inputType: 'HDMI',
        deviceType: 'Other',
        isActive: true,
        status: 'active',
        powerOn: false,
        createdAt: now,
        updatedAt: now,
      })
      .run()
  }

  // Create TV outputs (all outputs minus audio outputs)
  const tvOutputCount = modelSpec.outputs - audioOutputCount
  console.log(`Creating ${tvOutputCount} TV outputs (1-${tvOutputCount})...`)

  for (let i = 1; i <= tvOutputCount; i++) {
    db.insert(schema.matrixOutputs)
      .values({
        configId,
        channelNumber: i,
        label: `TV ${String(i).padStart(2, '0')}`,
        resolution: '1080p',
        isActive: true,
        status: 'active',
        powerOn: false,
        dailyTurnOn: true,
        dailyTurnOff: true,
        createdAt: now,
        updatedAt: now,
      })
      .run()
  }

  // Create audio matrix outputs
  const audioStart = tvOutputCount + 1
  const audioEnd = tvOutputCount + audioOutputCount
  console.log(`Creating ${audioOutputCount} audio outputs (${audioStart}-${audioEnd})...`)

  for (let i = audioStart; i <= audioEnd; i++) {
    const zoneNum = i - tvOutputCount
    db.insert(schema.matrixOutputs)
      .values({
        configId,
        channelNumber: i,
        label: `Matrix ${zoneNum}`,
        resolution: '1080p',
        isActive: true,
        status: 'active',
        audioOutput: `Zone ${zoneNum}`,
        powerOn: false,
        dailyTurnOn: false,
        dailyTurnOff: false,
        createdAt: now,
        updatedAt: now,
      })
      .run()
  }

  // Verify
  const inputCount = db.select({ count: dbCount() })
    .from(schema.matrixInputs)
    .where(eq(schema.matrixInputs.configId, configId))
    .get()

  const outputCount = db.select({ count: dbCount() })
    .from(schema.matrixOutputs)
    .where(eq(schema.matrixOutputs.configId, configId))
    .get()

  console.log('\nSeed complete!')
  console.log(`  Inputs:  ${inputCount?.count}`)
  console.log(`  Outputs: ${outputCount?.count} (${tvOutputCount} TVs + ${audioOutputCount} audio)`)
  console.log(`  Protocol: HTTP (verified routing via web API)`)
  console.log('\nNext steps:')
  console.log('  1. Update input/output labels in the UI')
  console.log('  2. Set outputOffset if audio ports differ from default')
  console.log('  3. Test routing from Matrix Control page')
}

seedWolfPackConfig()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Seed failed:', error)
    process.exit(1)
  })
