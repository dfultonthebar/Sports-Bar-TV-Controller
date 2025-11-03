import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { db } from '@/db';
import { schema } from '@/db';
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'

/**
 * API endpoint for generating Q&As from documentation
 * Designed to be called by n8n workflows for automated AI training
 */

interface QAGenerationRequest {
  filePath?: string;
  content?: string;
  category?: string;
}

export async function POST(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.AI)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  try {
    const body: QAGenerationRequest = await request.json();
    const { filePath, content, category } = body;

    if (!filePath && !content) {
      return NextResponse.json(
        { error: 'Either filePath or content is required' },
        { status: 400 }
      );
    }

    let documentContent = content;
    let sourceFile = filePath || 'manual-input';

    // Read file if path provided
    if (filePath) {
      const fullPath = path.isAbsolute(filePath)
        ? filePath
        : path.join(process.cwd(), filePath);

      if (!fs.existsSync(fullPath)) {
        return NextResponse.json(
          { error: `File not found: ${filePath}` },
          { status: 404 }
        );
      }

      documentContent = fs.readFileSync(fullPath, 'utf-8');
      sourceFile = path.relative(process.cwd(), fullPath);
    }

    if (!documentContent) {
      return NextResponse.json(
        { error: 'No content to process' },
        { status: 400 }
      );
    }

    // Return content for Claude Code to process
    // n8n will call this endpoint, then Claude Code generates Q&As
    return NextResponse.json({
      success: true,
      message: 'Document ready for Q&A generation',
      sourceFile,
      contentLength: documentContent.length,
      content: documentContent,
      category: category || path.dirname(sourceFile).split(path.sep).pop() || 'general',
    });

  } catch (error) {
    console.error('Error in AI training endpoint:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * Save Q&As to database
 * Called after Claude Code generates the Q&As
 */
export async function PUT(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.AI)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  try {
    const { qas } = await request.json();

    if (!Array.isArray(qas)) {
      return NextResponse.json(
        { error: 'qas must be an array' },
        { status: 400 }
      );
    }

    const inserted = [];

    for (const qa of qas) {
      const id = crypto.randomUUID();

      await db.insert(schema.qaEntries).values({
        id,
        question: qa.question,
        answer: qa.answer,
        category: qa.category,
        tags: Array.isArray(qa.tags) ? qa.tags.join(',') : qa.tags,
        confidence: qa.confidence || 0.9,
        sourceFile: qa.sourceFile,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      inserted.push({ id, question: qa.question });
    }

    return NextResponse.json({
      success: true,
      message: `Inserted ${inserted.length} Q&As`,
      inserted,
    });

  } catch (error) {
    console.error('Error saving Q&As:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * Get training status and stats
 */
export async function GET(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.AI)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  try {
    const totalQAs = await db
      .select()
      .from(schema.qaEntries)
      .execute();

    const categoryCounts = totalQAs.reduce((acc: Record<string, number>, qa) => {
      const cat = qa.category || 'uncategorized';
      acc[cat] = (acc[cat] || 0) + 1;
      return acc;
    }, {});

    return NextResponse.json({
      success: true,
      totalQAs: totalQAs.length,
      categories: categoryCounts,
      lastUpdated: totalQAs.length > 0
        ? Math.max(...totalQAs.map(qa => new Date(qa.createdAt).getTime()))
        : null,
    });

  } catch (error) {
    console.error('Error getting training stats:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
