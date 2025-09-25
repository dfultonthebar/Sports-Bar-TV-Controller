
import crypto from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const SECRET_KEY = process.env.ENCRYPTION_KEY || 'sports-bar-ai-assistant-encryption-key-2025'

// Generate a consistent key from the secret
function getKey(): Buffer {
  return crypto.scryptSync(SECRET_KEY, 'salt', 32)
}

export function encrypt(text: string): string {
  try {
    const key = getKey()
    const iv = crypto.randomBytes(16)
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv)
    
    let encrypted = cipher.update(text, 'utf8', 'hex')
    encrypted += cipher.final('hex')
    const authTag = cipher.getAuthTag()
    
    return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted
  } catch (error) {
    console.error('Encryption error:', error)
    // Fallback to simple base64 encoding if encryption fails
    return 'b64:' + Buffer.from(text).toString('base64')
  }
}

export function decrypt(encryptedText: string): string {
  try {
    // Handle fallback base64 encoding
    if (encryptedText.startsWith('b64:')) {
      return Buffer.from(encryptedText.slice(4), 'base64').toString()
    }
    
    const key = getKey()
    const parts = encryptedText.split(':')
    
    if (parts.length !== 3) {
      // Try old format or return as-is
      return encryptedText
    }
    
    const iv = Buffer.from(parts[0], 'hex')
    const authTag = Buffer.from(parts[1], 'hex')
    const encrypted = parts[2]
    
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
    decipher.setAuthTag(authTag)
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8')
    decrypted += decipher.final('utf8')
    
    return decrypted
  } catch (error) {
    console.error('Decryption error:', error)
    // Return original text if decryption fails
    return encryptedText
  }
}
