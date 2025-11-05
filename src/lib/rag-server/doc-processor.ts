/**
 * Document Processor for RAG System
 *
 * Handles document scanning, parsing, and intelligent chunking
 */

import fs from 'fs/promises';
import path from 'path';
import { logger } from '@/lib/logger';
import { RAGConfig, extractTechTags } from './config';
import * as cheerio from 'cheerio';

export interface DocumentChunk {
  id: string;
  content: string;
  metadata: {
    filename: string;
    filepath: string;
    techTags: string[];
    chunkIndex: number;
    totalChunks: number;
    heading?: string;
    fileType: string;
    tokens: number;
  };
}

export interface ProcessedDocument {
  filepath: string;
  filename: string;
  chunks: DocumentChunk[];
  techTags: string[];
  error?: string;
}

/**
 * Recursively scan directory for supported documents
 */
export async function scanDocuments(dirPath: string = RAGConfig.docsPath): Promise<string[]> {
  const documents: string[] = [];

  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);

      // Skip excluded folders
      if (entry.isDirectory()) {
        if (!RAGConfig.excludeFolders.includes(entry.name)) {
          const subDocs = await scanDocuments(fullPath);
          documents.push(...subDocs);
        }
        continue;
      }

      // Check if file has supported extension
      const ext = path.extname(entry.name).toLowerCase();
      if (RAGConfig.supportedExtensions.includes(ext)) {
        documents.push(fullPath);
      }
    }
  } catch (error) {
    logger.error('Error scanning documents', { data: { error, dirPath }
      });
  }

  return documents;
}

/**
 * Convert HTML to Markdown using cheerio
 */
function htmlToMarkdown(html: string): string {
  const $ = cheerio.load(html);

  // Remove script and style tags
  $('script, style').remove();

  // Convert headings
  $('h1').each((_, el) => {
    $(el).replaceWith(`\n# ${$(el).text()}\n`);
  });
  $('h2').each((_, el) => {
    $(el).replaceWith(`\n## ${$(el).text()}\n`);
  });
  $('h3').each((_, el) => {
    $(el).replaceWith(`\n### ${$(el).text()}\n`);
  });
  $('h4').each((_, el) => {
    $(el).replaceWith(`\n#### ${$(el).text()}\n`);
  });

  // Convert lists
  $('ul li').each((_, el) => {
    $(el).replaceWith(`- ${$(el).text()}\n`);
  });
  $('ol li').each((i, el) => {
    $(el).replaceWith(`${i + 1}. ${$(el).text()}\n`);
  });

  // Convert code blocks
  $('pre code, code').each((_, el) => {
    const text = $(el).text();
    $(el).replaceWith(`\`${text}\``);
  });

  // Convert links
  $('a').each((_, el) => {
    const href = $(el).attr('href') || '';
    const text = $(el).text();
    $(el).replaceWith(`[${text}](${href})`);
  });

  // Get text content
  let markdown = $('body').text();
  if (!markdown) {
    markdown = $.text();
  }

  // Clean up excessive whitespace
  markdown = markdown.replace(/\n{3,}/g, '\n\n').trim();

  return markdown;
}

/**
 * Extract text from PDF (simple text extraction)
 */
async function extractTextFromPDF(filepath: string): Promise<string> {
  try {
    // Use pdf-parse if available
    const pdfParse = await import('pdf-parse').catch(() => null);
    if (pdfParse) {
      const dataBuffer = await fs.readFile(filepath);
      const data = await pdfParse.default(dataBuffer);
      return data.text;
    }

    // Fallback: skip PDF processing
    logger.warn('pdf-parse not available, skipping PDF', { data: { filepath } });
    return '';
  } catch (error) {
    logger.error('Error extracting PDF text', { data: { error, filepath } });
    return '';
  }
}

/**
 * Read and parse document based on file type
 */
export async function readDocument(filepath: string): Promise<string> {
  const ext = path.extname(filepath).toLowerCase();

  try {
    if (ext === '.pdf') {
      return await extractTextFromPDF(filepath);
    }

    const content = await fs.readFile(filepath, 'utf-8');

    if (ext === '.html' || ext === '.htm') {
      return htmlToMarkdown(content);
    }

    // Markdown and text files
    return content;
  } catch (error) {
    logger.error('Error reading document', { data: { error, filepath }
      });
    throw error;
  }
}

/**
 * Estimate token count (rough approximation: 1 token ≈ 4 chars)
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Extract heading context from text at a given position
 */
function findNearestHeading(text: string, position: number): string | undefined {
  const beforeText = text.substring(0, position);
  const headingMatches = beforeText.match(/^#+\s+(.+)$/gm);

  if (headingMatches && headingMatches.length > 0) {
    const lastHeading = headingMatches[headingMatches.length - 1];
    return lastHeading.replace(/^#+\s+/, '').trim();
  }

  return undefined;
}

/**
 * Intelligent document chunking with overlap
 */
export function chunkDocument(
  content: string,
  filepath: string,
  chunkSize: number = RAGConfig.chunkSize,
  overlap: number = RAGConfig.chunkOverlap
): DocumentChunk[] {
  const chunks: DocumentChunk[] = [];
  const filename = path.basename(filepath);
  const techTags = extractTechTags(filepath);
  const fileType = path.extname(filepath).substring(1);

  // Split by paragraphs first
  const paragraphs = content.split(/\n\s*\n/);

  let currentChunk = '';
  let currentTokens = 0;
  let chunkIndex = 0;
  let position = 0;

  for (const paragraph of paragraphs) {
    const paraTokens = estimateTokens(paragraph);

    // If single paragraph is too large, split it
    if (paraTokens > chunkSize * 1.5) {
      // Save current chunk if not empty
      if (currentChunk.trim()) {
        chunks.push(createChunk(currentChunk, filepath, filename, techTags, fileType, chunkIndex, position));
        chunkIndex++;
        position += currentChunk.length;
      }

      // Split large paragraph by sentences
      const sentences = paragraph.split(/(?<=[.!?])\s+/);
      currentChunk = '';
      currentTokens = 0;

      for (const sentence of sentences) {
        const sentenceTokens = estimateTokens(sentence);

        if (currentTokens + sentenceTokens > chunkSize && currentChunk) {
          chunks.push(createChunk(currentChunk, filepath, filename, techTags, fileType, chunkIndex, position));
          chunkIndex++;
          position += currentChunk.length;

          // Keep overlap
          const overlapText = getLastNTokens(currentChunk, overlap);
          currentChunk = overlapText + ' ' + sentence;
          currentTokens = estimateTokens(currentChunk);
        } else {
          currentChunk += (currentChunk ? ' ' : '') + sentence;
          currentTokens += sentenceTokens;
        }
      }

      continue;
    }

    // Check if adding paragraph exceeds chunk size
    if (currentTokens + paraTokens > chunkSize && currentChunk) {
      chunks.push(createChunk(currentChunk, filepath, filename, techTags, fileType, chunkIndex, position));
      chunkIndex++;
      position += currentChunk.length;

      // Keep overlap
      const overlapText = getLastNTokens(currentChunk, overlap);
      currentChunk = overlapText + '\n\n' + paragraph;
      currentTokens = estimateTokens(currentChunk);
    } else {
      currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
      currentTokens += paraTokens;
    }
  }

  // Add final chunk
  if (currentChunk.trim()) {
    chunks.push(createChunk(currentChunk, filepath, filename, techTags, fileType, chunkIndex, position));
  }

  // Update total chunks count
  chunks.forEach(chunk => {
    chunk.metadata.totalChunks = chunks.length;
  });

  return chunks;
}

/**
 * Create a document chunk with metadata
 */
function createChunk(
  content: string,
  filepath: string,
  filename: string,
  techTags: string[],
  fileType: string,
  chunkIndex: number,
  position: number
): DocumentChunk {
  const tokens = estimateTokens(content);
  const heading = findNearestHeading(content, position);

  return {
    id: `${filename}-chunk-${chunkIndex}`,
    content: content.trim(),
    metadata: {
      filename,
      filepath,
      techTags,
      chunkIndex,
      totalChunks: 0, // Will be updated later
      heading,
      fileType,
      tokens,
    },
  };
}

/**
 * Get last N tokens from text for overlap
 */
function getLastNTokens(text: string, n: number): string {
  const words = text.split(/\s+/);
  const tokenCount = Math.ceil(n * 0.75); // Rough word-to-token ratio
  return words.slice(-tokenCount).join(' ');
}

/**
 * Process a single document into chunks
 */
export async function processDocument(filepath: string): Promise<ProcessedDocument> {
  const filename = path.basename(filepath);

  try {
    const content = await readDocument(filepath);

    if (!content || content.trim().length === 0) {
      return {
        filepath,
        filename,
        chunks: [],
        techTags: [],
        error: 'Empty document or unsupported format',
      };
    }

    const chunks = chunkDocument(content, filepath);
    const techTags = extractTechTags(filepath);

    logger.info('Document processed', {
      data: {
        filename,
        chunks: chunks.length,
        techTags,
      }
    });

    return {
      filepath,
      filename,
      chunks,
      techTags,
    };
  } catch (error) {
    logger.error('Error processing document', { data: { error, filepath }
      });
    return {
      filepath,
      filename,
      chunks: [],
      techTags: [],
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Process multiple documents in batch
 */
export async function processDocuments(filepaths: string[]): Promise<ProcessedDocument[]> {
  const results: ProcessedDocument[] = [];

  for (const filepath of filepaths) {
    const result = await processDocument(filepath);
    results.push(result);
  }

  return results;
}
