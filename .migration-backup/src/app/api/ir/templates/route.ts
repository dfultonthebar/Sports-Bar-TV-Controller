import { NextResponse, NextRequest } from 'next/server'
import fs from 'fs'
import path from 'path'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'

import { logger } from '@/lib/logger'
export async function GET(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.HARDWARE)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  try {
    const templatesPath = path.join(process.cwd(), 'src/data/ir-command-templates.json')
    const templatesData = fs.readFileSync(templatesPath, 'utf-8')
    const templates = JSON.parse(templatesData)

    return NextResponse.json({
      success: true,
      templates: templates.templates
    })
  } catch (error) {
    logger.error('Error loading IR command templates:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to load IR command templates' },
      { status: 500 }
    )
  }
}
