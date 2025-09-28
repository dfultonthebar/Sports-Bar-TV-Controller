

import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

export const dynamic = 'force-dynamic'

const prisma = new PrismaClient()

export async function GET() {
  try {
    // Get all configured providers with their input assignments
    const providers = await prisma.tVProvider.findMany({
      where: { isActive: true },
      include: {
        providerInputs: {
          include: {
            input: true
          }
        }
      }
    })

    // Get matrix inputs for compatibility check
    const matrixConfig = await prisma.matrixConfiguration.findFirst({
      where: { isActive: true },
      include: {
        inputs: {
          where: { isActive: true },
          orderBy: { channelNumber: 'asc' }
        }
      }
    })

    const matrixInputs = matrixConfig?.inputs || []

    // Test provider compatibility
    const providerCompatibility = providers.map(provider => {
      const compatibleInputs = matrixInputs.filter(input => {
        const deviceType = input.deviceType?.toLowerCase() || ''
        const inputType = input.inputType?.toLowerCase() || ''
        const label = input.label?.toLowerCase() || ''
        
        // Enhanced compatibility logic for testing
        let isCompatible = false
        
        if (provider.type === 'satellite') {
          isCompatible = deviceType.includes('direct') || deviceType.includes('dish') || 
                        deviceType.includes('satellite') || inputType.includes('satellite') ||
                        label.includes('direct') || label.includes('dish') || label.includes('satellite')
        } else if (provider.type === 'cable') {
          isCompatible = deviceType.includes('cable') || inputType.includes('cable') ||
                        label.includes('cable') || label.includes('spectrum') || label.includes('comcast')
        } else if (provider.type === 'streaming') {
          isCompatible = deviceType.includes('streaming') || deviceType.includes('roku') ||
                        deviceType.includes('fire') || deviceType.includes('apple') ||
                        inputType.includes('streaming') || label.includes('streaming')
        } else {
          // Fallback - HDMI and Other are compatible with everything
          isCompatible = inputType.includes('hdmi') || deviceType.includes('hdmi') ||
                        deviceType === 'Other' || inputType === 'Other'
        }
        
        return isCompatible
      })

      return {
        id: provider.id,
        name: provider.name,
        type: provider.type,
        channels: JSON.parse(provider.channels),
        packages: JSON.parse(provider.packages),
        assignedInputs: provider.providerInputs.map(pi => ({
          id: pi.input.id,
          label: pi.input.label,
          channelNumber: pi.input.channelNumber,
          deviceType: pi.input.deviceType,
          inputType: pi.input.inputType
        })),
        compatibleInputs: compatibleInputs.map(input => ({
          id: input.id,
          label: input.label,
          channelNumber: input.channelNumber,
          deviceType: input.deviceType,
          inputType: input.inputType
        })),
        isSelectable: compatibleInputs.length > 0 || provider.providerInputs.length > 0
      }
    })

    return NextResponse.json({
      success: true,
      data: {
        totalProviders: providers.length,
        selectableProviders: providerCompatibility.filter(p => p.isSelectable).length,
        matrixInputs: matrixInputs.length,
        providers: providerCompatibility
      },
      message: 'Provider compatibility test completed'
    })
  } catch (error) {
    console.error('Error testing providers:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to test providers' },
      { status: 500 }
    )
  }
}

// Test endpoint to verify DirectTV specifically
export async function POST(request: NextRequest) {
  try {
    const { providerType } = await request.json()
    
    const matrixConfig = await prisma.matrixConfiguration.findFirst({
      where: { isActive: true },
      include: {
        inputs: {
          where: { isActive: true },
          orderBy: { channelNumber: 'asc' }
        }
      }
    })

    const matrixInputs = matrixConfig?.inputs || []
    
    // Test specific provider type compatibility
    const testResults = matrixInputs.map(input => {
      const deviceType = input.deviceType?.toLowerCase() || ''
      const inputType = input.inputType?.toLowerCase() || ''
      const label = input.label?.toLowerCase() || ''
      
      let compatibility = {
        exact: false,
        partial: false,
        label: false,
        reason: []
      }
      
      if (providerType === 'satellite') {
        compatibility.exact = deviceType === 'directv' || deviceType === 'directv receiver' || 
                              deviceType === 'satellite' || inputType === 'satellite'
        compatibility.partial = deviceType.includes('direct') || deviceType.includes('dish') ||
                               deviceType.includes('satellite') || inputType.includes('satellite')
        compatibility.label = label.includes('direct') || label.includes('dish') || 
                             label.includes('satellite')
        
        if (compatibility.exact) compatibility.reason.push('Exact device/input type match')
        if (compatibility.partial) compatibility.reason.push('Partial type match')
        if (compatibility.label) compatibility.reason.push('Label contains satellite keywords')
      }
      
      return {
        input: {
          id: input.id,
          label: input.label,
          channelNumber: input.channelNumber,
          deviceType: input.deviceType,
          inputType: input.inputType
        },
        compatibility,
        isCompatible: compatibility.exact || compatibility.partial || compatibility.label
      }
    })
    
    const compatibleInputs = testResults.filter(result => result.isCompatible)
    
    return NextResponse.json({
      success: true,
      data: {
        providerType,
        totalInputs: matrixInputs.length,
        compatibleInputs: compatibleInputs.length,
        testResults,
        recommendation: compatibleInputs.length === 0 ? 
          `No compatible inputs found for ${providerType}. Configure matrix inputs with device types like: DirecTV, DirectTV Receiver, Satellite Box, or Satellite.` :
          `Found ${compatibleInputs.length} compatible input(s) for ${providerType} provider.`
      }
    })
  } catch (error) {
    console.error('Error in provider compatibility test:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to test provider compatibility' },
      { status: 500 }
    )
  }
}

