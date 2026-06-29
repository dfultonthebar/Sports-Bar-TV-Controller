/**
 * Morning Reset API (v2.85.0)
 *
 * Manual trigger for the daily 04:00 CT "morning reset to defaults" job.
 * Runs a FULL-location revert: every configured matrix output back to its
 * default input AND every cable/DirecTV box back to its default channel
 * (resolved from SystemSettings.default_sources), respecting live-game
 * protection.
 *
 * POST body: { "dryRun": true } resolves and logs every action WITHOUT
 * issuing any hardware command — used to verify resolution off-hours without
 * disrupting live TVs. Omit / false to execute the actual re-route + tune.
 */
import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@sports-bar/logger';
import { withRateLimit } from '@/lib/rate-limiting/middleware';
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter';
import { validateRequestBody, z } from '@/lib/validation';
import { schedulerService } from '@sports-bar/scheduler';

export async function POST(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.DEFAULT);
  if (!rateLimit.allowed) return rateLimit.response;

  logger.api.request('POST', '/api/scheduling/morning-reset');

  const validationSchema = z.object({
    dryRun: z.boolean().optional(),
  });

  const bodyValidation = await validateRequestBody(request, validationSchema);
  if (!bodyValidation.success) return bodyValidation.error;

  try {
    const dryRun = bodyValidation.data.dryRun === true;
    const stats = await schedulerService.triggerMorningResetNow({ dryRun });

    logger.api.response('POST', '/api/scheduling/morning-reset', 200);
    return NextResponse.json({ success: true, dryRun, stats });
  } catch (error: any) {
    logger.api.error('POST', '/api/scheduling/morning-reset', error);
    return NextResponse.json(
      { success: false, error: 'Morning reset failed', details: error.message },
      { status: 500 }
    );
  }
}
