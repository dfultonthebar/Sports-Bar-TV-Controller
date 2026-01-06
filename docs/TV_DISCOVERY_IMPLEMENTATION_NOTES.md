# TV Discovery Implementation Notes

## Document Purpose

This document provides technical implementation guidance for developers building the TV Discovery system. It complements the UX Specification with code patterns, service architecture, and security considerations.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend (React)                        │
├─────────────────────────────────────────────────────────────┤
│ TVDiscoveryWizard Component                                 │
│  ├─ DiscoveryConfigStep                                     │
│  ├─ DiscoveryScanStep                                       │
│  ├─ PairingWorkflowStep                                     │
│  └─ MatrixAssignmentStep                                    │
└─────────────────────────────────────────────────────────────┘
                          │
                          │ HTTP/WebSocket
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                   API Routes (Next.js)                      │
├─────────────────────────────────────────────────────────────┤
│ /api/tv-discovery/scan                                      │
│ /api/tv-discovery/scan/:scanId/status                       │
│ /api/tv-discovery/pair                                      │
│ /api/tv-discovery/pair/:pairingId/verify                    │
│ /api/tv-discovery/assign                                    │
│ /api/tv-discovery/auto-assign                               │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│               Service Layer (/src/lib)                      │
├─────────────────────────────────────────────────────────────┤
│ TVDiscoveryService                                          │
│  ├─ scanNetwork()                                           │
│  ├─ detectBrand()                                           │
│  └─ getCapabilities()                                       │
│                                                             │
│ TVPairingService                                            │
│  ├─ SamsungPairingClient                                    │
│  ├─ LGWebOSPairingClient                                    │
│  ├─ SonyBRAVIAPairingClient                                 │
│  └─ VizioSmartCastPairingClient                             │
│                                                             │
│ TVControlService                                            │
│  ├─ power()                                                 │
│  ├─ volume()                                                │
│  └─ input()                                                 │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                    Database (Drizzle ORM)                   │
├─────────────────────────────────────────────────────────────┤
│ NetworkTVDevice table                                       │
│ MatrixOutput table (updated)                                │
└─────────────────────────────────────────────────────────────┘
```

---

## File Structure

```
/src/lib/tv-discovery/
├── discovery-service.ts          # Network scanning logic
├── pairing-service.ts            # Brand-agnostic pairing interface
├── clients/
│   ├── samsung-client.ts         # Samsung WebSocket pairing
│   ├── lg-webos-client.ts        # LG WebOS pairing
│   ├── sony-bravia-client.ts     # Sony PSK pairing
│   ├── vizio-smartcast-client.ts # Vizio pairing
│   └── base-client.ts            # Abstract base class
├── control-service.ts            # TV control commands
├── brand-detection.ts            # Brand detection logic
└── types.ts                      # TypeScript interfaces

/src/components/tv-discovery/
├── TVDiscoveryWizard.tsx         # Main wizard component
├── DiscoveryConfigStep.tsx       # Step 1: Configuration
├── DiscoveryScanStep.tsx         # Step 2: Scanning
├── PairingWorkflowStep.tsx       # Step 3: Pairing
├── MatrixAssignmentStep.tsx      # Step 4: Assignment
├── components/
│   ├── IPRangeInput.tsx          # IP range input fields
│   ├── CIDRInput.tsx             # CIDR notation input
│   ├── PortSelector.tsx          # Port selection checkboxes
│   ├── ScanProgress.tsx          # Progress bar component
│   ├── DetectedDeviceCard.tsx    # Device card in results
│   ├── PairingCard.tsx           # Pairing UI per brand
│   ├── DraggableTVCard.tsx       # Drag source for assignment
│   └── MatrixOutputDropZone.tsx  # Drop target for assignment
└── hooks/
    ├── useDiscoveryWizard.ts     # State management hook
    ├── useScanProgress.ts        # Polling hook for scan status
    └── usePairingFlow.ts         # Pairing state machine

/src/app/api/tv-discovery/
├── scan/route.ts                 # POST /api/tv-discovery/scan
├── scan/[scanId]/status/route.ts # GET scan status
├── pair/route.ts                 # POST /api/tv-discovery/pair
├── pair/[pairingId]/verify/route.ts # POST verify PIN
├── pair/[pairingId]/status/route.ts # GET pairing status
├── assign/route.ts               # POST assign to matrix
├── auto-assign/route.ts          # POST auto-assign
└── devices/[deviceId]/route.ts   # DELETE device
```

---

## Core Services Implementation

### 1. TVDiscoveryService

**File**: `/src/lib/tv-discovery/discovery-service.ts`

```typescript
import { db } from '@/db'
import { schema } from '@/db'
import { logger } from '@/lib/logger'
import net from 'net'
import http from 'http'
import WebSocket from 'ws'

export interface ScanConfig {
  startIP: string
  endIP: string
  ports: number[]
  timeout: number
  concurrentScans: number
  skipCEC?: boolean
  testPower?: boolean
}

export interface DiscoveredTV {
  ipAddress: string
  port: number
  brand: string
  model?: string
  confidence: 'high' | 'medium' | 'low'
  pairingRequired: boolean
  capabilities: string[]
}

export interface ScanProgress {
  scanId: string
  status: 'scanning' | 'complete' | 'failed'
  current: number
  total: number
  currentIP: string
  discovered: DiscoveredTV[]
  elapsed: number
  estimatedRemaining: number
}

export class TVDiscoveryService {
  private activeScanProgress = new Map<string, ScanProgress>()

  /**
   * Start network scan for TVs
   */
  async scanNetwork(config: ScanConfig): Promise<string> {
    const scanId = `scan-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

    logger.info('[TV_DISCOVERY] Starting network scan', { scanId, config })

    // Initialize progress tracking
    const ips = this.generateIPRange(config.startIP, config.endIP)
    this.activeScanProgress.set(scanId, {
      scanId,
      status: 'scanning',
      current: 0,
      total: ips.length,
      currentIP: ips[0],
      discovered: [],
      elapsed: 0,
      estimatedRemaining: ips.length * config.timeout,
    })

    // Start scan in background
    this.executeScan(scanId, ips, config).catch((error) => {
      logger.error('[TV_DISCOVERY] Scan failed', { scanId, error })
      const progress = this.activeScanProgress.get(scanId)
      if (progress) {
        progress.status = 'failed'
      }
    })

    return scanId
  }

  /**
   * Get scan progress for polling
   */
  getScanProgress(scanId: string): ScanProgress | null {
    return this.activeScanProgress.get(scanId) || null
  }

  /**
   * Execute the actual scan (runs in background)
   */
  private async executeScan(
    scanId: string,
    ips: string[],
    config: ScanConfig
  ): Promise<void> {
    const startTime = Date.now()
    const progress = this.activeScanProgress.get(scanId)!

    // Process IPs in batches (concurrent scans)
    for (let i = 0; i < ips.length; i += config.concurrentScans) {
      const batch = ips.slice(i, i + config.concurrentScans)

      // Scan batch concurrently
      const results = await Promise.all(
        batch.map((ip) => this.scanSingleIP(ip, config.ports, config.timeout))
      )

      // Add discovered TVs to progress
      for (const result of results) {
        if (result) {
          progress.discovered.push(result)
        }
      }

      // Update progress
      progress.current = Math.min(i + config.concurrentScans, ips.length)
      progress.currentIP = ips[progress.current] || ips[ips.length - 1]
      progress.elapsed = Date.now() - startTime

      const remaining = ips.length - progress.current
      const avgTimePerIP = progress.elapsed / progress.current
      progress.estimatedRemaining = Math.round(remaining * avgTimePerIP)
    }

    // Mark as complete
    progress.status = 'complete'
    progress.current = ips.length
    progress.elapsed = Date.now() - startTime
    progress.estimatedRemaining = 0

    logger.info('[TV_DISCOVERY] Scan complete', {
      scanId,
      discovered: progress.discovered.length,
      elapsed: progress.elapsed,
    })

    // Cleanup after 5 minutes
    setTimeout(() => {
      this.activeScanProgress.delete(scanId)
    }, 5 * 60 * 1000)
  }

  /**
   * Scan a single IP across all ports
   */
  private async scanSingleIP(
    ip: string,
    ports: number[],
    timeout: number
  ): Promise<DiscoveredTV | null> {
    for (const port of ports) {
      const result = await this.probePort(ip, port, timeout)
      if (result) {
        return result
      }
    }
    return null
  }

  /**
   * Probe a specific IP:port combination
   */
  private async probePort(
    ip: string,
    port: number,
    timeout: number
  ): Promise<DiscoveredTV | null> {
    try {
      // First check if port is open (TCP handshake)
      const isOpen = await this.checkPortOpen(ip, port, timeout)
      if (!isOpen) return null

      // Port is open, now detect brand
      const detection = await this.detectBrand(ip, port, timeout)
      if (!detection) return null

      logger.info('[TV_DISCOVERY] Device detected', { ip, port, ...detection })

      return {
        ipAddress: ip,
        port,
        ...detection,
      }
    } catch (error: any) {
      logger.debug('[TV_DISCOVERY] Probe failed', { ip, port, error: error.message })
      return null
    }
  }

  /**
   * Check if TCP port is open
   */
  private checkPortOpen(ip: string, port: number, timeout: number): Promise<boolean> {
    return new Promise((resolve) => {
      const socket = new net.Socket()
      let timedOut = false

      const timer = setTimeout(() => {
        timedOut = true
        socket.destroy()
        resolve(false)
      }, timeout)

      socket.connect(port, ip, () => {
        clearTimeout(timer)
        socket.destroy()
        resolve(!timedOut)
      })

      socket.on('error', () => {
        clearTimeout(timer)
        resolve(false)
      })
    })
  }

  /**
   * Detect TV brand by querying device info
   */
  private async detectBrand(
    ip: string,
    port: number,
    timeout: number
  ): Promise<Omit<DiscoveredTV, 'ipAddress' | 'port'> | null> {
    try {
      // Samsung (port 8001)
      if (port === 8001) {
        const info = await this.querySamsungDevice(ip, port, timeout)
        if (info) return info
      }

      // LG WebOS (port 3000)
      if (port === 3000) {
        const info = await this.queryLGDevice(ip, port, timeout)
        if (info) return info
      }

      // Sony BRAVIA (port 20060)
      if (port === 20060) {
        const info = await this.querySonyDevice(ip, port, timeout)
        if (info) return info
      }

      // Vizio SmartCast (port 7345)
      if (port === 7345) {
        const info = await this.queryVizioDevice(ip, port, timeout)
        if (info) return info
      }

      // Generic HTTP probe
      return await this.queryGenericDevice(ip, port, timeout)
    } catch (error: any) {
      logger.debug('[TV_DISCOVERY] Brand detection failed', {
        ip,
        port,
        error: error.message,
      })
      return null
    }
  }

  /**
   * Query Samsung device info
   */
  private async querySamsungDevice(
    ip: string,
    port: number,
    timeout: number
  ): Promise<Omit<DiscoveredTV, 'ipAddress' | 'port'> | null> {
    try {
      // Try to connect to Samsung WebSocket API
      const ws = new WebSocket(`ws://${ip}:${port}/api/v2/`)

      const deviceInfo = await new Promise<any>((resolve, reject) => {
        const timer = setTimeout(() => {
          ws.close()
          reject(new Error('Timeout'))
        }, timeout)

        ws.on('open', () => {
          clearTimeout(timer)
          ws.close()
          resolve(true)
        })

        ws.on('error', (error) => {
          clearTimeout(timer)
          reject(error)
        })
      })

      if (deviceInfo) {
        return {
          brand: 'Samsung',
          model: null, // Can't get model without pairing
          confidence: 'high',
          pairingRequired: true,
          capabilities: ['power', 'volume', 'input', 'apps'],
        }
      }
    } catch (error) {
      // WebSocket connection failed
    }

    return null
  }

  /**
   * Query LG WebOS device info
   */
  private async queryLGDevice(
    ip: string,
    port: number,
    timeout: number
  ): Promise<Omit<DiscoveredTV, 'ipAddress' | 'port'> | null> {
    try {
      const ws = new WebSocket(`ws://${ip}:${port}/`)

      const deviceInfo = await new Promise<any>((resolve, reject) => {
        const timer = setTimeout(() => {
          ws.close()
          reject(new Error('Timeout'))
        }, timeout)

        ws.on('open', () => {
          clearTimeout(timer)
          ws.close()
          resolve(true)
        })

        ws.on('error', (error) => {
          clearTimeout(timer)
          reject(error)
        })
      })

      if (deviceInfo) {
        return {
          brand: 'LG',
          model: null,
          confidence: 'high',
          pairingRequired: true,
          capabilities: ['power', 'volume', 'input', 'apps'],
        }
      }
    } catch (error) {
      // WebSocket connection failed
    }

    return null
  }

  /**
   * Query Sony BRAVIA device info
   */
  private async querySonyDevice(
    ip: string,
    port: number,
    timeout: number
  ): Promise<Omit<DiscoveredTV, 'ipAddress' | 'port'> | null> {
    try {
      const response = await this.httpRequest(
        'POST',
        `http://${ip}:${port}/sony/system`,
        { method: 'getSystemInformation', params: [], id: 1, version: '1.0' },
        timeout
      )

      if (response && response.result) {
        return {
          brand: 'Sony',
          model: response.result[0]?.model || null,
          confidence: 'high',
          pairingRequired: true, // Requires PSK
          capabilities: ['power', 'volume', 'input'],
        }
      }
    } catch (error) {
      // HTTP request failed
    }

    return null
  }

  /**
   * Query Vizio SmartCast device info
   */
  private async queryVizioDevice(
    ip: string,
    port: number,
    timeout: number
  ): Promise<Omit<DiscoveredTV, 'ipAddress' | 'port'> | null> {
    try {
      const response = await this.httpRequest(
        'GET',
        `http://${ip}:${port}/state/device/deviceinfo`,
        null,
        timeout
      )

      if (response) {
        return {
          brand: 'Vizio',
          model: response.model || null,
          confidence: 'high',
          pairingRequired: true,
          capabilities: ['power', 'volume', 'input'],
        }
      }
    } catch (error) {
      // HTTP request failed
    }

    return null
  }

  /**
   * Generic HTTP probe
   */
  private async queryGenericDevice(
    ip: string,
    port: number,
    timeout: number
  ): Promise<Omit<DiscoveredTV, 'ipAddress' | 'port'> | null> {
    // Try HTTP GET to common endpoints
    const endpoints = ['/', '/api', '/info', '/status']

    for (const endpoint of endpoints) {
      try {
        const response = await this.httpRequest('GET', `http://${ip}:${port}${endpoint}`, null, timeout)
        if (response) {
          // Got some response, assume it's a generic device
          return {
            brand: 'Generic',
            model: null,
            confidence: 'low',
            pairingRequired: true,
            capabilities: [],
          }
        }
      } catch (error) {
        continue
      }
    }

    return null
  }

  /**
   * Make HTTP request with timeout
   */
  private httpRequest(
    method: string,
    url: string,
    body: any,
    timeout: number
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      const urlObj = new URL(url)
      const options = {
        hostname: urlObj.hostname,
        port: urlObj.port,
        path: urlObj.pathname + urlObj.search,
        method,
        timeout,
        headers: body ? { 'Content-Type': 'application/json' } : {},
      }

      const req = http.request(options, (res) => {
        let data = ''
        res.on('data', (chunk) => (data += chunk))
        res.on('end', () => {
          try {
            resolve(JSON.parse(data))
          } catch {
            resolve(data)
          }
        })
      })

      req.on('error', reject)
      req.on('timeout', () => {
        req.destroy()
        reject(new Error('Timeout'))
      })

      if (body) {
        req.write(JSON.stringify(body))
      }
      req.end()
    })
  }

  /**
   * Generate IP range from start/end IPs
   */
  private generateIPRange(startIP: string, endIP: string): string[] {
    const start = this.ipToNumber(startIP)
    const end = this.ipToNumber(endIP)
    const ips: string[] = []

    for (let i = start; i <= end; i++) {
      ips.push(this.numberToIP(i))
    }

    return ips
  }

  /**
   * Convert IP string to number
   */
  private ipToNumber(ip: string): number {
    return ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0)
  }

  /**
   * Convert number to IP string
   */
  private numberToIP(num: number): string {
    return [
      (num >>> 24) & 0xff,
      (num >>> 16) & 0xff,
      (num >>> 8) & 0xff,
      num & 0xff,
    ].join('.')
  }
}

export const tvDiscoveryService = new TVDiscoveryService()
```

---

### 2. TVPairingService (Brand-Agnostic Interface)

**File**: `/src/lib/tv-discovery/pairing-service.ts`

```typescript
import { SamsungPairingClient } from './clients/samsung-client'
import { LGWebOSPairingClient } from './clients/lg-webos-client'
import { SonyBRAVIAPairingClient } from './clients/sony-bravia-client'
import { VizioSmartCastPairingClient } from './clients/vizio-smartcast-client'
import { logger } from '@/lib/logger'

export interface PairingSession {
  pairingId: string
  ipAddress: string
  port: number
  brand: string
  status: 'waiting' | 'pin_required' | 'accepted' | 'rejected' | 'timeout' | 'error'
  requiresPIN: boolean
  timeout: number
  startedAt: Date
  expiresAt: Date
  authToken?: string
  error?: string
}

export interface PairingResult {
  success: boolean
  deviceId: string
  authToken: string
  tokenExpiry: Date
  capabilities: {
    power: boolean
    volume: boolean
    input: boolean
    apps: boolean
  }
  apiVersion?: string
}

export class TVPairingService {
  private activePairings = new Map<string, PairingSession>()

  /**
   * Initiate pairing with a TV
   */
  async initiatePairing(
    ipAddress: string,
    port: number,
    brand: string
  ): Promise<PairingSession> {
    const pairingId = `pair-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

    logger.info('[TV_PAIRING] Initiating pairing', { pairingId, ipAddress, brand })

    // Create pairing session
    const timeout = this.getBrandTimeout(brand)
    const session: PairingSession = {
      pairingId,
      ipAddress,
      port,
      brand,
      status: 'waiting',
      requiresPIN: this.brandRequiresPIN(brand),
      timeout,
      startedAt: new Date(),
      expiresAt: new Date(Date.now() + timeout * 1000),
    }

    this.activePairings.set(pairingId, session)

    // Start pairing process in background
    this.executePairing(pairingId).catch((error) => {
      logger.error('[TV_PAIRING] Pairing failed', { pairingId, error })
      session.status = 'error'
      session.error = error.message
    })

    return session
  }

  /**
   * Get pairing session status
   */
  getPairingStatus(pairingId: string): PairingSession | null {
    return this.activePairings.get(pairingId) || null
  }

  /**
   * Verify PIN and complete pairing (for brands that require PIN)
   */
  async verifyPIN(pairingId: string, pin: string): Promise<PairingResult> {
    const session = this.activePairings.get(pairingId)
    if (!session) {
      throw new Error('Pairing session not found')
    }

    if (!session.requiresPIN) {
      throw new Error('This TV does not require PIN verification')
    }

    logger.info('[TV_PAIRING] Verifying PIN', { pairingId, brand: session.brand })

    // Get brand-specific client
    const client = this.getClientForBrand(session.brand)

    // Verify PIN
    const result = await client.verifyPIN(session.ipAddress, session.port, pin)

    if (result.success) {
      session.status = 'accepted'
      session.authToken = result.authToken

      // Save to database
      const deviceId = await this.saveToDatabase(session, result)

      // Cleanup session after 5 minutes
      setTimeout(() => {
        this.activePairings.delete(pairingId)
      }, 5 * 60 * 1000)

      return {
        success: true,
        deviceId,
        authToken: result.authToken,
        tokenExpiry: result.tokenExpiry,
        capabilities: result.capabilities,
        apiVersion: result.apiVersion,
      }
    } else {
      session.status = 'rejected'
      session.error = result.error
      throw new Error(result.error || 'PIN verification failed')
    }
  }

  /**
   * Execute pairing (runs in background)
   */
  private async executePairing(pairingId: string): Promise<void> {
    const session = this.activePairings.get(pairingId)!
    const client = this.getClientForBrand(session.brand)

    try {
      // Send pairing request to TV
      await client.sendPairingRequest(session.ipAddress, session.port)

      if (session.requiresPIN) {
        // PIN required - wait for user input
        session.status = 'pin_required'

        // Set timeout
        setTimeout(() => {
          if (session.status === 'pin_required' || session.status === 'waiting') {
            session.status = 'timeout'
            logger.warn('[TV_PAIRING] Pairing timeout', { pairingId })
          }
        }, session.timeout * 1000)
      } else {
        // No PIN required (e.g., LG) - poll for acceptance
        session.status = 'waiting'
        await this.pollForAcceptance(pairingId, client)
      }
    } catch (error: any) {
      session.status = 'error'
      session.error = error.message
      logger.error('[TV_PAIRING] Pairing execution failed', { pairingId, error })
    }
  }

  /**
   * Poll for pairing acceptance (for LG TVs without PIN)
   */
  private async pollForAcceptance(
    pairingId: string,
    client: any
  ): Promise<void> {
    const session = this.activePairings.get(pairingId)!
    const pollInterval = 2000 // 2 seconds

    const poll = async () => {
      try {
        const status = await client.checkPairingStatus(session.ipAddress, session.port)

        if (status === 'accepted') {
          session.status = 'accepted'
          session.authToken = client.getAuthToken()

          // Save to database
          await this.saveToDatabase(session, {
            authToken: session.authToken,
            tokenExpiry: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
            capabilities: { power: true, volume: true, input: true, apps: true },
          })
        } else if (status === 'rejected') {
          session.status = 'rejected'
        } else if (new Date() > session.expiresAt) {
          session.status = 'timeout'
        } else {
          // Still waiting - poll again
          setTimeout(poll, pollInterval)
        }
      } catch (error: any) {
        session.status = 'error'
        session.error = error.message
      }
    }

    await poll()
  }

  /**
   * Save paired TV to database
   */
  private async saveToDatabase(
    session: PairingSession,
    result: any
  ): Promise<string> {
    const { db } = await import('@/db')
    const { schema } = await import('@/db')
    const crypto = await import('crypto')

    // Encrypt auth token
    const encryptedToken = this.encryptToken(result.authToken)

    // Create device record
    const [device] = await db.insert(schema.networkTVDevices).values({
      id: crypto.randomUUID(),
      ipAddress: session.ipAddress,
      port: session.port,
      brand: session.brand,
      displayName: `${session.brand} TV (${session.ipAddress})`,
      authToken: encryptedToken,
      authTokenExpiry: result.tokenExpiry,
      pairingStatus: 'paired',
      lastPairingAttempt: new Date(),
      supportsPower: result.capabilities.power,
      supportsVolume: result.capabilities.volume,
      supportsInput: result.capabilities.input,
      supportsApps: result.capabilities.apps,
      apiVersion: result.apiVersion,
      status: 'online',
      lastSeen: new Date(),
      discoveryMethod: 'ip_scan',
      discoveryConfidence: 'high',
      discoveredAt: new Date(),
    }).returning()

    logger.info('[TV_PAIRING] Device saved to database', {
      deviceId: device.id,
      brand: session.brand,
      ipAddress: session.ipAddress,
    })

    return device.id
  }

  /**
   * Get brand-specific pairing client
   */
  private getClientForBrand(brand: string): any {
    switch (brand.toLowerCase()) {
      case 'samsung':
        return new SamsungPairingClient()
      case 'lg':
        return new LGWebOSPairingClient()
      case 'sony':
        return new SonyBRAVIAPairingClient()
      case 'vizio':
        return new VizioSmartCastPairingClient()
      default:
        throw new Error(`Unsupported brand: ${brand}`)
    }
  }

  /**
   * Check if brand requires PIN entry
   */
  private brandRequiresPIN(brand: string): boolean {
    const pskBrands = ['sony'] // PSK instead of PIN
    const noPinBrands = ['lg'] // Accept/reject only

    return !noPinBrands.includes(brand.toLowerCase()) && !pskBrands.includes(brand.toLowerCase())
  }

  /**
   * Get brand-specific timeout
   */
  private getBrandTimeout(brand: string): number {
    const timeouts: Record<string, number> = {
      samsung: 60,
      lg: 45,
      sony: 120, // PSK entry takes longer
      vizio: 60,
    }
    return timeouts[brand.toLowerCase()] || 60
  }

  /**
   * Encrypt auth token for storage
   */
  private encryptToken(token: string): string {
    // TODO: Implement proper encryption using crypto module
    // For now, return base64 encoded (NOT SECURE - placeholder)
    return Buffer.from(token).toString('base64')
  }
}

export const tvPairingService = new TVPairingService()
```

---

## Security Considerations

### 1. Authentication Token Storage

**CRITICAL**: Auth tokens must be encrypted at rest in the database.

```typescript
import crypto from 'crypto'

const ENCRYPTION_KEY = process.env.TOKEN_ENCRYPTION_KEY! // 32 bytes
const ALGORITHM = 'aes-256-gcm'

export function encryptToken(token: string): string {
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY, 'hex'), iv)

  let encrypted = cipher.update(token, 'utf8', 'hex')
  encrypted += cipher.final('hex')

  const authTag = cipher.getAuthTag()

  // Return: iv:authTag:encrypted
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`
}

export function decryptToken(encryptedToken: string): string {
  const [ivHex, authTagHex, encrypted] = encryptedToken.split(':')

  const iv = Buffer.from(ivHex, 'hex')
  const authTag = Buffer.from(authTagHex, 'hex')
  const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY, 'hex'), iv)

  decipher.setAuthTag(authTag)

  let decrypted = decipher.update(encrypted, 'hex', 'utf8')
  decrypted += decipher.final('utf8')

  return decrypted
}
```

### 2. Rate Limiting

Apply rate limits to prevent abuse:

```typescript
// In API route
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'

export async function POST(request: NextRequest) {
  const rateLimit = await withRateLimit(request, {
    ...RateLimitConfigs.DEFAULT,
    maxRequests: 10, // Max 10 scans per hour
    windowMs: 60 * 60 * 1000,
  })
  if (!rateLimit.allowed) return rateLimit.response

  // ... rest of handler
}
```

### 3. Input Validation

Validate all user inputs using Zod schemas:

```typescript
import { z } from 'zod'

export const ScanConfigSchema = z.object({
  method: z.enum(['ip_range', 'cidr', 'subnet']),
  config: z.object({
    startIP: z.string().ip({ version: 'v4' }).optional(),
    endIP: z.string().ip({ version: 'v4' }).optional(),
    cidr: z.string().regex(/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\/\d{1,2}$/).optional(),
    ports: z.array(z.number().int().min(1).max(65535)).min(1),
    timeout: z.number().int().min(1000).max(10000),
    concurrentScans: z.number().int().min(1).max(20),
    skipCEC: z.boolean().optional(),
    testPower: z.boolean().optional(),
  }),
})

export const PINSchema = z.object({
  pin: z.string().regex(/^\d{4}$/, 'PIN must be 4 digits'),
})
```

---

## Testing Strategy

### Unit Tests

```typescript
// __tests__/tv-discovery-service.test.ts
import { tvDiscoveryService } from '@/lib/tv-discovery/discovery-service'

describe('TVDiscoveryService', () => {
  describe('scanNetwork', () => {
    it('should generate correct IP range', () => {
      const ips = tvDiscoveryService['generateIPRange']('192.168.1.1', '192.168.1.5')
      expect(ips).toEqual([
        '192.168.1.1',
        '192.168.1.2',
        '192.168.1.3',
        '192.168.1.4',
        '192.168.1.5',
      ])
    })

    it('should convert IP to number correctly', () => {
      const num = tvDiscoveryService['ipToNumber']('192.168.1.100')
      expect(num).toBe(3232235876)
    })

    it('should convert number to IP correctly', () => {
      const ip = tvDiscoveryService['numberToIP'](3232235876)
      expect(ip).toBe('192.168.1.100')
    })
  })

  describe('detectBrand', () => {
    it('should detect Samsung TV on port 8001', async () => {
      // Mock WebSocket connection
      const result = await tvDiscoveryService['detectBrand']('192.168.1.100', 8001, 2000)
      expect(result?.brand).toBe('Samsung')
      expect(result?.confidence).toBe('high')
    })
  })
})
```

### Integration Tests

```typescript
// tests/integration/tv-discovery.test.ts
import { tvDiscoveryService } from '@/lib/tv-discovery/discovery-service'
import { tvPairingService } from '@/lib/tv-discovery/pairing-service'

describe('TV Discovery Integration', () => {
  it('should complete full discovery workflow', async () => {
    // Start scan
    const scanId = await tvDiscoveryService.scanNetwork({
      startIP: '192.168.5.1',
      endIP: '192.168.5.10',
      ports: [8001],
      timeout: 2000,
      concurrentScans: 5,
    })

    // Poll for results
    let progress
    do {
      await new Promise((r) => setTimeout(r, 1000))
      progress = tvDiscoveryService.getScanProgress(scanId)
    } while (progress?.status === 'scanning')

    expect(progress?.status).toBe('complete')
    expect(progress?.discovered.length).toBeGreaterThan(0)

    // Initiate pairing for first device
    const device = progress!.discovered[0]
    const pairing = await tvPairingService.initiatePairing(
      device.ipAddress,
      device.port,
      device.brand
    )

    expect(pairing.pairingId).toBeDefined()
    expect(pairing.status).toBe('pin_required')

    // Verify PIN (mock)
    const result = await tvPairingService.verifyPIN(pairing.pairingId, '1234')

    expect(result.success).toBe(true)
    expect(result.deviceId).toBeDefined()
    expect(result.authToken).toBeDefined()
  })
})
```

---

## Performance Optimization

### 1. Connection Pooling

Reuse HTTP agents for multiple requests:

```typescript
import http from 'http'
import https from 'https'

const httpAgent = new http.Agent({
  keepAlive: true,
  maxSockets: 20,
})

const httpsAgent = new https.Agent({
  keepAlive: true,
  maxSockets: 20,
})

// Use in requests
const req = http.request({ ...options, agent: httpAgent })
```

### 2. Scan Batching

Process IPs in optimal batches:

```typescript
const OPTIMAL_BATCH_SIZE = 5 // Balance between speed and system load

for (let i = 0; i < ips.length; i += OPTIMAL_BATCH_SIZE) {
  const batch = ips.slice(i, i + OPTIMAL_BATCH_SIZE)
  await Promise.all(batch.map((ip) => scanSingleIP(ip, ...)))
}
```

### 3. Aggressive Timeouts

Use short timeouts to prevent slow scans:

```typescript
const DEFAULT_TIMEOUT = 2000 // 2 seconds
const PORT_OPEN_TIMEOUT = 500 // 0.5 seconds for TCP handshake
```

---

## Logging and Monitoring

### Log Levels

```typescript
// Discovery start
logger.info('[TV_DISCOVERY] Starting scan', { scanId, config })

// Device detected
logger.info('[TV_DISCOVERY] Device detected', { ip, port, brand })

// Pairing initiated
logger.info('[TV_PAIRING] Initiating pairing', { pairingId, brand })

// Errors
logger.error('[TV_DISCOVERY] Scan failed', { scanId, error })
logger.warn('[TV_PAIRING] Pairing timeout', { pairingId })

// Debug (development only)
logger.debug('[TV_DISCOVERY] Probing port', { ip, port })
```

### Metrics to Track

- Scan duration
- Devices detected per scan
- Pairing success rate
- Average time per pairing
- Error rates by brand
- Network timeout rates

---

## Environment Variables

```bash
# .env.local

# Token encryption key (32 bytes hex)
TOKEN_ENCRYPTION_KEY=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef

# Discovery defaults
TV_DISCOVERY_DEFAULT_TIMEOUT=2000
TV_DISCOVERY_MAX_CONCURRENT=10
TV_DISCOVERY_ENABLE_CACHE=true

# Pairing defaults
TV_PAIRING_DEFAULT_TIMEOUT=60
TV_PAIRING_LG_TIMEOUT=45
TV_PAIRING_SONY_TIMEOUT=120

# Feature flags
TV_DISCOVERY_ENABLE_CEC_FALLBACK=true
TV_DISCOVERY_ENABLE_AUTO_ASSIGN=true
```

---

## Database Indexes

```sql
-- Add indexes for performance

CREATE INDEX idx_network_tv_device_ip
ON NetworkTVDevice(ipAddress);

CREATE INDEX idx_network_tv_device_status
ON NetworkTVDevice(status);

CREATE INDEX idx_network_tv_device_matrix_output
ON NetworkTVDevice(matrixOutputId);

CREATE INDEX idx_network_tv_device_pairing_status
ON NetworkTVDevice(pairingStatus);

CREATE INDEX idx_matrix_output_network_tv
ON MatrixOutput(networkTVDeviceId);
```

---

## Future Enhancements

### Phase 2 Features

1. **mDNS/Bonjour Discovery**
   - Auto-detect TVs without IP range scanning
   - Service name: `_samsung-tv._tcp.local.`, `_webostv._tcp.local.`

2. **Wake-on-LAN**
   - Store MAC addresses during discovery
   - Wake TVs before scanning

3. **Scheduled Discovery**
   - Cron job to run daily/weekly scans
   - Auto-detect new TVs

4. **Health Monitoring**
   - Periodic status checks
   - Alert on TV offline
   - Auto-retry failed pairings

5. **Bulk Operations**
   - Pair all detected TVs automatically
   - Batch power tests
   - Export/import configurations

---

**Implementation Notes Version 1.0**
**Last Updated**: 2025-11-21
**Related Docs**: TV_DISCOVERY_UX_SPECIFICATION.md, TV_DISCOVERY_QUICK_REFERENCE.md
