
/**
 * Channel Preset Auto-Reordering Service
 * 
 * This service analyzes usage patterns and automatically reorders channel presets
 * to put the most frequently used channels at the top.
 * 
 * Features:
 * - Weighted scoring (recent usage counts more than old usage)
 * - Separate ordering for cable and directv
 * - Configurable time decay for usage scores
 * - Safe reordering that preserves data integrity
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

interface UsageScore {
  id: string
  name: string
  channelNumber: string
  score: number
  usageCount: number
  lastUsed: Date | null
}

/**
 * Calculate a weighted usage score for a preset
 * Recent usage is weighted more heavily than older usage
 */
function calculateUsageScore(
  usageCount: number,
  lastUsed: Date | null,
  createdAt: Date
): number {
  if (usageCount === 0) {
    return 0
  }

  const now = new Date()
  const daysSinceLastUse = lastUsed 
    ? (now.getTime() - lastUsed.getTime()) / (1000 * 60 * 60 * 24)
    : 365 // If never used, treat as 1 year old

  const daysSinceCreation = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24)

  // Base score from usage count
  let score = usageCount * 100

  // Apply time decay - usage loses value over time
  // Recent usage (within 7 days) gets full weight
  // Usage decays by 50% every 30 days
  const decayFactor = Math.pow(0.5, daysSinceLastUse / 30)
  score *= decayFactor

  // Boost for very recent usage (within 24 hours)
  if (daysSinceLastUse < 1) {
    score *= 1.5
  }

  // Slight boost for newer presets to give them a chance
  if (daysSinceCreation < 7) {
    score *= 1.1
  }

  return Math.round(score)
}

/**
 * Reorder presets for a specific device type based on usage
 */
async function reorderPresetsForDevice(deviceType: 'cable' | 'directv'): Promise<void> {
  console.log(`[Preset Reorder] Processing ${deviceType} presets...`)

  // Fetch all active presets for this device type
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

  // Calculate usage scores
  const scoredPresets: UsageScore[] = presets.map(preset => ({
    id: preset.id,
    name: preset.name,
    channelNumber: preset.channelNumber,
    score: calculateUsageScore(preset.usageCount, preset.lastUsed, preset.createdAt),
    usageCount: preset.usageCount,
    lastUsed: preset.lastUsed
  }))

  // Sort by score (highest first)
  scoredPresets.sort((a, b) => b.score - a.score)

  // Log the reordering decision
  console.log(`[Preset Reorder] ${deviceType} preset scores:`)
  scoredPresets.forEach((preset, index) => {
    console.log(
      `  ${index + 1}. ${preset.name} (Ch ${preset.channelNumber}) - ` +
      `Score: ${preset.score}, Uses: ${preset.usageCount}, ` +
      `Last: ${preset.lastUsed ? preset.lastUsed.toISOString().split('T')[0] : 'Never'}`
    )
  })

  // Update order in database
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
 * Main reorder function - processes all device types
 */
export async function reorderAllPresets(): Promise<void> {
  console.log('[Preset Reorder] Starting automatic preset reordering...')
  
  try {
    await reorderPresetsForDevice('cable')
    await reorderPresetsForDevice('directv')
    
    console.log('[Preset Reorder] Reordering completed successfully')
  } catch (error) {
    console.error('[Preset Reorder] Error during reordering:', error)
    throw error
  }
}

/**
 * Get usage statistics for all presets
 */
export async function getUsageStatistics() {
  const stats = await prisma.channelPreset.groupBy({
    by: ['deviceType'],
    _count: {
      id: true
    },
    _sum: {
      usageCount: true
    },
    where: {
      isActive: true
    }
  })

  const topPresets = await prisma.channelPreset.findMany({
    where: {
      isActive: true,
      usageCount: {
        gt: 0
      }
    },
    orderBy: {
      usageCount: 'desc'
    },
    take: 10
  })

  return {
    statistics: stats,
    topPresets
  }
}

// Export for use in API routes and cron jobs
export default {
  reorderAllPresets,
  reorderPresetsForDevice,
  getUsageStatistics
}
