
import { NextResponse } from 'next/server';
import { cecService } from '@/lib/cec-service';

export async function GET(request: Request) {
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
