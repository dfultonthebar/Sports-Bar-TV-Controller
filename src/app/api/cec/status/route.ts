
import { NextResponse, NextRequest } from 'next/server';
import { cecService } from '@/lib/cec-service';
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'
import { z } from 'zod'
import { validateRequestBody, validateQueryParams, validatePathParams, ValidationSchemas, isValidationError, isValidationSuccess} from '@/lib/validation'

export async function GET(request: Request) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.HARDWARE)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }


  // Query parameter validation
  const queryValidation = validateQueryParams(request, z.record(z.string()).optional())
  if (isValidationError(queryValidation)) return queryValidation.error


  try {
    const { searchParams } = new URL(request.url);
    const tvAddress = searchParams.get('tvAddress') || '0';
    
    const result = await cecService.getPowerStatus(tvAddress);
    
    return NextResponse.json({
      success: true,
      ...result
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message, status: 'unknown', devices: [] as any[] },
      { status: 500 }
    );
  }
}
