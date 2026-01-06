/**
 * HiQnet Protocol Client for BSS Soundweb London devices
 *
 * HiQnet is Harman's proprietary protocol for networked audio devices.
 * BSS Soundweb London devices use TCP port 1023 for HiQnet communication.
 */

import * as net from 'net'
import { logger } from '@sports-bar/logger'
import { HiQnetMessage, HiQnetMessageType } from './types'

const HIQNET_PORT = 1023
const HIQNET_VERSION = 2
const HIQNET_HEADER_LENGTH = 25
const CONNECTION_TIMEOUT = 5000
const RESPONSE_TIMEOUT = 10000

export class HiQnetClient {
  private socket: net.Socket | null = null
  private ipAddress: string
  private port: number
  private connected: boolean = false
  private sequenceNumber: number = 0
  private responseCallbacks: Map<number, (msg: HiQnetMessage) => void> = new Map()
  private commandQueue: Array<{ command: Buffer; resolve: (value: Buffer) => void; reject: (error: Error) => void }> = []
  private processing: boolean = false

  constructor(ipAddress: string, port: number = HIQNET_PORT) {
    this.ipAddress = ipAddress
    this.port = port
  }

  async connect(): Promise<boolean> {
    if (this.connected && this.socket) {
      return true
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        if (this.socket) {
          this.socket.destroy()
        }
        reject(new Error(`Connection timeout to ${this.ipAddress}:${this.port}`))
      }, CONNECTION_TIMEOUT)

      this.socket = new net.Socket()

      this.socket.on('connect', () => {
        clearTimeout(timeout)
        this.connected = true
        logger.info(`[BSS] Connected to ${this.ipAddress}:${this.port}`)
        resolve(true)
      })

      this.socket.on('data', (data: Buffer) => {
        this.handleResponse(data)
      })

      this.socket.on('error', (error) => {
        clearTimeout(timeout)
        logger.error(`[BSS] Socket error: ${error.message}`)
        this.connected = false
        reject(error)
      })

      this.socket.on('close', () => {
        this.connected = false
        logger.info(`[BSS] Connection closed to ${this.ipAddress}`)
      })

      this.socket.connect(this.port, this.ipAddress)
    })
  }

  async disconnect(): Promise<void> {
    if (this.socket) {
      this.socket.destroy()
      this.socket = null
      this.connected = false
    }
  }

  isConnected(): boolean {
    return this.connected
  }

  private handleResponse(data: Buffer): void {
    try {
      const message = this.parseHiQnetMessage(data)
      if (message) {
        const callback = this.responseCallbacks.get(message.sequenceNumber)
        if (callback) {
          callback(message)
          this.responseCallbacks.delete(message.sequenceNumber)
        }
      }
    } catch (error) {
      logger.error('[BSS] Error parsing response:', error)
    }
  }

  private parseHiQnetMessage(data: Buffer): HiQnetMessage | null {
    if (data.length < HIQNET_HEADER_LENGTH) {
      return null
    }

    return {
      version: data.readUInt8(0),
      headerLength: data.readUInt8(1),
      messageLength: data.readUInt32BE(2),
      sourceAddress: data.readUInt32BE(6),
      destinationAddress: data.readUInt32BE(10),
      messageId: data.readUInt16BE(14),
      flags: data.readUInt16BE(16),
      hopCount: data.readUInt8(18),
      sequenceNumber: data.readUInt16BE(19),
      messageType: data.readUInt8(21),
      payload: data.slice(HIQNET_HEADER_LENGTH)
    }
  }

  private buildHiQnetMessage(
    destinationAddress: number,
    messageType: HiQnetMessageType,
    payload: Buffer = Buffer.alloc(0)
  ): Buffer {
    const messageLength = HIQNET_HEADER_LENGTH + payload.length
    const header = Buffer.alloc(HIQNET_HEADER_LENGTH)

    header.writeUInt8(HIQNET_VERSION, 0)
    header.writeUInt8(HIQNET_HEADER_LENGTH, 1)
    header.writeUInt32BE(messageLength, 2)
    header.writeUInt32BE(0x00010001, 6)  // Source address (this node)
    header.writeUInt32BE(destinationAddress, 10)
    header.writeUInt16BE(0x0000, 14)  // Message ID
    header.writeUInt16BE(0x0000, 16)  // Flags
    header.writeUInt8(5, 18)  // Hop count
    header.writeUInt16BE(this.sequenceNumber++, 19)
    header.writeUInt8(messageType, 21)
    header.writeUInt8(0x00, 22)  // Error code
    header.writeUInt8(0x00, 23)  // Reserved
    header.writeUInt8(0x00, 24)  // Reserved

    return Buffer.concat([header, payload])
  }

  private async queueCommand(command: Buffer): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      this.commandQueue.push({ command, resolve, reject })
      this.processQueue()
    })
  }

  private async processQueue(): Promise<void> {
    if (this.processing || this.commandQueue.length === 0) {
      return
    }

    this.processing = true
    const { command, resolve, reject } = this.commandQueue.shift()!

    try {
      const response = await this.sendRawCommand(command)
      resolve(response)
    } catch (error) {
      reject(error as Error)
    } finally {
      this.processing = false
      this.processQueue()
    }
  }

  private async sendRawCommand(command: Buffer): Promise<Buffer> {
    if (!this.socket || !this.connected) {
      throw new Error('Not connected to BSS device')
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Response timeout'))
      }, RESPONSE_TIMEOUT)

      const seqNum = command.readUInt16BE(19)
      this.responseCallbacks.set(seqNum, (msg) => {
        clearTimeout(timeout)
        resolve(msg.payload)
      })

      this.socket!.write(command, (err) => {
        if (err) {
          clearTimeout(timeout)
          this.responseCallbacks.delete(seqNum)
          reject(err)
        }
      })
    })
  }

  /**
   * Send a keep-alive message to maintain the connection
   */
  async sendKeepAlive(): Promise<void> {
    const message = this.buildHiQnetMessage(0x00000000, HiQnetMessageType.KeepAlive)
    await this.queueCommand(message)
  }

  /**
   * Request network information from the device
   */
  async getNetworkInfo(nodeAddress: number): Promise<Buffer> {
    const message = this.buildHiQnetMessage(nodeAddress, HiQnetMessageType.RequestNetworkInfo)
    return await this.queueCommand(message)
  }

  /**
   * Get attribute values from a device
   */
  async getAttributes(nodeAddress: number, objectId: number, attributeIds: number[]): Promise<Buffer> {
    const payload = Buffer.alloc(4 + attributeIds.length * 2)
    payload.writeUInt32BE(objectId, 0)
    attributeIds.forEach((id, i) => {
      payload.writeUInt16BE(id, 4 + i * 2)
    })

    const message = this.buildHiQnetMessage(nodeAddress, HiQnetMessageType.GetAttributes, payload)
    return await this.queueCommand(message)
  }

  /**
   * Set attribute values on a device
   */
  async setAttributes(nodeAddress: number, objectId: number, attributeId: number, value: Buffer): Promise<Buffer> {
    const payload = Buffer.alloc(6 + value.length)
    payload.writeUInt32BE(objectId, 0)
    payload.writeUInt16BE(attributeId, 4)
    value.copy(payload, 6)

    const message = this.buildHiQnetMessage(nodeAddress, HiQnetMessageType.SetAttributes, payload)
    return await this.queueCommand(message)
  }

  /**
   * Subscribe to attribute changes
   */
  async subscribe(nodeAddress: number, objectId: number, attributeId: number): Promise<Buffer> {
    const payload = Buffer.alloc(6)
    payload.writeUInt32BE(objectId, 0)
    payload.writeUInt16BE(attributeId, 4)

    const message = this.buildHiQnetMessage(nodeAddress, HiQnetMessageType.Subscribe, payload)
    return await this.queueCommand(message)
  }

  /**
   * Turn on the device locate LED
   */
  async locateOn(nodeAddress: number): Promise<void> {
    const message = this.buildHiQnetMessage(nodeAddress, HiQnetMessageType.LocateOn)
    await this.queueCommand(message)
  }

  /**
   * Turn off the device locate LED
   */
  async locateOff(nodeAddress: number): Promise<void> {
    const message = this.buildHiQnetMessage(nodeAddress, HiQnetMessageType.LocateOff)
    await this.queueCommand(message)
  }
}
