import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { schema } from '@/db';
import { eq } from 'drizzle-orm';
import { logger } from '@sports-bar/logger';
import { withRateLimit } from '@/lib/rate-limiting/middleware';
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter';
import { validateRequestBody, ValidationSchemas, z } from '@/lib/validation';

// GET - Get all input sources
export async function GET(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.DEFAULT);
  if (!rateLimit.allowed) return rateLimit.response;

  logger.api.request('GET', '/api/scheduling/input-sources');

  try {
    const sources = await db.select().from(schema.inputSources);

    logger.api.response('GET', '/api/scheduling/input-sources', 200, { count: sources.length });
    return NextResponse.json({
      success: true,
      sources: sources.map(s => ({
        ...s,
        availableNetworks: JSON.parse(s.availableNetworks),
        installedApps: s.installedApps ? JSON.parse(s.installedApps) : null,
      })),
    });
  } catch (error: any) {
    logger.api.error('GET', '/api/scheduling/input-sources', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch input sources', details: error.message },
      { status: 500 }
    );
  }
}

// POST - Create new input source
export async function POST(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.DEFAULT);
  if (!rateLimit.allowed) return rateLimit.response;

  logger.api.request('POST', '/api/scheduling/input-sources');

  const validationSchema = z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    type: z.enum(['cable', 'directv', 'firetv']),
    deviceId: z.string().optional(),
    matrixInputId: z.string().optional(),
    availableNetworks: z.array(z.string()),
    installedApps: z.array(z.string()).optional(),
    isActive: z.boolean().default(true),
    priorityRank: z.number().int().min(1).max(100).default(50),
  });

  const bodyValidation = await validateRequestBody(request, validationSchema);
  if (!bodyValidation.success) return bodyValidation.error;

  try {
    const data = bodyValidation.data;

    // Check if ID already exists
    const existing = await db
      .select()
      .from(schema.inputSources)
      .where(eq(schema.inputSources.id, data.id))
      .limit(1);

    if (existing.length > 0) {
      return NextResponse.json(
        { success: false, error: 'Input source ID already exists' },
        { status: 400 }
      );
    }

    await db.insert(schema.inputSources).values({
      id: data.id,
      name: data.name,
      type: data.type,
      deviceId: data.deviceId || null,
      matrixInputId: data.matrixInputId || null,
      availableNetworks: JSON.stringify(data.availableNetworks),
      installedApps: data.installedApps ? JSON.stringify(data.installedApps) : null,
      isActive: data.isActive,
      currentlyAllocated: false,
      priorityRank: data.priorityRank,
    });

    logger.api.response('POST', '/api/scheduling/input-sources', 201);
    return NextResponse.json({ success: true, id: data.id }, { status: 201 });
  } catch (error: any) {
    logger.api.error('POST', '/api/scheduling/input-sources', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create input source', details: error.message },
      { status: 500 }
    );
  }
}

// DELETE - Delete input source
export async function DELETE(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.DEFAULT);
  if (!rateLimit.allowed) return rateLimit.response;

  logger.api.request('DELETE', '/api/scheduling/input-sources');

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json(
      { success: false, error: 'Missing id parameter' },
      { status: 400 }
    );
  }

  try {
    await db.delete(schema.inputSources).where(eq(schema.inputSources.id, id));

    logger.api.response('DELETE', '/api/scheduling/input-sources', 200);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    logger.api.error('DELETE', '/api/scheduling/input-sources', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete input source', details: error.message },
      { status: 500 }
    );
  }
}
