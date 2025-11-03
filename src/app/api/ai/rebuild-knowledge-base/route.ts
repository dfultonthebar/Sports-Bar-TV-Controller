
import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'
import { z } from 'zod'
import { validateRequestBody, validateQueryParams, validatePathParams, ValidationSchemas } from '@/lib/validation'

const execAsync = promisify(exec);

export async function POST(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.AI)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }


  // Input validation
  const bodyValidation = await validateRequestBody(request, z.record(z.unknown()))
  if (!bodyValidation.success) return bodyValidation.error


  try {
    console.log('Starting knowledge base rebuild...');
    
    // Execute the build script
    const { stdout, stderr } = await execAsync('npm run build-knowledge-base', {
      cwd: process.cwd(),
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer
    });
    
    console.log('Build output:', stdout);
    if (stderr) {
      console.error('Build errors:', stderr);
    }
    
    return NextResponse.json({
      success: true,
      message: 'Knowledge base rebuilt successfully',
      output: stdout,
    });
  } catch (error: any) {
    console.error('Error rebuilding knowledge base:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message,
        output: error.stdout || '',
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.AI)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  return NextResponse.json({
    endpoint: '/api/ai/rebuild-knowledge-base',
    method: 'POST',
    description: 'Rebuilds the AI knowledge base from documentation files',
  });
}
