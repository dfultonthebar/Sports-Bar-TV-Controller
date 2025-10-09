
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';


export async function GET(request: NextRequest) {
  try {
    const config = await prisma.matrixConfiguration.findFirst({
      where: { isActive: true },
      select: { name: true, id: true },
    });

    if (!config) {
      return NextResponse.json(
        { error: 'No active matrix configuration found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ 
      name: config.name,
      id: config.id,
      configFileName: `${config.name.toLowerCase().replace(/\s+/g, '-')}.local.json`
    });
  } catch (error: any) {
    console.error('Error fetching matrix configuration:', error);
    return NextResponse.json(
      { error: 'Failed to fetch matrix configuration', message: error.message },
      { status: 500 }
    );
}
