/**
 * Q&A Generation Processor
 *
 * This module contains the core processing logic for Q&A generation,
 * extracted to be used by both the API route and the background worker.
 */

import fs from 'fs';
import path from 'path';
import { and, asc, create, deleteRecord, desc, eq, findMany, findUnique, or, update, upsert } from '@/lib/db-helpers';
import { schema } from '@/db';
import { logger } from '@/lib/logger';
import { calculateFileHash } from '@/lib/utils/file-hash';

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
const DEFAULT_MODEL = 'phi3:mini';
const FALLBACK_MODEL = 'llama3.2:3b';
const QA_GENERATION_TIMEOUT = 600000; // 10 minutes
const MAX_CONCURRENT_FILES = 2;
const MAX_FILE_SIZE_MB = 2;
const CHUNK_SIZE = 3000;
const MAX_RETRIES = 2;

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
    console.log(`[QA Processor] Starting job ${jobId}`);

    await update('qaGenerationJobs', eq(schema.qaGenerationJobs.id, jobId), {
      status: 'running',
      startedAt: new Date().toISOString(),
    });

    const files = await collectFilesForGeneration(options);

    console.log(`[QA Processor] Found ${files.length} files to process`);
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
          console.log(`[${index + 1}/${files.length}] ⏭️  Skipping (${reason}): ${file}`);
          skippedFiles++;
          return { success: true, qas: [], skipped: true };
        }

        console.log(`[${index + 1}/${files.length}] 🔄 Processing (${reason}): ${file}`);

        const stats = fs.statSync(file);
        const fileSizeMB = stats.size / (1024 * 1024);

        if (fileSizeMB > MAX_FILE_SIZE_MB) {
          console.warn(`[${index + 1}/${files.length}] ⚠️  Skipping large file (${fileSizeMB.toFixed(2)}MB): ${file}`);
          errors.push(`${file}: File too large (${fileSizeMB.toFixed(2)}MB), skipped to prevent timeout`);
          await updateFileTracking(file, 0, options.sourceType, 'skipped');
          failedFiles++;
          return { success: false, qas: [] };
        }

        const qas = await generateQAsFromFile(file, options);

        if (qas.length === 0) {
          failedFiles++;
          console.warn(`❌ No Q&As generated for ${file}`);
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

        console.log(`[${index + 1}/${files.length}] ✅ Generated ${savedQAs.length} Q&As from ${file}`);
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

    console.log(`\n📊 Summary: ${processedFiles} processed, ${skippedFiles} skipped, ${failedFiles} failed, ${generatedQAs} Q&As generated`);

    await update('qaGenerationJobs', eq(schema.qaGenerationJobs.id, jobId), {
      processedFiles,
      generatedQAs,
    });

    const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`⏱️  Completed in ${elapsedTime}s`);

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

    console.log(`✅ Q&A generation ${finalStatus}: ${generatedQAs} Q&As from ${processedFiles} files`);
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

  const supportedExtensions = ['.md', '.txt', '.rst', '.pdf'];
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
  const model = options.model || DEFAULT_MODEL;

  const prompt = `Generate question-answer pairs from the following content. Return a JSON array of Q&A objects.

Each Q&A should have:
- question: A clear, specific question
- answer: A concise, accurate answer
- tags: Array of relevant tags

Content:
${chunk}

Return ONLY valid JSON array, no other text.`;

  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        prompt,
        stream: false,
        options: {
          temperature: 0.7,
          top_p: 0.9,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.statusText}`);
    }

    const data = await response.json();
    const qas = JSON.parse(data.response);

    return qas.map((qa: any) => ({
      question: qa.question,
      answer: qa.answer,
      category,
      tags: qa.tags || [],
      confidence: 0.8,
      sourceFile: filePath,
    }));
  } catch (error) {
    logger.error(`Error calling Ollama API:`, error);
    return [];
  }
}
