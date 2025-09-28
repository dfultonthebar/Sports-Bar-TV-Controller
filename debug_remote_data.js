
const { PrismaClient } = require('@prisma/client')

async function debugRemoteData() {
  const prisma = new PrismaClient()
  
  try {
    console.log('🔍 Debugging Bartender Remote Data Loading')
    console.log('=' .repeat(50))
    
    // Check Matrix inputs
    console.log('\n📡 Matrix Inputs in Database:')
    const matrixInputs = await prisma.matrixInput.findMany({
      orderBy: { channelNumber: 'asc' }
    })
    
    if (matrixInputs.length === 0) {
      console.log('❌ No Matrix inputs found in database!')
      console.log('💡 Run: node scripts/setup-wolfpack-inputs.js')
    } else {
      matrixInputs.forEach(input => {
        console.log(`   Channel ${input.channelNumber}: "${input.label}" (${input.inputType}) - ${input.isActive ? '✅' : '❌'}`)
      })
    }
    
    // Check IR devices from JSON file
    console.log('\n📺 IR Devices in JSON File:')
    let irDevices = []
    try {
      const fs = require('fs')
      const path = require('path')
      const irDevicesPath = path.join(__dirname, 'data', 'ir-devices.json')
      const irDevicesData = fs.readFileSync(irDevicesPath, 'utf8')
      const parsedData = JSON.parse(irDevicesData)
      irDevices = parsedData.devices || []
      
      if (irDevices.length === 0) {
        console.log('❌ No IR devices found in JSON file!')
      } else {
        irDevices.forEach(device => {
          console.log(`   Channel ${device.inputChannel}: "${device.name}" (${device.brand}) - ${device.controlMethod} - ${device.isActive ? '✅' : '❌'}`)
        })
      }
    } catch (err) {
      console.log('❌ Failed to load IR devices from JSON file!')
      console.log('Error:', err.message)
    }
    
    // Check mapping alignment
    console.log('\n🔗 Matrix Input to IR Device Mapping:')
    for (let channel = 1; channel <= 6; channel++) {
      const matrixInput = matrixInputs.find(i => i.channelNumber === channel)
      const irDevice = irDevices.find(d => d.inputChannel === channel)
      
      if (matrixInput && irDevice) {
        console.log(`   Channel ${channel}: "${matrixInput.label}" ↔ "${irDevice.name}" ✅`)
      } else if (matrixInput && !irDevice) {
        console.log(`   Channel ${channel}: "${matrixInput.label}" ↔ NO IR DEVICE ❌`)
      } else if (!matrixInput && irDevice) {
        console.log(`   Channel ${channel}: NO MATRIX INPUT ↔ "${irDevice.name}" ❌`)
      } else {
        console.log(`   Channel ${channel}: NO DATA ❌`)
      }
    }
    
    // Simulate API response
    console.log('\n🌐 Matrix Config API Response Simulation:')
    const matrixConfig = await prisma.matrixConfiguration.findFirst({
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
