
import { NextRequest, NextResponse } from 'next/server'
import { cecService } from '@/lib/cec-service'
import { withRateLimit, addRateLimitHeaders } from '@/lib/rate-limiting/middleware'
import { z } from 'zod'
import { validateRequestBody, ValidationSchemas } from '@/lib/validation'

// Validation schema for CEC commands
const cecCommandSchema = z.object({
  action: ValidationSchemas.cecAction,
  tvAddress: ValidationSchemas.cecAddress.default('0'),
  params: z.object({
    inputNumber: ValidationSchemas.inputNumber.optional(),
    volume: ValidationSchemas.volume.optional(),
    key: z.string().min(1).max(50).optional(),
    command: z.string().min(1).max(200).optional()
  }).optional().default({})
})

export async function POST(request: NextRequest) {
  // QUICK WIN 3: Apply rate limiting to prevent hardware command flooding
  const rateLimitCheck = await withRateLimit(request, 'HARDWARE')

  if (!rateLimitCheck.allowed) {
    return rateLimitCheck.response!
  }

  try {
    // Validate request body
    const validation = await validateRequestBody(request, cecCommandSchema)
    if (!validation.success) return validation.error

    const { action, tvAddress, params } = validation.data

    let result;

    switch (action) {
      case 'power_on':
        result = await cecService.powerOn(tvAddress);
        break;

      case 'power_off':
        result = await cecService.powerOff(tvAddress);
        break;

      case 'toggle_power':
        result = await cecService.togglePower(tvAddress);
        break;

      case 'set_input':
        if (!params.inputNumber) {
          return NextResponse.json(
            { success: false, message: 'inputNumber is required for set_input' },
            { status: 400 }
          );
        }
        result = await cecService.setInput(params.inputNumber, tvAddress);
        break;

      case 'set_volume':
        if (params.volume === undefined) {
          return NextResponse.json(
            { success: false, message: 'volume is required for set_volume' },
            { status: 400 }
          );
        }
        result = await cecService.setVolume(params.volume, tvAddress);
        break;

      case 'mute':
        result = await cecService.mute(tvAddress);
        break;

      case 'send_key':
        if (!params.key) {
          return NextResponse.json(
            { success: false, message: 'key is required for send_key' },
            { status: 400 }
          );
        }
        result = await cecService.sendKey(params.key, tvAddress);
        break;

      case 'raw':
        if (!params.command) {
          return NextResponse.json(
            { success: false, message: 'command is required for raw commands' },
            { status: 400 }
          );
        }
        result = await cecService.sendRawCommand(params.command);
        break;

      default:
        return NextResponse.json(
          { success: false, message: `Unknown action: ${action}` },
          { status: 400 }
        );
    }

    const jsonResponse = NextResponse.json(result)
    return addRateLimitHeaders(jsonResponse, rateLimitCheck.result)
  } catch (error: any) {
    const jsonResponse = NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    )
    return addRateLimitHeaders(jsonResponse, rateLimitCheck.result)
  }
}
