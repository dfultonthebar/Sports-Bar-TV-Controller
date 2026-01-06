
import { NextResponse, NextRequest } from 'next/server';
import { cecService } from '@/lib/cec-service';
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'

export async function GET(request: Request) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.HARDWARE)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  try {
    const { searchParams } = new URL(request.url);
    const forceRefresh = searchParams.get('refresh') === 'true';
    
    const devices = await cecService.scanDevices(forceRefresh);
    
    return NextResponse.json({
      success: true,
      devices,
      count: devices.length
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message, devices: [] as any[], count: 0 },
      { status: 500 }
    );
  }
}
