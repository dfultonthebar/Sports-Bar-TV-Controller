
/**
 * Sports Guide API - Update Key Endpoint
 * 
 * Updates the Sports Guide API key in environment configuration
 * Note: This requires server restart to take effect in production
 */

import { NextRequest, NextResponse } from 'next/server';
import { writeFile } from 'fs/promises';
import { join } from 'path';
import { SportsGuideApi } from '@/lib/sportsGuideApi';
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'

import { logger } from '@/lib/logger'
import { z } from 'zod'
import { validateRequestBody, validateQueryParams, validatePathParams, ValidationSchemas, isValidationError, isValidationSuccess} from '@/lib/validation'
export async function POST(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.SPORTS_DATA)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }


  // Input validation
  const bodyValidation = await validateRequestBody(request, z.record(z.unknown()))
  if (isValidationError(bodyValidation)) return bodyValidation.error
  try {
    const { apiKey, userId } = bodyValidation.data;

    if (!apiKey || !userId) {
      return NextResponse.json(
        {
          success: false,
          message: 'API key and User ID are required',
        },
        { status: 400 }
      );
    }

    // Verify the new API key works before saving
    const testApi = new SportsGuideApi({
      apiKey,
      userId,
      baseUrl: process.env.SPORTS_GUIDE_API_URL || 'https://guide.thedailyrail.com/api/v1',
    });

    const verification = await testApi.verifyApiKey();

    if (!verification.valid) {
      return NextResponse.json(
        {
          success: false,
          message: `API key validation failed: ${verification.message}`,
        },
        { status: 400 }
      );
    }

    // Read current .env file
    const envPath = join(process.cwd(), '.env');
    let envContent = '';
    
    try {
      const fs = require('fs');
      envContent = fs.readFileSync(envPath, 'utf-8');
    } catch (error) {
      // If .env doesn't exist, start with empty content
      envContent = '';
    }

    // Update or add Sports Guide API configuration
    const lines = envContent.split('\n');
    let apiKeyUpdated = false;
    let userIdUpdated = false;

    const updatedLines = lines.map((line) => {
      if (line.startsWith('SPORTS_GUIDE_API_KEY=')) {
        apiKeyUpdated = true;
        return `SPORTS_GUIDE_API_KEY=${apiKey}`;
      }
      if (line.startsWith('SPORTS_GUIDE_USER_ID=')) {
        userIdUpdated = true;
        return `SPORTS_GUIDE_USER_ID=${userId}`;
      }
      return line;
    });

    // Add new entries if they didn't exist
    if (!apiKeyUpdated) {
      updatedLines.push(`SPORTS_GUIDE_API_KEY=${apiKey}`);
    }
    if (!userIdUpdated) {
      updatedLines.push(`SPORTS_GUIDE_USER_ID=${userId}`);
    }

    // Write updated .env file
    await writeFile(envPath, updatedLines.join('\n'));

    // Update process.env for current session
    process.env.SPORTS_GUIDE_API_KEY = apiKey;
    process.env.SPORTS_GUIDE_USER_ID = userId;

    return NextResponse.json({
      success: true,
      message: 'API key updated successfully. Server restart recommended for full effect.',
      requiresRestart: true,
    });
  } catch (error) {
    logger.error('Error updating Sports Guide API key:', error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to update API key',
      },
      { status: 500 }
    );
  }
}
