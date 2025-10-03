
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

/**
 * Reorder all presets based on usage count
 * This function is called by the monthly cron job
 */
export async function reorderAllPresets() {
  try {
    console.log('[Preset Reorder] Starting preset reordering based on usage...')

    // Get all active presets grouped by device type
    const cablePresets = await prisma.channelPreset.findMany({
      where: { deviceType: 'cable', isActive: true },
      orderBy: [
        { usageCount: 'desc' },
        { name: 'asc' }
      ]
    })

    const directvPresets = await prisma.channelPreset.findMany({
      where: { deviceType: 'directv', isActive: true },
      orderBy: [
        { usageCount: 'desc' },
        { name: 'asc' }
      ]
    })

    // Update order field for cable presets
    for (let i = 0; i < cablePresets.length; i++) {
      await prisma.channelPreset.update({
        where: { id: cablePresets[i].id },
        data: { order: i }
      })
    }

    // Update order field for directv presets
    for (let i = 0; i < directvPresets.length; i++) {
      await prisma.channelPreset.update({
        where: { id: directvPresets[i].id },
        data: { order: i }
      })
    }

    console.log(`[Preset Reorder] Successfully reordered ${cablePresets.length} cable presets and ${directvPresets.length} DirecTV presets`)

    return {
      success: true,
      cablePresetsReordered: cablePresets.length,
      directvPresetsReordered: directvPresets.length
    }
  } catch (error) {
    console.error('[Preset Reorder] Error reordering presets:', error)
    throw error
  }
}

/**
 * Get usage statistics for all presets
 */
export async function getUsageStatistics() {
  try {
    const allPresets = await prisma.channelPreset.findMany({
      where: { isActive: true },
      orderBy: { usageCount: 'desc' }
    })

    const cablePresets = allPresets.filter(p => p.deviceType === 'cable')
    const directvPresets = allPresets.filter(p => p.deviceType === 'directv')

    const totalUsage = allPresets.reduce((sum, preset) => sum + preset.usageCount, 0)
    const avgUsage = allPresets.length > 0 ? totalUsage / allPresets.length : 0

    // Get most used presets
    const topPresets = allPresets.slice(0, 10).map(preset => ({
      id: preset.id,
      name: preset.name,
      channelNumber: preset.channelNumber,
      deviceType: preset.deviceType,
      usageCount: preset.usageCount,
      lastUsed: preset.lastUsed
    }))

    // Get least used presets
    const leastUsedPresets = allPresets
      .filter(p => p.usageCount === 0)
      .map(preset => ({
        id: preset.id,
        name: preset.name,
        channelNumber: preset.channelNumber,
        deviceType: preset.deviceType
      }))

    return {
      totalPresets: allPresets.length,
      cablePresets: cablePresets.length,
      directvPresets: directvPresets.length,
      totalUsage,
      averageUsage: Math.round(avgUsage * 100) / 100,
      topPresets,
      unusedPresets: leastUsedPresets.length,
      leastUsedPresets: leastUsedPresets.slice(0, 10)
    }
  } catch (error) {
    console.error('[Preset Statistics] Error fetching statistics:', error)
    throw error
  }
}

/**
 * Check if a preset needs reordering based on usage patterns
 * This can be used for real-time adaptive reordering
 */
export async function checkReorderingNeeded(deviceType: 'cable' | 'directv'): Promise<boolean> {
  try {
    const presets = await prisma.channelPreset.findMany({
      where: { deviceType, isActive: true },
      orderBy: { order: 'asc' }
    })

    // Check if current order matches usage-based order
    const usageBasedOrder = [...presets].sort((a, b) => {
      if (b.usageCount !== a.usageCount) {
        return b.usageCount - a.usageCount
      }
      return a.name.localeCompare(b.name)
    })

    // Compare orders
    for (let i = 0; i < presets.length; i++) {
      if (presets[i].id !== usageBasedOrder[i].id) {
        return true // Reordering needed
      }
    }

    return false // No reordering needed
  } catch (error) {
    console.error('[Preset Reorder Check] Error checking reordering:', error)
    return false
  }
}
