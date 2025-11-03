
import { NextRequest, NextResponse } from 'next/server'
import { cecService } from '@/lib/cec-service'
import { withRateLimit, addRateLimitHeaders } from '@/lib/rate-limiting/middleware'

export async function POST(request: NextRequest) {
  // QUICK WIN 3: Apply rate limiting to prevent hardware command flooding
  const rateLimitCheck = await withRateLimit(request, 'HARDWARE')

  if (!rateLimitCheck.allowed) {
    return rateLimitCheck.response!
  }

  try {
    const body = await request.json()
    const { action, tvAddress = '0', params = {} } = body

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
