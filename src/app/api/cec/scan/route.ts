
import { NextResponse } from 'next/server';
import { cecService } from '@/lib/cec-service';

export async function GET(request: Request) {
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
