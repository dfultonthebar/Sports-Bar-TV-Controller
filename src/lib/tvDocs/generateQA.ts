
/**
 * TV Manual Q&A Generation Service
 * 
 * Generates Q&A pairs from TV manual content for AI training
 */

import { and, asc, create, desc, eq, or } from '@/lib/db-helpers'
import { schema } from '@/db'
import { logger } from '@/lib/logger'
import { extractManualContent, splitContentIntoChunks, extractKeySections } from './extractContent'

// Using singleton prisma from @/lib/prisma

interface QAPair {
  question: string
  answer: string
  category: string
  source: string
}

/**
 * Generate Q&A pairs from manual content using AI
 */
async function generateQAPairsFromChunk(
  chunk: string,
  manufacturer: string,
  model: string,
  category: string
): Promise<QAPair[]> {
  try {
    // Use the AI service to generate Q&A pairs
    const response = await fetch('/api/ai/generate-qa', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: chunk,
        context: `TV Manual for ${manufacturer} ${model}`,
        category
      })
    })
    
    if (!response.ok) {
      console.warn(`[TV Docs] AI Q&A generation failed for chunk`)
      return []
    }
    
    const data = await response.json()
    
    if (data.qaPairs && Array.isArray(data.qaPairs)) {
      return data.qaPairs.map((pair: any) => ({
        question: pair.question,
        answer: pair.answer,
        category,
        source: `${manufacturer} ${model} Manual`
      }))
    }
    
    return []
  } catch (error) {
    logger.error('[TV Docs] Error generating Q&A pairs:', error)
    return []
  }
}

/**
 * Generate template Q&A pairs for common TV questions
 */
function generateTemplateQAPairs(
  manufacturer: string,
  model: string,
  sections: Record<string, string>
): QAPair[] {
  const qaPairs: QAPair[] = []
  
  // Basic model information
  qaPairs.push({
    question: `What TV model is this?`,
    answer: `This is a ${manufacturer} ${model}.`,
    category: 'general',
    source: `${manufacturer} ${model} Manual`
  })
  
  qaPairs.push({
    question: `What brand is this TV?`,
    answer: `This TV is manufactured by ${manufacturer}.`,
    category: 'general',
    source: `${manufacturer} ${model} Manual`
  })
  
  // Extract specifications if available
  if (sections.specifications) {
    const specs = sections.specifications.substring(0, 500)
    qaPairs.push({
      question: `What are the specifications of the ${manufacturer} ${model}?`,
      answer: specs,
      category: 'specifications',
      source: `${manufacturer} ${model} Manual`
    })
  }
  
  // Extract setup information
  if (sections.setup) {
    const setup = sections.setup.substring(0, 500)
    qaPairs.push({
      question: `How do I set up the ${manufacturer} ${model}?`,
      answer: setup,
      category: 'setup',
      source: `${manufacturer} ${model} Manual`
    })
  }
  
  // Extract connection information
  if (sections.connections) {
    const connections = sections.connections.substring(0, 500)
    qaPairs.push({
      question: `What connections does the ${manufacturer} ${model} have?`,
      answer: connections,
      category: 'connections',
      source: `${manufacturer} ${model} Manual`
    })
  }
  
  return qaPairs
}

/**
 * Save Q&A pairs to the database
 */
async function saveQAPairsToDatabase(qaPairs: QAPair[]): Promise<number> {
  try {
    let savedCount = 0
    
    for (const pair of qaPairs) {
      try {
        await create('qaEntries', {
            question: pair.question,
            answer: pair.answer,
            category: pair.category,
            sourceType: 'auto-generated',
            sourceFile: pair.source,
            isActive: true
          })
        savedCount++
      } catch (error) {
        logger.error('[TV Docs] Error saving Q&A pair:', error)
      }
    }
    
    logger.debug(`[TV Docs] Saved ${savedCount}/${qaPairs.length} Q&A pairs to database`)
    
    return savedCount
  } catch (error) {
    logger.error('[TV Docs] Error saving Q&A pairs:', error)
    return 0
  }
}

/**
 * Generate Q&A pairs from a TV manual
 */
export async function generateQAFromManual(
  manualPath: string,
  manufacturer: string,
  model: string
): Promise<{ success: boolean; qaPairsCount: number; error?: string }> {
  try {
    logger.debug(`[TV Docs] Generating Q&A pairs from manual: ${manualPath}`)
    
    // Extract content from manual
    const content = await extractManualContent(manualPath)
    
    if (!content || content.length < 100) {
      throw new Error('Manual content is too short or empty')
    }
    
    // Extract key sections
    const sections = extractKeySections(content)
    
    // Generate template Q&A pairs
    const templateQAPairs = generateTemplateQAPairs(manufacturer, model, sections)
    
    // Split content into chunks for AI processing
    const chunks = splitContentIntoChunks(content, 2000)
    
    // Generate Q&A pairs from chunks (limit to first 10 chunks to avoid overload)
    const aiQAPairs: QAPair[] = []
    const maxChunks = Math.min(chunks.length, 10)
    
    for (let i = 0; i < maxChunks; i++) {
      const chunk = chunks[i]
      const category = Object.keys(sections).find(key => 
        sections[key].includes(chunk.substring(0, 100))
      ) || 'general'
      
      const pairs = await generateQAPairsFromChunk(chunk, manufacturer, model, category)
      aiQAPairs.push(...pairs)
      
      // Small delay to avoid overwhelming the AI service
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
    
    // Combine all Q&A pairs
    const allQAPairs = [...templateQAPairs, ...aiQAPairs]
    
    logger.debug(`[TV Docs] Generated ${allQAPairs.length} Q&A pairs (${templateQAPairs.length} template + ${aiQAPairs.length} AI-generated)`)
    
    // Save to database
    const savedCount = await saveQAPairsToDatabase(allQAPairs)
    
    return {
      success: true,
      qaPairsCount: savedCount
    }
  } catch (error: any) {
    logger.error('[TV Docs] Error generating Q&A from manual:', error)
    return {
      success: false,
      qaPairsCount: 0,
      error: error.message
    }
  }
}
