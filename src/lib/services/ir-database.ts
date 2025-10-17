
/**
 * Global Cache IR Database Service
 * Handles communication with the Global Cache Cloud IR Database
 * API Documentation: https://irdb.globalcache.com:8081/
 */

import { logDatabaseOperation } from '../database-logger'

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
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('🔐 [IR DATABASE] Attempting login')
    console.log('   Email:', email)
    console.log('   Timestamp:', new Date().toISOString())
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

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
      
      console.log('📥 [IR DATABASE] Login response:')
      console.log('   Status:', data.Status)
      console.log('   Success:', data.Status === 'success')
      
      if (data.Status === 'success' && data.Account?.ApiKey) {
        console.log('✅ [IR DATABASE] Login successful')
        console.log('   API Key:', data.Account.ApiKey.substring(0, 8) + '...')
      } else {
        console.log('❌ [IR DATABASE] Login failed:', data.Message)
      }
      
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      
      logDatabaseOperation('IR_DATABASE', 'login', {
        email,
        success: data.Status === 'success',
        message: data.Message
      })

      return data
    } catch (error: any) {
      console.log('❌ [IR DATABASE] Login error:', error.message)
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      
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
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('🔓 [IR DATABASE] Logging out')
    console.log('   Timestamp:', new Date().toISOString())
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

    try {
      const response = await fetch(`${IR_DATABASE_BASE_URL}/api/account/logout?apikey=${apiKey}`, {
        method: 'POST'
      })

      const data: IRDBAccountResponse = await response.json()
      
      console.log('✅ [IR DATABASE] Logout successful')
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      
      logDatabaseOperation('IR_DATABASE', 'logout', {
        success: true
      })

      return data
    } catch (error: any) {
      console.log('❌ [IR DATABASE] Logout error:', error.message)
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      
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
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('📋 [IR DATABASE] Fetching brands')
    console.log('   Timestamp:', new Date().toISOString())
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

    try {
      const response = await fetch(`${IR_DATABASE_BASE_URL}/api/brands`)
      const data: IRDBBrand[] = await response.json()
      
      console.log('✅ [IR DATABASE] Brands fetched successfully')
      console.log('   Count:', data.length)
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      
      logDatabaseOperation('IR_DATABASE', 'get_brands', {
        count: data.length
      })

      return data
    } catch (error: any) {
      console.log('❌ [IR DATABASE] Error fetching brands:', error.message)
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      
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
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('📋 [IR DATABASE] Fetching device types')
    console.log('   Timestamp:', new Date().toISOString())
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

    try {
      const response = await fetch(`${IR_DATABASE_BASE_URL}/api/types`)
      const data: IRDBType[] = await response.json()
      
      console.log('✅ [IR DATABASE] Types fetched successfully')
      console.log('   Count:', data.length)
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      
      logDatabaseOperation('IR_DATABASE', 'get_types', {
        count: data.length
      })

      return data
    } catch (error: any) {
      console.log('❌ [IR DATABASE] Error fetching types:', error.message)
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      
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
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('📋 [IR DATABASE] Fetching types for brand')
    console.log('   Brand:', brand)
    console.log('   Timestamp:', new Date().toISOString())
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

    try {
      const response = await fetch(`${IR_DATABASE_BASE_URL}/api/brands/${encodedBrand}/types`)
      const data: IRDBBrandType[] = await response.json()
      
      console.log('✅ [IR DATABASE] Brand types fetched successfully')
      console.log('   Count:', data.length)
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      
      logDatabaseOperation('IR_DATABASE', 'get_brand_types', {
        brand,
        count: data.length
      })

      return data
    } catch (error: any) {
      console.log('❌ [IR DATABASE] Error fetching brand types:', error.message)
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      
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
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('📋 [IR DATABASE] Fetching models')
    console.log('   Brand:', brand)
    console.log('   Type:', type)
    console.log('   Timestamp:', new Date().toISOString())
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

    try {
      const response = await fetch(
        `${IR_DATABASE_BASE_URL}/api/brands/${encodedBrand}/types/${encodedType}/models`
      )
      const data: IRDBModel[] = await response.json()
      
      console.log('✅ [IR DATABASE] Models fetched successfully')
      console.log('   Count:', data.length)
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      
      logDatabaseOperation('IR_DATABASE', 'get_models', {
        brand,
        type,
        count: data.length
      })

      return data
    } catch (error: any) {
      console.log('❌ [IR DATABASE] Error fetching models:', error.message)
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      
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
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('📋 [IR DATABASE] Fetching functions')
    console.log('   Codeset ID:', codesetId)
    console.log('   Timestamp:', new Date().toISOString())
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

    try {
      const response = await fetch(
        `${IR_DATABASE_BASE_URL}/api/codesets/${codesetId}/functions`
      )
      const data: IRDBFunction[] = await response.json()
      
      console.log('✅ [IR DATABASE] Functions fetched successfully')
      console.log('   Count:', data.length)
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      
      logDatabaseOperation('IR_DATABASE', 'get_functions', {
        codesetId,
        count: data.length
      })

      return data
    } catch (error: any) {
      console.log('❌ [IR DATABASE] Error fetching functions:', error.message)
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      
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
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('⬇️  [IR DATABASE] Downloading IR code')
    console.log('   Codeset ID:', codesetId)
    console.log('   Function:', functionName)
    console.log('   Format:', format)
    console.log('   Timestamp:', new Date().toISOString())
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

    try {
      const response = await fetch(
        `${IR_DATABASE_BASE_URL}/api/codesets/${codesetId}/functions/${encodedFunction}/codes?apikey=${apiKey}&output=direct&format=${format}`
      )
      const data: IRDBCode = await response.json()
      
      console.log('✅ [IR DATABASE] Code downloaded successfully')
      console.log('   Function:', functionName)
      console.log('   Code length:', data.Code1?.length || 0)
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      
      logDatabaseOperation('IR_DATABASE', 'download_code', {
        codesetId,
        functionName,
        format,
        success: true
      })

      return data
    } catch (error: any) {
      console.log('❌ [IR DATABASE] Error downloading code:', error.message)
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      
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
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('⬇️  [IR DATABASE] Downloading complete codeset')
    console.log('   Codeset ID:', codesetId)
    console.log('   Format:', format)
    console.log('   Timestamp:', new Date().toISOString())
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

    try {
      const response = await fetch(
        `${IR_DATABASE_BASE_URL}/api/codesets/${codesetId}?apikey=${apiKey}&output=direct&format=${format}`
      )
      const data: IRDBCodeResponse = await response.json()
      
      console.log('✅ [IR DATABASE] Codeset downloaded successfully')
      console.log('   Status:', data.Status)
      console.log('   Code:', data.Code)
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      
      logDatabaseOperation('IR_DATABASE', 'download_codeset', {
        codesetId,
        format,
        status: data.Status,
        code: data.Code
      })

      return data
    } catch (error: any) {
      console.log('❌ [IR DATABASE] Error downloading codeset:', error.message)
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      
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
