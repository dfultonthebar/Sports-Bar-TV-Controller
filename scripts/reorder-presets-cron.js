#!/usr/bin/env node

/**
 * Cron Job Script for Automatic Preset Reordering
 * 
 * This script should be run periodically (e.g., daily) to automatically
 * reorder channel presets based on usage patterns.
 * 
 * Usage:
 *   node scripts/reorder-presets-cron.js
 * 
 * Crontab example (run daily at 3 AM):
 *   0 3 * * * cd /home/ubuntu/Sports-Bar-TV-Controller && node scripts/reorder-presets-cron.js >> logs/preset-reorder.log 2>&1
 */

const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

/**
 * Calculate a weighted usage score for a preset
 */
function calculateUsageScore(usageCount, lastUsed, createdAt) {
  if (usageCount === 0) {
    return 0
  }

  const now = new Date()
  const daysSinceLastUse = lastUsed 
    ? (now.getTime() - new Date(lastUsed).getTime()) / (1000 * 60 * 60 * 24)
    : 365

  const daysSinceCreation = (now.getTime() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24)

  let score = usageCount * 100

  // Time decay
  const decayFactor = Math.pow(0.5, daysSinceLastUse / 30)
  score *= decayFactor

  // Boost for very recent usage
  if (daysSinceLastUse < 1) {
    score *= 1.5
  }

  // Boost for newer presets
  if (daysSinceCreation < 7) {
    score *= 1.1
  }

  return Math.round(score)
}

/**
 * Reorder presets for a specific device type
 */
async function reorderPresetsForDevice(deviceType) {
  console.log(`[Preset Reorder] Processing ${deviceType} presets...`)

  const presets = await prisma.channelPreset.findMany({
    where: {
      deviceType,
      isActive: true
    },
    orderBy: {
      order: 'asc'
    }
  })

  if (presets.length === 0) {
    console.log(`[Preset Reorder] No presets found for ${deviceType}`)
    return
  }

  // Calculate scores
  const scoredPresets = presets.map(preset => ({
    id: preset.id,
    name: preset.name,
    channelNumber: preset.channelNumber,
    score: calculateUsageScore(preset.usageCount, preset.lastUsed, preset.createdAt),
    usageCount: preset.usageCount,
    lastUsed: preset.lastUsed
  }))

  // Sort by score
  scoredPresets.sort((a, b) => b.score - a.score)

  // Log decisions
  console.log(`[Preset Reorder] ${deviceType} preset scores:`)
  scoredPresets.forEach((preset, index) => {
    const lastUsedStr = preset.lastUsed 
      ? new Date(preset.lastUsed).toISOString().split('T')[0] 
      : 'Never'
    console.log(
      `  ${index + 1}. ${preset.name} (Ch ${preset.channelNumber}) - ` +
      `Score: ${preset.score}, Uses: ${preset.usageCount}, Last: ${lastUsedStr}`
    )
  })

  // Update database
  const updatePromises = scoredPresets.map((preset, index) => {
    return prisma.channelPreset.update({
      where: { id: preset.id },
      data: { order: index }
    })
  })

  await Promise.all(updatePromises)

  console.log(`[Preset Reorder] Successfully reordered ${scoredPresets.length} ${deviceType} presets`)
}

/**
 * Main function
 */
async function main() {
  const timestamp = new Date().toISOString()
  console.log(`[${timestamp}] Starting scheduled preset reordering...`)

  try {
    await reorderPresetsForDevice('cable')
    await reorderPresetsForDevice('directv')
    
    console.log(`[${timestamp}] Preset reordering completed successfully`)
    await prisma.$disconnect()
    process.exit(0)
  } catch (error) {
    console.error(`[${timestamp}] Error during preset reordering:`, error)
    await prisma.$disconnect()
    process.exit(1)
  }
}

main()
