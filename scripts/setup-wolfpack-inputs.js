
const { PrismaClient } = require('@prisma/client')
const fs = require('fs')
const path = require('path')

const prisma = new PrismaClient()

async function setupWolfPackInputs() {
  try {
    console.log('🔧 Setting up Wolf Pack Input Configuration...')

    // First, create a matrix configuration if it doesn't exist
    let matrixConfig = await prisma.matrixConfiguration.findFirst({
      where: { isActive: true }
    })

    if (!matrixConfig) {
      console.log('📡 Creating Matrix Configuration...')
      matrixConfig = await prisma.matrixConfiguration.create({
        data: {
          name: 'Main Wolf Pack Matrix',
          ipAddress: '192.168.1.50',  // Default Wolf Pack IP
          tcpPort: 5000,
          udpPort: 4000,
          protocol: 'TCP',
          isActive: true,
          connectionStatus: 'disconnected'
        }
      })
      console.log(`✅ Matrix Configuration created: ${matrixConfig.name}`)
    }

    // Now create Wolf Pack inputs that align with the IR devices
    const wolfPackInputs = [
      {
        channelNumber: 1,
        label: 'Main DirecTV Box',
        inputType: 'Satellite',
        isActive: true,
        status: 'active'
      },
      {
        channelNumber: 2,
        label: 'Samsung TV - Bar Left',
        inputType: 'TV',
        isActive: true,
        status: 'active'
      },
      {
        channelNumber: 3,
        label: 'Apple TV - Private Room',
        inputType: 'Streaming',
        isActive: true,
        status: 'active'
      },
      {
        channelNumber: 4,
        label: 'Cable Box - Main Bar',
        inputType: 'Cable',
        isActive: true,
        status: 'active'
      },
      {
        channelNumber: 5,
        label: 'Roku - Patio Area',
        inputType: 'Streaming',
        isActive: true,
        status: 'active'
      },
      {
        channelNumber: 6,
        label: 'Gaming Console',
        inputType: 'Gaming',
        isActive: true,
        status: 'active'
      }
    ]

    // Clear existing inputs for this config
    await prisma.matrixInput.deleteMany({
      where: { configId: matrixConfig.id }
    })

    // Create new inputs
    for (const input of wolfPackInputs) {
      await prisma.matrixInput.create({
        data: {
          configId: matrixConfig.id,
          channelNumber: input.channelNumber,
          label: input.label,
          inputType: input.inputType,
          isActive: input.isActive,
          status: input.status
        }
      })
      console.log(`✅ Input ${input.channelNumber}: ${input.label} (${input.inputType})`)
    }

    console.log('\n📝 Updating IR device names to match Wolf Pack labels...')
    
    // Load and update IR devices to match Wolf Pack names
    const irDevicesFile = path.join(process.cwd(), 'data', 'ir-devices.json')
    let irData = { devices: [] }
    
    try {
      const data = fs.readFileSync(irDevicesFile, 'utf8')
      irData = JSON.parse(data)
    } catch (err) {
      console.log('Creating new IR devices file...')
    }

    // Update existing devices and add missing ones
    const updatedDevices = [
      {
        id: 'device_main_directv',
        name: 'Main DirecTV Box',
        brand: 'DirecTV',
        deviceType: 'Satellite Receiver',
        inputChannel: 1,
        iTachAddress: '192.168.1.100',
        codesetId: '1001',
        controlMethod: 'IR',
        isActive: true
      },
      {
        id: 'device_samsung_tv1',
        name: 'Samsung TV - Bar Left',
        brand: 'Samsung',
        deviceType: 'TV',
        inputChannel: 2,
        iTachAddress: '192.168.1.100',
        codesetId: '2001',
        controlMethod: 'IR',
        isActive: true
      },
      {
        id: 'device_appletv_private',
        name: 'Apple TV - Private Room',
        brand: 'Apple TV',
        deviceType: 'Streaming Device',
        inputChannel: 3,
        iTachAddress: '192.168.1.100',
        codesetId: '5001',
        controlMethod: 'IR',
        isActive: true
      },
      {
        id: 'device_cable_main',
        name: 'Cable Box - Main Bar',
        brand: 'Comcast',
        deviceType: 'Cable Receiver',
        inputChannel: 4,
        iTachAddress: '192.168.1.100',
        codesetId: '1002',
        controlMethod: 'IR',
        isActive: false  // Not yet configured
      },
      {
        id: 'device_roku_patio',
        name: 'Roku - Patio Area',
        brand: 'Roku',
        deviceType: 'Streaming Device',
        inputChannel: 5,
        deviceIpAddress: '192.168.1.110',
        ipControlPort: 8080,
        controlMethod: 'IP',
        isActive: false  // Not yet configured
      },
      {
        id: 'device_gaming_console',
        name: 'Gaming Console',
        brand: 'Sony PlayStation',
        deviceType: 'Gaming Console',
        inputChannel: 6,
        iTachAddress: '192.168.1.100',
        codesetId: '3001',
        controlMethod: 'IR',
        isActive: false  // Not yet configured
      }
    ]

    // Save updated IR devices
    fs.writeFileSync(irDevicesFile, JSON.stringify({ devices: updatedDevices }, null, 2))
    
    updatedDevices.forEach(device => {
      const status = device.isActive ? '✅ Ready' : '⚠️ Needs Setup'
      console.log(`${status} Input ${device.inputChannel}: ${device.name} (${device.controlMethod})`)
    })

    console.log('\n🎉 SETUP COMPLETE!')
    console.log('✅ Wolf Pack inputs configured and aligned with IR devices')
    console.log('✅ Ready inputs: 3 devices (DirecTV, Samsung TV, Apple TV)')
    console.log('⚠️ Needs configuration: 3 devices (Cable Box, Roku, Gaming Console)')
    
    console.log('\n📋 Next Steps:')
    console.log('1. Configure iTach or IP addresses for remaining devices')
    console.log('2. Test IR/IP commands from the Bartender Remote')
    console.log('3. The labels in the remote interface now match the device names!')

  } catch (error) {
    console.error('❌ Error setting up Wolf Pack inputs:', error)
  } finally {
    await prisma.$disconnect()
  }
}

setupWolfPackInputs()
