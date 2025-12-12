/**
 * API Key Authentication Utilities
 *
 * Handles API key-based authentication for webhooks and automation including:
 * - API key generation and hashing
 * - API key validation
 * - Permission checking
 * - Usage tracking
 */

import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { db } from '@/db'
import { authApiKeys, locations } from '@/db/schema'
import { eq, and } from 'drizzle-orm'
import { AUTH_CONFIG } from './config'
import { logger } from '@/lib/logger'

export interface ApiKeyData {
  id: string
  locationId: string
  name: string
  permissions: string[]
  isActive: boolean
  expiresAt: string | null
  lastUsed: string | null
  usageCount: number
  createdAt: string
}

/**
 * Generate a secure random API key
 */
export function generateApiKey(): string {
  return crypto.randomBytes(AUTH_CONFIG.API_KEY_LENGTH).toString('hex')
}

/**
 * Hash an API key using bcrypt
 */
export async function hashApiKey(apiKey: string): Promise<string> {
  try {
    return await bcrypt.hash(apiKey, AUTH_CONFIG.API_KEY_BCRYPT_ROUNDS)
  } catch (error) {
    logger.error('Error hashing API key:', error)
    throw error
  }
}

/**
 * Verify an API key against a hash
 */
export async function verifyApiKey(apiKey: string, hash: string): Promise<boolean> {
  try {
    return await bcrypt.compare(apiKey, hash)
  } catch (error) {
    logger.error('Error verifying API key:', error)
    return false
  }
}

/**
 * Validate an API key and check permissions for an endpoint
 */
export async function validateApiKey(
  apiKey: string,
  endpoint: string,
  locationId?: string
): Promise<{
  valid: boolean
  keyId?: string
  name?: string
  error?: string
}> {
  try {
    if (!apiKey) {
      return { valid: false, error: 'API key is required' }
    }

    const locId = locationId || AUTH_CONFIG.LOCATION_ID

    // Get all active API keys for this location
    const keys = await db
      .select()
      .from(authApiKeys)
      .where(
        and(
          eq(authApiKeys.locationId, locId),
          eq(authApiKeys.isActive, true)
        )
      )

    // Check each key
    for (const keyRecord of keys) {
      // Check if key has expired
      if (keyRecord.expiresAt) {
        const expiryDate = new Date(keyRecord.expiresAt)
        if (expiryDate < new Date()) {
          logger.warn(`API key ${keyRecord.id} has expired`)
          continue
        }
      }

      // Verify API key
      const isValid = await verifyApiKey(apiKey, keyRecord.keyHash)
      if (isValid) {
        // Check permissions
        const permissions = JSON.parse(keyRecord.permissions) as string[]
        const hasPermission = checkEndpointPermission(endpoint, permissions)

        if (!hasPermission) {
          logger.warn(`API key ${keyRecord.id} does not have permission for ${endpoint}`)
          return {
            valid: false,
            error: 'Insufficient permissions for this endpoint',
          }
        }

        // Update last used timestamp and usage count
        await db
          .update(authApiKeys)
          .set({
            lastUsed: new Date().toISOString(),
            usageCount: keyRecord.usageCount + 1,
          })
          .where(eq(authApiKeys.id, keyRecord.id))

        logger.info(`Valid API key authenticated: ${keyRecord.name}`)

        return {
          valid: true,
          keyId: keyRecord.id,
          name: keyRecord.name,
        }
      }
    }

    logger.warn('API key validation failed - no matching key found')
    return { valid: false, error: 'Invalid API key' }
  } catch (error) {
    logger.error('Error validating API key:', error)
    return { valid: false, error: 'API key validation error' }
  }
}

/**
 * Check if an API key has permission for an endpoint
 */
function checkEndpointPermission(endpoint: string, permissions: string[]): boolean {
  // Check for wildcard permission
  if (permissions.includes('*')) {
    return true
  }

  // Check for exact match
  if (permissions.includes(endpoint)) {
    return true
  }

  // Check for pattern matches (e.g., /api/webhooks/*)
  for (const permission of permissions) {
    if (permission.endsWith('/*')) {
      const basePattern = permission.slice(0, -2)
      if (endpoint.startsWith(basePattern + '/') || endpoint === basePattern) {
        return true
      }
    }
  }

  return false
}

/**
 * Create a new API key
 */
export async function createApiKey(
  name: string,
  permissions: string[],
  locationId?: string,
  createdBy?: string,
  expiresAt?: Date
): Promise<{
  success: boolean
  apiKey?: string // Return the plain key only on creation
  keyId?: string
  error?: string
}> {
  try {
    // Validate name
    if (!name || name.trim().length === 0) {
      return { success: false, error: 'API key name is required' }
    }

    // Validate permissions
    if (!permissions || permissions.length === 0) {
      return { success: false, error: 'At least one permission is required' }
    }

    const locId = locationId || AUTH_CONFIG.LOCATION_ID

    // Ensure location exists
    const location = await db
      .select()
      .from(locations)
      .where(eq(locations.id, locId))
      .limit(1)

    if (location.length === 0) {
      return { success: false, error: 'Location not found' }
    }

    // Generate and hash the API key
    const apiKey = generateApiKey()
    const keyHash = await hashApiKey(apiKey)

    // Create API key record
    const newKey = await db.insert(authApiKeys).values({
      locationId: locId,
      name,
      keyHash,
      permissions: JSON.stringify(permissions),
      isActive: true,
      expiresAt: expiresAt ? expiresAt.toISOString() : null,
      lastUsed: null,
      usageCount: 0,
      createdBy,
    }).returning()

    logger.info(`Created new API key: ${newKey[0].id} (${name})`)

    return {
      success: true,
      apiKey, // Return plain key only on creation
      keyId: newKey[0].id,
    }
  } catch (error) {
    logger.error('Error creating API key:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create API key',
    }
  }
}

/**
 * Revoke an API key
 */
export async function revokeApiKey(keyId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const result = await db
      .update(authApiKeys)
      .set({
        isActive: false,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(authApiKeys.id, keyId))
      .returning()

    if (result.length === 0) {
      return { success: false, error: 'API key not found' }
    }

    logger.info(`Revoked API key: ${keyId}`)
    return { success: true }
  } catch (error) {
    logger.error('Error revoking API key:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to revoke API key',
    }
  }
}

/**
 * Delete an API key permanently
 */
export async function deleteApiKey(keyId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const result = await db
      .delete(authApiKeys)
      .where(eq(authApiKeys.id, keyId))
      .returning()

    if (result.length === 0) {
      return { success: false, error: 'API key not found' }
    }

    logger.info(`Deleted API key: ${keyId}`)
    return { success: true }
  } catch (error) {
    logger.error('Error deleting API key:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete API key',
    }
  }
}

/**
 * List all API keys for a location (without exposing hashes)
 */
export async function listApiKeys(locationId?: string): Promise<ApiKeyData[]> {
  try {
    const locId = locationId || AUTH_CONFIG.LOCATION_ID

    const keys = await db
      .select({
        id: authApiKeys.id,
        locationId: authApiKeys.locationId,
        name: authApiKeys.name,
        permissions: authApiKeys.permissions,
        isActive: authApiKeys.isActive,
        expiresAt: authApiKeys.expiresAt,
        lastUsed: authApiKeys.lastUsed,
        usageCount: authApiKeys.usageCount,
        createdAt: authApiKeys.createdAt,
      })
      .from(authApiKeys)
      .where(eq(authApiKeys.locationId, locId))

    return keys.map(key => ({
      ...key,
      permissions: JSON.parse(key.permissions) as string[],
    }))
  } catch (error) {
    logger.error('Error listing API keys:', error)
    return []
  }
}

/**
 * Update API key permissions
 */
export async function updateApiKeyPermissions(
  keyId: string,
  permissions: string[]
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!permissions || permissions.length === 0) {
      return { success: false, error: 'At least one permission is required' }
    }

    const result = await db
      .update(authApiKeys)
      .set({
        permissions: JSON.stringify(permissions),
        updatedAt: new Date().toISOString(),
      })
      .where(eq(authApiKeys.id, keyId))
      .returning()

    if (result.length === 0) {
      return { success: false, error: 'API key not found' }
    }

    logger.info(`Updated API key permissions: ${keyId}`)
    return { success: true }
  } catch (error) {
    logger.error('Error updating API key permissions:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update permissions',
    }
  }
}

/**
 * Get API key statistics
 */
export async function getApiKeyStats(locationId?: string): Promise<{
  totalKeys: number
  activeKeys: number
  inactiveKeys: number
  totalUsage: number
  mostUsedKey: { name: string; usageCount: number } | null
}> {
  try {
    const locId = locationId || AUTH_CONFIG.LOCATION_ID

    const keys = await db
      .select()
      .from(authApiKeys)
      .where(eq(authApiKeys.locationId, locId))

    const activeKeys = keys.filter(k => k.isActive).length
    const inactiveKeys = keys.filter(k => !k.isActive).length
    const totalUsage = keys.reduce((sum, k) => sum + k.usageCount, 0)

    const sortedByUsage = [...keys].sort((a, b) => b.usageCount - a.usageCount)
    const mostUsedKey = sortedByUsage[0]
      ? { name: sortedByUsage[0].name, usageCount: sortedByUsage[0].usageCount }
      : null

    return {
      totalKeys: keys.length,
      activeKeys,
      inactiveKeys,
      totalUsage,
      mostUsedKey,
    }
  } catch (error) {
    logger.error('Error getting API key stats:', error)
    return {
      totalKeys: 0,
      activeKeys: 0,
      inactiveKeys: 0,
      totalUsage: 0,
      mostUsedKey: null,
    }
  }
}
