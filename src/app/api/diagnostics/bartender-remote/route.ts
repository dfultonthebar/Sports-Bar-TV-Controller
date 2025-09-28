
import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function GET() {
  try {
    // Get Wolf Pack inputs
    const wolfPackInputs = await prisma.wolfPackInput.findMany({
      where: { isActive: true },
      orderBy: { channelNumber: 'asc' }
    })

    // Get IR devices  
    const irDevices = await prisma.irDevice.findMany({
      orderBy: { inputChannel: 'asc' }
    })

    // Simulate what BartenderRemoteControl.tsx filtering does
    const customInputs = wolfPackInputs.filter(input => 
      input.label && !input.label.match(/^Input \d+$/) && input.isActive
    )

    // Create device mapping
    const deviceMapping = []
    for (let channel = 1; channel <= 6; channel++) {
      const wolfPackInput = wolfPackInputs.find(i => i.channelNumber === channel)
      const irDevice = irDevices.find(d => d.inputChannel === channel)
      
      deviceMapping.push({
        channel,
        wolfPackInput: wolfPackInput ? {
          label: wolfPackInput.label,
          inputType: wolfPackInput.inputType,
          isActive: wolfPackInput.isActive
        } : null,
        irDevice: irDevice ? {
          name: irDevice.name,
          brand: irDevice.brand,
          controlMethod: irDevice.controlMethod,
          isActive: irDevice.isActive
        } : null,
        mapped: !!(wolfPackInput && irDevice)
      })
    }

    return NextResponse.json({
      status: 'success',
      data: {
        wolfPackInputsTotal: wolfPackInputs.length,
        wolfPackInputsActive: wolfPackInputs.filter(i => i.isActive).length,
        irDevicesTotal: irDevices.length,
        irDevicesActive: irDevices.filter(d => d.isActive).length,
        filteredInputsForRemote: customInputs.length,
        deviceMapping,
        rawWolfPackInputs: wolfPackInputs,
        rawIRDevices: irDevices,
        filteredInputs: customInputs
      },
      message: `Found ${wolfPackInputs.length} Wolf Pack inputs, ${irDevices.length} IR devices, ${customInputs.length} will show in remote`
    })

  } catch (error) {
    console.error('Error in bartender remote diagnostics:', error)
    return NextResponse.json({
      status: 'error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
