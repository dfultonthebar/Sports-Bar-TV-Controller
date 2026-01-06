import { NextRequest, NextResponse } from 'next/server';
import { findFirst, eq } from '@/lib/db-helpers'
import { schema } from '@/db'
import { logger } from '@sports-bar/logger'
import { cacheManager } from '@/lib/cache-manager'

export async function GET(request: NextRequest) {
  try {
    const cacheKey = 'active-matrix-config'

    // Try to get from cache first (1 minute TTL)
    const cached = cacheManager.get('matrix-config', cacheKey)
    if (cached && typeof cached === 'object') {
      logger.debug('[Matrix] Returning matrix config from cache')
      return NextResponse.json({
        ...cached,
        fromCache: true
      })
    }

    const config = await findFirst('matrixConfigurations', {
      where: eq(schema.matrixConfigurations.isActive, true)
    });

    if (!config) {
      return NextResponse.json(
        { error: 'No active matrix configuration found' },
        { status: 404 }
      );
    }

    const response = {
      name: config.name,
      id: config.id,
      configFileName: `${config.name.toLowerCase().replace(/\s+/g, '-')}.local.json`
    }

    // Cache for 1 minute
    cacheManager.set('matrix-config', cacheKey, response)
    logger.debug('[Matrix] Cached matrix configuration')

    return NextResponse.json({
      ...response,
      fromCache: false
    });
  } catch (error: any) {
    logger.error('Error fetching matrix configuration:', error);
    return NextResponse.json(
      { error: 'Failed to fetch matrix configuration', message: error.message },
      { status: 500 }
    );
  }
}
