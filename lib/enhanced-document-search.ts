
import { prisma } from './db'

export interface DocumentSearchResult {
  id: string
  originalName: string
  content: string
  relevanceScore: number
  matchedTerms: string[]
}

export class EnhancedDocumentSearch {
  // Enhanced search with fuzzy matching and keyword extraction
  async searchDocuments(query: string, limit: number = 5): Promise<DocumentSearchResult[]> {
    try {
      // Extract keywords from query
      const keywords = this.extractKeywords(query)
      const searchTerms = this.generateSearchTerms(keywords)

      // Get all documents with content
      const documents = await prisma.document.findMany({
        where: {
          content: {
            not: null
          }
        },
        select: {
          id: true,
          originalName: true,
          content: true
        }
      })

      if (!documents || documents.length === 0) {
        return []
      }

      // Score each document
      const scoredDocuments = documents.map(doc => {
        const score = this.calculateRelevanceScore(doc, searchTerms, keywords)
        const matchedTerms = this.findMatchedTerms(doc, searchTerms)
        
        return {
          ...doc,
          content: doc.content || '',
          relevanceScore: score,
          matchedTerms
        }
      })

      // Filter and sort by relevance
      return scoredDocuments
        .filter(doc => doc.relevanceScore > 0)
        .sort((a, b) => b.relevanceScore - a.relevanceScore)
        .slice(0, limit)

    } catch (error) {
      console.error('Enhanced document search error:', error)
      return []
    }
  }

  private extractKeywords(query: string): string[] {
    // Remove common stop words and extract meaningful terms
    const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'should', 'could', 'can', 'may', 'might'])
    
    return query
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2 && !stopWords.has(word))
  }

  private generateSearchTerms(keywords: string[]): string[] {
    const searchTerms = [...keywords]
    
    // Add partial matches and common variations
    keywords.forEach(keyword => {
      // Add partial matches for longer words
      if (keyword.length > 4) {
        searchTerms.push(keyword.substring(0, keyword.length - 1))
        searchTerms.push(keyword.substring(1))
      }
      
      // Add common technical variations
      const variations = this.getCommonVariations(keyword)
      searchTerms.push(...variations)
    })

    return Array.from(new Set(searchTerms)) // Remove duplicates
  }

  private getCommonVariations(term: string): string[] {
    const variations: string[] = []
    
    // Technical term mappings for AV equipment
    const termMappings: Record<string, string[]> = {
      'tv': ['television', 'display', 'monitor', 'screen'],
      'audio': ['sound', 'speaker', 'volume', 'music'],
      'video': ['display', 'visual', 'picture', 'image'],
      'power': ['on', 'off', 'turn', 'switch'],
      'channel': ['input', 'source', 'feed'],
      'volume': ['sound', 'audio', 'level'],
      'remote': ['control', 'controller', 'rc'],
      'matrix': ['switcher', 'router', 'switch'],
      'zone': ['area', 'room', 'section'],
      'atlas': ['processor', 'audio processor', 'dsp'],
      'wolfpack': ['matrix', 'hdmi', 'switcher'],
      'ir': ['infrared', 'remote', 'control'],
      'network': ['ip', 'ethernet', 'lan', 'connection'],
      'troubleshoot': ['fix', 'repair', 'problem', 'issue', 'debug'],
      'configure': ['setup', 'config', 'set', 'program'],
      'install': ['setup', 'installation', 'mounting']
    }

    const mapping = termMappings[term.toLowerCase()]
    if (mapping) {
      variations.push(...mapping)
    }

    return variations
  }

  private calculateRelevanceScore(document: any, searchTerms: string[], originalKeywords: string[]): number {
    const content = (document.content || '').toLowerCase()
    const filename = document.originalName.toLowerCase()
    let score = 0

    // Exact keyword matches in content (highest weight)
    originalKeywords.forEach(keyword => {
      const regex = new RegExp(`\\b${keyword}\\b`, 'gi')
      const matches = content.match(regex) || []
      score += matches.length * 10
      
      // Filename matches get extra points
      if (filename.includes(keyword)) {
        score += 20
      }
    })

    // Search term matches (medium weight)
    searchTerms.forEach(term => {
      if (content.includes(term)) {
        score += 5
      }
      if (filename.includes(term)) {
        score += 10
      }
    })

    // Proximity bonus - terms appearing near each other
    if (originalKeywords.length > 1) {
      score += this.calculateProximityBonus(content, originalKeywords)
    }

    // Document type bonus for common AV documentation
    if (filename.includes('manual') || filename.includes('guide') || filename.includes('spec')) {
      score *= 1.2
    }

    return Math.round(score)
  }

  private calculateProximityBonus(content: string, keywords: string[]): number {
    let bonus = 0
    const words = content.split(/\s+/)
    
    for (let i = 0; i < keywords.length - 1; i++) {
      for (let j = i + 1; j < keywords.length; j++) {
        const keyword1 = keywords[i]
        const keyword2 = keywords[j]
        
        // Find positions of both keywords
        const positions1 = words.map((word, index) => word.includes(keyword1) ? index : -1).filter(pos => pos !== -1)
        const positions2 = words.map((word, index) => word.includes(keyword2) ? index : -1).filter(pos => pos !== -1)
        
        // Calculate minimum distance between any pair
        positions1.forEach(pos1 => {
          positions2.forEach(pos2 => {
            const distance = Math.abs(pos1 - pos2)
            if (distance <= 50) { // Within 50 words
              bonus += Math.max(0, 10 - distance / 5)
            }
          })
        })
      }
    }
    
    return bonus
  }

  private findMatchedTerms(document: any, searchTerms: string[]): string[] {
    const content = (document.content || '').toLowerCase()
    const filename = document.originalName.toLowerCase()
    
    return searchTerms.filter(term => 
      content.includes(term) || filename.includes(term)
    )
  }

  // Method to reprocess all documents (for fixing missing content)
  async reprocessAllDocuments() {
    try {
      const { extractTextFromFile } = await import('./text-extractor')
      
      const documents = await prisma.document.findMany({
        where: {
          OR: [
            { content: null },
            { content: '' }
          ]
        }
      })

      let processed = 0
      let errors = 0

      for (const doc of documents) {
        try {
          const textResult = await extractTextFromFile(doc.filePath, doc.mimeType)
          
          await prisma.document.update({
            where: { id: doc.id },
            data: { content: textResult }
          })
          
          processed++
        } catch (error) {
          console.error(`Failed to reprocess document ${doc.originalName}:`, error)
          errors++
        }
      }

      return {
        totalDocuments: documents.length,
        processed,
        errors
      }
    } catch (error) {
      console.error('Failed to reprocess documents:', error)
      throw error
    }
  }
}

export const documentSearch = new EnhancedDocumentSearch()
