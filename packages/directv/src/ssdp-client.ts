// Minimal SSDP client for DirecTV LAN discovery.
//
// Replaces `node-ssdp` (last published 2022, abandoned, transitively
// depends on vulnerable `ip` package — GHSA-2p57-rm9w-gvfp HIGH SSRF).
//
// SSDP (Simple Service Discovery Protocol) is just multicast UDP on
// 239.255.255.250:1900 with HTTP-like request/response headers. We only
// need M-SEARCH (send) + response parsing — no NOTIFY, no advertisements,
// no continuous listening. ~80 lines total.

import * as dgram from 'dgram'
import { EventEmitter } from 'events'

const SSDP_ADDRESS = '239.255.255.250'
const SSDP_PORT = 1900

export interface SSDPResponseHeaders {
  ST?: string
  LOCATION?: string
  USN?: string
  SERVER?: string
  [key: string]: string | undefined
}

export interface SSDPRemoteInfo {
  address: string
  port: number
}

/**
 * Minimal SSDP M-SEARCH client. Drop-in for `node-ssdp`'s `Client` for the
 * narrow subset of API the DirecTV discovery code uses.
 */
export class SSDPClient extends EventEmitter {
  private socket: dgram.Socket | null = null

  /**
   * Send an SSDP M-SEARCH for the given Search Target (ST). Responses
   * arrive via the 'response' event as
   *   (headers: SSDPResponseHeaders, statusCode: number, rinfo: SSDPRemoteInfo)
   * matching node-ssdp's callback signature.
   */
  search(searchTarget: string): void {
    if (this.socket) {
      // Stale socket from a previous search — close before reopening.
      try { this.socket.close() } catch {}
    }

    this.socket = dgram.createSocket({ type: 'udp4', reuseAddr: true })

    this.socket.on('message', (msg, rinfo) => {
      const text = msg.toString('utf8')
      const lines = text.split(/\r?\n/)
      const statusLine = lines[0] || ''
      const statusMatch = statusLine.match(/^HTTP\/[\d.]+\s+(\d+)/i)
      if (!statusMatch) return
      const statusCode = parseInt(statusMatch[1], 10)

      const headers: SSDPResponseHeaders = {}
      for (const line of lines.slice(1)) {
        const idx = line.indexOf(':')
        if (idx <= 0) continue
        const key = line.slice(0, idx).trim().toUpperCase()
        const value = line.slice(idx + 1).trim()
        if (key) headers[key] = value
      }

      this.emit('response', headers, statusCode, { address: rinfo.address, port: rinfo.port })
    })

    this.socket.on('error', (err) => {
      this.emit('error', err)
    })

    this.socket.bind(0, () => {
      if (!this.socket) return
      // Receive multicast responses if any (most SSDP responses come back
      // as unicast to our ephemeral port, but some boxes reply multicast).
      try { this.socket.addMembership(SSDP_ADDRESS) } catch {}

      const message = Buffer.from(
        [
          'M-SEARCH * HTTP/1.1',
          `HOST: ${SSDP_ADDRESS}:${SSDP_PORT}`,
          'MAN: "ssdp:discover"',
          'MX: 3',
          `ST: ${searchTarget}`,
          '',
          ''
        ].join('\r\n'),
        'utf8'
      )

      this.socket.send(message, 0, message.length, SSDP_PORT, SSDP_ADDRESS)
    })
  }

  stop(): void {
    if (this.socket) {
      try { this.socket.close() } catch {}
      this.socket = null
    }
  }
}
