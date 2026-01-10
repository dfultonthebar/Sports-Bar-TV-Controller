/**
 * Commercial Lighting System Discovery API
 * POST /api/commercial-lighting/systems/discover - Discover systems on network
 */

import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@sports-bar/logger'
import { LutronLIPClient, HueClient } from '@sports-bar/commercial-lighting'

interface DiscoveredSystem {
  systemType: string
  name: string
  ipAddress: string
  port?: number
  model?: string
  serialNumber?: string
  firmwareVersion?: string
}

// POST - Discover systems on network
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { subnet, systemTypes } = body

    // Default to common subnet if not provided
    const targetSubnet = subnet || '192.168.1'

    // Default to all supported system types
    const targetTypes: string[] = systemTypes || ['lutron', 'hue']

    const discoveredSystems: DiscoveredSystem[] = []
    const errors: string[] = []

    // Discover Philips Hue bridges using mDNS/SSDP (simplified to known ports)
    if (targetTypes.includes('hue')) {
      try {
        // Hue bridges typically respond on port 443
        // Try to discover using the Hue API discovery endpoint
        const hueDiscoveryResult = await discoverHueBridges()
        discoveredSystems.push(...hueDiscoveryResult)
      } catch (error) {
        errors.push(`Hue discovery error: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    }

    // Discover Lutron systems on common ports
    if (targetTypes.includes('lutron')) {
      try {
        const lutronDiscoveryResult = await discoverLutronSystems(targetSubnet)
        discoveredSystems.push(...lutronDiscoveryResult)
      } catch (error) {
        errors.push(`Lutron discovery error: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    }

    logger.info('[LIGHTING] System discovery completed', {
      found: discoveredSystems.length,
      types: targetTypes,
      subnet: targetSubnet,
    })

    return NextResponse.json({
      success: true,
      data: {
        systems: discoveredSystems,
        errors: errors.length > 0 ? errors : undefined,
        searchParams: {
          subnet: targetSubnet,
          systemTypes: targetTypes,
        },
      },
    })
  } catch (error) {
    logger.error('[LIGHTING] System discovery failed', { error })
    return NextResponse.json(
      { success: false, error: 'Failed to discover systems' },
      { status: 500 }
    )
  }
}

async function discoverHueBridges(): Promise<DiscoveredSystem[]> {
  const discovered: DiscoveredSystem[] = []

  try {
    // Use Philips Hue discovery portal
    const response = await fetch('https://discovery.meethue.com/', {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(5000),
    })

    if (response.ok) {
      const bridges = await response.json()

      for (const bridge of bridges) {
        // Try to get more details from the bridge
        try {
          const configResponse = await fetch(`http://${bridge.internalipaddress}/api/config`, {
            signal: AbortSignal.timeout(3000),
          })

          if (configResponse.ok) {
            const config = await configResponse.json()
            discovered.push({
              systemType: 'philips-hue',
              name: config.name || 'Philips Hue Bridge',
              ipAddress: bridge.internalipaddress,
              port: 443,
              model: config.modelid,
              serialNumber: config.bridgeid,
              firmwareVersion: config.swversion,
            })
          } else {
            discovered.push({
              systemType: 'philips-hue',
              name: 'Philips Hue Bridge',
              ipAddress: bridge.internalipaddress,
              port: 443,
            })
          }
        } catch {
          discovered.push({
            systemType: 'philips-hue',
            name: 'Philips Hue Bridge',
            ipAddress: bridge.internalipaddress,
            port: 443,
          })
        }
      }
    }
  } catch (error) {
    logger.warn('[LIGHTING] Hue cloud discovery failed, trying local scan', { error })
  }

  return discovered
}

async function discoverLutronSystems(subnet: string): Promise<DiscoveredSystem[]> {
  const discovered: DiscoveredSystem[] = []

  // Lutron systems typically use port 23 for telnet
  const commonPorts = [23, 4999]

  // Scan common IP addresses on the subnet (limited for performance)
  const ipRanges = [1, 2, 100, 101, 102, 200, 201, 254]

  for (const lastOctet of ipRanges) {
    const ip = `${subnet}.${lastOctet}`

    for (const port of commonPorts) {
      try {
        // Attempt a quick connection to see if something is listening
        const isReachable = await checkPort(ip, port)

        if (isReachable) {
          // Try to identify if it's a Lutron system
          try {
            const client = new LutronLIPClient({
              host: ip,
              port: port,
            })

            // Quick connection test with timeout
            const connected = await Promise.race([
              client.connect().then(() => true),
              new Promise<boolean>(resolve => setTimeout(() => resolve(false), 2000)),
            ])

            if (connected) {
              const systemInfo = await client.getSystemInfo()
              client.disconnect()

              // Determine system type based on response
              let systemType = 'lutron-radiora2' // default
              if (systemInfo?.model?.toLowerCase().includes('caseta')) {
                systemType = 'lutron-caseta'
              } else if (systemInfo?.model?.toLowerCase().includes('homeworks')) {
                systemType = 'lutron-homeworks'
              } else if (systemInfo?.model?.toLowerCase().includes('ra3')) {
                systemType = 'lutron-radiora3'
              }

              discovered.push({
                systemType,
                name: systemInfo?.name || `Lutron System (${ip})`,
                ipAddress: ip,
                port,
                model: systemInfo?.model,
                serialNumber: systemInfo?.serialNumber,
                firmwareVersion: systemInfo?.firmwareVersion,
              })
            }
          } catch {
            // Not a Lutron system or connection failed
          }
        }
      } catch {
        // Port not reachable, skip
      }
    }
  }

  return discovered
}

async function checkPort(ip: string, port: number): Promise<boolean> {
  return new Promise(resolve => {
    const net = require('net')
    const socket = new net.Socket()

    socket.setTimeout(1000)

    socket.on('connect', () => {
      socket.destroy()
      resolve(true)
    })

    socket.on('timeout', () => {
      socket.destroy()
      resolve(false)
    })

    socket.on('error', () => {
      socket.destroy()
      resolve(false)
    })

    socket.connect(port, ip)
  })
}
