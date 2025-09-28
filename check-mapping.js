
const { PrismaClient } = require('@prisma/client')
const fs = require('fs')
const path = require('path')

const prisma = new PrismaClient()

async function checkMapping() {
  try {
    console.log('=== WOLF PACK INPUT CONFIGURATION ===')
    const wolfPackInputs = await prisma.matrixInput.findMany({
      orderBy: { channelNumber: 'asc' }
    })
    
    if (wolfPackInputs.length === 0) {
      console.log('❌ No Wolf Pack inputs configured in database')
    } else {
      wolfPackInputs.forEach(input => {
        console.log(`Channel ${input.channelNumber}: "${input.label}" (${input.inputType}) - ${input.isActive ? 'Active' : 'Inactive'}`)
      })
    }

    console.log('\n=== IR DEVICE CONFIGURATION ===')
    const irDevicesFile = path.join(process.cwd(), 'data', 'ir-devices.json')
    
    let irDevices = []
    try {
      const data = fs.readFileSync(irDevicesFile, 'utf8')
      const parsed = JSON.parse(data)
      irDevices = parsed.devices || []
    } catch (err) {
      console.log('❌ No IR devices file found')
    }

    if (irDevices.length === 0) {
      console.log('❌ No IR devices configured')
    } else {
      irDevices.forEach(device => {
        console.log(`Input Channel ${device.inputChannel}: "${device.name}" (${device.brand}) - ${device.isActive ? 'Active' : 'Inactive'}`)
        console.log(`  Control: ${device.iTachAddress ? 'IR via iTach' : device.deviceIpAddress ? 'IP Control' : 'Not configured'}`)
      })
    }

    console.log('\n=== MAPPING ANALYSIS ===')
    const mappingAnalysis = wolfPackInputs.map(input => {
      const matchedDevice = irDevices.find(device => device.inputChannel === input.channelNumber)
      
      if (matchedDevice) {
        const controlReady = matchedDevice.iTachAddress || matchedDevice.deviceIpAddress
        console.log(`✅ Channel ${input.channelNumber}: "${input.label}" → "${matchedDevice.name}" ${controlReady ? '(Ready for control)' : '(Needs control configuration)'}`)
      } else {
        console.log(`❌ Channel ${input.channelNumber}: "${input.label}" → No IR device mapped`)
      }
    })

    console.log(`\n=== SUMMARY ===`)
    const mapped = wolfPackInputs.filter(input => 
      irDevices.some(device => device.inputChannel === input.channelNumber)
    ).length
    console.log(`Wolf Pack Inputs: ${wolfPackInputs.length}`)
    console.log(`IR Devices: ${irDevices.length}`)
    console.log(`Mapped: ${mapped}/${wolfPackInputs.length}`)
    console.log(`Ready for Control: ${irDevices.filter(d => d.iTachAddress || d.deviceIpAddress).length}/${irDevices.length}`)

  } catch (error) {
    console.error('Error checking mapping:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkMapping()
