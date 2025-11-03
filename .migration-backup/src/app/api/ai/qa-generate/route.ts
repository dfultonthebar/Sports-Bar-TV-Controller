import { NextRequest, NextResponse } from 'next/server';
import { generateQAsFromRepository, getQAGenerationStatus } from '@/lib/services/qa-generator';
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'

import { logger } from '@/lib/logger'
export async function POST(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.AI)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  try {
    const body = await request.json();
    const { sourceType, sourcePaths, categories, maxQAsPerFile, model, forceRegenerate } = body;

    if (!sourceType) {
      return NextResponse.json(
        { error: 'sourceType is required' },
        { status: 400 }
      );
    }

    logger.info(`Starting Q&A generation - Force regenerate: ${forceRegenerate ? 'YES' : 'NO'}`);

    const result = await generateQAsFromRepository({
      sourceType,
      sourcePaths,
      categories,
      maxQAsPerFile,
      model,
      forceRegenerate: forceRegenerate || false,
    });

    return NextResponse.json(result);
  } catch (error) {
    logger.error('Error generating Q&As:', error);
    return NextResponse.json(
      { error: 'Failed to generate Q&As', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.AI)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  try {
    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get('jobId');

    if (!jobId) {
      return NextResponse.json(
        { error: 'jobId is required' },
        { status: 400 }
      );
    }

    const status = await getQAGenerationStatus(jobId);

    if (!status) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(status);
  } catch (error) {
    logger.error('Error getting job status:', error);
    return NextResponse.json(
      { error: 'Failed to get job status' },
      { status: 500 }
    );
  }
}
