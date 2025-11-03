/**
 * Q&A Generation Processor
 *
 * This module contains the core processing logic for Q&A generation,
 * extracted to be used by both the API route and the background worker.
 *
 * Uses Claude API (Anthropic) for reliable, high-quality Q&A generation
 */

import fs from 'fs';
import path from 'path';
import { and, asc, create, deleteRecord, desc, eq, findMany, findUnique, or, update, upsert } from '@/lib/db-helpers';
import { schema } from '@/db';
import { logger } from '@/lib/logger';
import { calculateFileHash } from '@/lib/utils/file-hash';
import Anthropic from '@anthropic-ai/sdk';

// Claude API Configuration
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';
const DEFAULT_MODEL = 'claude-3-5-haiku-20241022'; // Fast and cost-effective
const QA_GENERATION_TIMEOUT = 120000; // 2 minutes per chunk
const MAX_CONCURRENT_FILES = 3; // Can handle more with Claude
const MAX_FILE_SIZE_MB = 2;
const CHUNK_SIZE = 4000; // Claude can handle larger chunks
const MAX_RETRIES = 2;

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: ANTHROPIC_API_KEY,
});

export interface QAGenerationOptions {
  sourceType: 'repository' | 'documentation' | 'codebase';
  sourcePaths?: string[];
  categories?: string[];
  maxQAsPerFile?: number;
  model?: string;
  forceRegenerate?: boolean;
}

export interface GeneratedQA {
  question: string;
  answer: string;
  category: string;
  tags: string[];
  confidence: number;
  sourceFile: string;
}

class ConcurrencyLimiter {
  private running = 0;
  private queue: Array<() => void> = [];

  constructor(private maxConcurrent: number) {}

  async run<T>(fn: () => Promise<T>): Promise<T> {
    while (this.running >= this.maxConcurrent) {
      await new Promise<void>(resolve => this.queue.push(resolve));
    }

    this.running++;
    try {
      return await fn();
    } finally {
      this.running--;
      const next = this.queue.shift();
      if (next) next();
    }
  }
}

/**
 * Check if file needs processing based on tracking
 */
async function shouldProcessFile(
  filePath: string,
  forceRegenerate: boolean
): Promise<{ shouldProcess: boolean; reason: string }> {
  if (forceRegenerate) {
    return { shouldProcess: true, reason: 'force_regenerate' };
  }

  try {
    const existing = await findUnique('processedFiles', eq(schema.processedFiles.filePath, filePath));

    if (!existing) {
      return { shouldProcess: true, reason: 'new_file' };
    }

    // Check if file has been modified
    const currentHash = await calculateFileHash(filePath);
    if (currentHash !== existing.fileHash) {
      return { shouldProcess: true, reason: 'file_modified' };
    }

    // File already processed and unchanged
    return { shouldProcess: false, reason: 'already_processed' };
  } catch (error) {
    logger.error(`Error checking file status for ${filePath}:`, error);
    return { shouldProcess: true, reason: 'check_failed' };
  }
}

/**
 * Update file tracking in database
 */
async function updateFileTracking(
  filePath: string,
  qaCount: number,
  sourceType: string,
  status: 'processed' | 'failed' | 'skipped'
): Promise<void> {
  try {
    const fileHash = await calculateFileHash(filePath);

    await upsert(
      'processedFiles',
      eq(schema.processedFiles.filePath, filePath),
      {
        filePath,
        fileHash,
        qaCount,
        sourceType,
        status,
      },
      {
        fileHash,
        lastProcessed: new Date().toISOString(),
        qaCount,
        status,
        updatedAt: new Date().toISOString(),
      }
    );
  } catch (error) {
    logger.error(`Error updating file tracking for ${filePath}:`, error);
  }
}

/**
 * Main job processing function - can be called by worker or API route
 */
export async function processQAGenerationJob(
  jobId: string,
  options: QAGenerationOptions
): Promise<void> {
  const startTime = Date.now();

  try {
    logger.info(`[QA Processor] Starting job ${jobId}`);

    await update('qaGenerationJobs', eq(schema.qaGenerationJobs.id, jobId), {
      status: 'running',
      startedAt: new Date().toISOString(),
    });

    const files = await collectFilesForGeneration(options);

    logger.info(`[QA Processor] Found ${files.length} files to process`);
    logger.debug(`Starting Q&A generation for ${files.length} files with ${MAX_CONCURRENT_FILES} concurrent workers`);
    logger.debug(`Force regenerate: ${options.forceRegenerate ? 'YES' : 'NO'}`);

    await update('qaGenerationJobs', eq(schema.qaGenerationJobs.id, jobId), {
      totalFiles: files.length,
    });

    if (files.length === 0) {
      throw new Error('No files found for Q&A generation');
    }

    let processedFiles = 0;
    let skippedFiles = 0;
    let generatedQAs = 0;
    let failedFiles = 0;
    const errors: string[] = [];

    const limiter = new ConcurrencyLimiter(MAX_CONCURRENT_FILES);

    const processFile = async (file: string, index: number) => {
      try {
        const { shouldProcess, reason } = await shouldProcessFile(file, options.forceRegenerate || false);

        if (!shouldProcess) {
          logger.info(`[${index + 1}/${files.length}] ⏭️  Skipping (${reason}): ${file}`);
          skippedFiles++;
          return { success: true, qas: [], skipped: true };
        }

        logger.info(`[${index + 1}/${files.length}] 🔄 Processing (${reason}): ${file}`);

        const stats = fs.statSync(file);
        const fileSizeMB = stats.size / (1024 * 1024);

        if (fileSizeMB > MAX_FILE_SIZE_MB) {
          logger.warn(`[${index + 1}/${files.length}] ⚠️  Skipping large file (${fileSizeMB.toFixed(2)}MB): ${file}`);
          errors.push(`${file}: File too large (${fileSizeMB.toFixed(2)}MB), skipped to prevent timeout`);
          await updateFileTracking(file, 0, options.sourceType, 'skipped');
          failedFiles++;
          return { success: false, qas: [] };
        }

        const qas = await generateQAsFromFile(file, options);

        if (qas.length === 0) {
          failedFiles++;
          logger.warn(`❌ No Q&As generated for ${file}`);
          await updateFileTracking(file, 0, options.sourceType, 'failed');
          return { success: false, qas: [] };
        }

        const savedQAs = [];
        for (const qa of qas) {
          try {
            await create('qaEntries', {
              question: qa.question,
              answer: qa.answer,
              category: qa.category,
              tags: JSON.stringify(qa.tags),
              sourceType: 'auto-generated',
              sourceFile: qa.sourceFile,
              confidence: qa.confidence,
            });
            savedQAs.push(qa);
          } catch (dbError) {
            logger.error(`Error saving Q&A to database:`, dbError);
            errors.push(`DB error for ${file}: ${dbError instanceof Error ? dbError.message : 'Unknown'}`);
          }
        }

        await updateFileTracking(file, savedQAs.length, options.sourceType, 'processed');

        logger.info(`[${index + 1}/${files.length}] ✅ Generated ${savedQAs.length} Q&As from ${file}`);
        return { success: true, qas: savedQAs };
      } catch (error) {
        failedFiles++;
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        logger.error(`Error processing file ${file}:`, errorMsg);
        errors.push(`${file}: ${errorMsg}`);
        await updateFileTracking(file, 0, options.sourceType, 'failed');
        return { success: false, qas: [] };
      }
    };

    const results = await Promise.all(
      files.map((file, index) =>
        limiter.run(() => processFile(file, index))
      )
    );

    processedFiles = results.filter(r => !r.skipped).length;
    generatedQAs = results.reduce((sum, r) => sum + r.qas.length, 0);

    logger.info(`\n📊 Summary: ${processedFiles} processed, ${skippedFiles} skipped, ${failedFiles} failed, ${generatedQAs} Q&As generated`);

    await update('qaGenerationJobs', eq(schema.qaGenerationJobs.id, jobId), {
      processedFiles,
      generatedQAs,
    });

    const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(2);
    logger.info(`⏱️  Completed in ${elapsedTime}s`);

    const finalStatus = generatedQAs > 0 ? 'completed' : 'failed';
    const errorMessage = errors.length > 0
      ? `Generated ${generatedQAs} Q&As from ${processedFiles - failedFiles}/${processedFiles} files. Errors: ${errors.slice(0, 3).join('; ')}${errors.length > 3 ? '...' : ''}`
      : undefined;

    await update('qaGenerationJobs', eq(schema.qaGenerationJobs.id, jobId), {
      status: finalStatus,
      processedFiles,
      generatedQAs,
      errorMessage,
      completedAt: new Date().toISOString(),
    });

    logger.info(`✅ Q&A generation ${finalStatus}: ${generatedQAs} Q&As from ${processedFiles} files`);
  } catch (error) {
    logger.error('Q&A generation process failed:', error);
    await update('qaGenerationJobs', eq(schema.qaGenerationJobs.id, jobId), {
      status: 'failed',
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
      completedAt: new Date().toISOString(),
    });
    throw error;
  }
}

async function collectFilesForGeneration(options: QAGenerationOptions): Promise<string[]> {
  const files: string[] = [];
  const projectRoot = process.cwd();

  if (options.sourcePaths && options.sourcePaths.length > 0) {
    for (const sourcePath of options.sourcePaths) {
      const fullPath = path.isAbsolute(sourcePath)
        ? sourcePath
        : path.join(projectRoot, sourcePath);

      try {
        const stats = await fs.promises.stat(fullPath);
        if (stats.isFile()) {
          files.push(fullPath);
        } else if (stats.isDirectory()) {
          const dirFiles = await collectFilesFromDirectory(fullPath);
          files.push(...dirFiles);
        }
      } catch (error) {
        logger.error(`Error accessing path ${fullPath}:`, error);
      }
    }
  } else {
    const defaultPaths = [
      path.join(projectRoot, 'docs'),
      path.join(projectRoot, 'documentation'),
      path.join(projectRoot, 'README.md'),
    ];

    for (const defaultPath of defaultPaths) {
      try {
        const stats = await fs.promises.stat(defaultPath);
        if (stats.isFile()) {
          files.push(defaultPath);
        } else if (stats.isDirectory()) {
          const dirFiles = await collectFilesFromDirectory(defaultPath);
          files.push(...dirFiles);
        }
      } catch (error) {
        // Path doesn't exist, skip
      }
    }
  }

  // Only process markdown files for faster, more reliable Q&A generation
  const supportedExtensions = ['.md'];
  return files.filter(file =>
    supportedExtensions.some(ext => file.toLowerCase().endsWith(ext))
  );
}

async function collectFilesFromDirectory(dirPath: string): Promise<string[]> {
  const files: string[] = [];

  try {
    const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);

      if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
        const subFiles = await collectFilesFromDirectory(fullPath);
        files.push(...subFiles);
      } else if (entry.isFile()) {
        files.push(fullPath);
      }
    }
  } catch (error) {
    logger.error(`Error reading directory ${dirPath}:`, error);
  }

  return files;
}

async function generateQAsFromFile(filePath: string, options: QAGenerationOptions): Promise<GeneratedQA[]> {
  const content = await fs.promises.readFile(filePath, 'utf-8');
  const fileCategory = path.dirname(filePath).split(path.sep).pop() || 'general';

  const chunks = chunkContent(content, CHUNK_SIZE);
  const allQAs: GeneratedQA[] = [];

  for (let i = 0; i < chunks.length; i++) {
    try {
      const qas = await generateQAsFromChunk(chunks[i], filePath, fileCategory, options);
      allQAs.push(...qas);

      if (options.maxQAsPerFile && allQAs.length >= options.maxQAsPerFile) {
        break;
      }
    } catch (error) {
      logger.error(`Error generating Q&As from chunk ${i + 1} of ${filePath}:`, error);
    }
  }

  return allQAs;
}

function chunkContent(content: string, chunkSize: number): string[] {
  const chunks: string[] = [];
  const lines = content.split('\n');
  let currentChunk = '';

  for (const line of lines) {
    if (currentChunk.length + line.length > chunkSize && currentChunk.length > 0) {
      chunks.push(currentChunk);
      currentChunk = line + '\n';
    } else {
      currentChunk += line + '\n';
    }
  }

  if (currentChunk.length > 0) {
    chunks.push(currentChunk);
  }

  return chunks;
}

async function generateQAsFromChunk(
  chunk: string,
  filePath: string,
  category: string,
  options: QAGenerationOptions
): Promise<GeneratedQA[]> {
  const fileName = path.basename(filePath);

  const prompt = `Analyze this documentation and generate 2-4 high-quality question-answer pairs that would help users understand this system.

Document: ${fileName}
Category: ${category}

Content:
${chunk}

CRITICAL INSTRUCTIONS:
1. Generate questions that users would actually ask about this system
2. Answers should be clear, accurate, and based ONLY on the provided content
3. Focus on practical, actionable information
4. Return ONLY valid JSON - no markdown, no code blocks, no extra text

Required JSON format:
{
  "qas": [
    {
      "question": "specific question here",
      "answer": "detailed answer here",
      "tags": ["tag1", "tag2"],
      "confidence": 0.9
    }
  ]
}`;

  let retries = 0;
  while (retries <= MAX_RETRIES) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), QA_GENERATION_TIMEOUT);

      const message = await anthropic.messages.create({
        model: DEFAULT_MODEL,
        max_tokens: 2048,
        temperature: 0.3,
        messages: [{
          role: 'user',
          content: prompt
        }],
      }, {
        signal: controller.signal as any,
      });

      clearTimeout(timeoutId);

      if (!message.content || message.content.length === 0) {
        throw new Error('Empty response from Claude API');
      }

      const responseText = message.content[0].type === 'text'
        ? message.content[0].text
        : '';

      // Parse the JSON response
      const cleaned = responseText.trim()
        .replace(/```json\s*/g, '')
        .replace(/```\s*/g, '')
        .trim();

      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);

      if (!parsed.qas || !Array.isArray(parsed.qas)) {
        throw new Error('Invalid Q&A structure');
      }

      const validQAs = parsed.qas
        .filter((qa: any) => qa.question && qa.answer)
        .map((qa: any) => ({
          question: qa.question,
          answer: qa.answer,
          category,
          tags: Array.isArray(qa.tags) ? qa.tags : [],
          confidence: typeof qa.confidence === 'number' ? qa.confidence : 0.85,
          sourceFile: filePath,
        }));

      if (validQAs.length > 0) {
        return validQAs;
      }

      throw new Error('No valid Q&As generated');

    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        logger.error(`Claude API timeout for ${fileName} (attempt ${retries + 1}/${MAX_RETRIES + 1})`);
      } else {
        logger.error(`Error calling Claude API (attempt ${retries + 1}/${MAX_RETRIES + 1}):`, error);
      }

      if (retries < MAX_RETRIES) {
        retries++;
        await new Promise(resolve => setTimeout(resolve, 2000 * retries)); // Exponential backoff
        continue;
      }

      return []; // Return empty array after all retries
    }
  }

  return [];
}
