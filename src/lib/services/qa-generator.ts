
/**
 * Q&A Generator Service
 * Automatically generates question-answer pairs from repository files and documentation
 * OPTIMIZED: Increased timeout to 180s, added parallel processing with concurrency control
 */

import fs from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
const DEFAULT_MODEL = 'phi3:mini'; // OPTIMIZED: Changed to faster model
const FALLBACK_MODEL = 'llama3.2:3b'; // Fallback if phi3:mini not available
const QA_GENERATION_TIMEOUT = 180000; // OPTIMIZED: Increased from 60s to 180s
const MAX_CONCURRENT_FILES = 5; // OPTIMIZED: Process up to 5 files in parallel

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
        console.log(`[${index + 1}/${files.length}] Processing: ${file}`);
        
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
    processedFiles = results.length;
    generatedQAs = results.reduce((sum, r) => sum + r.qas.length, 0);

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
 * Generate Q&As from a single file with optimized timeout
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

    // Prepare prompt for Ollama
    const prompt = `Analyze the following document and generate 3-5 high-quality question-answer pairs that would be useful for a chatbot assistant.

Document: ${fileName}
Content:
${content.substring(0, 4000)}

Generate Q&A pairs in JSON format:
{
  "qas": [
    {
      "question": "Clear, specific question",
      "answer": "Detailed, accurate answer",
      "category": "technical|operational|troubleshooting|general",
      "tags": ["tag1", "tag2"],
      "confidence": 0.8
    }
  ]
}

Focus on practical, actionable information. Ensure answers are complete and self-contained.`;

    // OPTIMIZED: Call Ollama API with 180s timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), QA_GENERATION_TIMEOUT);

    try {
      const response = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: options.model || DEFAULT_MODEL,
          prompt,
          stream: false,
          options: {
            temperature: 0.7,
            top_p: 0.9,
          },
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Ollama API error for ${fileName}:`, response.status, errorText);
        
        // OPTIMIZED: Try fallback model if primary fails
        if (options.model === DEFAULT_MODEL) {
          console.log(`Retrying with fallback model: ${FALLBACK_MODEL}`);
          return generateQAsFromFile(filePath, { ...options, model: FALLBACK_MODEL });
        }
        
        throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      if (!data.response) {
        console.error(`Invalid Ollama response structure for ${fileName}:`, data);
        throw new Error('Invalid response structure from Ollama');
      }

      // Parse the generated Q&As
      const qas = parseGeneratedQAs(data.response, fileName);
      return qas;
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`Q&A generation timed out after ${QA_GENERATION_TIMEOUT / 1000}s for ${fileName}`);
      }
      throw error;
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes('ECONNREFUSED')) {
      console.error(`Cannot connect to Ollama at ${OLLAMA_BASE_URL} for ${filePath}`);
      throw new Error('Ollama service is not running or not accessible');
    }
    throw error;
  }
}

/**
 * Parse generated Q&As from Ollama response
 */
function parseGeneratedQAs(response: string, sourceFile: string): GeneratedQA[] {
  try {
    // Try to extract JSON from the response
    const jsonMatch = response.match(/\{[\s\S]*"qas"[\s\S]*\}/);
    if (!jsonMatch) {
      console.warn(`No JSON found in response for ${sourceFile}`);
      return [];
    }

    const parsed = JSON.parse(jsonMatch[0]);
    
    if (!parsed.qas || !Array.isArray(parsed.qas)) {
      console.warn(`Invalid Q&A structure for ${sourceFile}`);
      return [];
    }

    return parsed.qas.map((qa: any) => ({
      question: qa.question || '',
      answer: qa.answer || '',
      category: qa.category || 'general',
      tags: Array.isArray(qa.tags) ? qa.tags : [],
      confidence: typeof qa.confidence === 'number' ? qa.confidence : 0.7,
      sourceFile,
    })).filter((qa: GeneratedQA) => qa.question && qa.answer);
  } catch (error) {
    console.error(`Error parsing Q&As for ${sourceFile}:`, error);
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
