

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
  await prisma.qAGenerationJob.update({
    where: { id: jobId },
    data: { status: 'running', startedAt: new Date() },
  });

  const files = await collectFilesForGeneration(options);
  
  await prisma.qAGenerationJob.update({
    where: { id: jobId },
    data: { totalFiles: files.length },
  });

  let processedFiles = 0;
  let generatedQAs = 0;

  for (const file of files) {
    try {
      const qas = await generateQAsFromFile(file, options);
      
      // Save generated Q&As to database
      for (const qa of qas) {
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
      }

      processedFiles++;
      
      // Update job progress
      await prisma.qAGenerationJob.update({
        where: { id: jobId },
        data: { processedFiles, generatedQAs },
      });
    } catch (error) {
      console.error(`Error processing file ${file}:`, error);
    }
  }

  // Mark job as completed
  await prisma.qAGenerationJob.update({
    where: { id: jobId },
    data: {
      status: 'completed',
      completedAt: new Date(),
    },
  });
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
    // Call Ollama API to generate Q&As
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
    });

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.statusText}`);
    }

    const data = await response.json();
    const generatedText = data.response;

    // Parse the generated Q&As
    const qas = parseGeneratedQAs(generatedText, category, filePath);
    
    return qas;
  } catch (error) {
    console.error(`Error generating Q&As for ${filePath}:`, error);
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

  return `You are an AI assistant helping to create training data for a Sports Bar TV Control System.

Analyze the following ${fileExt === '.md' ? 'documentation' : 'code'} file and generate 3-5 relevant question-answer pairs that would help train an AI assistant to understand and explain this system.

File: ${fileName}
Category: ${category}

Content:
${contentPreview}

Generate Q&A pairs in the following JSON format:
[
  {
    "question": "Clear, specific question about the system",
    "answer": "Detailed, accurate answer based on the content",
    "tags": ["tag1", "tag2"],
    "confidence": 0.9
  }
]

Focus on:
- System architecture and design
- API endpoints and their usage
- Features and capabilities
- Configuration and setup
- Common issues and troubleshooting
- Best practices

Make questions natural and conversational. Answers should be comprehensive but concise.
Only return the JSON array, no additional text.`;
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
    // Try to extract JSON from the response
    const jsonMatch = generatedText.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      console.warn('No JSON array found in generated text for:', sourceFile);
      return [];
    }

    const jsonString = jsonMatch[0];
    
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
      console.error('Attempted to parse:', jsonString.substring(0, 200));
      return [];
    }

    // Ensure qas is an array
    if (!Array.isArray(qas)) {
      console.warn('Parsed result is not an array for:', sourceFile);
      return [];
    }
    
    return qas.map((qa: any) => ({
      question: qa.question || '',
      answer: qa.answer || '',
      category,
      tags: Array.isArray(qa.tags) ? qa.tags : [],
      confidence: typeof qa.confidence === 'number' ? qa.confidence : 0.8,
      sourceFile,
    })).filter((qa: GeneratedQA) => qa.question && qa.answer);
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
