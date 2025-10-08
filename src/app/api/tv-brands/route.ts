export const dynamic = 'force-dynamic';


import { NextResponse } from 'next/server'
import { TV_BRAND_CONFIGS, getAllBrands, getBrandConfig } from '@/lib/tv-brands-config'

export async function GET(request: Request) {
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
