/**
 * Seed Authentication System
 *
 * Creates initial data for the authentication system:
 * - Default location
 * - Default STAFF and ADMIN PINs
 * - Example API key
 */

import { db } from '../src/db'
import { locations, authPins, authApiKeys } from '../src/db/schema'
import { eq } from 'drizzle-orm'
import { hashPIN } from '../src/lib/auth/pin'
import { hashApiKey, generateApiKey } from '../src/lib/auth/api-key'

const DEFAULT_LOCATION_ID = 'default-location'
const DEFAULT_LOCATION_NAME = 'Sports Bar'

// Default PINs (change these in production!)
const DEFAULT_STAFF_PIN = '1234'
const DEFAULT_ADMIN_PIN = '9999'

async function seedAuthSystem() {
  console.log('Starting authentication system seed...')

  try {
    // 1. Create default location
    console.log('\n1. Creating default location...')

    const existingLocation = await db
      .select()
      .from(locations)
      .where(eq(locations.id, DEFAULT_LOCATION_ID))
      .limit(1)

    if (existingLocation.length === 0) {
      await db.insert(locations).values({
        id: DEFAULT_LOCATION_ID,
        name: DEFAULT_LOCATION_NAME,
        description: 'Default location for single-location deployment',
        timezone: 'America/New_York',
        isActive: true,
      })
      console.log(`   ✓ Created location: ${DEFAULT_LOCATION_NAME}`)
    } else {
      console.log(`   - Location already exists: ${DEFAULT_LOCATION_NAME}`)
    }

    // 2. Create default STAFF PIN
    console.log('\n2. Creating default STAFF PIN...')

    const existingStaffPins = await db
      .select()
      .from(authPins)
      .where(eq(authPins.locationId, DEFAULT_LOCATION_ID))
      .then(pins => pins.filter(p => p.role === 'STAFF'))

    if (existingStaffPins.length === 0) {
      const staffPinHash = await hashPIN(DEFAULT_STAFF_PIN)
      await db.insert(authPins).values({
        locationId: DEFAULT_LOCATION_ID,
        role: 'STAFF',
        pinHash: staffPinHash,
        description: 'Default bartender/staff PIN',
        isActive: true,
      })
      console.log(`   ✓ Created STAFF PIN: ${DEFAULT_STAFF_PIN} (CHANGE THIS IN PRODUCTION!)`)
    } else {
      console.log(`   - STAFF PIN already exists`)
    }

    // 3. Create default ADMIN PIN
    console.log('\n3. Creating default ADMIN PIN...')

    const existingAdminPins = await db
      .select()
      .from(authPins)
      .where(eq(authPins.locationId, DEFAULT_LOCATION_ID))
      .then(pins => pins.filter(p => p.role === 'ADMIN'))

    if (existingAdminPins.length === 0) {
      const adminPinHash = await hashPIN(DEFAULT_ADMIN_PIN)
      await db.insert(authPins).values({
        locationId: DEFAULT_LOCATION_ID,
        role: 'ADMIN',
        pinHash: adminPinHash,
        description: 'Default manager/admin PIN',
        isActive: true,
      })
      console.log(`   ✓ Created ADMIN PIN: ${DEFAULT_ADMIN_PIN} (CHANGE THIS IN PRODUCTION!)`)
    } else {
      console.log(`   - ADMIN PIN already exists`)
    }

    // 4. Create example API key for webhooks
    console.log('\n4. Creating example API key for webhooks...')

    const existingApiKeys = await db
      .select()
      .from(authApiKeys)
      .where(eq(authApiKeys.locationId, DEFAULT_LOCATION_ID))

    if (existingApiKeys.length === 0) {
      const apiKey = generateApiKey()
      const keyHash = await hashApiKey(apiKey)

      await db.insert(authApiKeys).values({
        locationId: DEFAULT_LOCATION_ID,
        name: 'Default Webhook Key',
        keyHash,
        permissions: JSON.stringify([
          '/api/webhooks/*',
          '/api/n8n/*',
          '/api/automation/*',
        ]),
        isActive: true,
      })

      console.log(`   ✓ Created API key: ${apiKey}`)
      console.log(`   ✓ Permissions: webhooks, n8n, automation endpoints`)
      console.log(`   ⚠  SAVE THIS KEY - it will not be shown again!`)
    } else {
      console.log(`   - API keys already exist`)
    }

    console.log('\n✓ Authentication system seeded successfully!')
    console.log('\nDefault credentials (CHANGE THESE IN PRODUCTION!):')
    console.log(`  STAFF PIN: ${DEFAULT_STAFF_PIN}`)
    console.log(`  ADMIN PIN: ${DEFAULT_ADMIN_PIN}`)
    console.log('\nYou can now log in at /api/auth/login')

  } catch (error) {
    console.error('\n✗ Error seeding authentication system:', error)
    throw error
  }
}

// Run seed
seedAuthSystem()
  .then(() => {
    console.log('\nSeed completed successfully')
    process.exit(0)
  })
  .catch(error => {
    console.error('\nSeed failed:', error)
    process.exit(1)
  })
