import { NextRequest, NextResponse } from 'next/server'
import { readFile, writeFile } from 'fs/promises'
import { join } from 'path'
import { STREAMING_APPS_DATABASE } from '@/lib/streaming/streaming-apps-database'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'

const SUBSCRIBED_APPS_FILE = join(process.cwd(), 'data', 'subscribed-streaming-apps.json')

export async function GET(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.EXTERNAL)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  try {
    const data = await readFile(SUBSCRIBED_APPS_FILE, 'utf-8')
    const config = JSON.parse(data)

    // Enrich with app details from database
    const enrichedApps = config.subscribedApps.map((subApp: any) => {
      const appDetails = STREAMING_APPS_DATABASE.find(app => app.id === subApp.appId)
      return {
        ...subApp,
        ...appDetails
      }
    }).filter((app: any) => app.enabled)

    return NextResponse.json({
      apps: enrichedApps,
      lastUpdated: config.lastUpdated
    })
  } catch (error) {
    console.error('Error loading subscribed apps:', error)
    return NextResponse.json({ error: 'Failed to load subscribed apps' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.EXTERNAL)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  try {
    const updates = await request.json()
    const data = await readFile(SUBSCRIBED_APPS_FILE, 'utf-8')
    const config = JSON.parse(data)

    // Update the configuration
    config.subscribedApps = updates.subscribedApps || config.subscribedApps
    config.lastUpdated = new Date().toISOString()

    await writeFile(SUBSCRIBED_APPS_FILE, JSON.stringify(config, null, 2))

    return NextResponse.json({
      success: true,
      message: 'Subscribed apps updated successfully'
    })
  } catch (error) {
    console.error('Error updating subscribed apps:', error)
    return NextResponse.json({ error: 'Failed to update subscribed apps' }, { status: 500 })
  }
}
