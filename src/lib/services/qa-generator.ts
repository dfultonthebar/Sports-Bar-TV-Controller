

/**
 * Q&A Generator Service
 * Automatically generates question-answer pairs from repository files and documentation
 * OPTIMIZED: Enhanced with chunking, streaming, and improved JSON parsing
 */

import fs from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
const DEFAULT_MODEL = 'phi3:mini'; // OPTIMIZED: Changed to faster model
const FALLBACK_MODEL = 'llama3.2:3b'; // Fallback if phi3:mini not available
const QA_GENERATION_TIMEOUT = 600000; // OPTIMIZED: Increased to 600s (10 minutes) for large files
const MAX_CONCURRENT_FILES = 2; // OPTIMIZED: Reduced to 2 to prevent Ollama overload
const MAX_FILE_SIZE_MB = 2; // OPTIMIZED: Reduced to 2MB to prevent timeouts
const CHUNK_SIZE = 3000; // Characters per chunk for large files
const MAX_RETRIES = 2; // Number of retries for failed requests

export interface QAGenerationOptions {
  sourceType: 'repository' | 'documentation' | 'codebase';
  sourcePaths?: string[];
  categories?: string[];
  maxQAsPerFile?: number;
  model?: string;
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
 */
export async function generateQAsFromRepository(
  options: QAGenerationOptions
): Promise<{ jobId: string; status: string }> {
  // Create a generation job
  const job = await prisma.qAGenerationJob.create({
    data: {
      status: 'pending',
      sourceType: options.sourceType,
      sourcePath: options.sourcePaths?.join(','),
    },
  });

  // Start generation in background (don't await)
  processQAGeneration(job.id, options).catch(error => {
    console.error('Q&A generation failed:', error);
    prisma.qAGenerationJob.update({
      where: { id: job.id },
      data: {
        status: 'failed',
        errorMessage: error.message,
        completedAt: new Date(),
      },
    }).catch(console.error);
  });

  return { jobId: job.id, status: 'started' };
}

/**
 * OPTIMIZED: Concurrency limiter for parallel processing
 */
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
 * Process Q&A generation job with parallel processing
 */
async function processQAGeneration(
  jobId: string,
  options: QAGenerationOptions
): Promise<void> {
  const startTime = Date.now();
  
  try {
    await prisma.qAGenerationJob.update({
      where: { id: jobId },
      data: { status: 'running', startedAt: new Date() },
    });

    const files = await collectFilesForGeneration(options);
    
    console.log(`Starting Q&A generation for ${files.length} files with ${MAX_CONCURRENT_FILES} concurrent workers`);
    
    await prisma.qAGenerationJob.update({
      where: { id: jobId },
      data: { totalFiles: files.length },
    });

    if (files.length === 0) {
      throw new Error('No files found for Q&A generation');
    }

    let processedFiles = 0;
    let generatedQAs = 0;
    let failedFiles = 0;
    const errors: string[] = [];

    // OPTIMIZED: Use concurrency limiter for parallel processing
    const limiter = new ConcurrencyLimiter(MAX_CONCURRENT_FILES);
    
    const processFile = async (file: string, index: number) => {
      try {
        // Check if file has already been processed (has Q&As in database)
        const existingQAs = await prisma.qAEntry.findFirst({
          where: { sourceFile: file },
        });
        
        if (existingQAs) {
          console.log(`[${index + 1}/${files.length}] Skipping already processed file: ${file}`);
          return { success: true, qas: [], skipped: true };
        }
        
        // Check file size before processing
        const stats = fs.statSync(file);
        const fileSizeMB = stats.size / (1024 * 1024);
        
        if (fileSizeMB > MAX_FILE_SIZE_MB) {
          console.warn(`[${index + 1}/${files.length}] Skipping large file (${fileSizeMB.toFixed(2)}MB): ${file}`);
          errors.push(`${file}: File too large (${fileSizeMB.toFixed(2)}MB), skipped to prevent timeout`);
          failedFiles++;
          return { success: false, qas: [] };
        }
        
        console.log(`[${index + 1}/${files.length}] Processing (${fileSizeMB.toFixed(2)}MB): ${file}`);
        
        const qas = await generateQAsFromFile(file, options);
        
        if (qas.length === 0) {
          failedFiles++;
          console.warn(`No Q&As generated for ${file}`);
          return { success: false, qas: [] };
        }
        
        // Save generated Q&As to database
        const savedQAs = [];
        for (const qa of qas) {
          try {
            await prisma.qAEntry.create({
              data: {
                question: qa.question,
                answer: qa.answer,
                category: qa.category,
                tags: JSON.stringify(qa.tags),
                sourceType: 'auto-generated',
                sourceFile: qa.sourceFile,
                confidence: qa.confidence,
              },
            });
            savedQAs.push(qa);
          } catch (dbError) {
            console.error(`Error saving Q&A to database:`, dbError);
            errors.push(`DB error for ${file}: ${dbError instanceof Error ? dbError.message : 'Unknown'}`);
          }
        }

        console.log(`[${index + 1}/${files.length}] Generated ${savedQAs.length} Q&As from ${file}`);
        return { success: true, qas: savedQAs };
      } catch (error) {
        failedFiles++;
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        console.error(`Error processing file ${file}:`, errorMsg);
        errors.push(`${file}: ${errorMsg}`);
        return { success: false, qas: [] };
      }
    };

    // OPTIMIZED: Process files in parallel with concurrency control
    const results = await Promise.all(
      files.map((file, index) => 
        limiter.run(() => processFile(file, index))
      )
    );

    // Aggregate results
    const skippedFiles = results.filter(r => r.skipped).length;
    processedFiles = results.length - skippedFiles;
    generatedQAs = results.reduce((sum, r) => sum + r.qas.length, 0);
    
    console.log(`Summary: ${processedFiles} processed, ${skippedFiles} skipped (already processed), ${failedFiles} failed`);

    // Update progress
    await prisma.qAGenerationJob.update({
      where: { id: jobId },
      data: { processedFiles, generatedQAs },
    });

    const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`Completed: ${processedFiles} files, ${generatedQAs} Q&As in ${elapsedTime}s`);

    // Final update
    const finalStatus = generatedQAs > 0 ? 'completed' : 'failed';
    const errorMessage = errors.length > 0 
      ? `Generated ${generatedQAs} Q&As from ${processedFiles - failedFiles}/${processedFiles} files. Errors: ${errors.slice(0, 3).join('; ')}${errors.length > 3 ? '...' : ''}`
      : undefined;

    await prisma.qAGenerationJob.update({
      where: { id: jobId },
      data: {
        status: finalStatus,
        processedFiles,
        generatedQAs,
        errorMessage,
        completedAt: new Date(),
      },
    });

    console.log(`Q&A generation ${finalStatus}: ${generatedQAs} Q&As from ${processedFiles} files`);
  } catch (error) {
    console.error('Q&A generation process failed:', error);
    await prisma.qAGenerationJob.update({
      where: { id: jobId },
      data: {
        status: 'failed',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        completedAt: new Date(),
      },
    });
    throw error;
  }
}

/**
 * Collect files for Q&A generation based on options
 */
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
        console.error(`Error accessing path ${fullPath}:`, error);
      }
    }
  } else {
    // Default: scan common documentation directories
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

  // Filter for supported file types
  const supportedExtensions = ['.md', '.txt', '.rst', '.pdf'];
  return files.filter(file => 
    supportedExtensions.some(ext => file.toLowerCase().endsWith(ext))
  );
}

/**
 * Recursively collect files from a directory
 */
async function collectFilesFromDirectory(dirPath: string): Promise<string[]> {
  const files: string[] = [];

  try {
    const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);

      if (entry.isDirectory()) {
        // Skip node_modules and hidden directories
        if (!entry.name.startsWith('.') && entry.name !== 'node_modules') {
          const subFiles = await collectFilesFromDirectory(fullPath);
          files.push(...subFiles);
        }
      } else if (entry.isFile()) {
        files.push(fullPath);
      }
    }
  } catch (error) {
    console.error(`Error reading directory ${dirPath}:`, error);
  }

  return files;
}

/**
 * NEW: Chunk large content into smaller pieces
 */
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

/**
 * Generate Q&As from a single file with optimized timeout and chunking
 */
async function generateQAsFromFile(
  filePath: string,
  options: QAGenerationOptions
): Promise<GeneratedQA[]> {
  try {
    // Read file content
    const content = await fs.promises.readFile(filePath, 'utf-8');
    const fileName = path.basename(filePath);

    if (content.length < 100) {
      console.log(`Skipping ${fileName}: content too short`);
      return [];
    }

    // NEW: Chunk large files to prevent timeouts
    const chunks = chunkContent(content, CHUNK_SIZE);
    console.log(`Processing ${fileName} in ${chunks.length} chunk(s)`);

    const allQAs: GeneratedQA[] = [];

    // Process each chunk
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const chunkLabel = chunks.length > 1 ? ` (chunk ${i + 1}/${chunks.length})` : '';
      
      console.log(`Processing ${fileName}${chunkLabel}...`);

      // Prepare improved prompt with explicit JSON instructions
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

      // Call Ollama API with retry logic
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
              format: 'json', // NEW: Enforce JSON format
              options: {
                temperature: 0.3, // OPTIMIZED: Lower temperature for more consistent JSON
                top_p: 0.9,
                num_predict: 2048, // FIXED: Increased from 1000 to prevent truncation
              },
            }),
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          if (!response.ok) {
            const errorText = await response.text();
            console.error(`Ollama API error for ${fileName}${chunkLabel}:`, response.status, errorText);
            
            // Try fallback model on first retry
            if (retries === 0 && options.model === DEFAULT_MODEL) {
              console.log(`Retrying with fallback model: ${FALLBACK_MODEL}`);
              options.model = FALLBACK_MODEL;
              retries++;
              continue;
            }
            
            throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
          }

          const data = await response.json();

          if (!data.response) {
            console.error(`Invalid Ollama response structure for ${fileName}${chunkLabel}:`, data);
            throw new Error('Invalid response structure from Ollama');
          }

          // FIXED: Check if response was truncated by Ollama
          const responseText = data.response;
          const wasTruncated = data.done === false || 
                               !responseText.trim().endsWith('}') ||
                               responseText.includes('...');
          
          if (wasTruncated) {
            console.warn(`Response appears truncated for ${fileName}${chunkLabel}`);
            console.warn(`Response length: ${responseText.length} chars`);
            console.warn(`Response end: ...${responseText.substring(Math.max(0, responseText.length - 100))}`);
            
            if (retries < MAX_RETRIES) {
              console.log(`Retrying with increased token limit (attempt ${retries + 1}/${MAX_RETRIES})...`);
              retries++;
              continue;
            }
          }

          // Parse the generated Q&As with improved error handling
          qas = parseGeneratedQAs(responseText, fileName);
          
          if (qas.length > 0) {
            allQAs.push(...qas);
            break; // Success, exit retry loop
          } else {
            console.warn(`No valid Q&As parsed from response for ${fileName}${chunkLabel}`);
            
            if (retries < MAX_RETRIES) {
              console.log(`Retrying (attempt ${retries + 1}/${MAX_RETRIES})...`);
              retries++;
              await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1s before retry
              continue;
            }
            
            console.error(`Failed to generate valid Q&As after ${MAX_RETRIES} retries`);
            break;
          }
        } catch (error) {
          if (error instanceof Error && error.name === 'AbortError') {
            const timeoutSeconds = QA_GENERATION_TIMEOUT / 1000;
            console.error(`Q&A generation timed out after ${timeoutSeconds}s for ${fileName}${chunkLabel}`);
            
            if (retries < MAX_RETRIES) {
              console.log(`Retrying (${retries + 1}/${MAX_RETRIES})...`);
              retries++;
              continue;
            }
            
            throw new Error(`Q&A generation timed out after ${timeoutSeconds}s and ${MAX_RETRIES} retries. Consider reducing file size or increasing timeout.`);
          }
          
          if (retries < MAX_RETRIES) {
            console.error(`Error on attempt ${retries + 1}:`, error);
            retries++;
            await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2s before retry
            continue;
          }
          
          throw error;
        }
      }
    }

    return allQAs;
  } catch (error) {
    if (error instanceof Error && error.message.includes('ECONNREFUSED')) {
      console.error(`Cannot connect to Ollama at ${OLLAMA_BASE_URL} for ${filePath}`);
      throw new Error('Ollama service is not running or not accessible');
    }
    throw error;
  }
}

/**
 * Parse generated Q&As from Ollama response with improved error handling
 */
function parseGeneratedQAs(response: string, sourceFile: string): GeneratedQA[] {
  try {
    // Clean the response - remove markdown code blocks if present
    let cleanedResponse = response.trim();
    
    // Remove markdown code blocks
    cleanedResponse = cleanedResponse.replace(/```json\s*/g, '').replace(/```\s*/g, '');
    
    // FIXED: Validate JSON completeness before parsing
    // Check if response appears truncated (doesn't end with proper closing)
    const hasOpeningBrace = cleanedResponse.includes('{');
    const hasClosingBrace = cleanedResponse.includes('}');
    
    if (!hasOpeningBrace || !hasClosingBrace) {
      console.error(`Incomplete JSON response for ${sourceFile} - missing braces`);
      console.error(`Response preview: ${response.substring(0, 300)}...`);
      console.error(`Response end: ...${response.substring(Math.max(0, response.length - 100))}`);
      return [];
    }
    
    // Try to find JSON object in the response
    const jsonMatch = cleanedResponse.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.warn(`No JSON object found in response for ${sourceFile}`);
      console.warn(`Response preview: ${response.substring(0, 200)}...`);
      return [];
    }

    const jsonString = jsonMatch[0];
    
    // FIXED: Additional validation - check for truncation indicators
    if (jsonString.includes('...') || !jsonString.trim().endsWith('}')) {
      console.error(`Response appears truncated for ${sourceFile}`);
      console.error(`JSON end: ...${jsonString.substring(Math.max(0, jsonString.length - 150))}`);
      return [];
    }

    let parsed;
    try {
      parsed = JSON.parse(jsonString);
    } catch (parseError) {
      console.error(`JSON parse error for ${sourceFile}:`, parseError);
      console.error(`Attempted to parse (first 300 chars): ${jsonString.substring(0, 300)}...`);
      console.error(`Attempted to parse (last 300 chars): ...${jsonString.substring(Math.max(0, jsonString.length - 300))}`);
      
      // FIXED: Log the exact position where parsing failed
      if (parseError instanceof SyntaxError) {
        const match = parseError.message.match(/position (\d+)/);
        if (match) {
          const position = parseInt(match[1]);
          const contextStart = Math.max(0, position - 100);
          const contextEnd = Math.min(jsonString.length, position + 100);
          console.error(`Parse error context: ...${jsonString.substring(contextStart, contextEnd)}...`);
        }
      }
      return [];
    }
    
    if (!parsed.qas || !Array.isArray(parsed.qas)) {
      console.warn(`Invalid Q&A structure for ${sourceFile} - missing or invalid 'qas' array`);
      console.warn(`Parsed structure:`, JSON.stringify(parsed).substring(0, 200));
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
      console.warn(`No valid Q&As after filtering for ${sourceFile}`);
    }

    return validQAs;
  } catch (error) {
    console.error(`Error parsing Q&As for ${sourceFile}:`, error);
    console.error(`Response that failed to parse (first 300): ${response.substring(0, 300)}...`);
    console.error(`Response that failed to parse (last 300): ...${response.substring(Math.max(0, response.length - 300))}`);
    return [];
  }
}

/**
 * Get Q&A generation job status
 */
export async function getQAGenerationStatus(jobId: string) {
  return await prisma.qAGenerationJob.findUnique({
    where: { id: jobId },
  });
}

// Alias export for backward compatibility
export const getGenerationJobStatus = getQAGenerationStatus;

/**
 * Get all Q&A entries from the database
 */
export async function getAllQAEntries(filters?: {
  category?: string;
  sourceType?: string;
  limit?: number;
  offset?: number;
}) {
  const where: any = {};
  
  if (filters?.category) {
    where.category = filters.category;
  }
  
  if (filters?.sourceType) {
    where.sourceType = filters.sourceType;
  }

  const entries = await prisma.qAEntry.findMany({
    where,
    take: filters?.limit || 100,
    skip: filters?.offset || 0,
    orderBy: { createdAt: 'desc' },
  });

  const total = await prisma.qAEntry.count({ where });

  return {
    entries,
    total,
    limit: filters?.limit || 100,
    offset: filters?.offset || 0,
  };
}

/**
 * Search Q&A entries
 */
export async function searchQAEntries(query: string, filters?: {
  category?: string;
  sourceType?: string;
  limit?: number;
}) {
  const where: any = {
    OR: [
      { question: { contains: query } },
      { answer: { contains: query } },
      { tags: { has: query } },
    ],
  };

  if (filters?.category) {
    where.category = filters.category;
  }

  if (filters?.sourceType) {
    where.sourceType = filters.sourceType;
  }

  const entries = await prisma.qAEntry.findMany({
    where,
    take: filters?.limit || 50,
    orderBy: { confidence: 'desc' },
  });

  return {
    entries,
    total: entries.length,
    query,
  };
}

/**
 * Update a Q&A entry
 */
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
  return await prisma.qAEntry.update({
    where: { id },
    data: {
      ...data,
      updatedAt: new Date(),
    },
  });
}

/**
 * Delete a Q&A entry
 */
export async function deleteQAEntry(id: string) {
  return await prisma.qAEntry.delete({
    where: { id },
  });
}

/**
 * Get Q&A statistics
 */
export async function getQAStatistics() {
  const [
    totalEntries,
    verifiedEntries,
    categoryCounts,
    sourceTypeCounts,
    recentJobs,
  ] = await Promise.all([
    prisma.qAEntry.count(),
    prisma.qAEntry.count({ where: { isActive: true } }),
    prisma.qAEntry.groupBy({
      by: ['category'],
      _count: true,
    }),
    prisma.qAEntry.groupBy({
      by: ['sourceType'],
      _count: true,
    }),
    prisma.qAGenerationJob.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  return {
    totalEntries,
    verifiedEntries,
    unverifiedEntries: totalEntries - verifiedEntries,
    categoryCounts: categoryCounts.map(c => ({
      category: c.category,
      count: c._count,
    })),
    sourceTypeCounts: sourceTypeCounts.map(s => ({
      sourceType: s.sourceType,
      count: s._count,
    })),
    recentJobs: recentJobs.map(job => ({
      id: job.id,
      status: job.status,
      sourceType: job.sourceType,
      entriesGenerated: job.entriesGenerated,
      createdAt: job.createdAt,
      completedAt: job.completedAt,
    })),
  };
}
