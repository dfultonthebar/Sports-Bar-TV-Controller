
import { NextRequest, NextResponse } from 'next/server';
import { processUploadedFile } from '@/lib/services/qa-uploader';
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'

import { logger } from '@/lib/logger'
import { z } from 'zod'
import { validateRequestBody, validateQueryParams, validatePathParams, ValidationSchemas } from '@/lib/validation'
export async function POST(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.AI)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }


  // Input validation
  const bodyValidation = await validateRequestBody(request, ValidationSchemas.qaEntry)
  if (!bodyValidation.success) return bodyValidation.error


  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const format = formData.get('format') as string | null;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Read file content
    const content = await file.text();

    // Process the file
    const result = await processUploadedFile(content, file.name, format || undefined);

    return NextResponse.json(result);
  } catch (error) {
    logger.error('Error uploading Q&A file:', error);
    return NextResponse.json(
      { error: 'Failed to upload Q&A file', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
