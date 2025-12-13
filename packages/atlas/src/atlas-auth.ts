
/**
 * Atlas Processor Authentication Utilities
 * 
 * Handles HTTP Basic Authentication for AtlasIED Atmosphere processors.
 * Most Atlas processors require authentication for their web interface and API access.
 * 
 * Common default credentials:
 * - Username: admin
 * - Password: admin (or blank)
 * 
 * Note: Always change default credentials in production environments.
 */

/**
 * Creates HTTP Basic Auth header
 */
export function createBasicAuthHeader(username: string, password: string): string {
  const credentials = `${username}:${password}`
  const encoded = Buffer.from(credentials).toString('base64')
  return `Basic ${encoded}`
}

/**
 * Creates headers object with authentication
 */
export function createAuthHeaders(username?: string, password?: string): HeadersInit {
  const headers: HeadersInit = {
    'User-Agent': 'Sports-Bar-AI-Assistant/1.0',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
  }

  if (username && password) {
    headers['Authorization'] = createBasicAuthHeader(username, password)
  }

  return headers
}

/**
 * Simple encryption for storing passwords (base64 encoding)
 * Note: This is NOT secure encryption, just obfuscation.
 * For production, use proper encryption like AES-256.
 */
export function encryptPassword(password: string): string {
  return Buffer.from(password).toString('base64')
}

/**
 * Decrypt password from storage
 */
export function decryptPassword(encrypted: string): string {
  return Buffer.from(encrypted, 'base64').toString('utf-8')
}

/**
 * Default credentials for Atlas processors
 */
export const ATLAS_DEFAULT_CREDENTIALS = {
  username: 'admin',
  password: 'admin',
  alternativePasswords: ['', 'password', 'Admin', '1234']
}

/**
 * Test multiple credential combinations
 */
export async function testCredentials(
  ipAddress: string,
  port: number,
  credentialsList: Array<{ username: string; password: string }>
): Promise<{ success: boolean; credentials?: { username: string; password: string }; error?: string }> {
  
  for (const credentials of credentialsList) {
    try {
      const testUrl = `http://${ipAddress}:${port}`
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 5000)

      const response = await fetch(testUrl, {
        method: 'GET',
        headers: createAuthHeaders(credentials.username, credentials.password),
        signal: controller.signal,
        // @ts-ignore - Node.js specific option
        rejectUnauthorized: false
      })

      clearTimeout(timeoutId)

      // Success if we get 200 or any response that's not 401/403
      if (response.status === 200 || (response.status >= 200 && response.status < 400)) {
        return { success: true, credentials }
      }

      // If we get 401, credentials are wrong, try next
      if (response.status === 401 || response.status === 403) {
        continue
      }

      // Other status codes might indicate connection success
      if (response.status < 500) {
        return { success: true, credentials }
      }

    } catch (error: any) {
      // Continue to next credential set
      continue
    }
  }

  return { 
    success: false, 
    error: 'All credential combinations failed. Please verify username and password.' 
  }
}
