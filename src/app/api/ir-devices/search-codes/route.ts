
import { NextRequest, NextResponse } from 'next/server'
import { globalCacheAPI, searchSpectrumModels, SPECTRUM_CABLE_BOX_MODELS } from '@/lib/global-cache-api'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'

import { logger } from '@/lib/logger'
import { z } from 'zod'
import { validateRequestBody, validateQueryParams, validatePathParams, ValidationSchemas } from '@/lib/validation'
// Force dynamic rendering for this API route
export const dynamic = 'force-dynamic'

// Enhanced codesets with comprehensive Spectrum support
const ENHANCED_CODESETS = {
  'DirecTV': {
    'Cable Box': [
      { id: '1001', name: 'DirecTV HD Receiver Series', brand: 'DirecTV', type: 'Cable Box' },
      { id: '1002', name: 'DirecTV Genie Series', brand: 'DirecTV', type: 'Cable Box' }
    ],
    'Satellite Receiver': [
      { id: '1003', name: 'DirecTV H25', brand: 'DirecTV', type: 'Satellite Receiver' },
      { id: '1004', name: 'DirecTV HR54', brand: 'DirecTV', type: 'Satellite Receiver' }
    ]
  },
  'Samsung': {
    'TV': [
      { id: '2001', name: 'Samsung Smart TV 2020-2023', brand: 'Samsung', type: 'TV' },
      { id: '2002', name: 'Samsung QLED Series', brand: 'Samsung', type: 'TV' }
    ],
    'Cable Box': [
      { id: '2101', name: 'Samsung SMT-C5320 (Spectrum HD Cable Box)', brand: 'Samsung', type: 'Cable Box' },
      { id: '2102', name: 'Samsung SMT-H3272 (Spectrum HD DVR)', brand: 'Samsung', type: 'Cable Box' },
      { id: '2103', name: 'Samsung SMT-H4362 (Spectrum HD DVR)', brand: 'Samsung', type: 'Cable Box' },
      { id: '2104', name: 'Samsung SMT-I3105 (Spectrum Cable Box)', brand: 'Samsung', type: 'Cable Box' },
      { id: '2105', name: 'Samsung SMT-I5150 (Spectrum HD Cable Box)', brand: 'Samsung', type: 'Cable Box' }
    ]
  },
  'LG': {
    'TV': [
      { id: '3001', name: 'LG OLED Series', brand: 'LG', type: 'TV' },
      { id: '3002', name: 'LG NanoCell Series', brand: 'LG', type: 'TV' }
    ]
  },
  'Comcast': {
    'Cable Box': [
      { id: '4001', name: 'Comcast X1 Platform', brand: 'Comcast', type: 'Cable Box' },
      { id: '4002', name: 'Comcast Legacy Set-top Box', brand: 'Comcast', type: 'Cable Box' }
    ]
  },
  'Charter Spectrum': {
    'Cable Box': [
      { id: '7001', name: 'Charter Spectrum HD Cable Box', brand: 'Charter Spectrum', type: 'Cable Box' },
      { id: '7002', name: 'Charter Spectrum HD DVR', brand: 'Charter Spectrum', type: 'Cable Box' },
      { id: '7003', name: 'Charter Spectrum Legacy Cable Box', brand: 'Charter Spectrum', type: 'Cable Box' },
      { id: '7004', name: 'Charter Spectrum Digital Transport Adapter', brand: 'Charter Spectrum', type: 'Cable Box' }
    ]
  },
  'Cisco': {
    'Cable Box': [
      { id: '8001', name: 'Cisco DTA271HD (Spectrum DTA)', brand: 'Cisco', type: 'Cable Box' },
      { id: '8002', name: 'Cisco DTA170HD (Spectrum DTA)', brand: 'Cisco', type: 'Cable Box' },
      { id: '8003', name: 'Cisco Explorer 4250HDC (Spectrum HD DVR)', brand: 'Cisco', type: 'Cable Box' },
      { id: '8004', name: 'Cisco Explorer 8300HDC (Spectrum HD DVR)', brand: 'Cisco', type: 'Cable Box' },
      { id: '8005', name: 'Cisco Explorer 3250HD (Spectrum HD Cable Box)', brand: 'Cisco', type: 'Cable Box' },
      { id: '8006', name: 'Scientific Atlanta 3250HD (Spectrum HD Cable Box)', brand: 'Cisco', type: 'Cable Box' },
      { id: '8007', name: 'Scientific Atlanta 4250HDC (Spectrum HD DVR)', brand: 'Cisco', type: 'Cable Box' }
    ]
  },
  'Arris': {
    'Cable Box': [
      { id: '9001', name: 'Arris DCT3416 (Spectrum HD DVR)', brand: 'Arris', type: 'Cable Box' },
      { id: '9002', name: 'Arris DCT6200 (Spectrum HD Cable Box)', brand: 'Arris', type: 'Cable Box' },
      { id: '9003', name: 'Arris DCT6412 (Spectrum HD DVR)', brand: 'Arris', type: 'Cable Box' },
      { id: '9004', name: 'Arris DCX3200 (Spectrum HD Cable Box)', brand: 'Arris', type: 'Cable Box' },
      { id: '9005', name: 'Arris DCX3400 (Spectrum HD DVR)', brand: 'Arris', type: 'Cable Box' },
      { id: '9006', name: 'Arris DX013ANM (Spectrum Cable Box)', brand: 'Arris', type: 'Cable Box' }
    ]
  },
  'Motorola': {
    'Cable Box': [
      { id: '10001', name: 'Motorola DCH70 (Spectrum HD Cable Box)', brand: 'Motorola', type: 'Cable Box' },
      { id: '10002', name: 'Motorola DCT3416 (Spectrum HD DVR)', brand: 'Motorola', type: 'Cable Box' },
      { id: '10003', name: 'Motorola DCT6200 (Spectrum HD Cable Box)', brand: 'Motorola', type: 'Cable Box' },
      { id: '10004', name: 'Motorola DCT6412 (Spectrum HD DVR)', brand: 'Motorola', type: 'Cable Box' }
    ]
  },
  'Pace': {
    'Cable Box': [
      { id: '11001', name: 'Pace DC758D (Spectrum Cable Box)', brand: 'Pace', type: 'Cable Box' },
      { id: '11002', name: 'Pace TDC575D (Spectrum HD Cable Box)', brand: 'Pace', type: 'Cable Box' },
      { id: '11003', name: 'Pace TDC777D (Spectrum HD DVR)', brand: 'Pace', type: 'Cable Box' },
      { id: '11004', name: 'Pace MX011ANM (Spectrum Cable Box)', brand: 'Pace', type: 'Cable Box' }
    ]
  },
  'Apple TV': {
    'Streaming Device': [
      { id: '5001', name: 'Apple TV 4K (2017-2023)', brand: 'Apple TV', type: 'Streaming Device' },
      { id: '5002', name: 'Apple TV HD', brand: 'Apple TV', type: 'Streaming Device' }
    ]
  },
  'Roku': {
    'Streaming Device': [
      { id: '6001', name: 'Roku Ultra Series', brand: 'Roku', type: 'Streaming Device' },
      { id: '6002', name: 'Roku Streaming Stick', brand: 'Roku', type: 'Streaming Device' }
    ]
  }
}

export async function GET(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.HARDWARE)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }


  // Input validation
  const bodyValidation = await validateRequestBody(request, z.record(z.unknown()))
  if (!bodyValidation.success) return bodyValidation.error
  const body = bodyValidation.data

  // Query parameter validation
  const queryValidation = validateQueryParams(request, z.record(z.string()).optional())
  if (!queryValidation.success) return queryValidation.error


  try {
    const { searchParams } = new URL(request.url)
    const brand = searchParams.get('brand')
    const type = searchParams.get('type')

    if (!brand || !type) {
      return NextResponse.json({ error: 'Brand and type parameters are required' }, { status: 400 })
    }

    let codesets: any[] = []
    let message = ''

    // Special handling for Spectrum searches - return ALL models from all manufacturers
    const spectrumBrands = ['Charter Spectrum', 'Spectrum', 'Charter']
    const isSpectrumSearch = spectrumBrands.some(sb => 
      brand.toLowerCase().includes(sb.toLowerCase()) || 
      sb.toLowerCase().includes(brand.toLowerCase())
    )

    if (isSpectrumSearch || (brand.toLowerCase().includes('spectrum') || brand.toLowerCase().includes('charter'))) {
      // Use comprehensive Global Cache API integration for Spectrum
      try {
        codesets = await globalCacheAPI.searchModels(brand, type)
        message = `Found ${codesets.length} Spectrum cable box models from Global Cache Database`
      } catch (error) {
        logger.info('Global Cache API not available, using enhanced local database')
        // Fallback to enhanced local database - return ALL Spectrum models
        codesets = []
        const spectrumManufacturers = ['Charter Spectrum', 'Samsung', 'Cisco', 'Arris', 'Motorola', 'Pace']
        
        spectrumManufacturers.forEach(manufacturer => {
          const brandCodesets = ENHANCED_CODESETS[manufacturer as keyof typeof ENHANCED_CODESETS]
          if (brandCodesets && brandCodesets[type as keyof typeof brandCodesets]) {
            const typeCodesets = brandCodesets[type as keyof typeof brandCodesets] as any[]
            codesets.push(...typeCodesets)
          }
        })
        
        message = `Found ${codesets.length} Spectrum cable box models from enhanced local database`
      }
    } else {
      // Standard brand search with enhanced database
      const brandCodesets = ENHANCED_CODESETS[brand as keyof typeof ENHANCED_CODESETS]
      
      if (brandCodesets) {
        const typeCodesets = brandCodesets[type as keyof typeof brandCodesets] as any[]
        if (typeCodesets && Array.isArray(typeCodesets)) {
          codesets = typeCodesets
        }
      }

      // Also try Global Cache API for non-Spectrum devices
      try {
        const apiResults = await globalCacheAPI.searchModels(brand, type)
        if (apiResults.length > 0) {
          // Merge with local results, avoiding duplicates
          const localIds = new Set(codesets.map(c => c.id))
          const newResults = apiResults.filter(r => !localIds.has(r.id))
          codesets.push(...newResults)
        }
      } catch (error) {
        logger.info('Global Cache API not available for', brand)
      }

      message = `Found ${codesets.length} codesets for ${brand} ${type}`
    }

    // Sort results by name for better UX
    codesets.sort((a, b) => a.name.localeCompare(b.name))

    return NextResponse.json({ 
      codesets,
      message,
      globalCacheApiUsed: codesets.length > 0 && isSpectrumSearch,
      totalModels: codesets.length
    })

  } catch (error) {
    logger.error('Error searching codesets:', error)
    return NextResponse.json({ 
      error: 'Failed to search codesets',
      codesets: [] as any[],
      message: 'Error occurred during search'
    }, { status: 500 })
  }
}

// Additional API endpoints for model details and IR codes

export async function POST(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.HARDWARE)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }


  // Input validation
  const bodyValidation = await validateRequestBody(request, z.record(z.unknown()))
  if (!bodyValidation.success) return bodyValidation.error

  // Query parameter validation
  const queryValidation = validateQueryParams(request, z.record(z.string()).optional())
  if (!queryValidation.success) return queryValidation.error

  try {
    const { modelId, action } = body

    if (action === 'getModelCodes' && modelId) {
      // Get IR codes for specific model
      const codes = await globalCacheAPI.getModelCodes(modelId)
      
      return NextResponse.json({
        codes,
        modelId,
        message: `Found ${codes.length} code sets for model ${modelId}`
      })
    }

    if (action === 'searchAllSpectrum') {
      // Return all Spectrum models across all manufacturers
      const spectrumModels = await searchSpectrumModels('')
      
      return NextResponse.json({
        models: spectrumModels,
        totalModels: spectrumModels.length,
        message: `Found ${spectrumModels.length} Spectrum cable box models`
      })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })

  } catch (error) {
    logger.error('Error in POST handler:', error)
    return NextResponse.json({ 
      error: 'Failed to process request'
    }, { status: 500 })
  }
}
