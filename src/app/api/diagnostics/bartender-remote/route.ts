import { NextResponse } from 'next/server'
import { findMany, eq } from '@/lib/db-helpers'
import { schema } from '@/db'
import { logger } from '@/lib/logger'
import fs from 'fs'
import path from 'path'

export async function GET() {
  try {
    logger.api.request('GET', '/api/diagnostics/bartender-remote', {})
    
    // Get Matrix inputs from database using Drizzle ORM
    const matrixInputs = await findMany('matrixInputs', {
      where: eq(schema.matrixInputs.isActive, true),
      orderBy: schema.matrixInputs.channelNumber
    })

    // Get IR devices from JSON file
    let irDevices: any[] = []
    try {
      const irDevicesPath = path.join(process.cwd(), 'data', 'ir-devices.json')
      const irDevicesData = fs.readFileSync(irDevicesPath, 'utf8')
      const parsedData = JSON.parse(irDevicesData)
      irDevices = parsedData.devices || []
    } catch (err) {
      logger.error('Failed to load IR devices from JSON:', err)
    }

    // Simulate what BartenderRemoteControl.tsx filtering does
    const customInputs = matrixInputs.filter(input => 
      input.label && !input.label.match(/^Input \d+$/) && input.isActive
    )

    // Create device mapping
    const deviceMapping: any[] = []
    for (let channel = 1; channel <= 6; channel++) {
      const matrixInput = matrixInputs.find(i => i.channelNumber === channel)
      const irDevice = irDevices.find((d: any) => d.inputChannel === channel)
      
      deviceMapping.push({
        channel,
        matrixInput: matrixInput ? {
          label: matrixInput.label,
          inputType: matrixInput.inputType,
          isActive: matrixInput.isActive
        } : null,
        irDevice: irDevice ? {
          name: irDevice.name,
          brand: irDevice.brand,
          controlMethod: irDevice.controlMethod,
          isActive: irDevice.isActive
        } : null,
        mapped: !!(matrixInput && irDevice)
      })
    }

    // Check what the component filtering logic produces
    const componentWouldShow = customInputs.length > 0 ? customInputs : [
      { id: '1', channelNumber: 1, label: 'Cable Box 1', inputType: 'Cable', isActive: true },
      { id: '2', channelNumber: 2, label: 'DirecTV 1', inputType: 'Satellite', isActive: true },
      { id: '3', channelNumber: 3, label: 'Cable Box 2', inputType: 'Cable', isActive: true },
      { id: '4', channelNumber: 4, label: 'DirecTV 2', inputType: 'Satellite', isActive: true },
      { id: '5', channelNumber: 5, label: 'Streaming Box', inputType: 'Streaming', isActive: true },
      { id: '6', channelNumber: 6, label: 'Gaming Console', inputType: 'Gaming', isActive: true },
    ]

    const response = {
      status: 'success',
      data: {
        matrixInputsTotal: matrixInputs.length,
        matrixInputsActive: matrixInputs.filter(i => i.isActive).length,
        irDevicesTotal: irDevices.length,
        irDevicesActive: irDevices.filter((d: any) => d.isActive).length,
        filteredInputsForRemote: customInputs.length,
        deviceMapping,
        rawMatrixInputs: matrixInputs,
        rawIRDevices: irDevices,
        filteredInputs: customInputs,
        componentWouldShow: componentWouldShow,
        fallbackUsed: customInputs.length === 0
      },
      message: `Found ${matrixInputs.length} Matrix inputs, ${irDevices.length} IR devices, ${customInputs.length > 0 ? customInputs.length : 'fallback'} will show in remote`
    }

    logger.api.response('GET', '/api/diagnostics/bartender-remote', 200, response)
    return NextResponse.json(response)

  } catch (error) {
    logger.api.error('GET', '/api/diagnostics/bartender-remote', error)
    return NextResponse.json({
      status: 'error',
      message: error instanceof Error ? error.message : 'Unknown error',
      details: error instanceof Error ? error.stack : 'Unknown error'
    }, { status: 500 })
  }
}
