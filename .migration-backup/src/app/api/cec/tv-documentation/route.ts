
/**
 * TV Documentation API
 * 
 * Endpoint for listing and managing TV documentation
 */

import { NextRequest, NextResponse } from 'next/server'
import { getAllTVDocumentation } from '@/lib/tvDocs'
import { listDownloadedManuals } from '@/lib/tvDocs/downloadManual'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'

import { logger } from '@/lib/logger'
/**
 * GET /api/cec/tv-documentation
 * 
 * Get all TV documentation records
 * 
 * Response:
 * - documentation: Array of TV documentation records
 * - totalManuals: Total number of downloaded manuals
 * - totalQAPairs: Total number of Q&A pairs generated
 */
export async function GET(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.HARDWARE)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  try {
    logger.info('[TV Documentation API] Fetching all TV documentation')
    
    // Get documentation records
    const documentation = await getAllTVDocumentation()
    
    // Get downloaded manuals
    const manuals = await listDownloadedManuals()
    
    // Calculate totals
    const totalQAPairs = documentation.reduce((sum, doc) => sum + doc.qaPairsCount, 0)
    
    return NextResponse.json({
      success: true,
      documentation,
      totalManuals: manuals.length,
      totalQAPairs,
      manuals: manuals.map(m => ({
        filename: m.filename,
        size: m.size,
        sizeFormatted: formatBytes(m.size)
      }))
    })
  } catch (error: any) {
    logger.error('[TV Documentation API] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to fetch TV documentation'
      },
      { status: 500 }
    )
  }
}

/**
 * Format bytes to human-readable string
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes'
  
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
}
