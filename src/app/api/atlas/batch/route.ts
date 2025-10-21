
/**
 * Atlas Batch Operations API Endpoint
 * 
 * POST /api/atlas/batch
 * Execute multiple Atlas commands in a single request
 * 
 * Request body:
 * {
 *   processorId: string,
 *   commands: Array<{
 *     method: 'set' | 'get' | 'sub' | 'unsub',
 *     appKey?: string,
 *     atlasParam?: string,
 *     value?: any,
 *     format?: 'val' | 'pct' | 'str'
 *   }>
 * }
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db/drizzle'
import { audioProcessors, atlasMappings } from '@/db/schema'
import { eq, and } from 'drizzle-orm'
import { AtlasTCPClient } from '@/lib/atlasClient'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { processorId, commands } = body

    // Validate required fields
    if (!processorId) {
      return NextResponse.json(
        { success: false, error: 'processorId is required' },
        { status: 400 }
      )
    }

    if (!commands || !Array.isArray(commands) || commands.length === 0) {
      return NextResponse.json(
        { success: false, error: 'commands array is required and must not be empty' },
        { status: 400 }
      )
    }

    // Get processor details
    const processor = await db.query.audioProcessors.findFirst({
      where: eq(audioProcessors.id, processorId)
    })

    if (!processor) {
      return NextResponse.json(
        { success: false, error: 'Audio processor not found' },
        { status: 404 }
      )
    }

    // Resolve all app keys to Atlas parameters
    const resolvedCommands = await Promise.all(
      commands.map(async (cmd) => {
        let paramName = cmd.atlasParam
        let paramFormat = cmd.format || 'val'

        if (cmd.appKey) {
          const mapping = await db.query.atlasMappings.findFirst({
            where: and(
              eq(atlasMappings.processorId, processorId),
              eq(atlasMappings.appKey, cmd.appKey)
            )
          })

          if (!mapping) {
            throw new Error(`No mapping found for appKey: ${cmd.appKey}`)
          }

          paramName = mapping.atlasParam
          paramFormat = mapping.format
        }

        return {
          ...cmd,
          param: paramName,
          format: paramFormat
        }
      })
    )

    // Create Atlas client
    const client = new AtlasTCPClient({
      ipAddress: processor.ipAddress,
      port: processor.tcpPort
    })

    try {
      await client.connect()

      // Execute commands
      const results = await Promise.all(
        resolvedCommands.map(async (cmd) => {
          try {
            let response
            switch (cmd.method) {
              case 'set':
                response = await (client as any).sendCommand({
                  method: 'set',
                  param: cmd.param,
                  value: cmd.value,
                  format: cmd.format
                })
                break
              case 'get':
                response = await client.getParameter(cmd.param, cmd.format as any)
                break
              case 'sub':
                response = await client.subscribe(cmd.param, cmd.format as any)
                break
              case 'unsub':
                response = await client.unsubscribe(cmd.param, cmd.format as any)
                break
              default:
                throw new Error(`Unknown method: ${cmd.method}`)
            }
            return { success: true, command: cmd, response }
          } catch (error) {
            return {
              success: false,
              command: cmd,
              error: error instanceof Error ? error.message : 'Unknown error'
            }
          }
        })
      )

      client.disconnect()

      // Check if any commands failed
      const failures = results.filter(r => !r.success)
      const allSuccessful = failures.length === 0

      return NextResponse.json({
        success: allSuccessful,
        data: {
          processorId,
          totalCommands: commands.length,
          successfulCommands: results.filter(r => r.success).length,
          failedCommands: failures.length,
          results
        }
      })
    } catch (error) {
      client.disconnect()
      throw error
    }
  } catch (error) {
    console.error('[Atlas Batch] Error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to execute batch commands' 
      },
      { status: 500 }
    )
  }
}
