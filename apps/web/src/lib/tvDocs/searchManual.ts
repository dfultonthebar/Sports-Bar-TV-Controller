
/**
 * TV Manual Search Service
 * 
 * Searches the internet for TV manuals and documentation
 */

import { TVManualSearchResult } from './types'

import { logger } from '@/lib/logger'
/**
 * Search for TV manual using web search
 */
export async function searchTVManual(
  manufacturer: string,
  model: string
): Promise<TVManualSearchResult[]> {
  try {
    logger.info(`[TV Docs] Searching for manual: ${manufacturer} ${model}`)
    
    // Construct search queries
    const queries = [
      `${manufacturer} ${model} manual PDF`,
      `${manufacturer} ${model} user guide PDF`,
      `${manufacturer} ${model} instruction manual`,
    ]
    
    const results: TVManualSearchResult[] = []
    
    // Search for each query
    for (const query of queries) {
      try {
        // Use web search to find manuals
        const searchResponse = await fetch('/api/web-search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query,
            numResults: 5
          })
        })
        
        if (!searchResponse.ok) {
          logger.warn(`[TV Docs] Search failed for query: ${query}`)
          continue
        }
        
        const searchData = await searchResponse.json()
        
        if (searchData.results && Array.isArray(searchData.results)) {
          for (const result of searchData.results) {
            const url = result.url || result.link
            const title = result.title || result.name || ''
            
            if (!url) continue
            
            // Check if it's a PDF
            const isPDF = url.toLowerCase().endsWith('.pdf') || 
                         title.toLowerCase().includes('pdf')
            
            // Calculate relevance score
            let relevanceScore = 0
            const lowerTitle = title.toLowerCase()
            const lowerUrl = url.toLowerCase()
            
            if (lowerTitle.includes('manual') || lowerUrl.includes('manual')) relevanceScore += 3
            if (lowerTitle.includes('user guide') || lowerUrl.includes('user-guide')) relevanceScore += 3
            if (lowerTitle.includes(manufacturer.toLowerCase())) relevanceScore += 2
            if (lowerTitle.includes(model.toLowerCase())) relevanceScore += 2
            if (isPDF) relevanceScore += 2
            if (lowerUrl.includes('support') || lowerUrl.includes('download')) relevanceScore += 1
            
            results.push({
              url,
              title,
              source: new URL(url).hostname,
              isPDF,
              relevanceScore
            })
          }
        }
      } catch (error) {
        logger.error(`[TV Docs] Error searching query "${query}":`, error)
      }
    }
    
    // Sort by relevance score
    results.sort((a, b) => b.relevanceScore - a.relevanceScore)
    
    // Remove duplicates
    const uniqueResults = results.filter((result, index, self) =>
      index === self.findIndex(r => r.url === result.url)
    )
    
    logger.info(`[TV Docs] Found ${uniqueResults.length} potential manual sources`)
    
    return uniqueResults.slice(0, 10) // Return top 10 results
  } catch (error: any) {
    logger.error('[TV Docs] Error searching for manual:', error)
    throw new Error(`Failed to search for manual: ${error.message}`)
  }
}

/**
 * Validate if a URL is accessible and is a valid manual
 */
export async function validateManualUrl(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, {
      method: 'HEAD',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    })
    
    if (!response.ok) return false
    
    const contentType = response.headers.get('content-type') || ''
    const contentLength = parseInt(response.headers.get('content-length') || '0')
    
    // Check if it's a PDF or HTML document
    const isValidType = contentType.includes('pdf') || 
                       contentType.includes('html') ||
                       contentType.includes('text')
    
    // Check if file size is reasonable (between 100KB and 50MB)
    const isValidSize = contentLength > 100000 && contentLength < 52428800
    
    return isValidType && (contentLength === 0 || isValidSize)
  } catch (error) {
    logger.error('[TV Docs] Error validating URL:', error)
    return false
  }
}
