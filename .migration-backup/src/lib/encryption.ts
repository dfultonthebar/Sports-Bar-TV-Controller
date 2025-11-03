
import crypto from 'crypto'

import { logger } from '@/lib/logger'
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'sports-bar-ai-assistant-encryption-key-2025'
const ALGORITHM = 'aes-256-gcm'

export function encrypt(text: string): string {
  try {
    // Create a 32-byte key from the environment variable
    const key = crypto.createHash('sha256').update(ENCRYPTION_KEY).digest()
    
    // Generate a random initialization vector
    const iv = crypto.randomBytes(16)
    
    // Create cipher
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv)
    
    // Encrypt the text
    let encrypted = cipher.update(text, 'utf8', 'hex')
    encrypted += cipher.final('hex')
    
    // Combine IV and encrypted data
    return iv.toString('hex') + ':' + encrypted
  } catch (error) {
    logger.error('Encryption error:', error)
    throw new Error('Failed to encrypt data')
  }
}

export function decrypt(encryptedText: string): string {
  try {
    // Create a 32-byte key from the environment variable
    const key = crypto.createHash('sha256').update(ENCRYPTION_KEY).digest()
    
    // Split the IV and encrypted data
    const textParts = encryptedText.split(':')
    if (textParts.length !== 2) {
      throw new Error('Invalid encrypted text format')
    }
    
    const iv = Buffer.from(textParts[0], 'hex')
    const encryptedData = textParts[1]
    
    // Create decipher
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv)
    
    // Decrypt the data
    let decrypted = decipher.update(encryptedData, 'hex', 'utf8')
    decrypted += decipher.final('utf8')
    
    return decrypted
  } catch (error) {
    logger.error('Decryption error:', error)
    throw new Error('Failed to decrypt data')
  }
}
