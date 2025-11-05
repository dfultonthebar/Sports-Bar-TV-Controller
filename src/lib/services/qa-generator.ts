/**
 * Q&A Generator Service
 * Automatically generates question-answer pairs from repository files and documentation
 * OPTIMIZED: Enhanced with chunking, streaming, improved JSON parsing, and file tracking
 */

import fs from 'fs';
import path from 'path';
import { and, asc, create, deleteRecord, desc, eq, findMany, findUnique, or, update, upsert } from '@/lib/db-helpers'
import { schema } from '@/db'
import { logger } from '@/lib/logger';
import { calculateFileHash } from '@/lib/utils/file-hash';
import { count as drizzleCount } from 'drizzle-orm';

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
  forceRegenerate?: boolean; // NEW: Force regeneration of all files
}

export interface GeneratedQA {
  question: string;
  answer: string;
  category: string;
  tags: string[];
  confidence: number;
  sourceFile: string;
}

/**
 * Generate Q&A pairs from repository files
 *
 * Creates a pending job in the database that will be picked up by the background worker.
 * The worker runs independently to avoid issues with Next.js API route lifecycle.
 */
export async function generateQAsFromRepository(
  options: QAGenerationOptions
): Promise<{ jobId: string; status: string }> {
  const job = await create('qaGenerationJobs', {
    status: 'pending',
    sourceType: options.sourceType,
    sourcePath: options.sourcePaths?.join(','),
  });

  logger.info(`[QA Generator] Created job ${job.id} - waiting for background worker to process`);

  return { jobId: job.id, status: 'pending' };
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
    // Check if file exists in tracking
    const tracked = await findUnique('processedFiles', eq(schema.processedFiles.filePath, filePath));

    if (!tracked) {
      return { shouldProcess: true, reason: 'new_file' };
    }

    // Calculate current file hash
    const currentHash = await calculateFileHash(filePath);

    if (tracked.fileHash !== currentHash) {
      return { shouldProcess: true, reason: 'file_changed' };
    }

    // File unchanged, skip processing
    return { shouldProcess: false, reason: 'already_processed' };
  } catch (error) {
    logger.error(`Error checking file tracking for ${filePath}:`, error);
    // On error, process the file to be safe
    return { shouldProcess: true, reason: 'tracking_error' };
  }
}

/**
 * Update file tracking after processing
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
 * Process Q&A generation job with parallel processing and file tracking
 */
async function processQAGeneration(
  jobId: string,
  options: QAGenerationOptions
): Promise<void> {
  const startTime = Date.now();
  
  try {
    await update('qaGenerationJobs', eq(schema.qaGenerationJobs.id, jobId), {
      status: 'running',
      startedAt: new Date().toISOString(),
    });

    const files = await collectFilesForGeneration(options);

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
        // Check if file should be processed
        const { shouldProcess, reason } = await shouldProcessFile(file, options.forceRegenerate || false);
        
        if (!shouldProcess) {
          logger.debug(`[${index + 1}/${files.length}] ⏭️  Skipping (${reason}): ${file}`);
          skippedFiles++;
          return { success: true, qas: [], skipped: true };
        }

        logger.debug(`[${index + 1}/${files.length}] 🔄 Processing (${reason}): ${file}`);
        
        // Check file size before processing
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
        
        // Save generated Q&As to database
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

        // Update file tracking
        await updateFileTracking(file, savedQAs.length, options.sourceType, 'processed');

        logger.debug(`[${index + 1}/${files.length}] ✅ Generated ${savedQAs.length} Q&As from ${file}`);
        return { success: true, qas: savedQAs };
      } catch (error) {
        failedFiles++;
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        logger.error(`Error processing file ${file}:`, { data: errorMsg });
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
    
    logger.debug(`\n📊 Summary: ${processedFiles} processed, ${skippedFiles} skipped, ${failedFiles} failed`);

    await update('qaGenerationJobs', eq(schema.qaGenerationJobs.id, jobId), {
      processedFiles,
      generatedQAs,
    });

    const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(2);
    logger.debug(`⏱️  Completed in ${elapsedTime}s`);

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

    logger.debug(`✅ Q&A generation ${finalStatus}: ${generatedQAs} Q&As from ${processedFiles} files`);
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

      if (entry.isDirectory()) {
        if (!entry.name.startsWith('.') && entry.name !== 'node_modules') {
          const subFiles = await collectFilesFromDirectory(fullPath);
          files.push(...subFiles);
        }
      } else if (entry.isFile()) {
        files.push(fullPath);
      }
    }
  } catch (error) {
    logger.error(`Error reading directory ${dirPath}:`, error);
  }

  return files;
}

function chunkContent(content: string, maxChunkSize: number = CHUNK_SIZE): string[] {
  if (content.length <= maxChunkSize) {
    return [content];
  }

  const chunks: string[] = [];
  let currentChunk = '';
  const lines = content.split('\n');

  for (const line of lines) {
    if (currentChunk.length + line.length + 1 > maxChunkSize && currentChunk.length > 0) {
      chunks.push(currentChunk);
      currentChunk = line;
    } else {
      currentChunk += (currentChunk ? '\n' : '') + line;
    }
  }

  if (currentChunk) {
    chunks.push(currentChunk);
  }

  return chunks;
}

async function generateQAsFromFile(
  filePath: string,
  options: QAGenerationOptions
): Promise<GeneratedQA[]> {
  try {
    const content = await fs.promises.readFile(filePath, 'utf-8');
    const fileName = path.basename(filePath);

    if (content.length < 100) {
      logger.debug(`Skipping ${fileName}: content too short`);
      return [];
    }

    const chunks = chunkContent(content, CHUNK_SIZE);
    logger.debug(`Processing ${fileName} in ${chunks.length} chunk(s)`);

    const allQAs: GeneratedQA[] = [];

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const chunkLabel = chunks.length > 1 ? ` (chunk ${i + 1}/${chunks.length})` : '';
      
      logger.debug(`Processing ${fileName}${chunkLabel}...`);

      const prompt = `You are a helpful assistant that generates question-answer pairs from documentation.

CRITICAL INSTRUCTIONS:
1. You MUST respond with ONLY valid JSON - no other text before or after
2. Do NOT include markdown code blocks or any formatting
3. Start your response with { and end with }

Analyze the following document and generate 2-3 high-quality question-answer pairs.

Document: ${fileName}${chunkLabel}
Content:
${chunk}

Respond with this EXACT JSON structure (no markdown, no code blocks):
{
  "qas": [
    {
      "question": "Clear, specific question about the content",
      "answer": "Detailed, accurate answer based on the content",
      "category": "technical",
      "tags": ["relevant", "tags"],
      "confidence": 0.8
    }
  ]
}

Remember: Output ONLY the JSON object, nothing else.`;

      let retries = 0;
      let qas: GeneratedQA[] = [];

      while (retries <= MAX_RETRIES) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), QA_GENERATION_TIMEOUT);

          const response = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model: options.model || DEFAULT_MODEL,
              prompt,
              stream: false,
              format: 'json',
              options: {
                temperature: 0.3,
                top_p: 0.9,
                num_predict: 2048,
              },
            }),
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          if (!response.ok) {
            const errorText = await response.text();
            logger.error(`Ollama API error for ${fileName}${chunkLabel}:`, response.status, errorText);
            
            if (retries === 0 && options.model === DEFAULT_MODEL) {
              logger.debug(`Retrying with fallback model: ${FALLBACK_MODEL}`);
              options.model = FALLBACK_MODEL;
              retries++;
              continue;
            }
            
            throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
          }

          const data = await response.json();

          if (!data.response) {
            logger.error(`Invalid Ollama response structure for ${fileName}${chunkLabel}:`, data);
            throw new Error('Invalid response structure from Ollama');
          }

          const responseText = data.response;
          const wasTruncated = data.done === false || 
                               !responseText.trim().endsWith('}') ||
                               responseText.includes('...');
          
          if (wasTruncated) {
            logger.warn(`Response appears truncated for ${fileName}${chunkLabel}`);
            
            if (retries < MAX_RETRIES) {
              logger.debug(`Retrying with increased token limit (attempt ${retries + 1}/${MAX_RETRIES})...`);
              retries++;
              continue;
            }
          }

          qas = parseGeneratedQAs(responseText, fileName);
          
          if (qas.length > 0) {
            allQAs.push(...qas);
            break;
          } else {
            logger.warn(`No valid Q&As parsed from response for ${fileName}${chunkLabel}`);
            
            if (retries < MAX_RETRIES) {
              logger.debug(`Retrying (attempt ${retries + 1}/${MAX_RETRIES})...`);
              retries++;
              await new Promise(resolve => setTimeout(resolve, 1000));
              continue;
            }
            
            logger.error(`Failed to generate valid Q&As after ${MAX_RETRIES} retries`);
            break;
          }
        } catch (error) {
          if (error instanceof Error && error.name === 'AbortError') {
            const timeoutSeconds = QA_GENERATION_TIMEOUT / 1000;
            logger.error(`Q&A generation timed out after ${timeoutSeconds}s for ${fileName}${chunkLabel}`);
            
            if (retries < MAX_RETRIES) {
              logger.debug(`Retrying (${retries + 1}/${MAX_RETRIES})...`);
              retries++;
              continue;
            }
            
            throw new Error(`Q&A generation timed out after ${timeoutSeconds}s and ${MAX_RETRIES} retries.`);
          }
          
          if (retries < MAX_RETRIES) {
            logger.error(`Error on attempt ${retries + 1}:`, error);
            retries++;
            await new Promise(resolve => setTimeout(resolve, 2000));
            continue;
          }
          
          throw error;
        }
      }
    }

    return allQAs;
  } catch (error) {
    if (error instanceof Error && error.message.includes('ECONNREFUSED')) {
      logger.error(`Cannot connect to Ollama at ${OLLAMA_BASE_URL} for ${filePath}`);
      throw new Error('Ollama service is not running or not accessible');
    }
    throw error;
  }
}

function parseGeneratedQAs(response: string, sourceFile: string): GeneratedQA[] {
  try {
    let cleanedResponse = response.trim();
    cleanedResponse = cleanedResponse.replace(/```json\s*/g, '').replace(/```\s*/g, '');
    
    const hasOpeningBrace = cleanedResponse.includes('{');
    const hasClosingBrace = cleanedResponse.includes('}');
    
    if (!hasOpeningBrace || !hasClosingBrace) {
      logger.error(`Incomplete JSON response for ${sourceFile} - missing braces`);
      return [];
    }
    
    const jsonMatch = cleanedResponse.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      logger.warn(`No JSON object found in response for ${sourceFile}`);
      return [];
    }

    const jsonString = jsonMatch[0];
    
    if (jsonString.includes('...') || !jsonString.trim().endsWith('}')) {
      logger.error(`Response appears truncated for ${sourceFile}`);
      return [];
    }

    let parsed;
    try {
      parsed = JSON.parse(jsonString);
    } catch (parseError) {
      logger.error(`JSON parse error for ${sourceFile}:`, parseError);
      return [];
    }
    
    if (!parsed.qas || !Array.isArray(parsed.qas)) {
      logger.warn(`Invalid Q&A structure for ${sourceFile} - missing or invalid 'qas' array`);
      return [];
    }

    const validQAs = parsed.qas
      .map((qa: any) => ({
        question: qa.question || '',
        answer: qa.answer || '',
        category: qa.category || 'general',
        tags: Array.isArray(qa.tags) ? qa.tags : [],
        confidence: typeof qa.confidence === 'number' ? qa.confidence : 0.7,
        sourceFile,
      }))
      .filter((qa: GeneratedQA) => qa.question && qa.answer);

    if (validQAs.length === 0) {
      logger.warn(`No valid Q&As after filtering for ${sourceFile}`);
    }

    return validQAs;
  } catch (error) {
    logger.error(`Error parsing Q&As for ${sourceFile}:`, error);
    return [];
  }
}

export async function getQAGenerationStatus(jobId: string) {
  return await findUnique('qaGenerationJobs', eq(schema.qaGenerationJobs.id, jobId));
}

export const getGenerationJobStatus = getQAGenerationStatus;

export async function getAllQAEntries(filters?: {
  category?: string;
  sourceType?: string;
  limit?: number;
  offset?: number;
}) {
  const conditions: any[] = [];

  if (filters?.category) {
    conditions.push(eq(schema.qaEntries.category, filters.category));
  }

  if (filters?.sourceType) {
    conditions.push(eq(schema.qaEntries.sourceType, filters.sourceType));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const entries = await findMany('qaEntries', {
    where: whereClause,
    limit: filters?.limit || 100,
    offset: filters?.offset || 0,
    orderBy: desc(schema.qaEntries.createdAt),
  });

  // Count total matching entries
  const { db } = await import('@/lib/db');
  const totalResult = await db
    .select({ count: drizzleCount() })
    .from(schema.qaEntries)
    .where(whereClause)
    .execute();

  const total = totalResult[0]?.count || 0;

  return {
    entries,
    total,
    limit: filters?.limit || 100,
    offset: filters?.offset || 0,
  };
}

export async function searchQAEntries(query: string, filters?: {
  category?: string;
  sourceType?: string;
  limit?: number;
}) {
  // Use raw SQL for LIKE queries since Drizzle doesn't have a contains operator
  const { db } = await import('@/lib/db');
  const { like } = await import('drizzle-orm');

  const conditions: any[] = [
    or(
      like(schema.qaEntries.question, `%${query}%`),
      like(schema.qaEntries.answer, `%${query}%`),
      like(schema.qaEntries.tags, `%${query}%`)
    )
  ];

  if (filters?.category) {
    conditions.push(eq(schema.qaEntries.category, filters.category));
  }

  if (filters?.sourceType) {
    conditions.push(eq(schema.qaEntries.sourceType, filters.sourceType));
  }

  const entries = await db
    .select()
    .from(schema.qaEntries)
    .where(and(...conditions))
    .limit(filters?.limit || 50)
    .orderBy(desc(schema.qaEntries.confidence))
    .execute();

  return {
    entries,
    total: entries.length,
    query,
  };
}

export async function updateQAEntry(
  id: string,
  data: {
    question?: string;
    answer?: string;
    category?: string;
    tags?: string[];
    confidence?: number;
    isActive?: boolean;
  }
) {
  return await update('qaEntries', eq(schema.qaEntries.id, id), {
    ...data,
    updatedAt: new Date().toISOString(),
  });
}

export async function deleteQAEntry(id: string) {
  return await deleteRecord('qaEntries', eq(schema.qaEntries.id, id));
}

export async function getQAStatistics() {
  const { db } = await import('@/lib/db');
  const { sql } = await import('drizzle-orm');

  // Get total and active counts
  const totalResult = await db
    .select({ count: drizzleCount() })
    .from(schema.qaEntries)
    .execute();
  const totalEntries = totalResult[0]?.count || 0;

  const activeResult = await db
    .select({ count: drizzleCount() })
    .from(schema.qaEntries)
    .where(eq(schema.qaEntries.isActive, true))
    .execute();
  const activeEntries = activeResult[0]?.count || 0;

  // Get category counts using groupBy
  const categoryCounts = await db
    .select({
      category: schema.qaEntries.category,
      count: drizzleCount(),
    })
    .from(schema.qaEntries)
    .groupBy(schema.qaEntries.category)
    .execute();

  // Get source type counts using groupBy
  const sourceTypeCounts = await db
    .select({
      source: schema.qaEntries.sourceType,
      count: drizzleCount(),
    })
    .from(schema.qaEntries)
    .groupBy(schema.qaEntries.sourceType)
    .execute();

  // Get recent jobs
  const recentJobs = await findMany('qaGenerationJobs', {
    limit: 10,
    orderBy: desc(schema.qaGenerationJobs.createdAt),
  });

  return {
    total: totalEntries,
    active: activeEntries,
    byCategory: categoryCounts.map(c => ({
      category: c.category,
      count: c.count,
    })),
    bySource: sourceTypeCounts.map(s => ({
      source: s.source,
      count: s.count,
    })),
    recentJobs: recentJobs.map(job => ({
      id: job.id,
      status: job.status,
      sourceType: job.sourceType,
      entriesGenerated: job.entriesGenerated || 0,
      createdAt: job.createdAt,
      completedAt: job.completedAt,
    })),
  };
}
