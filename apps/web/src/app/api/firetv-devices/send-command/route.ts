// Fire TV Send Command API - Execute commands with persistent connections

import { NextRequest, NextResponse } from 'next/server'
import { connectionManager } from '@/services/firetv-connection-manager'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'
import { z } from 'zod'
import { validateRequestBody, ValidationSchemas, isValidationError, isValidationSuccess} from '@/lib/validation'

import { logger } from '@sports-bar/logger'
// Key code mappings for Fire TV
const KEY_CODES: Record<string, number> = {
  'UP': 19,
  'DOWN': 20,
  'LEFT': 21,
  'RIGHT': 22,
  'OK': 23,
  'SELECT': 23,
  'HOME': 3,
  'BACK': 4,
  'MENU': 82,
  'PLAY_PAUSE': 85,
  'PLAY': 126,
  'PAUSE': 127,
  'STOP': 86,
  'REWIND': 89,
  'FAST_FORWARD': 90,
  'NEXT': 87,
  'PREVIOUS': 88,
  'VOL_UP': 24,
  'VOL_DOWN': 25,
  'MUTE': 164,
  'POWER': 26,
  'SEARCH': 84
}

// Validation schema for FireTV command
const firetvSendCommandSchema = z.object({
  deviceId: ValidationSchemas.deviceId,
  command: z.string().min(1).max(200, 'Command must be less than 200 characters'),
  appPackage: ValidationSchemas.appId.optional(),
  ipAddress: ValidationSchemas.ipAddress,
  port: ValidationSchemas.port.default(5555)
})

export async function POST(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.HARDWARE)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  try {
    // Validate request body
    const validation = await validateRequestBody(request, firetvSendCommandSchema)
    if (isValidationError(validation)) return validation.error

    const { data } = validation

    const { deviceId, command, appPackage, ipAddress, port } = data
    logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    logger.info('🎮 [FIRE CUBE] Sending command')
    logger.info(`   Device ID: ${deviceId}`)
    logger.info(`   Command: ${command}`)
    logger.info(`   Package: ${appPackage || 'N/A'}`)
    logger.info(`   IP: ${ipAddress}:${port}`)
    logger.info(`   Timestamp: ${new Date().toISOString()}`)
    logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    
    const ip = ipAddress.trim()
    const devicePort = parseInt(port.toString())
    const deviceAddress = `${ip}:${devicePort}`
    
    // Get or create persistent connection using connection manager
    const adbClient = await connectionManager.getOrCreateConnection(deviceId, ip, devicePort)
    
    let result: string
    let commandType: string
    
    // Parse and execute command
    if (command === 'LAUNCH_APP' && appPackage) {
      logger.info(`[FIRE CUBE] Launching app: ${appPackage}`)
      result = await adbClient.launchApp(appPackage)
      commandType = 'Launch App'
      
    } else if (command === 'STOP_APP' && appPackage) {
      logger.info(`[FIRE CUBE] Stopping app: ${appPackage}`)
      result = await adbClient.stopApp(appPackage)
      commandType = 'Stop App'
      
    } else if (command === 'WAKE') {
      logger.info('[FIRE CUBE] Waking device')
      result = await adbClient.wakeDevice()
      commandType = 'Wake Device'
      
    } else if (command === 'KEEP_AWAKE_ON') {
      logger.info('[FIRE CUBE] Enabling stay awake')
      result = await adbClient.keepAwake(true)
      commandType = 'Enable Stay Awake'
      
    } else if (command === 'KEEP_AWAKE_OFF') {
      logger.info('[FIRE CUBE] Disabling stay awake')
      result = await adbClient.keepAwake(false)
      commandType = 'Disable Stay Awake'
      
    } else if (KEY_CODES[command]) {
      logger.info(`[FIRE CUBE] Sending key: ${command} (${KEY_CODES[command]})`)
      result = await adbClient.sendKey(KEY_CODES[command])
      commandType = `Key: ${command}`
      
    } else if (command.startsWith('input keyevent ')) {
      const keyCode = parseInt(command.replace('input keyevent ', ''))
      logger.info(`[FIRE CUBE] Sending keyevent: ${keyCode}`)
      result = await adbClient.sendKey(keyCode)
      commandType = `Keyevent: ${keyCode}`
      
    } else if (command.startsWith('monkey -p ')) {
      const packageName = command.match(/monkey -p ([^\s]+)/)?.[1]
      if (packageName) {
        logger.info(`[FIRE CUBE] Launching app via monkey: ${packageName}`)
        result = await adbClient.launchApp(packageName)
        commandType = `Launch: ${packageName}`
      } else {
        throw new Error('Invalid monkey command format')
      }
      
    } else {
      // Generic shell command
      logger.info(`[FIRE CUBE] Executing shell command: ${command}`)
      result = await adbClient.executeShellCommand(command)
      commandType = 'Shell Command'
    }
    
    logger.info('[FIRE CUBE] ✅ Command executed successfully')
    logger.info(`[FIRE CUBE] Result: ${result}`)
    
    return NextResponse.json({
      success: true,
      message: `${commandType} executed successfully`,
      data: {
        command,
        result,
        deviceAddress,
        persistentConnection: true,
        keepAliveActive: true
      }
    })
    
  } catch (error: any) {
    logger.error('[FIRE CUBE] ❌ Command execution error:', error)
    
    let errorMessage = 'Failed to execute command'
    
    if (error.message && error.message.includes('timeout')) {
      errorMessage = 'Command execution timeout'
    } else if (error.message && error.message.includes('refused')) {
      errorMessage = 'Connection refused'
    } else if (error.message && error.message.includes('unauthorized')) {
      errorMessage = 'Device unauthorized - please accept the ADB authorization prompt on the Fire TV'
    }
    
    return NextResponse.json({
      success: false,
      message: errorMessage,
      data: {
        error: error.message
      }
    }, { status: 500 })
  }
}

// Note: Cleanup is now handled by the connection manager service
