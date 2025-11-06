
/**
 * Enhanced AI Knowledge System with Q&A Integration
 * Integrates Q&A training data with the existing knowledge base
 */

import { and, asc, desc, eq, findMany, or, update } from '@/lib/db-helpers'
import { schema } from '@/db'
import { db } from '@/db'
import { logger } from '@/lib/logger';
import { loadKnowledgeBase, DocumentChunk, searchKnowledgeBase } from './ai-knowledge';

export interface EnhancedContext {
  documentation: DocumentChunk[];
  qaEntries: Array<{
    question: string;
    answer: string;
    category: string;
    relevance: number;
  }>;
  totalSources: number;
}

/**
 * Search Q&A entries and rank by relevance
 */
export async function searchQAForContext(
  query: string,
  maxResults: number = 5
): Promise<Array<{
  question: string;
  answer: string;
  category: string;
  relevance: number;
}>> {
  try {
    const queryLower = query.toLowerCase();
    const queryTerms = queryLower.split(/\s+/).filter(term => term.length > 2);

    // Get active Q&A entries using Drizzle
    const entries = await db.select({
      id: schema.qaEntries.id,
      question: schema.qaEntries.question,
      answer: schema.qaEntries.answer,
      category: schema.qaEntries.category,
      usageCount: schema.qaEntries.useCount
    })
      .from(schema.qaEntries)
      .where(eq(schema.qaEntries.isActive, true))
      .all();

    // Score each Q&A entry
    const scoredEntries = entries.map(entry => {
      const questionLower = entry.question.toLowerCase();
      const answerLower = entry.answer.toLowerCase();
      let score = 0;

      // Exact phrase match in question gets highest score
      if (questionLower.includes(queryLower)) {
        score += 100;
      }

      // Exact phrase match in answer
      if (answerLower.includes(queryLower)) {
        score += 50;
      }

      // Individual term matches
      queryTerms.forEach(term => {
        const questionMatches = (questionLower.match(new RegExp(term, 'g')) || []).length;
        const answerMatches = (answerLower.match(new RegExp(term, 'g')) || []).length;
        score += questionMatches * 10;
        score += answerMatches * 5;
      });

      // Boost for usage count (popular Q&As are likely more relevant)
      score += Math.min(entry.usageCount * 2, 20);

      return {
        question: entry.question,
        answer: entry.answer,
        category: entry.category,
        relevance: score,
        id: entry.id,
      };
    });

    // Sort by relevance and return top results
    const topEntries = scoredEntries
      .filter(entry => entry.relevance > 0)
      .sort((a, b) => b.relevance - a.relevance)
      .slice(0, maxResults);

    // Update usage count for returned entries
    for (const entry of topEntries) {
      // Fetch current entry to get current usageCount
      const current = await db.select()
        .from(schema.qaEntries)
        .where(eq(schema.qaEntries.id, entry.id))
        .get();

      if (current) {
        await db.update(schema.qaEntries)
          .set({
            useCount: (current.useCount || 0) + 1,
            lastUsed: new Date().toISOString()
          })
          .where(eq(schema.qaEntries.id, entry.id))
          .run()
          .catch(console.error);
      }
    }

    return topEntries;
  } catch (error) {
    logger.error('Error searching Q&A entries:', error);
    return [];
  }
}

/**
 * Build enhanced context combining documentation and Q&A entries
 */
export async function buildEnhancedContextWithQA(
  query: string,
  maxDocs: number = 5,
  maxQAs: number = 5
): Promise<EnhancedContext> {
  // Search documentation
  const docs = searchKnowledgeBase(query, maxDocs);

  // Search Q&A entries
  const qaEntries = await searchQAForContext(query, maxQAs);

  return {
    documentation: docs,
    qaEntries,
    totalSources: docs.length + qaEntries.length,
  };
}

/**
 * Format enhanced context for AI prompt
 */
export function formatEnhancedContext(context: EnhancedContext): string {
  let formatted = '';

  // Add Q&A entries first (they're usually more direct)
  if (context.qaEntries.length > 0) {
    formatted += '## Relevant Q&A Knowledge:\n\n';
    context.qaEntries.forEach((qa, index) => {
      formatted += `### Q&A ${index + 1} (${qa.category}, relevance: ${qa.relevance.toFixed(0)})\n`;
      formatted += `**Q:** ${qa.question}\n`;
      formatted += `**A:** ${qa.answer}\n\n`;
    });
  }

  // Add documentation
  if (context.documentation.length > 0) {
    formatted += '## Relevant Documentation:\n\n';
    context.documentation.forEach((doc, index) => {
      formatted += `### Document ${index + 1}: ${doc.metadata.filename}\n`;
      formatted += `Source: ${doc.source}\n`;
      formatted += `Type: ${doc.type}\n\n`;
      formatted += doc.content;
      formatted += '\n\n';
    });
  }

  if (context.totalSources === 0) {
    formatted = 'No relevant documentation or Q&A entries found for this query.';
  }

  return formatted;
}

/**
 * Get context for AI assistant with Q&A integration
 */
export async function getAIContext(query: string): Promise<string> {
  const context = await buildEnhancedContextWithQA(query);
  return formatEnhancedContext(context);
}
