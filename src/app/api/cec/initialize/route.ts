
import { NextResponse } from 'next/server';
import { cecService } from '@/lib/cec-service';

export async function POST() {
  try {
    const result = await cecService.initialize();
    
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message, adapters: [] },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const result = await cecService.initialize();
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message, adapters: [] },
      { status: 500 }
    );
  }
}
