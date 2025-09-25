
import crypto from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const SECRET_KEY = process.env.ENCRYPTION_KEY || 'default-secret-key-change-in-production'

// Generate a consistent key from the secret
function getKey(): Buffer {
  return crypto.scryptSync(SECRET_KEY, 'salt', 32)
}

export function encrypt(text: string): string {
  try {
    const key = getKey()
    const iv = crypto.randomBytes(16)
    const cipher = crypto.createCipher('aes-256-cbc', key)
    
    let encrypted = cipher.update(text, 'utf8', 'hex')
    encrypted += cipher.final('hex')
    
    return iv.toString('hex') + ':' + encrypted
  } catch (error) {
    console.error('Encryption error:', error)
    return text // Return original text if encryption fails
  }
}

export function decrypt(encryptedText: string): string {
  try {
    const key = getKey()
    const parts = encryptedText.split(':')
    
    if (parts.length !== 2) {
      return encryptedText // Return as-is if not in expected format
    }
    
    const iv = Buffer.from(parts[0], 'hex')
    const encrypted = parts[1]
    
    const decipher = crypto.createDecipher('aes-256-cbc', key)
    let decrypted = decipher.update(encrypted, 'hex', 'utf8')
    decrypted += decipher.final('utf8')
    
    return decrypted
  } catch (error) {
    console.error('Decryption error:', error)
    return encryptedText // Return original text if decryption fails
  }
}
