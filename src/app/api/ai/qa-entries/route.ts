import { NextRequest, NextResponse } from 'next/server';
import { readFile, writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { existsSync } from 'fs';

interface QAEntry {
  id: string;
  question: string;
  answer: string;
  category: string;
  createdAt: string;
}

const QA_FILE_PATH = path.join(process.cwd(), 'data', 'qa-entries.json');

async function ensureDataDir() {
  const dataDir = path.join(process.cwd(), 'data');
  if (!existsSync(dataDir)) {
    await mkdir(dataDir, { recursive: true });
  }
}

async function loadQAEntries(): Promise<QAEntry[]> {
  try {
    await ensureDataDir();
    if (!existsSync(QA_FILE_PATH)) {
      return [];
    }
    const data = await readFile(QA_FILE_PATH, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error loading Q&A entries:', error);
    return [];
  }
}

async function saveQAEntries(entries: QAEntry[]): Promise<void> {
  await ensureDataDir();
  await writeFile(QA_FILE_PATH, JSON.stringify(entries, null, 2), 'utf-8');
}

// GET - Retrieve all Q&A entries
export async function GET(request: NextRequest) {
  try {
    const entries = await loadQAEntries();
    return NextResponse.json({
      success: true,
      entries,
      count: entries.length
    });
  } catch (error) {
    console.error('Error in GET /api/ai/qa-entries:', error);
    return NextResponse.json(
      { error: 'Failed to load Q&A entries' },
      { status: 500 }
    );
  }
}

// POST - Add a new Q&A entry
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { question, answer, category } = body;

    if (!question || !answer) {
      return NextResponse.json(
        { error: 'Question and answer are required' },
        { status: 400 }
      );
    }

    const entries = await loadQAEntries();
    
    const newEntry: QAEntry = {
      id: `qa_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      question: question.trim(),
      answer: answer.trim(),
      category: category || 'general',
      createdAt: new Date().toISOString()
    };

    entries.push(newEntry);
    await saveQAEntries(entries);

    return NextResponse.json({
      success: true,
      entry: newEntry,
      message: 'Q&A entry added successfully'
    });
  } catch (error) {
    console.error('Error in POST /api/ai/qa-entries:', error);
    return NextResponse.json(
      { error: 'Failed to add Q&A entry' },
      { status: 500 }
    );
  }
}

// DELETE - Remove a Q&A entry
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Entry ID is required' },
        { status: 400 }
      );
    }

    const entries = await loadQAEntries();
    const filteredEntries = entries.filter(entry => entry.id !== id);

    if (filteredEntries.length === entries.length) {
      return NextResponse.json(
        { error: 'Entry not found' },
        { status: 404 }
      );
    }

    await saveQAEntries(filteredEntries);

    return NextResponse.json({
      success: true,
      message: 'Q&A entry deleted successfully'
    });
  } catch (error) {
    console.error('Error in DELETE /api/ai/qa-entries:', error);
    return NextResponse.json(
      { error: 'Failed to delete Q&A entry' },
      { status: 500 }
    );
  }
}
