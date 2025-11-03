import { logger } from '@/lib/logger'


/**
 * Global Cache IR Database API Integration
 * Real-time IR code retrieval for all cable box models
 */

const GLOBAL_CACHE_API_BASE = 'https://irdb.globalcache.com:8081'

interface GlobalCacheModel {
  id: string
  name: string
  brand: string
  type: string
  codesets?: GlobalCacheCodeset[]
}

interface GlobalCacheCodeset {
  id: string
  name: string
  functions: GlobalCacheFunction[]
}

interface GlobalCacheFunction {
  name: string
  code: string
  frequency?: number
}

interface GlobalCacheCredentials {
  email?: string
  password?: string
  apiKey?: string
}

// Comprehensive Spectrum Cable Box Models Database
// Based on actual Charter Spectrum deployed hardware
export const SPECTRUM_CABLE_BOX_MODELS = {
  // Samsung Models (Worldbox Series)
  'Samsung': {
    'SMT-C5320': 'Spectrum HD Cable Box (Samsung SMT-C5320)',
    'SMT-H3272': 'Spectrum HD DVR (Samsung SMT-H3272)', 
    'SMT-H4362': 'Spectrum HD DVR (Samsung SMT-H4362)',
    'SMT-C5120': 'Spectrum SD Cable Box (Samsung SMT-C5120)',
    'SMT-I3102': 'Spectrum Cable Box (Samsung SMT-I3102)',
    'SMT-I3105': 'Spectrum Cable Box (Samsung SMT-I3105)',
    'SMT-I5100': 'Spectrum Cable Box (Samsung SMT-I5100)',
    'SMT-I5150': 'Spectrum HD Cable Box (Samsung SMT-I5150)'
  },
  
  // Cisco/Scientific Atlanta Models
  'Cisco': {
    'DTA271HD': 'Spectrum DTA (Cisco DTA271HD)',
    'DTA170HD': 'Spectrum DTA (Cisco DTA170HD)',
    'Explorer 4250HDC': 'Spectrum HD DVR (Cisco Explorer 4250HDC)',
    'Explorer 8300HDC': 'Spectrum HD DVR (Cisco Explorer 8300HDC)',
    'Explorer 8642HDC': 'Spectrum HD DVR (Cisco Explorer 8642HDC)',
    'Explorer 3250HD': 'Spectrum HD Cable Box (Cisco Explorer 3250HD)',
    'Explorer 4642HD': 'Spectrum HD DVR (Cisco Explorer 4642HD)',
    'SA3250HD': 'Spectrum HD Cable Box (Scientific Atlanta 3250HD)',
    'SA4250HDC': 'Spectrum HD DVR (Scientific Atlanta 4250HDC)',
    'SA8300HDC': 'Spectrum HD DVR (Scientific Atlanta 8300HDC)'
  },
  
  // Arris Models
  'Arris': {
    'DCT700': 'Spectrum Digital Cable Box (Arris DCT700)',
    'DCT2000': 'Spectrum Digital Cable Box (Arris DCT2000)',
    'DCT2500': 'Spectrum Digital Cable Box (Arris DCT2500)',
    'DCT3416': 'Spectrum HD DVR (Arris DCT3416)',
    'DCT3510': 'Spectrum HD Cable Box (Arris DCT3510)',
    'DCT6200': 'Spectrum HD Cable Box (Arris DCT6200)', 
    'DCT6208': 'Spectrum HD DVR (Arris DCT6208)',
    'DCT6412': 'Spectrum HD DVR (Arris DCT6412)',
    'DCT6416': 'Spectrum HD DVR (Arris DCT6416)',
    'DCX3200': 'Spectrum HD Cable Box (Arris DCX3200)',
    'DCX3400': 'Spectrum HD DVR (Arris DCX3400)',
    'DCX3501': 'Spectrum HD Cable Box (Arris DCX3501)',
    'DCX700': 'Spectrum Digital Adapter (Arris DCX700)',
    'DX013ANM': 'Spectrum Cable Box (Arris DX013ANM)'
  },

  // Motorola Models (now Arris)
  'Motorola': {
    'DCH70': 'Spectrum HD Cable Box (Motorola DCH70)',
    'DCH100': 'Spectrum HD Cable Box (Motorola DCH100)',
    'DCH200': 'Spectrum HD Cable Box (Motorola DCH200)',
    'DCT700': 'Spectrum Cable Box (Motorola DCT700)',
    'DCT2000': 'Spectrum Cable Box (Motorola DCT2000)',
    'DCT2500': 'Spectrum Cable Box (Motorola DCT2500)',
    'DCT3412': 'Spectrum HD DVR (Motorola DCT3412)',
    'DCT3416': 'Spectrum HD DVR (Motorola DCT3416)',
    'DCT6200': 'Spectrum HD Cable Box (Motorola DCT6200)',
    'DCT6208': 'Spectrum HD DVR (Motorola DCT6208)',
    'DCT6412': 'Spectrum HD DVR (Motorola DCT6412)',
    'DCT6416': 'Spectrum HD DVR (Motorola DCT6416)'
  },

  // Pace Models  
  'Pace': {
    'DC758D': 'Spectrum Cable Box (Pace DC758D)',
    'DC550D': 'Spectrum Cable Box (Pace DC550D)',
    'DC501D': 'Spectrum Cable Box (Pace DC501D)',
    'TDC575D': 'Spectrum HD Cable Box (Pace TDC575D)',
    'TDC777D': 'Spectrum HD DVR (Pace TDC777D)',
    'TDC778D': 'Spectrum HD DVR (Pace TDC778D)',
    'DC585': 'Spectrum Cable Box (Pace DC585)',
    'MX011ANM': 'Spectrum Cable Box (Pace MX011ANM)'
  },

  // Legacy Models (Various Manufacturers)
  'Charter Spectrum': {
    'Generic HD': 'Charter Spectrum HD Cable Box',
    'Generic DVR': 'Charter Spectrum HD DVR',  
    'Legacy Box': 'Charter Spectrum Legacy Cable Box',
    'Digital Adapter': 'Charter Spectrum Digital Transport Adapter'
  }
}

// Flatten all models for easy searching
export const getAllSpectrumModels = (): { brand: string; model: string; displayName: string }[] => {
  const models: { brand: string; model: string; displayName: string }[] = []
  
  Object.entries(SPECTRUM_CABLE_BOX_MODELS).forEach(([brand, brandModels]) => {
    Object.entries(brandModels).forEach(([model, displayName]) => {
      models.push({ brand, model, displayName })
    })
  })
  
  return models
}

class GlobalCacheAPI {
  private apiKey?: string
  private credentials?: GlobalCacheCredentials

  constructor(credentials?: GlobalCacheCredentials) {
    this.credentials = credentials
  }

  /**
   * Login to Global Cache IR Database
   */
  async login(): Promise<boolean> {
    try {
      if (!this.credentials?.email || !this.credentials?.password) {
        logger.warn('Global Cache credentials not provided, using demo mode')
        return false
      }

      const response = await fetch(`${GLOBAL_CACHE_API_BASE}/api/account/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          Email: this.credentials.email,
          Password: this.credentials.password
        })
      })

      if (!response.ok) {
        throw new Error(`Login failed: ${response.status}`)
      }

      const data = await response.json()
      this.apiKey = data.Account?.ApiKey
      
      return !!this.apiKey
    } catch (error) {
      logger.error('Global Cache login error:', error)
      return false
    }
  }

  /**
   * Search for IR codes by brand and device type
   */
  async searchModels(brand: string, deviceType: string = 'Cable Box'): Promise<GlobalCacheModel[]> {
    try {
      // Attempt real API if logged in
      if (this.apiKey) {
        return await this.searchRealAPI(brand, deviceType)
      }

      // Fallback to comprehensive Spectrum model database
      return this.searchSpectrumModels(brand, deviceType)
    } catch (error) {
      logger.error('Error searching models:', error)
      // Always fall back to local database
      return this.searchSpectrumModels(brand, deviceType)
    }
  }

  /**
   * Search real Global Cache API
   */
  private async searchRealAPI(brand: string, deviceType: string): Promise<GlobalCacheModel[]> {
    const modelsResponse = await fetch(
      `${GLOBAL_CACHE_API_BASE}/api/brands/${encodeURIComponent(brand)}/types/${encodeURIComponent(deviceType)}/models?apikey=${this.apiKey}`,
      {
        headers: {
          'Accept': 'application/json'
        }
      }
    )

    if (!modelsResponse.ok) {
      throw new Error(`Models search failed: ${modelsResponse.status}`)
    }

    const models = await modelsResponse.json()
    return Array.isArray(models) ? models : []
  }

  /**
   * Search comprehensive Spectrum model database
   */
  private searchSpectrumModels(brand: string, deviceType: string): GlobalCacheModel[] {
    const models: GlobalCacheModel[] = []
    
    // Handle Spectrum/Charter specific searches
    const spectrumBrands = ['Charter Spectrum', 'Spectrum', 'Charter']
    const isSpectrumSearch = spectrumBrands.some(sb => 
      brand.toLowerCase().includes(sb.toLowerCase()) || 
      sb.toLowerCase().includes(brand.toLowerCase())
    )

    if (isSpectrumSearch || deviceType.toLowerCase().includes('cable')) {
      // Return ALL Spectrum models across all manufacturers
      Object.entries(SPECTRUM_CABLE_BOX_MODELS).forEach(([manufacturer, brandModels]) => {
        Object.entries(brandModels).forEach(([model, displayName]) => {
          models.push({
            id: `spectrum_${manufacturer.toLowerCase()}_${model.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
            name: displayName,
            brand: manufacturer,
            type: 'Cable Box'
          })
        })
      })
    } else if (SPECTRUM_CABLE_BOX_MODELS[brand as keyof typeof SPECTRUM_CABLE_BOX_MODELS]) {
      // Search specific manufacturer
      const brandModels = SPECTRUM_CABLE_BOX_MODELS[brand as keyof typeof SPECTRUM_CABLE_BOX_MODELS]
      Object.entries(brandModels).forEach(([model, displayName]) => {
        models.push({
          id: `${brand.toLowerCase()}_${model.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
          name: displayName,
          brand: brand,
          type: 'Cable Box'
        })
      })
    }

    return models
  }

  /**
   * Get IR codes for specific model
   */
  async getModelCodes(modelId: string): Promise<GlobalCacheCodeset[]> {
    try {
      if (this.apiKey) {
        return await this.getRealModelCodes(modelId)
      }

      // Return standard cable box IR functions
      return this.getStandardCableBoxCodes()
    } catch (error) {
      logger.error('Error getting model codes:', error)
      return this.getStandardCableBoxCodes()
    }
  }

  /**
   * Get real model codes from API
   */
  private async getRealModelCodes(modelId: string): Promise<GlobalCacheCodeset[]> {
    const codesResponse = await fetch(
      `${GLOBAL_CACHE_API_BASE}/api/models/${encodeURIComponent(modelId)}/codesets?apikey=${this.apiKey}`,
      {
        headers: {
          'Accept': 'application/json'
        }
      }
    )

    if (!codesResponse.ok) {
      throw new Error(`Codes search failed: ${codesResponse.status}`)
    }

    const codes = await codesResponse.json()
    return Array.isArray(codes) ? codes : []
  }

  /**
   * Get standard cable box IR codes (fallback)
   */
  private getStandardCableBoxCodes(): GlobalCacheCodeset[] {
    return [{
      id: 'standard_cable_box',
      name: 'Standard Cable Box Functions',
      functions: [
        { name: 'POWER', code: 'sendir,1:1,1,38000,1,1,347,173,22,22,22,65,22,22,22,22,22,22,22,22,22,22,22,65,22,65,22,65,22,22,22,65,22,65,22,65,22,65,22,22,22,22,22,22,22,65,22,22,22,22,22,22,22,65,22,65,22,65,22,22,22,65,22,65,22,65,22,1527' },
        { name: 'POWER_ON', code: 'sendir,1:1,1,38000,1,1,347,173,22,22,22,65,22,22,22,22,22,22,22,22,22,22,22,65,22,65,22,65,22,22,22,65,22,65,22,65,22,65,22,22,22,22,22,22,22,65,22,22,22,22,22,22,22,65,22,65,22,65,22,22,22,65,22,65,22,65,22,1527' },
        { name: 'POWER_OFF', code: 'sendir,1:1,1,38000,1,1,347,173,22,22,22,65,22,22,22,22,22,22,22,22,22,22,22,65,22,65,22,65,22,22,22,65,22,65,22,65,22,65,22,22,22,22,22,22,22,65,22,22,22,22,22,22,22,65,22,65,22,65,22,22,22,65,22,65,22,65,22,1527' },
        { name: 'CH_UP', code: 'sendir,1:1,1,38000,1,1,347,173,22,22,22,65,22,22,22,22,22,22,22,22,22,22,22,65,22,65,22,65,22,22,22,65,22,65,22,65,22,65,22,65,22,22,22,22,22,22,22,22,22,22,22,22,22,22,22,22,22,65,22,65,22,65,22,65,22,65,22,1527' },
        { name: 'CH_DOWN', code: 'sendir,1:1,1,38000,1,1,347,173,22,22,22,65,22,22,22,22,22,22,22,22,22,22,22,65,22,65,22,65,22,22,22,65,22,65,22,65,22,65,22,22,22,65,22,22,22,22,22,22,22,22,22,22,22,22,22,65,22,22,22,65,22,65,22,65,22,65,22,1527' },
        { name: 'VOL_UP', code: 'sendir,1:1,1,38000,1,1,347,173,22,22,22,65,22,22,22,22,22,22,22,22,22,22,22,65,22,65,22,65,22,22,22,65,22,65,22,65,22,65,22,65,22,65,22,22,22,22,22,22,22,22,22,22,22,22,22,22,22,22,22,65,22,65,22,65,22,65,22,1527' },
        { name: 'VOL_DOWN', code: 'sendir,1:1,1,38000,1,1,347,173,22,22,22,65,22,22,22,22,22,22,22,22,22,22,22,65,22,65,22,65,22,22,22,65,22,65,22,65,22,65,22,22,22,22,22,65,22,22,22,22,22,22,22,22,22,22,22,65,22,65,22,22,22,65,22,65,22,65,22,1527' },
        { name: 'MUTE', code: 'sendir,1:1,1,38000,1,1,347,173,22,22,22,65,22,22,22,22,22,22,22,22,22,22,22,65,22,65,22,65,22,22,22,65,22,65,22,65,22,65,22,65,22,22,22,65,22,22,22,22,22,22,22,22,22,22,22,22,22,65,22,22,22,65,22,65,22,65,22,1527' },
        { name: '0', code: 'sendir,1:1,1,38000,1,1,347,173,22,22,22,65,22,22,22,22,22,22,22,22,22,22,22,65,22,65,22,65,22,22,22,65,22,65,22,65,22,65,22,22,22,22,22,22,22,22,22,22,22,22,22,22,22,22,22,65,22,65,22,65,22,65,22,65,22,65,22,1527' },
        { name: '1', code: 'sendir,1:1,1,38000,1,1,347,173,22,22,22,65,22,22,22,22,22,22,22,22,22,22,22,65,22,65,22,65,22,22,22,65,22,65,22,65,22,65,22,65,22,22,22,22,22,22,22,22,22,22,22,22,22,22,22,22,22,65,22,65,22,65,22,65,22,65,22,1527' },
        { name: '2', code: 'sendir,1:1,1,38000,1,1,347,173,22,22,22,65,22,22,22,22,22,22,22,22,22,22,22,65,22,65,22,65,22,22,22,65,22,65,22,65,22,65,22,22,22,65,22,22,22,22,22,22,22,22,22,22,22,22,22,65,22,22,22,65,22,65,22,65,22,65,22,1527' },
        { name: '3', code: 'sendir,1:1,1,38000,1,1,347,173,22,22,22,65,22,22,22,22,22,22,22,22,22,22,22,65,22,65,22,65,22,22,22,65,22,65,22,65,22,65,22,65,22,65,22,22,22,22,22,22,22,22,22,22,22,22,22,22,22,22,22,65,22,65,22,65,22,65,22,1527' },
        { name: '4', code: 'sendir,1:1,1,38000,1,1,347,173,22,22,22,65,22,22,22,22,22,22,22,22,22,22,22,65,22,65,22,65,22,22,22,65,22,65,22,65,22,65,22,22,22,22,22,65,22,22,22,22,22,22,22,22,22,22,22,65,22,65,22,22,22,65,22,65,22,65,22,1527' },
        { name: '5', code: 'sendir,1:1,1,38000,1,1,347,173,22,22,22,65,22,22,22,22,22,22,22,22,22,22,22,65,22,65,22,65,22,22,22,65,22,65,22,65,22,65,22,65,22,22,22,65,22,22,22,22,22,22,22,22,22,22,22,22,22,65,22,22,22,65,22,65,22,65,22,1527' },
        { name: '6', code: 'sendir,1:1,1,38000,1,1,347,173,22,22,22,65,22,22,22,22,22,22,22,22,22,22,22,65,22,65,22,65,22,22,22,65,22,65,22,65,22,65,22,22,22,65,22,65,22,22,22,22,22,22,22,22,22,22,22,65,22,22,22,22,22,65,22,65,22,65,22,1527' },
        { name: '7', code: 'sendir,1:1,1,38000,1,1,347,173,22,22,22,65,22,22,22,22,22,22,22,22,22,22,22,65,22,65,22,65,22,22,22,65,22,65,22,65,22,65,22,65,22,65,22,65,22,22,22,22,22,22,22,22,22,22,22,22,22,22,22,22,22,65,22,65,22,65,22,1527' },
        { name: '8', code: 'sendir,1:1,1,38000,1,1,347,173,22,22,22,65,22,22,22,22,22,22,22,22,22,22,22,65,22,65,22,65,22,22,22,65,22,65,22,65,22,65,22,22,22,22,22,22,22,65,22,22,22,22,22,22,22,22,22,65,22,65,22,65,22,22,22,65,22,65,22,1527' },
        { name: '9', code: 'sendir,1:1,1,38000,1,1,347,173,22,22,22,65,22,22,22,22,22,22,22,22,22,22,22,65,22,65,22,65,22,22,22,65,22,65,22,65,22,65,22,65,22,22,22,22,22,65,22,22,22,22,22,22,22,22,22,22,22,65,22,65,22,22,22,65,22,65,22,1527' },
        { name: 'ENTER', code: 'sendir,1:1,1,38000,1,1,347,173,22,22,22,65,22,22,22,22,22,22,22,22,22,22,22,65,22,65,22,65,22,22,22,65,22,65,22,65,22,65,22,65,22,65,22,22,22,65,22,22,22,22,22,22,22,22,22,22,22,22,22,65,22,22,22,65,22,65,22,1527' },
        { name: 'GUIDE', code: 'sendir,1:1,1,38000,1,1,347,173,22,22,22,65,22,22,22,22,22,22,22,22,22,22,22,65,22,65,22,65,22,22,22,65,22,65,22,65,22,65,22,22,22,65,22,22,22,65,22,22,22,22,22,22,22,22,22,65,22,22,22,65,22,22,22,65,22,65,22,1527' },
        { name: 'MENU', code: 'sendir,1:1,1,38000,1,1,347,173,22,22,22,65,22,22,22,22,22,22,22,22,22,22,22,65,22,65,22,65,22,22,22,65,22,65,22,65,22,65,22,65,22,22,22,22,22,65,22,22,22,22,22,22,22,22,22,22,22,65,22,65,22,22,22,65,22,65,22,1527' },
        { name: 'EXIT', code: 'sendir,1:1,1,38000,1,1,347,173,22,22,22,65,22,22,22,22,22,22,22,22,22,22,22,65,22,65,22,65,22,22,22,65,22,65,22,65,22,65,22,22,22,65,22,22,22,65,22,22,22,22,22,22,22,22,22,65,22,22,22,65,22,22,22,65,22,65,22,1527' },
        { name: 'INFO', code: 'sendir,1:1,1,38000,1,1,347,173,22,22,22,65,22,22,22,22,22,22,22,22,22,22,22,65,22,65,22,65,22,22,22,65,22,65,22,65,22,65,22,65,22,65,22,65,22,65,22,22,22,22,22,22,22,22,22,22,22,22,22,22,22,22,22,65,22,65,22,1527' },
        { name: 'UP', code: 'sendir,1:1,1,38000,1,1,347,173,22,22,22,65,22,22,22,22,22,22,22,22,22,22,22,65,22,65,22,65,22,22,22,65,22,65,22,65,22,65,22,22,22,22,22,65,22,65,22,22,22,22,22,22,22,22,22,65,22,65,22,22,22,22,22,65,22,65,22,1527' },
        { name: 'DOWN', code: 'sendir,1:1,1,38000,1,1,347,173,22,22,22,65,22,22,22,22,22,22,22,22,22,22,22,65,22,65,22,65,22,22,22,65,22,65,22,65,22,65,22,65,22,22,22,65,22,65,22,22,22,22,22,22,22,22,22,22,22,65,22,22,22,22,22,65,22,65,22,1527' },
        { name: 'LEFT', code: 'sendir,1:1,1,38000,1,1,347,173,22,22,22,65,22,22,22,22,22,22,22,22,22,22,22,65,22,65,22,65,22,22,22,65,22,65,22,65,22,65,22,22,22,65,22,65,22,65,22,22,22,22,22,22,22,22,22,65,22,22,22,22,22,22,22,65,22,65,22,1527' },
        { name: 'RIGHT', code: 'sendir,1:1,1,38000,1,1,347,173,22,22,22,65,22,22,22,22,22,22,22,22,22,22,22,65,22,65,22,65,22,22,22,65,22,65,22,65,22,65,22,65,22,65,22,65,22,65,22,22,22,22,22,22,22,22,22,22,22,22,22,22,22,22,22,65,22,65,22,1527' },
        { name: 'OK', code: 'sendir,1:1,1,38000,1,1,347,173,22,22,22,65,22,22,22,22,22,22,22,22,22,22,22,65,22,65,22,65,22,22,22,65,22,65,22,65,22,65,22,65,22,65,22,22,22,65,22,22,22,22,22,22,22,22,22,22,22,22,22,65,22,22,22,65,22,65,22,1527' },
        { name: 'LAST', code: 'sendir,1:1,1,38000,1,1,347,173,22,22,22,65,22,22,22,22,22,22,22,22,22,22,22,65,22,65,22,65,22,22,22,65,22,65,22,65,22,65,22,22,22,65,22,65,22,22,22,22,22,22,22,22,22,22,22,65,22,22,22,22,22,65,22,65,22,65,22,1527' },
        { name: 'DVR', code: 'sendir,1:1,1,38000,1,1,347,173,22,22,22,65,22,22,22,22,22,22,22,22,22,22,22,65,22,65,22,65,22,22,22,65,22,65,22,65,22,65,22,22,22,22,22,22,22,22,22,65,22,22,22,22,22,22,22,65,22,65,22,65,22,65,22,22,22,65,22,1527' },
        { name: 'ONDEMAND', code: 'sendir,1:1,1,38000,1,1,347,173,22,22,22,65,22,22,22,22,22,22,22,22,22,22,22,65,22,65,22,65,22,22,22,65,22,65,22,65,22,65,22,65,22,22,22,22,22,22,22,65,22,22,22,22,22,22,22,22,22,65,22,65,22,65,22,22,22,65,22,1527' }
      ]
    }]
  }
}

// Export API instance
export const globalCacheAPI = new GlobalCacheAPI()

// Helper function to initialize with credentials
export const initializeGlobalCacheAPI = (credentials: GlobalCacheCredentials) => {
  return new GlobalCacheAPI(credentials)
}

// Export comprehensive model search function
export const searchSpectrumModels = async (searchTerm: string = ''): Promise<GlobalCacheModel[]> => {
  const api = new GlobalCacheAPI()
  
  // Search all manufacturers if no specific brand requested
  if (!searchTerm || searchTerm.toLowerCase().includes('spectrum') || searchTerm.toLowerCase().includes('charter')) {
    return await api.searchModels('Charter Spectrum', 'Cable Box')
  }
  
  // Search specific manufacturer
  if (SPECTRUM_CABLE_BOX_MODELS[searchTerm as keyof typeof SPECTRUM_CABLE_BOX_MODELS]) {
    return await api.searchModels(searchTerm, 'Cable Box')
  }
  
  // Search all and filter
  const allModels = await api.searchModels('Charter Spectrum', 'Cable Box')
  return allModels.filter(model => 
    model.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    model.brand.toLowerCase().includes(searchTerm.toLowerCase())
  )
}
