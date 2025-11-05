/**
 * PIN Authentication Utilities
 *
 * Handles PIN-based authentication including:
 * - PIN validation and hashing
 * - PIN creation and deletion
 * - PIN verification against database
 */

import bcrypt from 'bcryptjs'
import { db } from '@/db'
import { authPins, locations } from '@/db/schema'
import { eq, and } from 'drizzle-orm'
import { AUTH_CONFIG, type UserRole } from './config'
import { logger } from '@/lib/logger'

/**
 * Hash a PIN using bcrypt
 */
export async function hashPIN(pin: string): Promise<string> {
  try {
    const pinStr = pin.toString()

    // Validate PIN format
    if (!/^\d{4}$/.test(pinStr)) {
      throw new Error('PIN must be exactly 4 digits')
    }

    const pinNum = parseInt(pinStr, 10)
    if (pinNum < AUTH_CONFIG.PIN_MIN_VALUE || pinNum > AUTH_CONFIG.PIN_MAX_VALUE) {
      throw new Error(`PIN must be between ${AUTH_CONFIG.PIN_MIN_VALUE} and ${AUTH_CONFIG.PIN_MAX_VALUE}`)
    }

    return await bcrypt.hash(pinStr, AUTH_CONFIG.PIN_BCRYPT_ROUNDS)
  } catch (error) {
    logger.error('Error hashing PIN:', error)
    throw error
  }
}

/**
 * Verify a PIN against a hash
 */
export async function verifyPIN(pin: string, hash: string): Promise<boolean> {
  try {
    const pinStr = pin.toString()
    return await bcrypt.compare(pinStr, hash)
  } catch (error) {
    logger.error('Error verifying PIN:', error)
    return false
  }
}

/**
 * Validate a PIN and return the role if valid
 * Returns null if PIN is invalid or not found
 */
export async function validatePIN(pin: string, locationId?: string): Promise<{ role: UserRole; pinId: string } | null> {
  try {
    const pinStr = pin.toString()

    // Validate PIN format first (prevent database lookups for invalid PINs)
    if (!/^\d{4}$/.test(pinStr)) {
      logger.warn('Invalid PIN format attempted')
      return null
    }

    // Use configured location ID if not provided
    const locId = locationId || AUTH_CONFIG.LOCATION_ID

    // Get all active PINs for this location
    const pins = await db
      .select()
      .from(authPins)
      .where(
        and(
          eq(authPins.locationId, locId),
          eq(authPins.isActive, true)
        )
      )

    // Check each PIN hash
    for (const pinRecord of pins) {
      // Check if PIN has expired
      if (pinRecord.expiresAt) {
        const expiryDate = new Date(pinRecord.expiresAt)
        if (expiryDate < new Date()) {
          logger.warn(`PIN ${pinRecord.id} has expired`)
          continue
        }
      }

      // Verify PIN
      const isValid = await verifyPIN(pinStr, pinRecord.pinHash)
      if (isValid) {
        logger.info(`Valid ${pinRecord.role} PIN authenticated`)
        return {
          role: pinRecord.role as UserRole,
          pinId: pinRecord.id,
        }
      }
    }

    logger.warn('PIN authentication failed - no matching PIN found')
    return null
  } catch (error) {
    logger.error('Error validating PIN:', error)
    return null
  }
}

/**
 * Create a new PIN
 */
export async function createPIN(
  pin: string,
  role: UserRole,
  description?: string,
  locationId?: string,
  createdBy?: string,
  expiresAt?: Date
): Promise<{ success: boolean; pinId?: string; error?: string }> {
  try {
    // Validate PIN
    const pinStr = pin.toString()
    if (!/^\d{4}$/.test(pinStr)) {
      return { success: false, error: 'PIN must be exactly 4 digits' }
    }

    const pinNum = parseInt(pinStr, 10)
    if (pinNum < AUTH_CONFIG.PIN_MIN_VALUE || pinNum > AUTH_CONFIG.PIN_MAX_VALUE) {
      return {
        success: false,
        error: `PIN must be between ${AUTH_CONFIG.PIN_MIN_VALUE} and ${AUTH_CONFIG.PIN_MAX_VALUE}`,
      }
    }

    // Validate role
    if (!['STAFF', 'ADMIN'].includes(role)) {
      return { success: false, error: 'Invalid role. Must be STAFF or ADMIN' }
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

    // Hash the PIN
    const pinHash = await hashPIN(pinStr)

    // Create PIN record
    const newPin = await db.insert(authPins).values({
      locationId: locId,
      role,
      pinHash,
      description,
      isActive: true,
      expiresAt: expiresAt ? expiresAt.toISOString() : null,
      createdBy,
    }).returning()

    logger.info(`Created new ${role} PIN: ${newPin[0].id}`)

    return {
      success: true,
      pinId: newPin[0].id,
    }
  } catch (error) {
    logger.error('Error creating PIN:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create PIN',
    }
  }
}

/**
 * Delete a PIN by ID
 */
export async function deletePIN(pinId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const result = await db
      .delete(authPins)
      .where(eq(authPins.id, pinId))
      .returning()

    if (result.length === 0) {
      return { success: false, error: 'PIN not found' }
    }

    logger.info(`Deleted PIN: ${pinId}`)
    return { success: true }
  } catch (error) {
    logger.error('Error deleting PIN:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete PIN',
    }
  }
}

/**
 * Deactivate a PIN (soft delete)
 */
export async function deactivatePIN(pinId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const result = await db
      .update(authPins)
      .set({
        isActive: false,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(authPins.id, pinId))
      .returning()

    if (result.length === 0) {
      return { success: false, error: 'PIN not found' }
    }

    logger.info(`Deactivated PIN: ${pinId}`)
    return { success: true }
  } catch (error) {
    logger.error('Error deactivating PIN:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to deactivate PIN',
    }
  }
}

/**
 * List all PINs for a location (without exposing hashes)
 */
export async function listPINs(locationId?: string): Promise<Array<{
  id: string
  role: string
  description: string | null
  isActive: boolean
  expiresAt: string | null
  createdAt: string
}>> {
  try {
    const locId = locationId || AUTH_CONFIG.LOCATION_ID

    const pins = await db
      .select({
        id: authPins.id,
        role: authPins.role,
        description: authPins.description,
        isActive: authPins.isActive,
        expiresAt: authPins.expiresAt,
        createdAt: authPins.createdAt,
      })
      .from(authPins)
      .where(eq(authPins.locationId, locId))

    return pins
  } catch (error) {
    logger.error('Error listing PINs:', error)
    return []
  }
}

/**
 * Update PIN description
 */
export async function updatePINDescription(
  pinId: string,
  description: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const result = await db
      .update(authPins)
      .set({
        description,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(authPins.id, pinId))
      .returning()

    if (result.length === 0) {
      return { success: false, error: 'PIN not found' }
    }

    logger.info(`Updated PIN description: ${pinId}`)
    return { success: true }
  } catch (error) {
    logger.error('Error updating PIN description:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update PIN description',
    }
  }
}
