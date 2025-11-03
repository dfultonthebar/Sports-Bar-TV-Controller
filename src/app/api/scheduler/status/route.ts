
import { NextResponse, NextRequest } from 'next/server';
import { schedulerService } from '@/lib/scheduler-service';
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'

// GET - Get scheduler service status
export async function GET(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.SCHEDULER)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  return NextResponse.json({
    status: 'running',
    message: 'Scheduler service is active'
  });
}

// POST - Start/stop scheduler service
export async function POST(request: Request) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.SCHEDULER)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  const { action } = await request.json();
  
  if (action === 'start') {
    schedulerService.start();
    return NextResponse.json({ message: 'Scheduler service started' });
  } else if (action === 'stop') {
    schedulerService.stop();
    return NextResponse.json({ message: 'Scheduler service stopped' });
  }
  
  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}
