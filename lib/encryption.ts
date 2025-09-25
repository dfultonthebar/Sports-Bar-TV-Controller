
import crypto from 'crypto'

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'default-fallback-key-32-characters'
const ALGORITHM = 'aes-256-cbc'

export function encrypt(text: string): string {
  try {
    const iv = crypto.randomBytes(16)
    const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY, 'hex'), iv)
    let encrypted = cipher.update(text, 'utf8', 'hex')
    encrypted += cipher.final('hex')
    return iv.toString('hex') + ':' + encrypted
  } catch (error) {
    console.error('Encryption error:', error)
    throw new Error('Failed to encrypt data')
  }
}

export function decrypt(text: string): string {
  try {
    const textParts = text.split(':')
    if (textParts.length !== 2) {
      throw new Error('Invalid encrypted data format')
    }
    const iv = Buffer.from(textParts[0], 'hex')
    const encryptedText = textParts[1]
    const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY, 'hex'), iv)
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8')
    decrypted += decipher.final('utf8')
    return decrypted
  } catch (error) {
    console.error('Decryption error:', error)
    throw new Error('Failed to decrypt data')
  }
}
