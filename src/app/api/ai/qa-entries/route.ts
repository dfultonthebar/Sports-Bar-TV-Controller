import { NextRequest, NextResponse } from 'next/server';
import {
  getAllQAEntries,
  searchQAEntries,
  updateQAEntry,
  deleteQAEntry,
  getQAStatistics,
} from '@/lib/services/qa-generator';
import { prisma } from '@/lib/db';
import fs from 'fs/promises';
import path from 'path';

// System error logger
async function logSystemError(error: any, context: string) {
  try {
    const logDir = path.join(process.cwd(), 'logs');
    const logFile = path.join(logDir, 'system-errors.log');
    
    // Ensure log directory exists
    await fs.mkdir(logDir, { recursive: true });
    
    const timestamp = new Date().toISOString();
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : '';
    
    const logEntry = `[${timestamp}] ${context}\nError: ${errorMessage}\nStack: ${errorStack}\n\n`;
    
    await fs.appendFile(logFile, logEntry);
  } catch (logError) {
    console.error('Failed to write to system-errors.log:', logError);
  }
}

// GET - List all Q&A entries or search
export async function GET(request: NextRequest) {
  console.log('[AI QA] GET request - Fetching Q&A entries');
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('query');
    const category = searchParams.get('category');
    const sourceType = searchParams.get('sourceType');
    const stats = searchParams.get('stats');

    console.log('[AI QA] Query parameters:', { query, category, sourceType, stats });

    // Return statistics
    if (stats === 'true') {
      console.log('[AI QA] Fetching statistics...');
      try {
        const statistics = await getQAStatistics();
        console.log('[AI QA] ✓ Statistics retrieved:', statistics);
        return NextResponse.json(statistics);
      } catch (statsError) {
        console.error('[AI QA] ✗ Error fetching Q&A statistics:', statsError);
        await logSystemError(statsError, 'GET /api/ai/qa-entries?stats=true');
        // Return default statistics structure on error
        return NextResponse.json({
          total: 0,
          active: 0,
          byCategory: [],
          bySourceType: [],
          topUsed: [],
        });
      }
    }

    // Search Q&As
    if (query) {
      try {
        const results = await searchQAEntries(query);
        // Ensure results is always an array
        const safeResults = Array.isArray(results) ? results : [];
        return NextResponse.json(safeResults);
      } catch (searchError) {
        console.error('Error searching Q&A entries:', searchError);
        await logSystemError(searchError, `GET /api/ai/qa-entries?query=${query}`);
        // Return empty array on search error
        return NextResponse.json([]);
      }
    }

    // List all Q&As with filters
    const filters: any = {};
    if (category && category !== 'all') filters.category = category;
    if (sourceType && sourceType !== 'all') filters.sourceType = sourceType;

    try {
      const entries = await getAllQAEntries(filters);
      // Ensure entries is always an array
      const safeEntries = Array.isArray(entries) ? entries : [];
      return NextResponse.json(safeEntries);
    } catch (dbError) {
      console.error('Error fetching Q&A entries from database:', dbError);
      await logSystemError(dbError, `GET /api/ai/qa-entries with filters: ${JSON.stringify(filters)}`);
      
      // Return empty array instead of error to prevent frontend crashes
      // This allows the UI to render with no data rather than showing an error
      return NextResponse.json([]);
    }
  } catch (error) {
    console.error('Unexpected error in Q&A entries GET handler:', error);
    await logSystemError(error, 'GET /api/ai/qa-entries - Unexpected error');
    
    // Always return an array structure to prevent frontend "e.map is not a function" errors
    return NextResponse.json([]);
  }
}

// POST - Create new Q&A entry
export async function POST(request: NextRequest) {
  console.log('='.repeat(80));
  console.log('[AI QA] POST request - Creating new Q&A entry');
  console.log('[AI QA] Timestamp:', new Date().toISOString());
  
  try {
    const body = await request.json();
    const { question, answer, category, tags } = body;

    console.log('[AI QA] Request body:', {
      hasQuestion: !!question,
      hasAnswer: !!answer,
      category: category || 'general',
      tagsCount: Array.isArray(tags) ? tags.length : 0
    });

    if (!question || !answer) {
      console.error('[AI QA] ✗ Validation failed - Missing required fields');
      return NextResponse.json(
        { error: 'Question and answer are required' },
        { status: 400 }
      );
    }

    try {
      console.log('[AI QA] Attempting to create Q&A entry in database...');
      const entry = await prisma.qAEntry.create({
        data: {
          question,
          answer,
          category: category || 'general',
          tags: tags ? JSON.stringify(tags) : null,
          sourceType: 'manual',
          confidence: 1.0,
        },
      });

      console.log('[AI QA] ✓ Q&A entry created successfully');
      console.log('[AI QA] Entry ID:', entry.id);
      console.log('[AI QA] Entry category:', entry.category);
      console.log('='.repeat(80));

      return NextResponse.json(entry);
    } catch (dbError) {
      console.error('[AI QA] ✗ Database error creating Q&A entry:', dbError);
      console.error('[AI QA] Error type:', dbError instanceof Error ? dbError.constructor.name : typeof dbError);
      console.error('[AI QA] Error message:', dbError instanceof Error ? dbError.message : String(dbError));
      console.error('[AI QA] Error stack:', dbError instanceof Error ? dbError.stack : 'No stack trace');
      console.log('='.repeat(80));
      
      await logSystemError(dbError, `POST /api/ai/qa-entries - Database error`);
      return NextResponse.json(
        { error: 'Database error: Failed to create Q&A entry' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('[AI QA] ✗ Unexpected error creating Q&A entry:', error);
    console.error('[AI QA] Error type:', error instanceof Error ? error.constructor.name : typeof error);
    console.error('[AI QA] Error message:', error instanceof Error ? error.message : String(error));
    console.error('[AI QA] Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    console.log('='.repeat(80));
    
    await logSystemError(error, 'POST /api/ai/qa-entries - Unexpected error');
    return NextResponse.json(
      { error: 'Failed to create Q&A entry' },
      { status: 500 }
    );
  }
}

// PUT - Update Q&A entry
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, question, answer, category, tags, isActive } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'ID is required' },
        { status: 400 }
      );
    }

    const updateData: any = {};
    if (question !== undefined) updateData.question = question;
    if (answer !== undefined) updateData.answer = answer;
    if (category !== undefined) updateData.category = category;
    if (tags !== undefined) updateData.tags = JSON.stringify(tags);
    if (isActive !== undefined) updateData.isActive = isActive;

    try {
      const entry = await updateQAEntry(id, updateData);
      return NextResponse.json(entry);
    } catch (dbError) {
      console.error('Database error updating Q&A entry:', dbError);
      await logSystemError(dbError, `PUT /api/ai/qa-entries - Database error for ID: ${id}`);
      return NextResponse.json(
        { error: 'Database error: Failed to update Q&A entry' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error updating Q&A entry:', error);
    await logSystemError(error, 'PUT /api/ai/qa-entries - Unexpected error');
    return NextResponse.json(
      { error: 'Failed to update Q&A entry' },
      { status: 500 }
    );
  }
}

// DELETE - Delete Q&A entry
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'ID is required' },
        { status: 400 }
      );
    }

    try {
      await deleteQAEntry(id);
      return NextResponse.json({ success: true });
    } catch (dbError) {
      console.error('Database error deleting Q&A entry:', dbError);
      await logSystemError(dbError, `DELETE /api/ai/qa-entries - Database error for ID: ${id}`);
      return NextResponse.json(
        { error: 'Database error: Failed to delete Q&A entry' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error deleting Q&A entry:', error);
    await logSystemError(error, 'DELETE /api/ai/qa-entries - Unexpected error');
    return NextResponse.json(
      { error: 'Failed to delete Q&A entry' },
      { status: 500 }
    );
  }
}
