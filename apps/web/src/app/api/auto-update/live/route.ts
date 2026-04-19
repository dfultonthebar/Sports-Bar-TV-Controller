/**
 * GET /api/auto-update/live
 *
 * Server-Sent Events stream of the currently-running (or most-recent)
 * auto-update log. Watches the newest file under update-logs/ and pushes
 * new lines as they're appended. Used by /auto-update/live page.
 *
 * Connection lifecycle:
 *   - on connect, sends the current content as one batched event
 *   - then polls fstat every 1s; when size grows, reads delta + sends
 *   - when no growth for 5s AND the log contains a terminal marker
 *     (SUCCESS:, FAIL at step, ROLLED BACK), sends a 'done' event then
 *     closes
 *   - on the client disconnecting, the polling loop exits via ReadableStream cancel
 */
import { NextRequest } from 'next/server'
import * as fs from 'fs'
import * as path from 'path'

const LOG_DIR = '/home/ubuntu/sports-bar-data/update-logs'

function findLatestLog(): string | null {
  if (!fs.existsSync(LOG_DIR)) return null
  const files = fs
    .readdirSync(LOG_DIR)
    .filter(f => f.startsWith('auto-update-') && f.endsWith('.log'))
    .map(f => ({ name: f, mtime: fs.statSync(path.join(LOG_DIR, f)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime)
  return files[0] ? path.join(LOG_DIR, files[0].name) : null
}

function containsTerminalMarker(text: string): boolean {
  return /SUCCESS: updated|FAIL at step|ROLLED BACK/.test(text)
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const explicitId = url.searchParams.get('id')
  const logPath = explicitId
    ? path.join(LOG_DIR, `${explicitId}.log`)
    : findLatestLog()

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: any) => {
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))
        } catch { /* controller closed */ }
      }

      if (!logPath || !fs.existsSync(logPath)) {
        send('error', { message: 'No log file found' })
        controller.close()
        return
      }

      send('meta', { filename: path.basename(logPath) })

      // Send initial content
      let offset = 0
      let content = fs.readFileSync(logPath, 'utf8')
      offset = content.length
      send('chunk', { text: content })

      if (containsTerminalMarker(content)) {
        // Log is already completed — finish the stream immediately
        send('done', { reason: 'already-complete' })
        controller.close()
        return
      }

      let stableTicks = 0 // consecutive polls with no growth
      const MAX_STABLE_TICKS = 5

      const tick = setInterval(() => {
        try {
          const stat = fs.statSync(logPath)
          if (stat.size > offset) {
            const fd = fs.openSync(logPath, 'r')
            const len = stat.size - offset
            const buf = Buffer.alloc(len)
            fs.readSync(fd, buf, 0, len, offset)
            fs.closeSync(fd)
            offset = stat.size
            const text = buf.toString('utf8')
            send('chunk', { text })
            content += text
            stableTicks = 0

            if (containsTerminalMarker(text)) {
              send('done', { reason: 'terminal-marker' })
              clearInterval(tick)
              controller.close()
              return
            }
          } else {
            stableTicks += 1
            if (stableTicks >= MAX_STABLE_TICKS && containsTerminalMarker(content)) {
              send('done', { reason: 'stable' })
              clearInterval(tick)
              controller.close()
            }
          }
        } catch (err: any) {
          send('error', { message: err.message })
          clearInterval(tick)
          controller.close()
        }
      }, 1000)

      // Heartbeat so clients behind proxies don't time out during quiet periods
      const heartbeat = setInterval(() => {
        try { controller.enqueue(encoder.encode(`: heartbeat\n\n`)) } catch { clearInterval(heartbeat) }
      }, 15000)

      // Auto-close after 15 min regardless
      setTimeout(() => {
        send('done', { reason: 'timeout' })
        clearInterval(tick)
        clearInterval(heartbeat)
        try { controller.close() } catch { /* already closed */ }
      }, 15 * 60 * 1000)
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
    },
  })
}
