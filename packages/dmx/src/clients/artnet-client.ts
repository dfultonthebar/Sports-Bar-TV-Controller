/**
 * Art-Net Client
 * UDP-based DMX control for network DMX nodes (Enttec ODE, DMXking, etc.)
 * Implements Art-Net 4 protocol
 */

import { EventEmitter } from 'events'
import * as dgram from 'dgram'
import { DMX_CONFIG, ARTNET_ADAPTER_MODELS, ArtNetAdapterModel } from '../config'
import { dmxLogger } from '../dmx-logger'

export interface ArtNetConfig {
  ipAddress: string
  port?: number
  adapterModel?: ArtNetAdapterModel
  universe?: number           // Art-Net universe (0-32767)
  subnet?: number             // Art-Net subnet (0-15)
  net?: number                // Art-Net net (0-127)
  broadcast?: boolean         // Use broadcast instead of unicast
}

export interface ArtNetNode {
  ip: string
  mac: string
  shortName: string
  longName: string
  numPorts: number
  style: number
}

/**
 * Art-Net Client for network-based DMX nodes
 */
export class ArtNetClient extends EventEmitter {
  protected config: Required<ArtNetConfig>
  protected socket: dgram.Socket | null = null
  protected connected: boolean = false
  protected sequenceNumber: number = 0
  protected universes: Map<number, Uint8Array> = new Map()
  protected frameInterval: NodeJS.Timeout | null = null

  constructor(config: ArtNetConfig) {
    super()
    this.config = {
      ipAddress: config.ipAddress,
      port: config.port ?? DMX_CONFIG.ARTNET_PORT,
      adapterModel: config.adapterModel ?? 'generic-artnet',
      universe: config.universe ?? 0,
      subnet: config.subnet ?? 0,
      net: config.net ?? 0,
      broadcast: config.broadcast ?? false,
    }

    // Initialize default universe
    this.universes.set(this.config.universe, new Uint8Array(DMX_CONFIG.CHANNELS_PER_UNIVERSE).fill(0))
  }

  /**
   * Connect to Art-Net (creates UDP socket)
   */
  async connect(): Promise<void> {
    if (this.connected) {
      dmxLogger.warn('Art-Net client already connected', { ip: this.config.ipAddress })
      return
    }

    try {
      this.socket = dgram.createSocket({ type: 'udp4', reuseAddr: true })

      // Handle socket events
      this.socket.on('error', (error) => {
        dmxLogger.error('Art-Net socket error', error, { ip: this.config.ipAddress })
        this.emit('error', error)
      })

      this.socket.on('message', (msg, rinfo) => {
        this.handleMessage(msg, rinfo)
      })

      this.socket.on('listening', () => {
        const address = this.socket!.address()
        dmxLogger.info('Art-Net socket listening', {
          address: address.address,
          port: address.port,
        })
      })

      // Bind socket (use any available port for sending)
      await new Promise<void>((resolve, reject) => {
        this.socket!.bind(0, (error?: Error) => {
          if (error) {
            reject(error)
          } else {
            resolve()
          }
        })
      })

      // Enable broadcast if configured
      if (this.config.broadcast) {
        this.socket.setBroadcast(true)
      }

      this.connected = true
      dmxLogger.connection(this.config.ipAddress, 'connected', {
        adapter: this.config.adapterModel,
        universe: this.config.universe,
      })

      this.emit('connected')
      this.startFrameOutput()

    } catch (error) {
      dmxLogger.error('Failed to connect Art-Net client', error, {
        ip: this.config.ipAddress,
      })
      throw error
    }
  }

  /**
   * Disconnect Art-Net client
   */
  disconnect(): void {
    this.stopFrameOutput()

    if (this.socket) {
      this.socket.close()
      this.socket = null
    }

    this.connected = false
    dmxLogger.connection(this.config.ipAddress, 'disconnected')
    this.emit('disconnected')
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.connected && this.socket !== null
  }

  /**
   * Set a single DMX channel value
   */
  setChannel(channel: number, value: number, universe?: number): void {
    const uni = universe ?? this.config.universe
    if (!this.universes.has(uni)) {
      this.universes.set(uni, new Uint8Array(DMX_CONFIG.CHANNELS_PER_UNIVERSE).fill(0))
    }

    if (channel < 1 || channel > DMX_CONFIG.CHANNELS_PER_UNIVERSE) {
      throw new Error(`Channel must be between 1 and ${DMX_CONFIG.CHANNELS_PER_UNIVERSE}`)
    }

    this.universes.get(uni)![channel - 1] = Math.min(255, Math.max(0, value))
  }

  /**
   * Set multiple consecutive DMX channels
   */
  setChannels(startChannel: number, values: number[], universe?: number): void {
    const uni = universe ?? this.config.universe
    if (!this.universes.has(uni)) {
      this.universes.set(uni, new Uint8Array(DMX_CONFIG.CHANNELS_PER_UNIVERSE).fill(0))
    }

    const data = this.universes.get(uni)!
    for (let i = 0; i < values.length; i++) {
      const channel = startChannel + i
      if (channel <= DMX_CONFIG.CHANNELS_PER_UNIVERSE) {
        data[channel - 1] = Math.min(255, Math.max(0, values[i]))
      }
    }
  }

  /**
   * Set entire universe at once
   */
  setUniverse(data: Uint8Array | number[], universe?: number): void {
    const uni = universe ?? this.config.universe
    const universeData = this.universes.get(uni) ?? new Uint8Array(DMX_CONFIG.CHANNELS_PER_UNIVERSE).fill(0)

    const len = Math.min(data.length, DMX_CONFIG.CHANNELS_PER_UNIVERSE)
    for (let i = 0; i < len; i++) {
      universeData[i] = data[i]
    }

    this.universes.set(uni, universeData)
  }

  /**
   * Get universe data
   */
  getUniverse(universe?: number): Uint8Array {
    const uni = universe ?? this.config.universe
    return new Uint8Array(this.universes.get(uni) ?? new Uint8Array(DMX_CONFIG.CHANNELS_PER_UNIVERSE))
  }

  /**
   * Set all channels to zero (blackout)
   */
  blackout(universe?: number): void {
    if (universe !== undefined) {
      if (this.universes.has(universe)) {
        this.universes.get(universe)!.fill(0)
      }
    } else {
      // Blackout all universes
      for (const [, data] of this.universes) {
        data.fill(0)
      }
    }
  }

  /**
   * Send DMX data to a specific universe
   */
  async sendUniverse(universe?: number): Promise<void> {
    if (!this.isConnected()) {
      return
    }

    const uni = universe ?? this.config.universe
    const data = this.universes.get(uni)

    if (!data) {
      return
    }

    const packet = this.buildArtDmxPacket(uni, data)
    await this.sendPacket(packet)
  }

  /**
   * Send all universes
   */
  async sendAllUniverses(): Promise<void> {
    for (const universe of this.universes.keys()) {
      await this.sendUniverse(universe)
    }
  }

  /**
   * Build Art-Net ArtDmx packet (OpOutput 0x5000)
   */
  protected buildArtDmxPacket(universe: number, data: Uint8Array): Buffer {
    // Art-Net ArtDmx packet structure:
    // Bytes 0-7: ID "Art-Net\0"
    // Bytes 8-9: OpCode (0x5000 little-endian)
    // Bytes 10-11: Protocol Version (14, big-endian)
    // Byte 12: Sequence (0-255, 0 to disable)
    // Byte 13: Physical port (informational only)
    // Bytes 14-15: Universe (SubUni + Net, little-endian)
    // Bytes 16-17: Length (big-endian, must be even, 2-512)
    // Bytes 18+: DMX data

    const length = Math.min(data.length, DMX_CONFIG.CHANNELS_PER_UNIVERSE)
    const packetLength = 18 + length
    const packet = Buffer.alloc(packetLength)

    // Art-Net header
    DMX_CONFIG.ARTNET_HEADER.copy(packet, 0)

    // OpCode (ArtDmx = 0x5000, little-endian)
    packet.writeUInt16LE(DMX_CONFIG.ARTNET_OP_OUTPUT, 8)

    // Protocol version (big-endian)
    packet.writeUInt16BE(DMX_CONFIG.ARTNET_VERSION, 10)

    // Sequence number (0 = disabled)
    this.sequenceNumber = (this.sequenceNumber + 1) % 256
    if (this.sequenceNumber === 0) this.sequenceNumber = 1
    packet[12] = this.sequenceNumber

    // Physical port (0)
    packet[13] = 0

    // Universe address (SubUni in low byte, Net in high byte)
    // SubUni = (Subnet << 4) | Universe
    const subUni = ((this.config.subnet & 0x0f) << 4) | (universe & 0x0f)
    packet[14] = subUni
    packet[15] = this.config.net & 0x7f

    // Data length (big-endian, must be even)
    const paddedLength = length % 2 === 0 ? length : length + 1
    packet.writeUInt16BE(paddedLength, 16)

    // DMX data
    for (let i = 0; i < length; i++) {
      packet[18 + i] = data[i]
    }

    return packet
  }

  /**
   * Build Art-Net ArtPoll packet for node discovery
   */
  buildArtPollPacket(): Buffer {
    const packet = Buffer.alloc(14)

    // Art-Net header
    DMX_CONFIG.ARTNET_HEADER.copy(packet, 0)

    // OpCode (ArtPoll = 0x2000, little-endian)
    packet.writeUInt16LE(DMX_CONFIG.ARTNET_OP_POLL, 8)

    // Protocol version (big-endian)
    packet.writeUInt16BE(DMX_CONFIG.ARTNET_VERSION, 10)

    // Flags (enable diagnostic messages and data)
    packet[12] = 0x06

    // Priority (diagnostic priority)
    packet[13] = 0x10

    return packet
  }

  /**
   * Discover Art-Net nodes on the network
   */
  async discoverNodes(timeoutMs: number = 2000): Promise<ArtNetNode[]> {
    const nodes: ArtNetNode[] = []

    if (!this.isConnected()) {
      await this.connect()
    }

    return new Promise((resolve) => {
      const tempHandler = (msg: Buffer, rinfo: dgram.RemoteInfo) => {
        const node = this.parseArtPollReply(msg, rinfo)
        if (node) {
          nodes.push(node)
        }
      }

      this.on('pollReply', tempHandler)

      // Send ArtPoll
      const pollPacket = this.buildArtPollPacket()
      this.socket!.send(pollPacket, 0, pollPacket.length, this.config.port, '255.255.255.255')

      // Wait for responses
      setTimeout(() => {
        this.off('pollReply', tempHandler)
        resolve(nodes)
      }, timeoutMs)
    })
  }

  /**
   * Parse ArtPollReply packet
   */
  protected parseArtPollReply(msg: Buffer, rinfo: dgram.RemoteInfo): ArtNetNode | null {
    if (msg.length < 14) return null

    // Check header
    const header = msg.subarray(0, 8).toString()
    if (header !== 'Art-Net\0') return null

    // Check OpCode
    const opCode = msg.readUInt16LE(8)
    if (opCode !== DMX_CONFIG.ARTNET_OP_POLL_REPLY) return null

    // Parse reply (simplified)
    return {
      ip: rinfo.address,
      mac: `${msg[201].toString(16)}:${msg[202].toString(16)}:${msg[203].toString(16)}:${msg[204].toString(16)}:${msg[205].toString(16)}:${msg[206].toString(16)}`,
      shortName: msg.subarray(26, 44).toString().replace(/\0/g, ''),
      longName: msg.subarray(44, 108).toString().replace(/\0/g, ''),
      numPorts: msg[173],
      style: msg[200],
    }
  }

  /**
   * Handle incoming messages
   */
  protected handleMessage(msg: Buffer, rinfo: dgram.RemoteInfo): void {
    if (msg.length < 10) return

    const header = msg.subarray(0, 8).toString()
    if (header !== 'Art-Net\0') return

    const opCode = msg.readUInt16LE(8)

    switch (opCode) {
      case DMX_CONFIG.ARTNET_OP_POLL_REPLY:
        this.emit('pollReply', msg, rinfo)
        break
      // Handle other opcodes as needed
    }
  }

  /**
   * Send UDP packet
   */
  protected sendPacket(packet: Buffer): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.socket) {
        reject(new Error('Socket not initialized'))
        return
      }

      const target = this.config.broadcast ? '255.255.255.255' : this.config.ipAddress

      this.socket.send(packet, 0, packet.length, this.config.port, target, (error) => {
        if (error) {
          reject(error)
        } else {
          resolve()
        }
      })
    })
  }

  /**
   * Start automatic frame output
   */
  protected startFrameOutput(): void {
    if (this.frameInterval) return

    const intervalMs = Math.floor(1000 / DMX_CONFIG.FRAME_RATE_HZ)
    this.frameInterval = setInterval(() => {
      this.sendAllUniverses().catch(() => {
        // Error logged in sendUniverse
      })
    }, intervalMs)

    dmxLogger.debug('Started Art-Net frame output', {
      intervalMs,
      frameRate: DMX_CONFIG.FRAME_RATE_HZ,
    })
  }

  /**
   * Stop automatic frame output
   */
  protected stopFrameOutput(): void {
    if (this.frameInterval) {
      clearInterval(this.frameInterval)
      this.frameInterval = null
      dmxLogger.debug('Stopped Art-Net frame output')
    }
  }
}

export default ArtNetClient
