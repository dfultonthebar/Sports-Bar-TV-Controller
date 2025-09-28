
const { PrismaClient } = require('@prisma/client')

async function debugRemoteData() {
  const prisma = new PrismaClient()
  
  try {
    console.log('🔍 Debugging Bartender Remote Data Loading')
    console.log('=' .repeat(50))
    
    // Check Wolf Pack inputs
    console.log('\n📡 Wolf Pack Inputs in Database:')
    const wolfPackInputs = await prisma.wolfPackInput.findMany({
      orderBy: { channelNumber: 'asc' }
    })
    
    if (wolfPackInputs.length === 0) {
      console.log('❌ No Wolf Pack inputs found in database!')
      console.log('💡 Run: node scripts/setup-wolfpack-inputs.js')
    } else {
      wolfPackInputs.forEach(input => {
        console.log(`   Channel ${input.channelNumber}: "${input.label}" (${input.inputType}) - ${input.isActive ? '✅' : '❌'}`)
      })
    }
    
    // Check IR devices
    console.log('\n📺 IR Devices in Database:')
    const irDevices = await prisma.irDevice.findMany({
      orderBy: { inputChannel: 'asc' }
    })
    
    if (irDevices.length === 0) {
      console.log('❌ No IR devices found in database!')
    } else {
      irDevices.forEach(device => {
        console.log(`   Channel ${device.inputChannel}: "${device.name}" (${device.brand}) - ${device.controlMethod} - ${device.isActive ? '✅' : '❌'}`)
      })
    }
    
    // Check mapping alignment
    console.log('\n🔗 Wolf Pack to IR Device Mapping:')
    for (let channel = 1; channel <= 6; channel++) {
      const wolfPackInput = wolfPackInputs.find(i => i.channelNumber === channel)
      const irDevice = irDevices.find(d => d.inputChannel === channel)
      
      if (wolfPackInput && irDevice) {
        console.log(`   Channel ${channel}: "${wolfPackInput.label}" ↔ "${irDevice.name}" ✅`)
      } else if (wolfPackInput && !irDevice) {
        console.log(`   Channel ${channel}: "${wolfPackInput.label}" ↔ NO IR DEVICE ❌`)
      } else if (!wolfPackInput && irDevice) {
        console.log(`   Channel ${channel}: NO WOLF PACK INPUT ↔ "${irDevice.name}" ❌`)
      } else {
        console.log(`   Channel ${channel}: NO DATA ❌`)
      }
    }
    
    // Simulate API response
    console.log('\n🌐 Matrix Config API Response Simulation:')
    const matrixConfig = await prisma.wolfPackConfiguration.findFirst({
      include: {
        inputs: {
          where: { isActive: true },
          orderBy: { channelNumber: 'asc' }
        }
      }
    })
    
    if (matrixConfig) {
      console.log('Matrix Config:', {
        name: matrixConfig.name,
        ipAddress: matrixConfig.ipAddress,
        inputCount: matrixConfig.inputs.length
      })
      
      // Show what BartenderRemoteControl.tsx would receive
      const apiResponse = {
        config: matrixConfig,
        inputs: matrixConfig.inputs
      }
      
      // Apply the filtering logic from BartenderRemoteControl.tsx
      const customInputs = apiResponse.inputs.filter(input => 
        input.label && !input.label.match(/^Input \d+$/) && input.isActive
      )
      
      console.log('\n🎛️ Inputs that would show in Bartender Remote:')
      if (customInputs.length === 0) {
        console.log('❌ No inputs would show! (Filtering out all inputs)')
        console.log('🔍 Raw inputs:')
        apiResponse.inputs.forEach(input => {
          const matchesPattern = input.label.match(/^Input \d+$/)
          console.log(`   - "${input.label}" - Pattern match: ${matchesPattern ? 'YES (filtered out)' : 'NO (kept)'} - Active: ${input.isActive}`)
        })
      } else {
        customInputs.forEach(input => {
          console.log(`   ✅ Channel ${input.channelNumber}: "${input.label}"`)
        })
      }
    } else {
      console.log('❌ No Wolf Pack configuration found!')
    }
    
  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

debugRemoteData()
