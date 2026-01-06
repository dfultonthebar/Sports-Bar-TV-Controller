/**
 * Encryption Utility Library
 * Provides AES-256-GCM encryption/decryption for sensitive data
 *
 * SECURITY: Uses cryptographically secure encryption with authenticated encryption (GCM mode)
 * to protect against tampering and ensure confidentiality.
 */

import crypto from 'crypto'

// Encryption configuration
const ALGORITHM = 'aes-256-gcm' as const
const IV_LENGTH = 16 // 128 bits
const SALT_LENGTH = 64
const TAG_LENGTH = 16 // 128 bits for GCM authentication tag
const KEY_LENGTH = 32 // 256 bits
const PBKDF2_ITERATIONS = 100000 // High iteration count for key derivation

export interface EncryptedData {
  iv: string
  salt: string
  tag: string
  encrypted: string
}

/**
 * Get encryption key from environment variable
 * In production, this should be stored securely (e.g., AWS Secrets Manager, HashiCorp Vault)
 */
function getEncryptionKey(): string {
  const key = process.env.ENCRYPTION_KEY
  if (!key) {
    throw new Error('ENCRYPTION_KEY environment variable is not set. Please configure a secure encryption key.')
  }

  if (key.length < 32) {
    throw new Error('ENCRYPTION_KEY must be at least 32 characters long for secure encryption.')
  }

  return key
}

/**
 * Derive a cryptographic key from the master key using PBKDF2
 * This adds an additional layer of security
 */
function deriveKey(masterKey: string, salt: Buffer): Buffer {
  return crypto.pbkdf2Sync(
    masterKey,
    salt,
    PBKDF2_ITERATIONS,
    KEY_LENGTH,
    'sha256'
  )
}

/**
 * Encrypt sensitive data using AES-256-GCM
 *
 * @param plaintext - The data to encrypt (will be converted to string)
 * @returns Encrypted data object containing IV, salt, tag, and ciphertext
 */
export function encrypt(plaintext: string): EncryptedData {
  try {
    // Generate random salt and IV
    const salt = crypto.randomBytes(SALT_LENGTH)
    const iv = crypto.randomBytes(IV_LENGTH)

    // Derive key from master key
    const masterKey = getEncryptionKey()
    const key = deriveKey(masterKey, salt)

    // Create cipher
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv)

    // Encrypt the data
    let encrypted = cipher.update(plaintext, 'utf8', 'hex')
    encrypted += cipher.final('hex')

    // Get the authentication tag
    const tag = cipher.getAuthTag()

    return {
      iv: iv.toString('hex'),
      salt: salt.toString('hex'),
      tag: tag.toString('hex'),
      encrypted: encrypted
    }
  } catch (error) {
    throw new Error(`Encryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Decrypt data encrypted with the encrypt function
 *
 * @param encryptedData - The encrypted data object
 * @returns Decrypted plaintext string
 */
export function decrypt(encryptedData: EncryptedData): string {
  try {
    // Convert hex strings back to buffers
    const iv = Buffer.from(encryptedData.iv, 'hex')
    const salt = Buffer.from(encryptedData.salt, 'hex')
    const tag = Buffer.from(encryptedData.tag, 'hex')

    // Derive the same key
    const masterKey = getEncryptionKey()
    const key = deriveKey(masterKey, salt)

    // Create decipher
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
    decipher.setAuthTag(tag)

    // Decrypt the data
    let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8')
    decrypted += decipher.final('utf8')

    return decrypted
  } catch (error) {
    throw new Error(`Decryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Encrypt data and return as a single base64-encoded string
 * Useful for storing in databases or JSON files
 *
 * @param plaintext - The data to encrypt
 * @returns Base64-encoded encrypted data string
 */
export function encryptToString(plaintext: string): string {
  const encrypted = encrypt(plaintext)
  const combined = JSON.stringify(encrypted)
  return Buffer.from(combined).toString('base64')
}

/**
 * Decrypt data from a base64-encoded string
 *
 * @param encryptedString - Base64-encoded encrypted data string
 * @returns Decrypted plaintext string
 */
export function decryptFromString(encryptedString: string): string {
  try {
    const combined = Buffer.from(encryptedString, 'base64').toString('utf8')
    const encrypted = JSON.parse(combined) as EncryptedData
    return decrypt(encrypted)
  } catch (error) {
    throw new Error(`Invalid encrypted data format: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Generate a secure random encryption key
 * Use this to generate a new ENCRYPTION_KEY for your .env file
 *
 * @param length - Key length in bytes (default: 32 for AES-256)
 * @returns Hex-encoded random key
 */
export function generateEncryptionKey(length: number = 32): string {
  return crypto.randomBytes(length).toString('hex')
}

/**
 * Hash sensitive data using SHA-256
 * Useful for passwords or data that needs one-way hashing
 *
 * @param data - Data to hash
 * @returns Hex-encoded hash
 */
export function hashData(data: string): string {
  return crypto.createHash('sha256').update(data).digest('hex')
}

/**
 * Compare data with a hash (constant-time comparison)
 *
 * @param data - Plain data to compare
 * @param hash - Hash to compare against
 * @returns True if data matches hash
 */
export function compareHash(data: string, hash: string): boolean {
  const dataHash = hashData(data)
  return crypto.timingSafeEqual(
    Buffer.from(dataHash),
    Buffer.from(hash)
  )
}

/**
 * Validate that encryption is properly configured
 * Call this on application startup
 */
export function validateEncryptionSetup(): { valid: boolean; error?: string } {
  try {
    getEncryptionKey()

    // Test encryption/decryption
    const testData = 'test-encryption-validation'
    const encrypted = encryptToString(testData)
    const decrypted = decryptFromString(encrypted)

    if (decrypted !== testData) {
      return { valid: false, error: 'Encryption test failed: decrypted data does not match' }
    }

    return { valid: true }
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Unknown validation error'
    }
  }
}
