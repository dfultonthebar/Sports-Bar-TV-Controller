/**
 * Global Cache IR Database Service
 * Handles communication with the Global Cache Cloud IR Database
 * API Documentation: https://irdb.globalcache.com:8081/
 */

import { logDatabaseOperation } from '@sports-bar/data'
import { logger } from '@sports-bar/logger'

const IR_DATABASE_BASE_URL = 'https://irdb.globalcache.com:8081'

export interface IRDBBrand {
  Name: string
}

export interface IRDBType {
  Name: string
}

export interface IRDBBrandType {
  Brand: string
  Type: string
}

export interface IRDBModel {
  ID: string
  Brand: string
  Type: string
  Name: string
  Notes: string
}

export interface IRDBFunction {
  SetID: string
  Function: string
}

export interface IRDBCode {
  SetID: string
  Function: string
  Code1: string
  HexCode1?: string
  Code2?: string
  HexCode2?: string
}

export interface IRDBCodeResponse {
  Status: string
  Message: string
  Code: number
}

export interface IRDBAccountResponse {
  Status: string
  Message: string
  Account?: {
    ApiKey: string
    Email: string
  }
}

export class IRDatabaseService {
  private static instance: IRDatabaseService

  private constructor() {}

  static getInstance(): IRDatabaseService {
    if (!IRDatabaseService.instance) {
      IRDatabaseService.instance = new IRDatabaseService()
    }
    return IRDatabaseService.instance
  }

  /**
   * Login to Global Cache IR Database
   */
  async login(email: string, password: string): Promise<IRDBAccountResponse> {
    logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    logger.info('🔐 [IR DATABASE] Attempting login')
    logger.info('   Email:', { data: email })
    logger.info('   Timestamp:', { data: new Date().toISOString() })
    logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

    try {
      const response = await fetch(`${IR_DATABASE_BASE_URL}/api/account/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          Email: email,
          Password: password
        })
      })

      const data: IRDBAccountResponse = await response.json()

      logger.info('📥 [IR DATABASE] Login response:')
      logger.info('   Status:', { data: data.Status })
      logger.info('   Success:', { data: data.Status === 'success' })

      if (data.Status === 'success' && data.Account?.ApiKey) {
        logger.info('✅ [IR DATABASE] Login successful')
        logger.info('   API Key:', { data: data.Account.ApiKey.substring(0, 8) + '...' })
      } else {
        logger.info('❌ [IR DATABASE] Login failed:', { data: data.Message })
      }

      logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

      logDatabaseOperation('IR_DATABASE', 'login', {
        email,
        success: data.Status === 'success',
        message: data.Message
      })

      return data
    } catch (error: any) {
      logger.info('❌ [IR DATABASE] Login error:', error.message)
      logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

      logDatabaseOperation('IR_DATABASE', 'login_error', {
        email,
        error: error.message
      })

      return {
        Status: 'failure',
        Message: error.message,
        Code: -1
      } as any
    }
  }

  /**
   * Logout from Global Cache IR Database
   */
  async logout(apiKey: string): Promise<IRDBAccountResponse> {
    logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    logger.info('🔓 [IR DATABASE] Logging out')
    logger.info('   Timestamp:', { data: new Date().toISOString() })
    logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

    try {
      const response = await fetch(`${IR_DATABASE_BASE_URL}/api/account/logout?apikey=${apiKey}`, {
        method: 'POST'
      })

      const data: IRDBAccountResponse = await response.json()

      logger.info('✅ [IR DATABASE] Logout successful')
      logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

      logDatabaseOperation('IR_DATABASE', 'logout', {
        success: true
      })

      return data
    } catch (error: any) {
      logger.info('❌ [IR DATABASE] Logout error:', error.message)
      logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

      return {
        Status: 'failure',
        Message: error.message,
        Code: -1
      } as any
    }
  }

  /**
   * Get list of all brands
   */
  async getBrands(): Promise<IRDBBrand[]> {
    logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    logger.info('📋 [IR DATABASE] Fetching brands')
    logger.info('   Timestamp:', { data: new Date().toISOString() })
    logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

    try {
      const response = await fetch(`${IR_DATABASE_BASE_URL}/api/brands`)
      const data: IRDBBrand[] = await response.json()

      logger.info('✅ [IR DATABASE] Brands fetched successfully')
      logger.info('   Count:', { data: data.length })
      logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

      logDatabaseOperation('IR_DATABASE', 'get_brands', {
        count: data.length
      })

      return data
    } catch (error: any) {
      logger.info('❌ [IR DATABASE] Error fetching brands:', error.message)
      logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

      logDatabaseOperation('IR_DATABASE', 'get_brands_error', {
        error: error.message
      })

      throw error
    }
  }

  /**
   * Get list of all device types
   */
  async getTypes(): Promise<IRDBType[]> {
    logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    logger.info('📋 [IR DATABASE] Fetching device types')
    logger.info('   Timestamp:', { data: new Date().toISOString() })
    logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

    try {
      const response = await fetch(`${IR_DATABASE_BASE_URL}/api/types`)
      const data: IRDBType[] = await response.json()

      logger.info('✅ [IR DATABASE] Types fetched successfully')
      logger.info('   Count:', { data: data.length })
      logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

      logDatabaseOperation('IR_DATABASE', 'get_types', {
        count: data.length
      })

      return data
    } catch (error: any) {
      logger.info('❌ [IR DATABASE] Error fetching types:', error.message)
      logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

      logDatabaseOperation('IR_DATABASE', 'get_types_error', {
        error: error.message
      })

      throw error
    }
  }

  /**
   * Get device types for a specific brand
   */
  async getBrandTypes(brand: string): Promise<IRDBBrandType[]> {
    const encodedBrand = this.encodeSpecialChars(brand)

    logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    logger.info('📋 [IR DATABASE] Fetching types for brand')
    logger.info('   Brand:', { data: brand })
    logger.info('   Timestamp:', { data: new Date().toISOString() })
    logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

    try {
      const response = await fetch(`${IR_DATABASE_BASE_URL}/api/brands/${encodedBrand}/types`)
      const data: IRDBBrandType[] = await response.json()

      logger.info('✅ [IR DATABASE] Brand types fetched successfully')
      logger.info('   Count:', { data: data.length })
      logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

      logDatabaseOperation('IR_DATABASE', 'get_brand_types', {
        brand,
        count: data.length
      })

      return data
    } catch (error: any) {
      logger.info('❌ [IR DATABASE] Error fetching brand types:', error.message)
      logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

      logDatabaseOperation('IR_DATABASE', 'get_brand_types_error', {
        brand,
        error: error.message
      })

      throw error
    }
  }

  /**
   * Get models for a specific brand and device type
   */
  async getModels(brand: string, type: string): Promise<IRDBModel[]> {
    const encodedBrand = this.encodeSpecialChars(brand)
    const encodedType = this.encodeSpecialChars(type)

    logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    logger.info('📋 [IR DATABASE] Fetching models')
    logger.info('   Brand:', { data: brand })
    logger.info('   Type:', { data: type })
    logger.info('   Timestamp:', { data: new Date().toISOString() })
    logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

    try {
      const response = await fetch(
        `${IR_DATABASE_BASE_URL}/api/brands/${encodedBrand}/types/${encodedType}/models`
      )
      const data: IRDBModel[] = await response.json()

      logger.info('✅ [IR DATABASE] Models fetched successfully')
      logger.info('   Count:', { data: data.length })
      logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

      logDatabaseOperation('IR_DATABASE', 'get_models', {
        brand,
        type,
        count: data.length
      })

      return data
    } catch (error: any) {
      logger.info('❌ [IR DATABASE] Error fetching models:', error.message)
      logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

      logDatabaseOperation('IR_DATABASE', 'get_models_error', {
        brand,
        type,
        error: error.message
      })

      throw error
    }
  }

  /**
   * Get available functions for a codeset
   */
  async getFunctions(codesetId: string): Promise<IRDBFunction[]> {
    logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    logger.info('📋 [IR DATABASE] Fetching functions')
    logger.info('   Codeset ID:', { data: codesetId })
    logger.info('   Timestamp:', { data: new Date().toISOString() })
    logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

    try {
      const response = await fetch(
        `${IR_DATABASE_BASE_URL}/api/codesets/${codesetId}/functions`
      )
      const data: IRDBFunction[] = await response.json()

      logger.info('✅ [IR DATABASE] Functions fetched successfully')
      logger.info('   Count:', { data: data.length })
      logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

      logDatabaseOperation('IR_DATABASE', 'get_functions', {
        codesetId,
        count: data.length
      })

      return data
    } catch (error: any) {
      logger.info('❌ [IR DATABASE] Error fetching functions:', error.message)
      logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

      logDatabaseOperation('IR_DATABASE', 'get_functions_error', {
        codesetId,
        error: error.message
      })

      throw error
    }
  }

  /**
   * Download a specific IR code
   */
  async downloadCode(
    codesetId: string,
    functionName: string,
    apiKey: string,
    format: 'gc' | 'hex' | 'compressed' = 'gc'
  ): Promise<IRDBCode> {
    const encodedFunction = this.encodeSpecialChars(functionName)

    logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    logger.info('⬇️  [IR DATABASE] Downloading IR code')
    logger.info('   Codeset ID:', { data: codesetId })
    logger.info('   Function:', { data: functionName })
    logger.info('   Format:', { data: format })
    logger.info('   Timestamp:', { data: new Date().toISOString() })
    logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

    try {
      const url = `${IR_DATABASE_BASE_URL}/api/codesets/${codesetId}/functions/${encodedFunction}/codes?apikey=${apiKey}&output=direct&format=${format}`
      logger.info('   API URL:', { data: url })

      const response = await fetch(url)

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data: any = await response.json()

      // Log raw API response for debugging
      logger.info('📥 [IR DATABASE] Raw API Response:')
      logger.info('   Response type:', { data: typeof data })
      logger.info('   Response keys:', { data: Object.keys(data || {}) })
      logger.info('   Has Code1:', { data: 'Code1' in (data || {}) })
      logger.info('   Code1 value:', data?.Code1)

      // Check if this is a CodeResponse (error) instead of a Code (success)
      if (data.Status) {
        logger.info('⚠️  [IR DATABASE] Received CodeResponse (not Code)')
        logger.info('   Status:', data.Status)
        logger.info('   Message:', data.Message)
        logger.info('   Error Code:', data.Code)

        // Map error codes to messages
        const errorMessages: { [key: number]: string } = {
          2: 'API Key not found',
          3: 'User found, but is not currently logged in',
          4: 'Too many IR codes already requested today (rate limit)',
          5: 'Unknown output type requested',
          6: 'Direct output type is not allowed for this account',
          7: 'API key is required but was not provided',
          8: 'Failed to send email (invalid email address)',
          9: 'Unknown format requested'
        }

        const errorMsg = errorMessages[data.Code] || data.Message || 'Unknown error from Global Cache API'
        logger.info('❌ [IR DATABASE] API Error:', errorMsg)
        logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

        logDatabaseOperation('IR_DATABASE', 'download_code_api_error', {
          codesetId,
          functionName,
          errorCode: data.Code,
          errorMessage: errorMsg
        })

        throw new Error(errorMsg)
      }

      // Validate that we have the required Code1 field
      if (!data.Code1) {
        logger.info('❌ [IR DATABASE] Missing Code1 field in response')
        logger.info('   Response data:', { data: JSON.stringify(data, null, 2) })
        logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

        logDatabaseOperation('IR_DATABASE', 'download_code_missing_field', {
          codesetId,
          functionName,
          responseKeys: Object.keys(data || {})
        })

        throw new Error('IR code data missing from API response. Code1 field is required but was not returned.')
      }

      logger.info('✅ [IR DATABASE] Code downloaded successfully')
      logger.info('   Function:', { data: functionName })
      logger.info('   Code1 length:', data.Code1.length)
      logger.info('   HexCode1 length:', data.HexCode1?.length || 0)
      logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

      logDatabaseOperation('IR_DATABASE', 'download_code', {
        codesetId,
        functionName,
        format,
        success: true,
        code1Length: data.Code1.length,
        hasHexCode: !!data.HexCode1
      })

      return data as IRDBCode
    } catch (error: any) {
      logger.info('❌ [IR DATABASE] Error downloading code:', error.message)
      logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

      logDatabaseOperation('IR_DATABASE', 'download_code_error', {
        codesetId,
        functionName,
        error: error.message
      })

      throw error
    }
  }

  /**
   * Download entire codeset
   */
  async downloadCodeset(
    codesetId: string,
    apiKey: string,
    format: 'gc' | 'hex' | 'compressed' = 'gc'
  ): Promise<IRDBCodeResponse> {
    logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    logger.info('⬇️  [IR DATABASE] Downloading complete codeset')
    logger.info('   Codeset ID:', { data: codesetId })
    logger.info('   Format:', { data: format })
    logger.info('   Timestamp:', { data: new Date().toISOString() })
    logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

    try {
      const response = await fetch(
        `${IR_DATABASE_BASE_URL}/api/codesets/${codesetId}?apikey=${apiKey}&output=direct&format=${format}`
      )
      const data: IRDBCodeResponse = await response.json()

      logger.info('✅ [IR DATABASE] Codeset downloaded successfully')
      logger.info('   Status:', { data: data.Status })
      logger.info('   Code:', { data: data.Code })
      logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

      logDatabaseOperation('IR_DATABASE', 'download_codeset', {
        codesetId,
        format,
        status: data.Status,
        code: data.Code
      })

      return data
    } catch (error: any) {
      logger.info('❌ [IR DATABASE] Error downloading codeset:', error.message)
      logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

      logDatabaseOperation('IR_DATABASE', 'download_codeset_error', {
        codesetId,
        error: error.message
      })

      throw error
    }
  }

  /**
   * Encode special characters for URL usage
   */
  private encodeSpecialChars(str: string): string {
    return str
      .replace(/&/g, 'xampx')
      .replace(/\//g, 'xfslx')
      .replace(/>/g, 'xgtx')
      .replace(/</g, 'xltx')
      .replace(/:/g, 'xcolx')
      .replace(/\?/g, 'xquex')
      .replace(/%/g, 'xmodx')
      .replace(/\+/g, 'xaddx')
  }
}

export const irDatabaseService = IRDatabaseService.getInstance()
