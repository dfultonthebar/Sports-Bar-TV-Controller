#!/usr/bin/env tsx

/**
 * Configure Default Channels Script
 *
 * Sets up default ESPN channels and Atmosphere TV for idle periods.
 * This script configures which cable boxes should default to which ESPN channels
 * when no live games are scheduled.
 */

import { db } from '../src/db'
import { schema } from '../src/db'
import { eq } from 'drizzle-orm'

interface DefaultChannelConfig {
  inputLabel: string
  channelNumber: string
  channelName: string
  description: string
}

const defaultChannelConfigs: DefaultChannelConfig[] = [
  {
    inputLabel: 'Cable Box 1',
    channelNumber: '206', // Spectrum ESPN channel number (varies by market)
    channelName: 'ESPN',
    description: 'Main ESPN channel for breaking news and live sports'
  },
  {
    inputLabel: 'Cable Box 2',
    channelNumber: '207', // Spectrum ESPN2 channel number
    channelName: 'ESPN2',
    description: 'ESPN2 for additional live sports coverage'
  },
  {
    inputLabel: 'Cable Box 3',
    channelNumber: '567', // Spectrum ESPNU channel number
    channelName: 'ESPNU',
    description: 'ESPNU for college sports'
  },
  {
    inputLabel: 'Cable Box 4',
    channelNumber: '209', // Spectrum ESPN News channel number
    channelName: 'ESPN News',
    description: 'ESPN News for sports news and highlights'
  }
]

async function configureDefaultChannels() {
  console.log('🔧 Configuring default ESPN channels and Atmosphere TV...\n')

  // Update Atmosphere TV input (already done via SQL, but let's verify)
  console.log('📺 Verifying Atmosphere TV configuration...')
  const atmosphereInput = await db
    .select()
    .from(schema.matrixInputs)
    .where(eq(schema.matrixInputs.label, 'Atmosphere TV'))
    .limit(1)

  if (atmosphereInput.length > 0) {
    console.log(`   ✅ Atmosphere TV found at input ${atmosphereInput[0].channelNumber}`)
    console.log(`   🎨 Device type: ${atmosphereInput[0].deviceType}`)
  } else {
    console.log('   ⚠️  Atmosphere TV not found - manual configuration required')
  }

  console.log('')

  // Configure default ESPN channels
  console.log('📡 Configuring default ESPN channels...\n')

  for (const config of defaultChannelConfigs) {
    try {
      // Find the matrix input
      const input = await db
        .select()
        .from(schema.matrixInputs)
        .where(eq(schema.matrixInputs.label, config.inputLabel))
        .limit(1)

      if (input.length === 0) {
        console.log(`   ❌ Input not found: ${config.inputLabel}`)
        continue
      }

      const inputRecord = input[0]
      console.log(`📺 ${config.inputLabel} (Input ${inputRecord.channelNumber})`)
      console.log(`   Channel: ${config.channelNumber} (${config.channelName})`)
      console.log(`   Purpose: ${config.description}`)

      // Update or create inputCurrentChannel record
      const existing = await db
        .select()
        .from(schema.inputCurrentChannels)
        .where(eq(schema.inputCurrentChannels.inputNumber, inputRecord.channelNumber))
        .limit(1)

      if (existing.length > 0) {
        // Update existing record
        await db
          .update(schema.inputCurrentChannels)
          .set({
            channelNumber: config.channelNumber,
            channelName: config.channelName,
            inputLabel: config.inputLabel,
            deviceType: 'Cable Box',
            lastUpdated: new Date().toISOString()
          })
          .where(eq(schema.inputCurrentChannels.id, existing[0].id))

        console.log(`   ✅ Updated current channel status`)
      } else {
        // Create new record
        await db.insert(schema.inputCurrentChannels).values({
          inputNumber: inputRecord.channelNumber,
          inputLabel: config.inputLabel,
          deviceType: 'Cable Box',
          deviceId: inputRecord.id,
          channelNumber: config.channelNumber,
          channelName: config.channelName,
          showName: `${config.channelName} Programming`,
          lastUpdated: new Date().toISOString()
        })

        console.log(`   ✅ Created current channel status`)
      }

      console.log('')
    } catch (error) {
      console.error(`   ❌ Error configuring ${config.inputLabel}:`, error)
      console.log('')
    }
  }

  console.log('✅ Default channel configuration complete!\n')
  console.log('📊 Summary:')
  console.log(`   - ${defaultChannelConfigs.length} ESPN channels configured`)
  console.log(`   - 1 Atmosphere TV input available`)
  console.log(`   - Distribution Engine will use these for idle TVs\n`)
  console.log('💡 How it works:')
  console.log(`   1. When no games are scheduled, TVs in main/bar areas get ESPN channels`)
  console.log(`   2. TVs in side/patio areas get Atmosphere TV for ambient content`)
  console.log(`   3. Distribution Engine rotates between ESPN, ESPN2, ESPNU, ESPN News`)
  console.log(`   4. When games start, AI scheduler assigns them based on priority\n`)
}

// Run the configuration
configureDefaultChannels()
  .then(() => {
    console.log('🎉 Configuration complete!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('❌ Configuration failed:', error)
    process.exit(1)
  })
