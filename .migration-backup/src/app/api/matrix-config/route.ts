import { NextRequest, NextResponse } from 'next/server';
import { findFirst, eq } from '@/lib/db-helpers'
import { schema } from '@/db'

import { logger } from '@/lib/logger'
export async function GET(request: NextRequest) {
  try {
    const config = await findFirst('matrixConfigurations', {
      where: eq(schema.matrixConfigurations.isActive, true)
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
    logger.error('Error fetching matrix configuration:', error);
    return NextResponse.json(
      { error: 'Failed to fetch matrix configuration', message: error.message },
      { status: 500 }
    );
  }
}
