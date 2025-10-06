import { NextRequest, NextResponse } from 'next/server';
import {
  getAllQAEntries,
  searchQAEntries,
  updateQAEntry,
  deleteQAEntry,
  getQAStatistics,
} from '@/lib/services/qa-generator';

// GET - List all Q&A entries or search
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('query');
    const category = searchParams.get('category');
    const sourceType = searchParams.get('sourceType');
    const stats = searchParams.get('stats');

    // Return statistics
    if (stats === 'true') {
      const statistics = await getQAStatistics();
      return NextResponse.json(statistics);
    }

    // Search Q&As
    if (query) {
      const results = await searchQAEntries(query);
      return NextResponse.json(results);
    }

    // List all Q&As with filters
    const filters: any = {};
    if (category && category !== 'all') filters.category = category;
    if (sourceType && sourceType !== 'all') filters.sourceType = sourceType;

    const entries = await getAllQAEntries(filters);
    return NextResponse.json(entries);
  } catch (error) {
    console.error('Error fetching Q&A entries:', error);
    return NextResponse.json(
      { error: 'Failed to fetch Q&A entries' },
      { status: 500 }
    );
  }
}

// POST - Create new Q&A entry
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { question, answer, category, tags } = body;

    if (!question || !answer) {
      return NextResponse.json(
        { error: 'Question and answer are required' },
        { status: 400 }
      );
    }

    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();

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

    await prisma.$disconnect();
    return NextResponse.json(entry);
  } catch (error) {
    console.error('Error creating Q&A entry:', error);
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

    const entry = await updateQAEntry(id, updateData);
    return NextResponse.json(entry);
  } catch (error) {
    console.error('Error updating Q&A entry:', error);
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

    await deleteQAEntry(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting Q&A entry:', error);
    return NextResponse.json(
      { error: 'Failed to delete Q&A entry' },
      { status: 500 }
    );
  }
}
