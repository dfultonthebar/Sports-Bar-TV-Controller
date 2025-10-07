

/**
 * Q&A Generator Service
 * Automatically generates question-answer pairs from repository files and documentation
 */

import fs from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
const DEFAULT_MODEL = 'llama3.2:3b';

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
 * Process Q&A generation job
 */
async function processQAGeneration(
  jobId: string,
  options: QAGenerationOptions
): Promise<void> {
  try {
    await prisma.qAGenerationJob.update({
      where: { id: jobId },
      data: { status: 'running', startedAt: new Date() },
    });

    const files = await collectFilesForGeneration(options);
    
    console.log(`Starting Q&A generation for ${files.length} files`);
    
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

    for (const file of files) {
      try {
        console.log(`Processing file ${processedFiles + 1}/${files.length}: ${file}`);
        
        const qas = await generateQAsFromFile(file, options);
        
        if (qas.length === 0) {
          failedFiles++;
          console.warn(`No Q&As generated for ${file}`);
        }
        
        // Save generated Q&As to database
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
            generatedQAs++;
          } catch (dbError) {
            console.error(`Error saving Q&A to database:`, dbError);
            errors.push(`DB error for ${file}: ${dbError instanceof Error ? dbError.message : 'Unknown'}`);
          }
        }

        processedFiles++;
        
        // Update job progress every 5 files or on last file
        if (processedFiles % 5 === 0 || processedFiles === files.length) {
          await prisma.qAGenerationJob.update({
            where: { id: jobId },
            data: { processedFiles, generatedQAs },
          });
          console.log(`Progress: ${processedFiles}/${files.length} files, ${generatedQAs} Q&As generated`);
        }
      } catch (error) {
        failedFiles++;
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        console.error(`Error processing file ${file}:`, errorMsg);
        errors.push(`${file}: ${errorMsg}`);
        processedFiles++;
      }
    }

    // Final update
    const finalStatus = generatedQAs > 0 ? 'completed' : 'failed';
    const errorMessage = errors.length > 0 
      ? `Generated ${generatedQAs} Q&As from ${processedFiles - failedFiles}/${processedFiles} files. Errors: ${errors.slice(0, 3).join('; ')}${errors.length > 3 ? '...' : ''}`
      : generatedQAs === 0 
        ? 'No Q&As were generated. Check Ollama connection and logs.'
        : null;

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

    console.log(`Q&A generation completed: ${generatedQAs} Q&As from ${processedFiles} files (${failedFiles} failed)`);
    
  } catch (error) {
    console.error('Fatal error in Q&A generation:', error);
    await prisma.qAGenerationJob.update({
      where: { id: jobId },
      data: {
        status: 'failed',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        completedAt: new Date(),
      },
    });
  }
}

/**
 * Collect files for Q&A generation
 */
async function collectFilesForGeneration(
  options: QAGenerationOptions
): Promise<string[]> {
  const files: string[] = [];
  const rootDir = process.cwd();

  if (options.sourceType === 'documentation') {
    // Collect documentation files
    const docsDir = path.join(rootDir, 'docs');
    if (fs.existsSync(docsDir)) {
      const docFiles = fs.readdirSync(docsDir)
        .filter(f => f.endsWith('.md'))
        .map(f => path.join(docsDir, f));
      files.push(...docFiles);
    }
  } else if (options.sourceType === 'codebase') {
    // Collect important code files
    const srcDir = path.join(rootDir, 'src');
    const codeFiles = collectCodeFiles(srcDir);
    files.push(...codeFiles);
  } else if (options.sourceType === 'repository') {
    // Collect both documentation and key code files
    const docsDir = path.join(rootDir, 'docs');
    if (fs.existsSync(docsDir)) {
      const docFiles = fs.readdirSync(docsDir)
        .filter(f => f.endsWith('.md'))
        .map(f => path.join(docsDir, f));
      files.push(...docFiles);
    }
    
    // Add README and other important files
    const importantFiles = ['README.md', 'INSTALLATION.md'];
    for (const file of importantFiles) {
      const filePath = path.join(rootDir, file);
      if (fs.existsSync(filePath)) {
        files.push(filePath);
      }
    }
  }

  return files;
}

/**
 * Recursively collect code files
 */
function collectCodeFiles(dir: string, files: string[] = []): string[] {
  if (!fs.existsSync(dir)) return files;

  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    
    if (entry.isDirectory()) {
      // Skip node_modules and other irrelevant directories
      if (!['node_modules', '.next', '.git', 'dist', 'build'].includes(entry.name)) {
        collectCodeFiles(fullPath, files);
      }
    } else if (entry.isFile()) {
      // Include TypeScript, JavaScript, and API route files
      if (entry.name.match(/\.(ts|tsx|js|jsx)$/) && 
          !entry.name.endsWith('.test.ts') &&
          !entry.name.endsWith('.spec.ts')) {
        files.push(fullPath);
      }
    }
  }

  return files;
}

/**
 * Generate Q&A pairs from a single file
 */
async function generateQAsFromFile(
  filePath: string,
  options: QAGenerationOptions
): Promise<GeneratedQA[]> {
  const content = fs.readFileSync(filePath, 'utf-8');
  const fileName = path.basename(filePath);
  const fileExt = path.extname(filePath);

  // Determine category based on file path and content
  const category = determineCategory(filePath, content);

  // Create prompt for Q&A generation
  const prompt = createQAGenerationPrompt(content, fileName, fileExt, category);

  try {
    // Call Ollama API to generate Q&As with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout

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
          num_predict: 2000,
        },
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Ollama API error for ${fileName}:`, response.status, errorText);
      throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    // Validate response structure
    if (!data || typeof data.response !== 'string') {
      console.error(`Invalid Ollama response structure for ${fileName}:`, data);
      throw new Error('Invalid response structure from Ollama');
    }

    const generatedText = data.response;
    
    // Log the raw response for debugging
    console.log(`Generated text for ${fileName} (first 500 chars):`, generatedText.substring(0, 500));

    // Parse the generated Q&As
    const qas = parseGeneratedQAs(generatedText, category, filePath);
    
    if (qas.length === 0) {
      console.warn(`No Q&As parsed from ${fileName}. Raw response:`, generatedText.substring(0, 1000));
    } else {
      console.log(`Successfully generated ${qas.length} Q&As from ${fileName}`);
    }
    
    return qas;
  } catch (error: any) {
    if (error.name === 'AbortError') {
      console.error(`Timeout generating Q&As for ${filePath}`);
    } else if (error.cause?.code === 'ECONNREFUSED') {
      console.error(`Cannot connect to Ollama at ${OLLAMA_BASE_URL} for ${filePath}`);
    } else {
      console.error(`Error generating Q&As for ${filePath}:`, error);
    }
    return [];
  }
}

/**
 * Determine category based on file path and content
 */
function determineCategory(filePath: string, content: string): string {
  const lowerPath = filePath.toLowerCase();
  const lowerContent = content.toLowerCase();

  if (lowerPath.includes('/api/') || lowerPath.includes('route.ts')) {
    return 'api';
  } else if (lowerPath.includes('docs/') || lowerPath.endsWith('.md')) {
    if (lowerContent.includes('installation') || lowerContent.includes('setup')) {
      return 'configuration';
    } else if (lowerContent.includes('troubleshoot') || lowerContent.includes('error')) {
      return 'troubleshooting';
    } else if (lowerContent.includes('feature') || lowerContent.includes('capability')) {
      return 'features';
    }
    return 'system';
  } else if (lowerPath.includes('/lib/') || lowerPath.includes('service')) {
    return 'system';
  } else if (lowerPath.includes('component')) {
    return 'features';
  }

  return 'general';
}

/**
 * Create prompt for Q&A generation
 */
function createQAGenerationPrompt(
  content: string,
  fileName: string,
  fileExt: string,
  category: string
): string {
  const contentPreview = content.length > 4000 ? content.substring(0, 4000) + '...' : content;

  return `You are an AI assistant creating training data for a Sports Bar TV Control System. Your task is to generate question-answer pairs in STRICT JSON format.

File: ${fileName}
Category: ${category}
Type: ${fileExt === '.md' ? 'documentation' : 'code'}

Content to analyze:
${contentPreview}

CRITICAL INSTRUCTIONS:
1. Generate EXACTLY 3-5 question-answer pairs
2. Return ONLY a valid JSON array, nothing else
3. No markdown code blocks, no explanations, no additional text
4. Each Q&A must have: question, answer, tags (array), confidence (number)

REQUIRED JSON FORMAT (copy this structure exactly):
[
  {
    "question": "What is the main purpose of this file?",
    "answer": "This file handles...",
    "tags": ["system", "architecture"],
    "confidence": 0.9
  },
  {
    "question": "How does this component work?",
    "answer": "The component works by...",
    "tags": ["features", "usage"],
    "confidence": 0.85
  }
]

Focus areas for questions:
- System architecture and design patterns
- API endpoints and their parameters
- Features and capabilities
- Configuration options and setup steps
- Common issues and troubleshooting
- Integration points and dependencies

Requirements:
- Questions must be clear and specific (minimum 15 characters)
- Answers must be detailed and accurate (minimum 30 characters)
- Use information ONLY from the provided content
- Make questions conversational and natural
- Answers should be comprehensive but concise

REMEMBER: Return ONLY the JSON array. Start with [ and end with ]. No other text.`;
}

/**
 * Parse generated Q&As from AI response
 */
function parseGeneratedQAs(
  generatedText: string,
  category: string,
  sourceFile: string
): GeneratedQA[] {
  try {
    // Try multiple parsing strategies
    
    // Strategy 1: Look for JSON array with flexible whitespace
    let jsonMatch = generatedText.match(/\[\s*\{[\s\S]*?\}\s*\]/);
    
    // Strategy 2: Look for JSON code block
    if (!jsonMatch) {
      const codeBlockMatch = generatedText.match(/```(?:json)?\s*(\[[\s\S]*?\])\s*```/);
      if (codeBlockMatch) {
        jsonMatch = [codeBlockMatch[1]];
      }
    }
    
    // Strategy 3: Look for any array-like structure
    if (!jsonMatch) {
      jsonMatch = generatedText.match(/\[[\s\S]*\]/);
    }
    
    if (!jsonMatch) {
      console.warn('No JSON array found in generated text for:', sourceFile);
      console.warn('Generated text sample:', generatedText.substring(0, 500));
      return [];
    }

    let jsonString = jsonMatch[0];
    
    // Clean up common issues
    jsonString = jsonString
      .replace(/,\s*\]/g, ']')  // Remove trailing commas
      .replace(/,\s*\}/g, '}')  // Remove trailing commas in objects
      .trim();
    
    // Validate JSON string is not empty or malformed
    if (!jsonString || jsonString.trim().length < 3) {
      console.warn('Empty or invalid JSON string for:', sourceFile);
      return [];
    }

    let qas;
    try {
      qas = JSON.parse(jsonString);
    } catch (parseError) {
      console.error('Error parsing generated Q&As:', parseError);
      console.error('Attempted to parse:', jsonString.substring(0, 500));
      
      // Try to fix common JSON issues and retry
      try {
        // Fix unescaped quotes and newlines
        const fixedJson = jsonString
          .replace(/\n/g, '\\n')
          .replace(/\r/g, '\\r')
          .replace(/\t/g, '\\t');
        qas = JSON.parse(fixedJson);
        console.log('Successfully parsed after fixing JSON for:', sourceFile);
      } catch (retryError) {
        console.error('Retry parsing also failed for:', sourceFile);
        return [];
      }
    }

    // Ensure qas is an array
    if (!Array.isArray(qas)) {
      console.warn('Parsed result is not an array for:', sourceFile);
      // Try to wrap single object in array
      if (typeof qas === 'object' && qas !== null) {
        qas = [qas];
      } else {
        return [];
      }
    }
    
    // Map and validate Q&As
    const validQAs = qas
      .map((qa: any) => {
        // Handle various response formats
        const question = qa.question || qa.q || qa.Question || '';
        const answer = qa.answer || qa.a || qa.Answer || '';
        const tags = Array.isArray(qa.tags) ? qa.tags : 
                     (typeof qa.tags === 'string' ? qa.tags.split(',').map((t: string) => t.trim()) : []);
        const confidence = typeof qa.confidence === 'number' ? qa.confidence : 0.8;
        
        return {
          question: question.trim(),
          answer: answer.trim(),
          category,
          tags,
          confidence,
          sourceFile,
        };
      })
      .filter((qa: GeneratedQA) => {
        // Validate Q&A has meaningful content
        const hasQuestion = qa.question && qa.question.length > 10;
        const hasAnswer = qa.answer && qa.answer.length > 20;
        
        if (!hasQuestion || !hasAnswer) {
          console.warn(`Filtered out invalid Q&A from ${sourceFile}:`, {
            question: qa.question?.substring(0, 50),
            answer: qa.answer?.substring(0, 50)
          });
        }
        
        return hasQuestion && hasAnswer;
      });
    
    console.log(`Parsed ${validQAs.length} valid Q&As from ${qas.length} total items for ${sourceFile}`);
    return validQAs;
    
  } catch (error) {
    console.error('Error parsing generated Q&As for:', sourceFile, error);
    return [];
  }
}

/**
 * Get generation job status
 */
export async function getGenerationJobStatus(jobId: string) {
  return await prisma.qAGenerationJob.findUnique({
    where: { id: jobId },
  });
}

/**
 * Get all Q&A entries
 */
export async function getAllQAEntries(filters?: {
  category?: string;
  sourceType?: string;
  isActive?: boolean;
}) {
  try {
    const entries = await prisma.qAEntry.findMany({
      where: filters,
      orderBy: { createdAt: 'desc' },
    });
    // Ensure we always return an array
    return Array.isArray(entries) ? entries : [];
  } catch (error) {
    console.error('Error in getAllQAEntries:', error);
    // Return empty array on error to prevent crashes
    return [];
  }
}

/**
 * Search Q&A entries
 */
export async function searchQAEntries(query: string, limit: number = 10) {
  try {
    const entries = await prisma.qAEntry.findMany({
      where: {
        isActive: true,
        OR: [
          { question: { contains: query } },
          { answer: { contains: query } },
          { tags: { contains: query } },
        ],
      },
      orderBy: { usageCount: 'desc' },
      take: limit,
    });

    // Ensure we always return an array
    return Array.isArray(entries) ? entries : [];
  } catch (error) {
    console.error('Error in searchQAEntries:', error);
    // Return empty array on error to prevent crashes
    return [];
  }
}

/**
 * Update Q&A entry
 */
export async function updateQAEntry(
  id: string,
  data: Partial<{
    question: string;
    answer: string;
    category: string;
    tags: string[];
    isActive: boolean;
  }>
) {
  const updateData: any = { ...data };
  if (data.tags) {
    updateData.tags = JSON.stringify(data.tags);
  }

  return await prisma.qAEntry.update({
    where: { id },
    data: updateData,
  });
}

/**
 * Delete Q&A entry
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
  const total = await prisma.qAEntry.count();
  const active = await prisma.qAEntry.count({ where: { isActive: true } });
  
  const byCategoryRaw = await prisma.qAEntry.groupBy({
    by: ['category'],
    _count: {
      _all: true,
    },
  });

  const bySourceTypeRaw = await prisma.qAEntry.groupBy({
    by: ['sourceType'],
    _count: {
      _all: true,
    },
  });

  const topUsed = await prisma.qAEntry.findMany({
    where: { isActive: true },
    orderBy: { usageCount: 'desc' },
    take: 10,
    select: {
      id: true,
      question: true,
      usageCount: true,
      category: true,
    },
  });

  // Transform the groupBy results to match the expected format
  const byCategory = byCategoryRaw.map(item => ({
    category: item.category,
    _count: item._count._all,
  }));

  const bySourceType = bySourceTypeRaw.map(item => ({
    sourceType: item.sourceType,
    _count: item._count._all,
  }));

  return {
    total,
    active,
    byCategory,
    bySourceType,
    topUsed,
  };
}
