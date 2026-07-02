/**
 * VISCA-over-UDP client for the OBSBOT Tail 2.
 *
 * Command-queue pattern mirrors packages/bss-blu/src/hiqnet-client.ts —
 * FIFO array + `processing` flag, one command in flight at a time so
 * commands to the same camera never race each other. Raw dgram socket
 * mechanics mirror packages/dmx/src/clients/artnet-client.ts (bind on an
 * ephemeral local port, one 'message' handler for all replies).
 *
 * VISCA-over-IP frames are wrapped in an 8-byte payload-type header (Sony's
 * VISCA-over-IP encapsulation): 2 bytes payload type, 2 bytes payload
 * length, 4 bytes sequence number, then the raw VISCA command bytes.
 * Payload type 0x0100 = VISCA command, 0x0111 = VISCA reply/ACK/completion.
 */

import * as dgram from 'dgram'
import { logger } from '@sports-bar/logger'

const DEFAULT_VISCA_PORT = 52381
const RESPONSE_TIMEOUT_MS = 10000
const PAYLOAD_TYPE_COMMAND = 0x0100

interface QueuedCommand {
  command: Buffer
  resolve: (value: Buffer) => void
  reject: (error: Error) => void
}

export class ViscaClient {
  private socket: dgram.Socket | null = null
  private bound = false
  private ipAddress: string
  private port: number
  private sequenceNumber = 0
  private commandQueue: QueuedCommand[] = []
  private processing = false
  private pendingBySeq: Map<number, { resolve: (value: Buffer) => void; timeout: NodeJS.Timeout }> = new Map()

  constructor(ipAddress: string, port: number = DEFAULT_VISCA_PORT) {
    this.ipAddress = ipAddress
    this.port = port
  }

  async connect(): Promise<void> {
    if (this.bound && this.socket) return

    this.socket = dgram.createSocket({ type: 'udp4', reuseAddr: true })

    this.socket.on('error', (error) => {
      logger.error(`[OBSBOT] Socket error (${this.ipAddress}:${this.port}):`, error)
    })

    this.socket.on('message', (msg) => this.handleMessage(msg))

    await new Promise<void>((resolve, reject) => {
      this.socket!.bind(0, (err?: Error) => (err ? reject(err) : resolve()))
    })
    this.bound = true
    logger.info(`[OBSBOT] VISCA-over-UDP client bound for ${this.ipAddress}:${this.port}`)
  }

  disconnect(): void {
    for (const pending of this.pendingBySeq.values()) clearTimeout(pending.timeout)
    this.pendingBySeq.clear()
    if (this.socket) {
      this.socket.close()
      this.socket = null
    }
    this.bound = false
  }

  isConnected(): boolean {
    return this.bound
  }

  private handleMessage(msg: Buffer): void {
    if (msg.length < 8) return
    const seq = msg.readUInt32BE(4)
    const pending = this.pendingBySeq.get(seq)
    if (!pending) return // unsolicited or already-timed-out reply
    clearTimeout(pending.timeout)
    this.pendingBySeq.delete(seq)
    pending.resolve(msg.subarray(8))
  }

  /** Wrap a raw VISCA command in the VISCA-over-IP payload header. */
  private encode(viscaBytes: Buffer, seq: number): Buffer {
    const header = Buffer.alloc(8)
    header.writeUInt16BE(PAYLOAD_TYPE_COMMAND, 0)
    header.writeUInt16BE(viscaBytes.length, 2)
    header.writeUInt32BE(seq, 4)
    return Buffer.concat([header, viscaBytes])
  }

  /** Public entry point — queue a raw VISCA command frame, get the reply payload back. */
  async send(viscaBytes: Buffer): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      this.commandQueue.push({ command: viscaBytes, resolve, reject })
      this.processQueue()
    })
  }

  private async processQueue(): Promise<void> {
    if (this.processing || this.commandQueue.length === 0) return
    this.processing = true
    const { command, resolve, reject } = this.commandQueue.shift()!
    try {
      const response = await this.sendRaw(command)
      resolve(response)
    } catch (error) {
      reject(error as Error)
    } finally {
      this.processing = false
      this.processQueue()
    }
  }

  private async sendRaw(viscaBytes: Buffer): Promise<Buffer> {
    if (!this.socket || !this.bound) {
      throw new Error(`Not connected to OBSBOT camera at ${this.ipAddress}:${this.port}`)
    }
    const seq = this.sequenceNumber++
    const frame = this.encode(viscaBytes, seq)

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingBySeq.delete(seq)
        reject(new Error(`VISCA response timeout (${this.ipAddress}:${this.port}, seq=${seq})`))
      }, RESPONSE_TIMEOUT_MS)
      this.pendingBySeq.set(seq, { resolve, timeout })

      this.socket!.send(frame, this.port, this.ipAddress, (err) => {
        if (err) {
          clearTimeout(timeout)
          this.pendingBySeq.delete(seq)
          reject(err)
        }
      })
    })
  }
}
