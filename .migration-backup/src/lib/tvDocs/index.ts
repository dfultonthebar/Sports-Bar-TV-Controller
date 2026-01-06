
/**
 * TV Documentation Service
 * 
 * Main service for fetching, storing, and managing TV documentation
 */

import { and, asc, count, desc, eq, findMany, or } from '@/lib/db-helpers'
import { schema } from '@/db'
import { logger } from '@/lib/logger'
import { searchTVManual, validateManualUrl } from './searchManual'
import { downloadTVManual, getManualPath } from './downloadManual'
import { generateQAFromManual } from './generateQA'
import { TVManualFetchOptions, TVManualFetchResult, TVDocumentationRecord } from './types'

// Using singleton prisma from @/lib/prisma

/**
 * Fetch TV manual and generate Q&A pairs
 */
export async function fetchTVManual(
  options: TVManualFetchOptions
): Promise<TVManualFetchResult> {
  const { manufacturer, model, forceRefetch = false } = options
  
  try {
    logger.debug(`[TV Docs] Fetching manual for ${manufacturer} ${model}`)
    
    // Check if manual already exists
    if (!forceRefetch) {
      const existingPath = await getManualPath(manufacturer, model)
      if (existingPath) {
        logger.debug(`[TV Docs] Manual already exists: ${existingPath}`)
        
        // Check if Q&A pairs were already generated
        const existingQA = await prisma.qAEntry.count({
          where: {
            sourceFile: {
              contains: `${manufacturer} ${model}`
            }
          }
        })
        
        return {
          success: true,
          manufacturer,
          model,
          manualPath: existingPath,
          qaGenerated: existingQA > 0,
          qaPairsCount: existingQA
        }
      }
    }
    
    // Search for manual
    logger.debug(`[TV Docs] Searching for manual online...`)
    const searchResults = await searchTVManual(manufacturer, model)
    
    if (searchResults.length === 0) {
      logger.warn(`[TV Docs] No manual found for ${manufacturer} ${model}`)
      return {
        success: false,
        manufacturer,
        model,
        error: 'No manual found online',
        searchResults: []
      }
    }
    
    // Validate and download manual
    logger.debug(`[TV Docs] Found ${searchResults.length} potential sources, attempting download...`)
    const downloadResult = await downloadTVManual(manufacturer, model, searchResults)
    
    if (!downloadResult) {
      logger.warn(`[TV Docs] Failed to download manual from any source`)
      return {
        success: false,
        manufacturer,
        model,
        error: 'Failed to download manual from available sources',
        searchResults
      }
    }
    
    logger.debug(`[TV Docs] Manual downloaded successfully: ${downloadResult.path}`)
    
    // Generate Q&A pairs
    logger.debug(`[TV Docs] Generating Q&A pairs from manual...`)
    const qaResult = await generateQAFromManual(downloadResult.path, manufacturer, model)
    
    return {
      success: true,
      manufacturer,
      model,
      manualPath: downloadResult.path,
      documentationPath: downloadResult.url,
      qaGenerated: qaResult.success,
      qaPairsCount: qaResult.qaPairsCount
    }
  } catch (error: any) {
    logger.error('[TV Docs] Error fetching TV manual:', error)
    return {
      success: false,
      manufacturer,
      model,
      error: error.message
    }
  }
}

/**
 * Get all TV documentation records
 */
export async function getAllTVDocumentation(): Promise<TVDocumentationRecord[]> {
  try {
    // Get all unique TV models from matrix outputs
    const outputs = await prisma.matrixOutput.findMany({
      where: {
        tvBrand: { not: null },
        tvModel: { not: null }
      },
      select: {
        tvBrand: true,
        tvModel: true,
        lastDiscovery: true
      },
      distinct: ['tvBrand', 'tvModel']
    })
    
    const records: TVDocumentationRecord[] = []
    
    for (const output of outputs) {
      if (!output.tvBrand || !output.tvModel) continue
      
      const manualPath = await getManualPath(output.tvBrand, output.tvModel)
      
      const qaCount = await prisma.qAEntry.count({
        where: {
          sourceFile: {
            contains: `${output.tvBrand} ${output.tvModel}`
          }
        }
      })
      
      records.push({
        id: `${output.tvBrand}-${output.tvModel}`,
        manufacturer: output.tvBrand,
        model: output.tvModel,
        manualPath: manualPath || undefined,
        fetchStatus: manualPath ? 'completed' : 'pending',
        qaGenerated: qaCount > 0,
        qaPairsCount: qaCount,
        createdAt: output.lastDiscovery || new Date(),
        updatedAt: output.lastDiscovery || new Date()
      })
    }
    
    return records
  } catch (error) {
    logger.error('[TV Docs] Error getting TV documentation:', error)
    return []
  }
}

/**
 * Auto-fetch documentation for newly discovered TV
 */
export async function autoFetchDocumentation(
  manufacturer: string,
  model: string,
  outputNumber: number
): Promise<void> {
  try {
    logger.debug(`[TV Docs] Auto-fetching documentation for ${manufacturer} ${model} (Output ${outputNumber})`)
    
    // Run fetch in background (don't await)
    fetchTVManual({ manufacturer, model, outputNumber })
      .then(result => {
        if (result.success) {
          logger.debug(`[TV Docs] Successfully auto-fetched documentation for ${manufacturer} ${model}`)
        } else {
          logger.warn(`[TV Docs] Failed to auto-fetch documentation: ${result.error}`)
        }
      })
      .catch(error => {
        logger.error('[TV Docs] Error in auto-fetch:', error)
      })
  } catch (error) {
    logger.error('[TV Docs] Error starting auto-fetch:', error)
  }
}

export * from './types'
