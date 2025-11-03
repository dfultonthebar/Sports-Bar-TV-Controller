export const dynamic = 'force-dynamic';


import { NextResponse, NextRequest } from 'next/server'
import { TV_BRAND_CONFIGS, getAllBrands, getBrandConfig } from '@/lib/tv-brands-config'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'

export async function GET(request: Request) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.DATABASE_READ)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  try {
    const { searchParams } = new URL(request.url)
    const brand = searchParams.get('brand')

    if (brand) {
      // Return specific brand configuration
      const config = getBrandConfig(brand)
      return NextResponse.json({
        success: true,
        brand,
        config
      })
    }

    // Return all brands
    const brands = getAllBrands()
    return NextResponse.json({
      success: true,
      brands,
      configs: TV_BRAND_CONFIGS
    })

  } catch (error) {
    console.error('Error fetching TV brands:', error)
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to fetch TV brands' 
    }, { status: 500 })
  }
}
