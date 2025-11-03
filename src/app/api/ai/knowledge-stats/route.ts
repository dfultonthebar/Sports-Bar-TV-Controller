import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import path from 'path';
import { existsSync } from 'fs';
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'

export async function GET(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.AI)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  try {
    const kbPath = path.join(process.cwd(), 'data', 'ai-knowledge-base.json');
    const qaPath = path.join(process.cwd(), 'data', 'qa-entries.json');

    let totalDocuments = 0;
    let totalQAPairs = 0;
    let totalCharacters = 0;
    let lastUpdated = new Date().toISOString();

    // Load knowledge base stats
    if (existsSync(kbPath)) {
      const kbData = await readFile(kbPath, 'utf-8');
      const kb = JSON.parse(kbData);
      
      if (kb.stats) {
        totalDocuments = kb.stats.totalDocuments || 0;
        totalCharacters = kb.stats.totalCharacters || 0;
      }
      
      if (kb.lastUpdated) {
        lastUpdated = kb.lastUpdated;
      }
    }

    // Load Q&A entries count
    if (existsSync(qaPath)) {
      const qaData = await readFile(qaPath, 'utf-8');
      const qaEntries = JSON.parse(qaData);
      totalQAPairs = qaEntries.length || 0;
      
      // Add Q&A content to character count
      qaEntries.forEach((entry: any) => {
        totalCharacters += (entry.question?.length || 0) + (entry.answer?.length || 0);
      });
    }

    return NextResponse.json({
      success: true,
      stats: {
        totalDocuments,
        totalQAPairs,
        totalCharacters,
        lastUpdated
      }
    });
  } catch (error) {
    console.error('Error loading knowledge stats:', error);
    return NextResponse.json(
      { 
        error: 'Failed to load knowledge stats',
        stats: {
          totalDocuments: 0,
          totalQAPairs: 0,
          totalCharacters: 0,
          lastUpdated: new Date().toISOString()
        }
      },
      { status: 500 }
    );
  }
}
