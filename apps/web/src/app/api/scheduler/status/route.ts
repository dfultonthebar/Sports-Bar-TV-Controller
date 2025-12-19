
import { NextResponse, NextRequest } from 'next/server';
import { schedulerService } from '@/lib/scheduler-service';
import { autoReallocatorWorker } from '@/lib/scheduling/auto-reallocator-worker';
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'
import { z } from 'zod'
import { validateRequestBody, validateQueryParams, validatePathParams, ValidationSchemas, isValidationError, isValidationSuccess} from '@/lib/validation'

// GET - Get scheduler service status
export async function GET(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.SCHEDULER)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  const autoReallocatorStatus = autoReallocatorWorker.getStatus();

  return NextResponse.json({
    status: 'running',
    message: 'Scheduler service is active',
    autoReallocator: autoReallocatorStatus
  });
}

// POST - Start/stop scheduler service
export async function POST(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.SCHEDULER)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }


  // Input validation
  const bodyValidation = await validateRequestBody(request, z.record(z.unknown()))
  if (isValidationError(bodyValidation)) return bodyValidation.error


  const { action } = bodyValidation.data;
  
  if (action === 'start') {
    schedulerService.start();
    autoReallocatorWorker.start();
    return NextResponse.json({ message: 'Scheduler service and auto-reallocator started' });
  } else if (action === 'stop') {
    schedulerService.stop();
    autoReallocatorWorker.stop();
    return NextResponse.json({ message: 'Scheduler service and auto-reallocator stopped' });
  }
  
  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}
