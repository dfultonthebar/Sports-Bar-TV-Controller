#!/usr/bin/env node

/**
 * Seed Wolf Pack Matrix Configuration
 * This script creates the complete Wolf Pack matrix configuration including:
 * - MatrixConfiguration (connection settings)
 * - MatrixInputs (32 inputs)
 * - MatrixOutputs (36 outputs: 32 TVs + 4 Matrix audio outputs)
 */

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function seedWolfPackConfig() {
  try {
    console.log('🔧 Seeding Wolf Pack Matrix Configuration...\n')

    // Check if configuration already exists
    const existingConfig = await prisma.matrixConfiguration.findFirst({
      where: { isActive: true }
    })

    let matrixConfig

    if (existingConfig) {
      console.log('⚠️  Active matrix configuration already exists')
      console.log(`   Config: ${existingConfig.name}`)
      console.log(`   IP: ${existingConfig.ipAddress}`)
      console.log('   Updating inputs and outputs...\n')
      matrixConfig = existingConfig
    } else {
      // Create matrix configuration
      console.log('📡 Creating Matrix Configuration...')
      matrixConfig = await prisma.matrixConfiguration.create({
        data: {
          name: 'Graystone Alehouse Wolf Pack Matrix',
          ipAddress: '192.168.1.50',  // Default IP - can be changed via admin panel
          tcpPort: 5000,
          udpPort: 4000,
          protocol: 'TCP',
          isActive: true,
        }
      })
      console.log(`✅ Matrix Configuration created: ${matrixConfig.name}`)
      console.log(`   IP Address: ${matrixConfig.ipAddress}:${matrixConfig.tcpPort}\n`)
    }

    // Delete existing inputs and outputs for this config to start fresh
    const deletedInputs = await prisma.matrixInput.deleteMany({
      where: { configId: matrixConfig.id }
    })
    const deletedOutputs = await prisma.matrixOutput.deleteMany({
      where: { configId: matrixConfig.id }
    })
    console.log(`🗑️  Cleared ${deletedInputs.count} existing inputs and ${deletedOutputs.count} existing outputs\n`)

    // Create 32 inputs
    console.log('📥 Creating 32 Matrix Inputs...')
    const inputLabels = [
      'Cable Box 1', 'Cable Box 2', 'Cable Box 3', 'Cable Box 4',
      'Apple TV 1', 'Apple TV 2', 'Roku 1', 'Roku 2',
      'Gaming Console', 'Blu-ray Player', 'Laptop Input', 'PC Input',
      'Input 13', 'Input 14', 'Input 15', 'Input 16',
      'Input 17', 'Input 18', 'Input 19', 'Input 20',
      'Input 21', 'Input 22', 'Input 23', 'Input 24',
      'Input 25', 'Input 26', 'Input 27', 'Input 28',
      'Input 29', 'Input 30', 'Input 31', 'Input 32'
    ]

    for (let i = 1; i <= 32; i++) {
      await prisma.matrixInput.create({
        data: {
          configId: matrixConfig.id,
          channelNumber: i,
          label: inputLabels[i - 1],
          inputType: 'HDMI',
          deviceType: i <= 4 ? 'Cable Box' : i <= 8 ? 'Streaming Device' : 'Other',
          isActive: true,
          status: 'active',
          powerOn: false,
          isCecPort: false
        }
      })
    }
    console.log(`✅ Created 32 inputs (1-32)\n`)

    // Create 36 outputs (32 TVs + 4 Matrix audio outputs)
    console.log('📤 Creating 36 Matrix Outputs...')
    
    // Create outputs 1-32 (TVs)
    for (let i = 1; i <= 32; i++) {
      await prisma.matrixOutput.create({
        data: {
          configId: matrixConfig.id,
          channelNumber: i,
          label: `TV ${String(i).padStart(2, '0')}`,
          resolution: '1080p',
          isActive: true,
          status: 'active',
          audioOutput: null,
          powerOn: false,
          selectedVideoInput: null,
          videoInputLabel: null,
          dailyTurnOn: true,  // Default: participate in morning schedule
          dailyTurnOff: true  // Default: respond to "all off" command
        }
      })
    }
    console.log(`✅ Created 32 TV outputs (1-32)\n`)

    // Create outputs 33-36 (Matrix 1-4 for audio routing)
    console.log('🔊 Creating 4 Audio Matrix Outputs...')
    const audioOutputLabels = ['Matrix 1', 'Matrix 2', 'Matrix 3', 'Matrix 4']
    
    for (let i = 33; i <= 36; i++) {
      const matrixNumber = i - 32
      await prisma.matrixOutput.create({
        data: {
          configId: matrixConfig.id,
          channelNumber: i,
          label: audioOutputLabels[matrixNumber - 1],
          resolution: '1080p',
          isActive: true,
          status: 'active',
          audioOutput: `Zone ${matrixNumber}`,
          powerOn: false,
          selectedVideoInput: null,
          videoInputLabel: null,
          dailyTurnOn: false,  // Audio outputs don't need daily turn on
          dailyTurnOff: false  // Audio outputs don't need daily turn off
        }
      })
    }
    console.log(`✅ Created 4 audio matrix outputs (33-36)\n`)

    // Verify configuration
    const inputCount = await prisma.matrixInput.count({
      where: { configId: matrixConfig.id }
    })
    const outputCount = await prisma.matrixOutput.count({
      where: { configId: matrixConfig.id }
    })

    console.log('✅ SEED COMPLETE!\n')
    console.log('📊 Configuration Summary:')
    console.log(`   Matrix Config: ${matrixConfig.name}`)
    console.log(`   IP Address: ${matrixConfig.ipAddress}:${matrixConfig.tcpPort}`)
    console.log(`   Total Inputs: ${inputCount}`)
    console.log(`   Total Outputs: ${outputCount}`)
    console.log(`     - TVs (1-32): 32`)
    console.log(`     - Audio Matrix (33-36): 4`)
    console.log('')
    console.log('📋 Next Steps:')
    console.log('   1. Update matrix IP address in System Admin if needed')
    console.log('   2. Customize input/output labels as needed')
    console.log('   3. Configure TV selection settings (dailyTurnOn/dailyTurnOff)')
    console.log('   4. Test Wolf Pack connection from System Admin > Tests')
    console.log('')

  } catch (error) {
    console.error('❌ Error seeding Wolf Pack configuration:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

// Run the seed script
seedWolfPackConfig()
  .then(() => {
    console.log('✅ Seed script completed successfully')
    process.exit(0)
  })
  .catch((error) => {
    console.error('❌ Seed script failed:', error)
    process.exit(1)
  })
