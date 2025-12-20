/**
 * Q&A Uploader Service
 * Handles uploading and parsing Q&A documents in various formats
 */

import { create } from '@sports-bar/database'
import { logger } from '@sports-bar/logger'

export interface UploadedQA {
  question: string;
  answer: string;
  category?: string;
  tags?: string[];
}

export interface ParseResult {
  success: boolean;
  qas: UploadedQA[];
  errors: string[];
}

/**
 * Parse Q&A content from text
 * Supports formats:
 * - Q: / A: format
 * - Question: / Answer: format
 * - JSON format
 * - Markdown format with headers
 */
export function parseQAContent(content: string, format?: string): ParseResult {
  const errors: string[] = [];
  let qas: UploadedQA[] = [];

  try {
    // Try JSON format first
    if (format === 'json' || content.trim().startsWith('[') || content.trim().startsWith('{')) {
      qas = parseJSONFormat(content);
    }
    // Try Q:/A: format
    else if (content.includes('Q:') || content.includes('A:')) {
      qas = parseQAFormat(content);
    }
    // Try Question:/Answer: format
    else if (content.includes('Question:') || content.includes('Answer:')) {
      qas = parseQuestionAnswerFormat(content);
    }
    // Try markdown format
    else if (content.includes('##') || content.includes('###')) {
      qas = parseMarkdownFormat(content);
    }
    else {
      errors.push('Unable to detect Q&A format. Please use Q:/A:, Question:/Answer:, JSON, or Markdown format.');
    }

    // Validate parsed Q&As
    qas = qas.filter(qa => {
      if (!qa.question || !qa.answer) {
        errors.push(`Skipped invalid Q&A pair: ${qa.question || 'No question'}`);
        return false;
      }
      return true;
    });

    return {
      success: qas.length > 0,
      qas,
      errors,
    };
  } catch (error) {
    return {
      success: false,
      qas: [],
      errors: [`Parse error: ${error instanceof Error ? error.message : 'Unknown error'}`],
    };
  }
}

/**
 * Parse JSON format
 */
function parseJSONFormat(content: string): UploadedQA[] {
  const data = JSON.parse(content);
  const array = Array.isArray(data) ? data : [data];

  return array.map(item => ({
    question: item.question || item.q || '',
    answer: item.answer || item.a || '',
    category: item.category || 'general',
    tags: item.tags || [],
  }));
}

/**
 * Parse Q:/A: format
 */
function parseQAFormat(content: string): UploadedQA[] {
  const qas: UploadedQA[] = [];
  const lines = content.split('\n');

  let currentQ = '';
  let currentA = '';
  let inQuestion = false;
  let inAnswer = false;

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.startsWith('Q:')) {
      // Save previous Q&A if exists
      if (currentQ && currentA) {
        qas.push({
          question: currentQ.trim(),
          answer: currentA.trim(),
          category: 'general',
          tags: [],
        });
      }

      currentQ = trimmed.substring(2).trim();
      currentA = '';
      inQuestion = true;
      inAnswer = false;
    } else if (trimmed.startsWith('A:')) {
      currentA = trimmed.substring(2).trim();
      inQuestion = false;
      inAnswer = true;
    } else if (trimmed) {
      if (inQuestion) {
        currentQ += ' ' + trimmed;
      } else if (inAnswer) {
        currentA += ' ' + trimmed;
      }
    }
  }

  // Save last Q&A
  if (currentQ && currentA) {
    qas.push({
      question: currentQ.trim(),
      answer: currentA.trim(),
      category: 'general',
      tags: [],
    });
  }

  return qas;
}

/**
 * Parse Question:/Answer: format
 */
function parseQuestionAnswerFormat(content: string): UploadedQA[] {
  const qas: UploadedQA[] = [];
  const lines = content.split('\n');

  let currentQ = '';
  let currentA = '';
  let inQuestion = false;
  let inAnswer = false;

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.toLowerCase().startsWith('question:')) {
      // Save previous Q&A if exists
      if (currentQ && currentA) {
        qas.push({
          question: currentQ.trim(),
          answer: currentA.trim(),
          category: 'general',
          tags: [],
        });
      }

      currentQ = trimmed.substring(9).trim();
      currentA = '';
      inQuestion = true;
      inAnswer = false;
    } else if (trimmed.toLowerCase().startsWith('answer:')) {
      currentA = trimmed.substring(7).trim();
      inQuestion = false;
      inAnswer = true;
    } else if (trimmed) {
      if (inQuestion) {
        currentQ += ' ' + trimmed;
      } else if (inAnswer) {
        currentA += ' ' + trimmed;
      }
    }
  }

  // Save last Q&A
  if (currentQ && currentA) {
    qas.push({
      question: currentQ.trim(),
      answer: currentA.trim(),
      category: 'general',
      tags: [],
    });
  }

  return qas;
}

/**
 * Parse Markdown format
 * Expects format like:
 * ## Question
 * Question text
 * ## Answer
 * Answer text
 */
function parseMarkdownFormat(content: string): UploadedQA[] {
  const qas: UploadedQA[] = [];
  const sections = content.split(/^##\s+/m).filter(s => s.trim());

  let currentQ = '';
  let currentA = '';

  for (const section of sections) {
    const lines = section.split('\n');
    const header = lines[0].trim().toLowerCase();
    const body = lines.slice(1).join('\n').trim();

    if (header.includes('question')) {
      if (currentQ && currentA) {
        qas.push({
          question: currentQ,
          answer: currentA,
          category: 'general',
          tags: [],
        });
      }
      currentQ = body;
      currentA = '';
    } else if (header.includes('answer')) {
      currentA = body;
    }
  }

  // Save last Q&A
  if (currentQ && currentA) {
    qas.push({
      question: currentQ,
      answer: currentA,
      category: 'general',
      tags: [],
    });
  }

  return qas;
}

/**
 * Save uploaded Q&As to database
 */
export async function saveUploadedQAs(
  qas: UploadedQA[],
  sourceFile: string
): Promise<{ saved: number; errors: string[] }> {
  let saved = 0;
  const errors: string[] = [];

  for (const qa of qas) {
    try {
      await create('qaEntries', {
        question: qa.question,
        answer: qa.answer,
        category: qa.category || 'general',
        tags: qa.tags ? JSON.stringify(qa.tags) : null,
        sourceType: 'uploaded',
        sourceFile,
        confidence: 1.0,
      });
      saved++;
    } catch (error) {
      errors.push(`Failed to save Q&A: ${qa.question.substring(0, 50)}...`);
    }
  }

  return { saved, errors };
}

/**
 * Process uploaded file
 */
export async function processUploadedFile(
  content: string,
  filename: string,
  format?: string
): Promise<{
  success: boolean;
  saved: number;
  total: number;
  errors: string[];
}> {
  // Parse content
  const parseResult = parseQAContent(content, format);

  if (!parseResult.success) {
    return {
      success: false,
      saved: 0,
      total: 0,
      errors: parseResult.errors,
    };
  }

  // Save to database
  const saveResult = await saveUploadedQAs(parseResult.qas, filename);

  return {
    success: saveResult.saved > 0,
    saved: saveResult.saved,
    total: parseResult.qas.length,
    errors: [...parseResult.errors, ...saveResult.errors],
  };
}
