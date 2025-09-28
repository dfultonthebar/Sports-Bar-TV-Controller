
import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { readFile } from 'fs/promises'
import { join } from 'path'

const prisma = new PrismaClient()
const IR_DEVICES_FILE = join(process.cwd(), 'data', 'ir-devices.json')

async function loadIRDevices() {
  try {
    const data = await readFile(IR_DEVICES_FILE, 'utf8')
    return JSON.parse(data)
  } catch (error) {
    return { devices: [] }
  }
}

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    // Get Wolf Pack inputs from database
    const wolfPackInputs = await prisma.matrixInput.findMany({
      orderBy: { channelNumber: 'asc' },
      where: { isActive: true }
    })

    // Get IR devices from JSON file
    const irData = await loadIRDevices()
    const irDevices = irData.devices || []

    // Create mapping analysis
    const mappingAnalysis = wolfPackInputs.map(input => {
      const matchedDevice = irDevices.find((device: any) => device.inputChannel === input.channelNumber)
      
      return {
        wolfPackInput: {
          channelNumber: input.channelNumber,
          label: input.label,
          inputType: input.inputType,
          isActive: input.isActive
        },
        irDevice: matchedDevice ? {
          id: matchedDevice.id,
          name: matchedDevice.name,
          brand: matchedDevice.brand,
          deviceType: matchedDevice.deviceType,
          controlMethod: matchedDevice.controlMethod || 'IR',
          iTachAddress: matchedDevice.iTachAddress,
          deviceIpAddress: matchedDevice.deviceIpAddress,
          ipControlPort: matchedDevice.ipControlPort,
          isActive: matchedDevice.isActive
        } : null,
        mappingStatus: matchedDevice ? 'MAPPED' : 'UNMAPPED',
        controlReady: matchedDevice ? (
          matchedDevice.iTachAddress || matchedDevice.deviceIpAddress ? 'READY' : 'NEEDS_CONFIG'
        ) : 'NO_DEVICE'
      }
    })

    // Summary statistics
    const summary = {
      totalWolfPackInputs: wolfPackInputs.length,
      totalIRDevices: irDevices.length,
      mappedInputs: mappingAnalysis.filter(m => m.mappingStatus === 'MAPPED').length,
      unmappedInputs: mappingAnalysis.filter(m => m.mappingStatus === 'UNMAPPED').length,
      readyForControl: mappingAnalysis.filter(m => m.controlReady === 'READY').length,
      needsConfiguration: mappingAnalysis.filter(m => m.controlReady === 'NEEDS_CONFIG').length
    }

    return NextResponse.json({
      summary,
      mappingAnalysis,
      wolfPackInputs,
      irDevices
    })
  } catch (error) {
    console.error('Error analyzing device mapping:', error)
    return NextResponse.json({ error: 'Failed to analyze device mapping' }, { status: 500 })
  }
}
