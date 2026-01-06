# Commercial TV Network Control Protocols - Technical Plan

## Executive Summary

This document provides comprehensive technical specifications for implementing network-based control of commercial TVs across major brands. It covers discovery methods, authentication flows, control protocols, and implementation challenges specific to sports bar/hospitality environments.

**Document Version**: 1.0
**Last Updated**: 2025-11-21
**Target Audience**: Developers implementing TV discovery and control features

---

## Table of Contents

1. [Major TV Control Protocols](#major-tv-control-protocols)
2. [Network Discovery Methods](#network-discovery-methods)
3. [Authentication & Pairing](#authentication-pairing)
4. [Technical Implementation Examples](#technical-implementation-examples)
5. [Commercial vs Consumer Differences](#commercial-vs-consumer-differences)
6. [Technical Challenges](#technical-challenges)
7. [Recommended Implementation Strategy](#recommended-implementation-strategy)

---

## Major TV Control Protocols

### 1. Samsung Smart TVs (Tizen OS)

**Support**: 2016+ models with Tizen OS

#### Connection Details

| Parameter | Value |
|-----------|-------|
| Protocol | WebSocket (ws://) or Secure WebSocket (wss://) |
| Port (Unencrypted) | 8001 |
| Port (Encrypted) | 8002 |
| Format | JSON-RPC |
| Base URL | `ws://TV_IP:8001/api/v2/channels/samsung.remote.control` |

#### Authentication Flow

1. **Initial Connection**:
   ```
   ws://192.168.1.100:8001/api/v2/channels/samsung.remote.control?name=<BASE64_APP_NAME>
   ```
   - `name` parameter: Base64-encoded application name
   - Example: "Sports Bar Controller" → `U3BvcnRzIEJhciBDb250cm9sbGVy`

2. **Token-Based Authentication**:
   - On first connection, TV displays pairing prompt
   - User approves on TV screen
   - Server receives `authToken` in WebSocket response
   - Token must be stored for future connections

3. **Subsequent Connections**:
   ```
   wss://192.168.1.100:8002/api/v2/channels/samsung.remote.control?name=<BASE64>&token=<AUTH_TOKEN>
   ```

#### Security Notes

- **Modern TVs (2020+)**: MUST use secure WebSocket (port 8002)
- **Legacy TVs (2016-2019)**: Can use unencrypted WebSocket (port 8001)
- Self-signed certificate on port 8002 requires disabling certificate verification

#### Command Examples

**Send Remote Key Press**:
```json
{
  "method": "ms.remote.control",
  "params": {
    "Cmd": "Click",
    "DataOfCmd": "KEY_POWER",
    "Option": "false",
    "TypeOfRemote": "SendRemoteKey"
  }
}
```

**Get Installed Apps**:
```json
{
  "method": "ms.channel.emit",
  "params": {
    "event": "ed.installedApp.get",
    "to": "host"
  }
}
```

#### Capabilities

- ✅ Power on/off
- ✅ Volume control
- ✅ Input switching
- ✅ Channel tuning
- ✅ App launching
- ✅ Text input
- ❌ Power state detection (unreliable when off)

#### Code Example

```typescript
import WebSocket from 'ws'
import { Buffer } from 'buffer'

interface SamsungTVConfig {
  ipAddress: string
  port: number
  appName: string
  token?: string
}

class SamsungTVClient {
  private ws: WebSocket | null = null
  private config: SamsungTVConfig

  constructor(config: SamsungTVConfig) {
    this.config = config
  }

  async connect(): Promise<void> {
    const encodedName = Buffer.from(this.config.appName).toString('base64')
    const protocol = this.config.port === 8002 ? 'wss' : 'ws'

    let url = `${protocol}://${this.config.ipAddress}:${this.config.port}/api/v2/channels/samsung.remote.control?name=${encodedName}`

    if (this.config.token) {
      url += `&token=${this.config.token}`
    }

    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(url, {
        rejectUnauthorized: false // Accept self-signed certs
      })

      this.ws.on('open', () => {
        console.log('Connected to Samsung TV')
        resolve()
      })

      this.ws.on('message', (data) => {
        const response = JSON.parse(data.toString())

        // Save token on first connection
        if (response.data?.token) {
          this.config.token = response.data.token
          console.log('Received auth token:', this.config.token)
        }
      })

      this.ws.on('error', (error) => {
        reject(error)
      })
    })
  }

  async sendKey(key: string): Promise<void> {
    if (!this.ws) throw new Error('Not connected')

    const command = {
      method: 'ms.remote.control',
      params: {
        Cmd: 'Click',
        DataOfCmd: key,
        Option: 'false',
        TypeOfRemote: 'SendRemoteKey'
      }
    }

    this.ws.send(JSON.stringify(command))
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
  }
}

// Usage
const tv = new SamsungTVClient({
  ipAddress: '192.168.1.100',
  port: 8002,
  appName: 'Sports Bar Controller'
})

await tv.connect()
await tv.sendKey('KEY_POWER')
await tv.sendKey('KEY_HDMI')
tv.disconnect()
```

---

### 2. LG Smart TVs (webOS)

**Support**: 2014+ models with webOS

#### Connection Details

| Parameter | Value |
|-----------|-------|
| Protocol | WebSocket (ws://) or Secure WebSocket (wss://) |
| Port (Unencrypted) | 3000 |
| Port (Encrypted) | 3001 |
| Discovery | SSDP (urn:lge-com:service:webos-second-screen:1) |
| Format | JSON |

#### Authentication Flow

1. **Initial Handshake**:
   - Connect to `ws://TV_IP:3000/`
   - Send registration request
   - TV displays approval prompt
   - User accepts on TV screen

2. **Client Key Storage**:
   - On approval, TV responds with `client_key`
   - Store key in persistent storage
   - Use key for all future connections

3. **Subsequent Connections**:
   ```json
   {
     "type": "register",
     "payload": {
       "forcePairing": false,
       "pairingType": "PROMPT",
       "client-key": "STORED_CLIENT_KEY",
       "manifest": {
         "manifestVersion": 1,
         "appVersion": "1.0.0",
         "signed": {
           "created": "20250101",
           "appId": "com.sportsbar.tvcontroller",
           "vendorId": "com.sportsbar",
           "localizedAppNames": {
             "": "Sports Bar TV Controller",
             "en-US": "Sports Bar TV Controller"
           },
           "localizedVendorNames": {
             "": "Sports Bar"
           },
           "permissions": [
             "LAUNCH",
             "LAUNCH_WEBAPP",
             "APP_TO_APP",
             "CLOSE",
             "TEST_OPEN",
             "TEST_PROTECTED",
             "CONTROL_AUDIO",
             "CONTROL_DISPLAY",
             "CONTROL_INPUT_JOYSTICK",
             "CONTROL_INPUT_MEDIA_RECORDING",
             "CONTROL_INPUT_MEDIA_PLAYBACK",
             "CONTROL_INPUT_TV",
             "CONTROL_POWER",
             "READ_INSTALLED_APPS",
             "READ_LGE_SDX",
             "READ_NOTIFICATIONS",
             "SEARCH",
             "WRITE_SETTINGS",
             "WRITE_NOTIFICATIONS",
             "CONTROL_INPUT_TEXT",
             "CONTROL_MOUSE_AND_KEYBOARD",
             "READ_INPUT_DEVICE_LIST",
             "READ_NETWORK_STATE",
             "READ_RUNNING_APPS",
             "READ_UPDATE_INFO",
             "UPDATE_FROM_REMOTE_APP",
             "READ_LGE_TV_INPUT_EVENTS",
             "READ_TV_CURRENT_TIME"
           ]
         }
       }
     }
   }
   ```

4. **6-Digit PIN (Newer Models)**:
   - Some 2020+ models display 6-digit PIN on screen
   - Must send PIN in pairing request

#### Security Notes

- **Secure WebSocket**: Newer models require wss:// on port 3001
- **LG Connect Apps**: Must be enabled in TV Network settings
- **Certificate Handling**: Self-signed certificates require verification bypass

#### Command Examples

**Power Off**:
```json
{
  "type": "request",
  "id": "power_1",
  "uri": "ssap://system/turnOff"
}
```

**Get Volume**:
```json
{
  "type": "request",
  "id": "vol_1",
  "uri": "ssap://audio/getVolume"
}
```

**Set Volume**:
```json
{
  "type": "request",
  "id": "vol_2",
  "uri": "ssap://audio/setVolume",
  "payload": {
    "volume": 15
  }
}
```

**Switch Input**:
```json
{
  "type": "request",
  "id": "input_1",
  "uri": "ssap://tv/switchInput",
  "payload": {
    "inputId": "HDMI_1"
  }
}
```

**Launch App**:
```json
{
  "type": "request",
  "id": "app_1",
  "uri": "ssap://system.launcher/launch",
  "payload": {
    "id": "netflix"
  }
}
```

#### Capabilities

- ✅ Power off (power on requires Wake-on-LAN)
- ✅ Volume control
- ✅ Input switching
- ✅ App launching
- ✅ Media playback control
- ✅ Toast notifications
- ❌ Power on via network (WOL required)

#### Code Example

```typescript
import WebSocket from 'ws'

interface LGTVConfig {
  ipAddress: string
  port: number
  clientKey?: string
}

class LGWebOSClient {
  private ws: WebSocket | null = null
  private config: LGTVConfig
  private requestId = 0

  constructor(config: LGTVConfig) {
    this.config = config
  }

  async connect(): Promise<string | null> {
    const url = `ws://${this.config.ipAddress}:${this.config.port}/`

    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(url)

      this.ws.on('open', () => {
        // Send registration
        const registration = {
          type: 'register',
          payload: {
            forcePairing: false,
            pairingType: 'PROMPT',
            ...(this.config.clientKey && { 'client-key': this.config.clientKey }),
            manifest: {
              manifestVersion: 1,
              appVersion: '1.0.0',
              signed: {
                created: '20250101',
                appId: 'com.sportsbar.tvcontroller',
                vendorId: 'com.sportsbar',
                localizedAppNames: {
                  '': 'Sports Bar TV Controller'
                },
                localizedVendorNames: {
                  '': 'Sports Bar'
                },
                permissions: [
                  'CONTROL_POWER',
                  'CONTROL_AUDIO',
                  'CONTROL_DISPLAY',
                  'CONTROL_INPUT_TV'
                ]
              }
            }
          }
        }

        this.ws!.send(JSON.stringify(registration))
      })

      this.ws.on('message', (data) => {
        const response = JSON.parse(data.toString())

        if (response.type === 'registered') {
          const clientKey = response.payload?.['client-key']
          if (clientKey && !this.config.clientKey) {
            console.log('New client key received:', clientKey)
            resolve(clientKey)
          } else {
            resolve(null)
          }
        }
      })

      this.ws.on('error', (error) => {
        reject(error)
      })
    })
  }

  async sendCommand(uri: string, payload?: any): Promise<void> {
    if (!this.ws) throw new Error('Not connected')

    const command = {
      type: 'request',
      id: `cmd_${++this.requestId}`,
      uri,
      ...(payload && { payload })
    }

    this.ws.send(JSON.stringify(command))
  }

  async powerOff(): Promise<void> {
    await this.sendCommand('ssap://system/turnOff')
  }

  async setVolume(volume: number): Promise<void> {
    await this.sendCommand('ssap://audio/setVolume', { volume })
  }

  async switchInput(inputId: string): Promise<void> {
    await this.sendCommand('ssap://tv/switchInput', { inputId })
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
  }
}

// Usage
const tv = new LGWebOSClient({
  ipAddress: '192.168.1.101',
  port: 3000,
  clientKey: 'stored_key_from_previous_session' // Optional
})

const newKey = await tv.connect()
if (newKey) {
  // Store this key for future connections
  console.log('Save this key:', newKey)
}

await tv.switchInput('HDMI_1')
await tv.setVolume(20)
tv.disconnect()
```

---

### 3. Sony Android TVs (BRAVIA)

**Support**: 2015+ models with Android TV / Google TV

#### Connection Details

| Parameter | Value |
|-----------|-------|
| Protocol | HTTP REST API |
| Port | 80 (default) |
| Format | JSON-RPC |
| Base URL | `http://TV_IP/sony/` |
| Documentation | https://pro-bravia.sony.net/develop/integrate/rest-api/spec/ |

#### Authentication Methods

Sony supports three authentication methods:

1. **None**: No authentication (rarely enabled)
2. **Pre-Shared Key (PSK)**: Most common for commercial/professional use
3. **Normal**: PIN-based registration

#### Pre-Shared Key Setup (Recommended)

1. Navigate to TV settings:
   ```
   Settings → Network → Home Network Setup → IP Control → Pre-Shared Key
   ```

2. Enter PSK (16-20 characters recommended):
   ```
   Example: "MySecureKey12345"
   ```

3. Add PSK to HTTP request headers:
   ```
   X-Auth-PSK: MySecureKey12345
   ```

#### Normal Authentication Flow

1. **Registration Request**:
   ```bash
   POST http://TV_IP/sony/accessControl
   Content-Type: application/json

   {
     "id": 1,
     "method": "actRegister",
     "version": "1.0",
     "params": [
       {
         "clientid": "SportsBarController:12345",
         "nickname": "Sports Bar Controller",
         "level": "private"
       },
       [
         {
           "value": "yes",
           "function": "WOL"
         }
       ]
     ]
   }
   ```

2. **PIN Display**: TV displays 4-digit PIN on screen

3. **Authorization Header**: Use PIN as password with basic auth
   ```
   Authorization: Basic OnBpbl9jb2Rl  (empty username, PIN as password)
   ```

#### Command Examples

**Power Off**:
```bash
curl -H "Content-Type: application/json" \
     -H "X-Auth-PSK: MySecureKey12345" \
     -X POST \
     -d '{"id": 1, "method": "setPowerStatus", "version": "1.0", "params": [{"status": false}]}' \
     http://192.168.1.102/sony/system
```

**Get Power Status**:
```bash
curl -H "Content-Type: application/json" \
     -H "X-Auth-PSK: MySecureKey12345" \
     -X POST \
     -d '{"id": 1, "method": "getPowerStatus", "version": "1.0", "params": []}' \
     http://192.168.1.102/sony/system
```

**Set Volume**:
```bash
curl -H "Content-Type: application/json" \
     -H "X-Auth-PSK: MySecureKey12345" \
     -X POST \
     -d '{"id": 1, "method": "setAudioVolume", "version": "1.0", "params": [{"target": "speaker", "volume": "15"}]}' \
     http://192.168.1.102/sony/audio
```

**Switch Input**:
```bash
curl -H "Content-Type: application/json" \
     -H "X-Auth-PSK: MySecureKey12345" \
     -X POST \
     -d '{"id": 1, "method": "setPlayContent", "version": "1.0", "params": [{"uri": "extInput:hdmi?port=1"}]}' \
     http://192.168.1.102/sony/avContent
```

**Get Input List**:
```bash
curl -H "Content-Type: application/json" \
     -H "X-Auth-PSK: MySecureKey12345" \
     -X POST \
     -d '{"id": 1, "method": "getCurrentExternalInputsStatus", "version": "1.0", "params": []}' \
     http://192.168.1.102/sony/avContent
```

#### API Endpoints

| Endpoint | Purpose |
|----------|---------|
| `/sony/system` | Power control, system info |
| `/sony/audio` | Volume, mute, speaker settings |
| `/sony/avContent` | Input switching, content playback |
| `/sony/appControl` | App launching |
| `/sony/videoScreen` | Picture settings |
| `/sony/accessControl` | Authentication |

#### Capabilities

- ✅ Power on/off
- ✅ Power state detection
- ✅ Volume control
- ✅ Input switching
- ✅ App launching (Android apps)
- ✅ Picture settings
- ✅ System information
- ✅ Wake-on-LAN support

#### Code Example

```typescript
import axios, { AxiosInstance } from 'axios'

interface SonyBRAVIAConfig {
  ipAddress: string
  psk: string
  port?: number
}

class SonyBRAVIAClient {
  private axios: AxiosInstance
  private requestId = 0

  constructor(config: SonyBRAVIAConfig) {
    this.axios = axios.create({
      baseURL: `http://${config.ipAddress}:${config.port || 80}/sony`,
      headers: {
        'Content-Type': 'application/json',
        'X-Auth-PSK': config.psk
      },
      timeout: 5000
    })
  }

  private async sendCommand(endpoint: string, method: string, params: any[] = []): Promise<any> {
    const response = await this.axios.post(endpoint, {
      id: ++this.requestId,
      method,
      version: '1.0',
      params
    })

    if (response.data.error) {
      throw new Error(`Sony TV Error: ${JSON.stringify(response.data.error)}`)
    }

    return response.data.result
  }

  async getPowerStatus(): Promise<boolean> {
    const result = await this.sendCommand('/system', 'getPowerStatus')
    return result[0].status === 'active'
  }

  async setPowerStatus(on: boolean): Promise<void> {
    await this.sendCommand('/system', 'setPowerStatus', [{ status: on }])
  }

  async getVolume(): Promise<number> {
    const result = await this.sendCommand('/audio', 'getVolumeInformation')
    return result[0].find((v: any) => v.target === 'speaker')?.volume || 0
  }

  async setVolume(volume: number): Promise<void> {
    await this.sendCommand('/audio', 'setAudioVolume', [
      { target: 'speaker', volume: volume.toString() }
    ])
  }

  async switchInput(hdmiPort: number): Promise<void> {
    await this.sendCommand('/avContent', 'setPlayContent', [
      { uri: `extInput:hdmi?port=${hdmiPort}` }
    ])
  }

  async getInputs(): Promise<any[]> {
    const result = await this.sendCommand('/avContent', 'getCurrentExternalInputsStatus')
    return result[0] || []
  }
}

// Usage
const tv = new SonyBRAVIAClient({
  ipAddress: '192.168.1.102',
  psk: 'MySecureKey12345'
})

const isOn = await tv.getPowerStatus()
console.log('TV is on:', isOn)

await tv.setVolume(20)
await tv.switchInput(1) // HDMI 1
```

---

### 4. Vizio SmartCast TVs

**Support**: 2016+ models with SmartCast

#### Connection Details

| Parameter | Value |
|-----------|-------|
| Protocol | HTTPS REST API |
| Port | 9000 (pairing), 7345 (control) |
| Discovery | SSDP (urn:dial-multiscreen-org:service:dial:1) |
| Format | JSON |

#### Authentication Flow

1. **Pairing Request**:
   ```bash
   PUT https://TV_IP:9000/pairing/start
   Content-Type: application/json

   {
     "DEVICE_ID": "pyvizio",
     "DEVICE_NAME": "Sports Bar Controller"
   }
   ```

2. **PIN Display**: TV displays 4-digit PIN

3. **Pairing Completion**:
   ```bash
   PUT https://TV_IP:9000/pairing/pair
   Content-Type: application/json

   {
     "DEVICE_ID": "pyvizio",
     "CHALLENGE_TYPE": 1,
     "RESPONSE_VALUE": "1234",
     "PAIRING_REQ_TOKEN": <token_from_start_response>
   }
   ```

4. **Token Storage**: Response contains `AUTH_TOKEN` for future requests

#### Command Examples

**Get Power State**:
```bash
curl -k -H "AUTH: AUTH_TOKEN_HERE" \
     https://192.168.1.103:7345/state/device/power_mode
```

**Power On**:
```bash
curl -k -H "AUTH: AUTH_TOKEN_HERE" \
     -X PUT \
     -d '{"HASHVAL": 1234567890, "REQUEST": "PUT", "VALUE": 1}' \
     https://192.168.1.103:7345/key_command/POWER
```

**Power Off**:
```bash
curl -k -H "AUTH: AUTH_TOKEN_HERE" \
     -X PUT \
     -d '{"HASHVAL": 1234567890, "REQUEST": "PUT", "VALUE": 0}' \
     https://192.168.1.103:7345/key_command/POWER
```

**Volume Up**:
```bash
curl -k -H "AUTH: AUTH_TOKEN_HERE" \
     -X PUT \
     -d '{"HASHVAL": 1234567890, "REQUEST": "PUT", "VALUE": 1}' \
     https://192.168.1.103:7345/key_command/VOLUME_UP
```

**Switch Input**:
```bash
curl -k -H "AUTH: AUTH_TOKEN_HERE" \
     -X PUT \
     -d '{"HASHVAL": 1234567890, "REQUEST": "PUT", "VALUE": "HDMI-1"}' \
     https://192.168.1.103:7345/menu_native/current_input
```

#### Discovery via SSDP

Vizio TVs respond to SSDP M-SEARCH queries:
```
M-SEARCH * HTTP/1.1
HOST: 239.255.255.250:1900
MAN: "ssdp:discover"
MX: 3
ST: urn:dial-multiscreen-org:service:dial:1
```

#### Capabilities

- ✅ Power on/off
- ✅ Power state detection
- ✅ Volume control
- ✅ Input switching
- ✅ Smart app control (Google Cast)
- ⚠️ Self-signed HTTPS certificate (must ignore cert errors)

#### Code Example

```typescript
import axios, { AxiosInstance } from 'axios'
import https from 'https'

interface VizioSmartCastConfig {
  ipAddress: string
  authToken?: string
}

class VizioSmartCastClient {
  private axios: AxiosInstance
  private config: VizioSmartCastConfig

  constructor(config: VizioSmartCastConfig) {
    this.config = config

    // Ignore self-signed certificate
    const httpsAgent = new https.Agent({
      rejectUnauthorized: false
    })

    this.axios = axios.create({
      baseURL: `https://${config.ipAddress}:7345`,
      httpsAgent,
      timeout: 5000
    })
  }

  async pair(deviceId: string, deviceName: string): Promise<string> {
    // Start pairing
    const startResponse = await axios.put(
      `https://${this.config.ipAddress}:9000/pairing/start`,
      {
        DEVICE_ID: deviceId,
        DEVICE_NAME: deviceName
      },
      {
        httpsAgent: new https.Agent({ rejectUnauthorized: false })
      }
    )

    const pairingToken = startResponse.data.PAIRING_REQ_TOKEN

    // User must enter PIN shown on TV
    console.log('Enter PIN displayed on TV screen')
    // In real implementation, prompt user for PIN

    return pairingToken
  }

  async completePairing(pairingToken: string, pin: string, deviceId: string): Promise<string> {
    const response = await axios.put(
      `https://${this.config.ipAddress}:9000/pairing/pair`,
      {
        DEVICE_ID: deviceId,
        CHALLENGE_TYPE: 1,
        RESPONSE_VALUE: pin,
        PAIRING_REQ_TOKEN: pairingToken
      },
      {
        httpsAgent: new https.Agent({ rejectUnauthorized: false })
      }
    )

    return response.data.AUTH_TOKEN
  }

  private getHeaders() {
    if (!this.config.authToken) {
      throw new Error('Not authenticated. Call pair() first.')
    }
    return { AUTH: this.config.authToken }
  }

  private generateHashVal(): number {
    return Math.floor(Date.now() / 1000)
  }

  async getPowerState(): Promise<boolean> {
    const response = await this.axios.get('/state/device/power_mode', {
      headers: this.getHeaders()
    })
    return response.data.ITEMS[0].VALUE === 1
  }

  async setPowerState(on: boolean): Promise<void> {
    await this.axios.put('/key_command/POWER', {
      HASHVAL: this.generateHashVal(),
      REQUEST: 'PUT',
      VALUE: on ? 1 : 0
    }, {
      headers: this.getHeaders()
    })
  }

  async setVolume(volume: number): Promise<void> {
    await this.axios.put('/menu_native/audio/volume', {
      HASHVAL: this.generateHashVal(),
      REQUEST: 'PUT',
      VALUE: volume
    }, {
      headers: this.getHeaders()
    })
  }

  async switchInput(input: string): Promise<void> {
    await this.axios.put('/menu_native/current_input', {
      HASHVAL: this.generateHashVal(),
      REQUEST: 'PUT',
      VALUE: input // e.g., "HDMI-1"
    }, {
      headers: this.getHeaders()
    })
  }
}

// Usage
const tv = new VizioSmartCastClient({
  ipAddress: '192.168.1.103'
})

// First time pairing
const pairingToken = await tv.pair('sportsbar_001', 'Sports Bar Controller')
// User enters PIN from TV screen
const authToken = await tv.completePairing(pairingToken, '1234', 'sportsbar_001')
console.log('Save this token:', authToken)

// Subsequent use
const tv2 = new VizioSmartCastClient({
  ipAddress: '192.168.1.103',
  authToken: 'saved_token_from_pairing'
})

await tv2.setPowerState(true)
await tv2.switchInput('HDMI-1')
```

---

### 5. TCL Roku TVs

**Support**: All TCL Roku TV models

#### Connection Details

| Parameter | Value |
|-----------|-------|
| Protocol | HTTP REST API (External Control Protocol - ECP) |
| Port | 8060 |
| Discovery | SSDP (urn:roku:ecp) |
| Format | XML |
| Documentation | https://developer.roku.com/docs/developer-program/debugging/external-control-api.md |

#### No Authentication Required

Roku TVs do not require pairing or authentication. The ECP API is open on port 8060.

#### Command Examples

**Get Device Info**:
```bash
curl http://192.168.1.104:8060/query/device-info
```

**Power On (Roku TV only)**:
```bash
curl -d '' http://192.168.1.104:8060/keypress/PowerOn
```

**Power Off (Roku TV only)**:
```bash
curl -d '' http://192.168.1.104:8060/keypress/PowerOff
```

**Volume Up**:
```bash
curl -d '' http://192.168.1.104:8060/keypress/VolumeUp
```

**Volume Down**:
```bash
curl -d '' http://192.168.1.104:8060/keypress/VolumeDown
```

**Mute Toggle**:
```bash
curl -d '' http://192.168.1.104:8060/keypress/VolumeMute
```

**Switch Input to HDMI 1**:
```bash
curl -d '' http://192.168.1.104:8060/keypress/InputHDMI1
```

**Home Button**:
```bash
curl -d '' http://192.168.1.104:8060/keypress/Home
```

**Launch Channel**:
```bash
curl -d '' http://192.168.1.104:8060/launch/12 # Launch Netflix
```

**Get Active App**:
```bash
curl http://192.168.1.104:8060/query/active-app
```

**Get Installed Apps**:
```bash
curl http://192.168.1.104:8060/query/apps
```

#### Available Keys

```
Home, Rev, Fwd, Play, Select, Left, Right, Down, Up, Back,
InstantReplay, Info, Backspace, Search, Enter,
VolumeDown, VolumeUp, VolumeMute,
PowerOn, PowerOff,
InputTuner, InputHDMI1, InputHDMI2, InputHDMI3, InputHDMI4, InputAV1
```

#### Discovery via SSDP

Roku devices respond to SSDP queries:
```
M-SEARCH * HTTP/1.1
HOST: 239.255.255.250:1900
MAN: "ssdp:discover"
MX: 3
ST: roku:ecp
```

#### Capabilities

- ✅ Power on/off (Roku TVs only, not streaming sticks)
- ✅ Volume control (Roku TVs only)
- ✅ Input switching (Roku TVs only)
- ✅ Navigation/remote keys
- ✅ App launching
- ✅ Device information
- ❌ Direct volume level setting (only up/down/mute)
- ❌ Power state detection when off

#### Code Example

```typescript
import axios, { AxiosInstance } from 'axios'
import { parseStringPromise } from 'xml2js'

interface RokuTVConfig {
  ipAddress: string
  port?: number
}

class RokuTVClient {
  private axios: AxiosInstance

  constructor(config: RokuTVConfig) {
    this.axios = axios.create({
      baseURL: `http://${config.ipAddress}:${config.port || 8060}`,
      timeout: 5000
    })
  }

  async sendKey(key: string): Promise<void> {
    await this.axios.post(`/keypress/${key}`)
  }

  async getDeviceInfo(): Promise<any> {
    const response = await this.axios.get('/query/device-info')
    const parsed = await parseStringPromise(response.data)
    return parsed['device-info']
  }

  async getActiveApp(): Promise<string | null> {
    const response = await this.axios.get('/query/active-app')
    const parsed = await parseStringPromise(response.data)
    const app = parsed['active-app']?.app?.[0]
    return app?.$?.id || null
  }

  async getInstalledApps(): Promise<any[]> {
    const response = await this.axios.get('/query/apps')
    const parsed = await parseStringPromise(response.data)
    return parsed.apps?.app || []
  }

  async launchApp(appId: string): Promise<void> {
    await this.axios.post(`/launch/${appId}`)
  }

  // Convenience methods
  async powerOn(): Promise<void> {
    await this.sendKey('PowerOn')
  }

  async powerOff(): Promise<void> {
    await this.sendKey('PowerOff')
  }

  async volumeUp(): Promise<void> {
    await this.sendKey('VolumeUp')
  }

  async volumeDown(): Promise<void> {
    await this.sendKey('VolumeDown')
  }

  async volumeMute(): Promise<void> {
    await this.sendKey('VolumeMute')
  }

  async switchInput(hdmiPort: number): Promise<void> {
    await this.sendKey(`InputHDMI${hdmiPort}`)
  }

  async home(): Promise<void> {
    await this.sendKey('Home')
  }
}

// Usage
const tv = new RokuTVClient({
  ipAddress: '192.168.1.104'
})

const deviceInfo = await tv.getDeviceInfo()
console.log('Device:', deviceInfo)

await tv.powerOn()
await tv.switchInput(1) // HDMI 1
await tv.volumeUp()
await tv.volumeUp()
await tv.volumeUp()
```

---

### 6. Sharp Aquos Commercial Displays

**Support**: Commercial display models with network control

#### Connection Details

| Parameter | Value |
|-----------|-------|
| Protocol | TCP Socket (Telnet-like) |
| Port | 10002 (Aquos), 10008 (Professional), 8888 (4P series) |
| Format | ASCII commands |
| Authentication | None |

#### Setup Requirements

1. Enable network control on display:
   - Settings → Application → RS-232C/LAN SELECT → LAN
   - Setup → Telnet Server → ON

2. Some models require:
   - "Monitor Control via Network" → Enabled

#### Command Format

Commands follow the format: `COMMAND<CR>` (where <CR> is carriage return `\r`)

**Examples**:
- Power On: `POWR1   \r`
- Power Off: `POWR0   \r`
- HDMI 1: `IAVD1   \r`
- HDMI 2: `IAVD2   \r`
- Volume 20: `VOLM20  \r`

#### Capabilities

- ✅ Power on/off
- ✅ Input switching
- ✅ Volume control
- ✅ Picture settings
- ✅ Wake-on-LAN support
- ✅ No authentication required

#### Code Example

```typescript
import net from 'net'

interface SharpAquosConfig {
  ipAddress: string
  port?: number
}

class SharpAquosClient {
  private config: SharpAquosConfig
  private socket: net.Socket | null = null

  constructor(config: SharpAquosConfig) {
    this.config = {
      ...config,
      port: config.port || 10002
    }
  }

  private async sendCommand(command: string): Promise<string> {
    return new Promise((resolve, reject) => {
      this.socket = new net.Socket()

      let responseData = ''

      this.socket.on('data', (data) => {
        responseData += data.toString()
      })

      this.socket.on('close', () => {
        resolve(responseData.trim())
      })

      this.socket.on('error', (error) => {
        reject(error)
      })

      this.socket.connect(this.config.port!, this.config.ipAddress, () => {
        this.socket!.write(command + '\r')

        // Close after short delay
        setTimeout(() => {
          this.socket!.end()
        }, 500)
      })
    })
  }

  async setPowerState(on: boolean): Promise<void> {
    await this.sendCommand(`POWR${on ? 1 : 0}   `)
  }

  async getPowerState(): Promise<boolean> {
    const response = await this.sendCommand('POWR?   ')
    return response.includes('1')
  }

  async setVolume(volume: number): Promise<void> {
    // Volume range typically 0-60
    const vol = Math.min(60, Math.max(0, volume))
    await this.sendCommand(`VOLM${vol.toString().padStart(2, '0')}  `)
  }

  async switchInput(input: 'HDMI1' | 'HDMI2' | 'HDMI3' | 'HDMI4'): Promise<void> {
    const inputMap: Record<string, string> = {
      HDMI1: 'IAVD1   ',
      HDMI2: 'IAVD2   ',
      HDMI3: 'IAVD3   ',
      HDMI4: 'IAVD4   '
    }

    await this.sendCommand(inputMap[input])
  }
}

// Usage
const display = new SharpAquosClient({
  ipAddress: '192.168.1.105'
})

await display.setPowerState(true)
await display.switchInput('HDMI1')
await display.setVolume(30)
```

---

### 7. Hisense Android TVs

**Support**: Hisense Android TV and Google TV models

#### Connection Details

| Parameter | Value |
|-----------|-------|
| Protocol | MQTT over TCP |
| Port | 36669 |
| Format | MQTT topics/payloads |
| Broker | Mosquitto 1.4.2 (running on TV) |

#### Authentication

**Default Credentials** (may work on some models):
- Username: `hisenseservice`
- Password: `multimqttservice`

**4-Digit Code** (newer models):
1. TV displays 4-digit code on screen
2. Publish code to: `/remoteapp/tv/ui_service/HomeAssistant/actions/authenticationcode`
3. Payload: `{"authNum": "XXXX"}`

#### MQTT Topics

**Power Control**:
- Topic: `/remoteapp/tv/remote_service/<MAC>/actions/sendkey`
- Payload: `{"keycode": "KEY_POWER", "sourceid": "1"}`

**Volume Control**:
- Topic: `/remoteapp/tv/platform_service/<MAC>/actions/changevolume`
- Payload: `{"volume_type": 1, "volume_value": 20}`

**Input Switching**:
- Topic: `/remoteapp/tv/ui_service/<MAC>/actions/changesource`
- Payload: `{"sourceid": "3"}` (3 = HDMI 1, 4 = HDMI 2, etc.)

#### SSL/TLS Notes

- Some models do not support SSL and require `--no-ssl` option
- Self-signed certificates may not be present on all models

#### Capabilities

- ✅ Power control
- ✅ Volume control
- ✅ Input switching
- ✅ Remote key presses
- ⚠️ Inconsistent authentication across models
- ⚠️ MQTT complexity vs HTTP REST APIs

#### Code Example

```typescript
import mqtt from 'mqtt'

interface HisenseTVConfig {
  ipAddress: string
  macAddress: string
  username?: string
  password?: string
  port?: number
}

class HisenseTVClient {
  private client: mqtt.MqttClient
  private config: HisenseTVConfig

  constructor(config: HisenseTVConfig) {
    this.config = {
      username: 'hisenseservice',
      password: 'multimqttservice',
      port: 36669,
      ...config
    }

    this.client = mqtt.connect(`mqtt://${this.config.ipAddress}:${this.config.port}`, {
      username: this.config.username,
      password: this.config.password,
      rejectUnauthorized: false
    })
  }

  private async publish(topic: string, payload: any): Promise<void> {
    return new Promise((resolve, reject) => {
      this.client.publish(topic, JSON.stringify(payload), (error) => {
        if (error) reject(error)
        else resolve()
      })
    })
  }

  async sendKey(key: string): Promise<void> {
    const topic = `/remoteapp/tv/remote_service/${this.config.macAddress}/actions/sendkey`
    await this.publish(topic, {
      keycode: key,
      sourceid: '1'
    })
  }

  async setVolume(volume: number): Promise<void> {
    const topic = `/remoteapp/tv/platform_service/${this.config.macAddress}/actions/changevolume`
    await this.publish(topic, {
      volume_type: 1,
      volume_value: volume
    })
  }

  async switchInput(hdmiPort: number): Promise<void> {
    // Source IDs: 3 = HDMI1, 4 = HDMI2, 5 = HDMI3, 6 = HDMI4
    const sourceId = (2 + hdmiPort).toString()
    const topic = `/remoteapp/tv/ui_service/${this.config.macAddress}/actions/changesource`
    await this.publish(topic, {
      sourceid: sourceId
    })
  }

  async powerToggle(): Promise<void> {
    await this.sendKey('KEY_POWER')
  }

  disconnect(): void {
    this.client.end()
  }
}

// Usage
const tv = new HisenseTVClient({
  ipAddress: '192.168.1.106',
  macAddress: 'AA:BB:CC:DD:EE:FF'
})

await tv.powerToggle()
await tv.switchInput(1)
await tv.setVolume(25)
tv.disconnect()
```

---

## Network Discovery Methods

### 1. SSDP (Simple Service Discovery Protocol)

SSDP is the most common discovery method for smart TVs, based on UPnP.

#### Technical Specifications

- **Protocol**: UDP multicast
- **Multicast Address**: 239.255.255.250
- **Port**: 1900
- **Standard**: UPnP 1.0/1.1

#### M-SEARCH Request Format

```
M-SEARCH * HTTP/1.1
HOST: 239.255.255.250:1900
MAN: "ssdp:discover"
MX: 3
ST: <search_target>

```

**Search Targets by Brand**:

| Brand | Search Target |
|-------|--------------|
| Samsung | `urn:samsung.com:device:RemoteControlReceiver:1` |
| LG | `urn:lge-com:service:webos-second-screen:1` |
| Sony | `urn:schemas-sony-com:service:ScalarWebAPI:1` |
| Vizio | `urn:dial-multiscreen-org:service:dial:1` |
| Roku | `roku:ecp` |
| Generic | `ssdp:all` or `upnp:rootdevice` |

#### Response Format

```
HTTP/1.1 200 OK
CACHE-CONTROL: max-age=1800
EXT:
LOCATION: http://192.168.1.100:8001/api/v2/
SERVER: Linux/4.9.0, UPnP/1.0, Samsung/1.0
ST: urn:samsung.com:device:RemoteControlReceiver:1
USN: uuid:12345678-1234-1234-1234-123456789abc::urn:samsung.com:device:RemoteControlReceiver:1
```

#### Implementation Example

```typescript
import dgram from 'dgram'

interface SSDPDevice {
  ipAddress: string
  port: number
  location: string
  server: string
  st: string
  usn: string
}

async function discoverSSDP(searchTarget: string = 'ssdp:all', timeout: number = 3000): Promise<SSDPDevice[]> {
  const devices: SSDPDevice[] = []
  const socket = dgram.createSocket({ type: 'udp4', reuseAddr: true })

  const message = Buffer.from([
    'M-SEARCH * HTTP/1.1',
    'HOST: 239.255.255.250:1900',
    'MAN: "ssdp:discover"',
    `MX: ${Math.floor(timeout / 1000)}`,
    `ST: ${searchTarget}`,
    '',
    ''
  ].join('\r\n'))

  return new Promise((resolve) => {
    socket.on('message', (msg, rinfo) => {
      const response = msg.toString()
      const lines = response.split('\r\n')

      const device: Partial<SSDPDevice> = {
        ipAddress: rinfo.address,
        port: rinfo.port
      }

      lines.forEach(line => {
        const [key, ...valueParts] = line.split(':')
        const value = valueParts.join(':').trim()

        switch (key.toUpperCase()) {
          case 'LOCATION':
            device.location = value
            break
          case 'SERVER':
            device.server = value
            break
          case 'ST':
            device.st = value
            break
          case 'USN':
            device.usn = value
            break
        }
      })

      if (device.location) {
        devices.push(device as SSDPDevice)
      }
    })

    socket.bind(() => {
      socket.addMembership('239.255.255.250')
      socket.send(message, 0, message.length, 1900, '239.255.255.250')

      setTimeout(() => {
        socket.close()
        resolve(devices)
      }, timeout)
    })
  })
}

// Usage
const devices = await discoverSSDP('ssdp:all', 5000)
console.log('Discovered devices:', devices)

// Samsung-specific discovery
const samsungTVs = await discoverSSDP('urn:samsung.com:device:RemoteControlReceiver:1')

// LG-specific discovery
const lgTVs = await discoverSSDP('urn:lge-com:service:webos-second-screen:1')
```

---

### 2. Port Scanning

When SSDP fails or for comprehensive discovery, direct port scanning identifies TVs by detecting open ports.

#### Common TV Ports

| Port | Brand/Protocol |
|------|---------------|
| 8001 | Samsung (WebSocket) |
| 8002 | Samsung (Secure WebSocket) |
| 3000 | LG webOS (WebSocket) |
| 3001 | LG webOS (Secure WebSocket) |
| 80 | Sony BRAVIA (HTTP) |
| 9000 | Vizio SmartCast (Pairing) |
| 7345 | Vizio SmartCast (Control) |
| 8060 | Roku (ECP) |
| 10002 | Sharp Aquos |
| 10008 | Sharp Professional |
| 36669 | Hisense (MQTT) |

#### Port Scan Implementation

```typescript
import net from 'net'

interface PortScanResult {
  ipAddress: string
  port: number
  open: boolean
  banner?: string
}

async function scanPort(ipAddress: string, port: number, timeout: number = 2000): Promise<PortScanResult> {
  return new Promise((resolve) => {
    const socket = new net.Socket()
    let banner = ''

    socket.setTimeout(timeout)

    socket.on('connect', () => {
      // Connected - port is open
      // Try to read banner
      setTimeout(() => {
        socket.end()
      }, 200)
    })

    socket.on('data', (data) => {
      banner += data.toString()
    })

    socket.on('timeout', () => {
      socket.destroy()
      resolve({ ipAddress, port, open: false })
    })

    socket.on('error', () => {
      resolve({ ipAddress, port, open: false })
    })

    socket.on('close', () => {
      resolve({ ipAddress, port, open: true, banner })
    })

    socket.connect(port, ipAddress)
  })
}

async function scanIPRange(startIP: string, endIP: string, ports: number[]): Promise<PortScanResult[]> {
  const results: PortScanResult[] = []

  // Convert IP to number for iteration
  const ipToNum = (ip: string) => {
    return ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet), 0) >>> 0
  }

  const numToIP = (num: number) => {
    return [
      (num >>> 24) & 255,
      (num >>> 16) & 255,
      (num >>> 8) & 255,
      num & 255
    ].join('.')
  }

  const startNum = ipToNum(startIP)
  const endNum = ipToNum(endIP)

  // Scan with concurrency limit
  const concurrency = 10
  const tasks: Promise<PortScanResult>[] = []

  for (let ipNum = startNum; ipNum <= endNum; ipNum++) {
    const ip = numToIP(ipNum)

    for (const port of ports) {
      tasks.push(scanPort(ip, port))

      // Limit concurrency
      if (tasks.length >= concurrency) {
        const result = await Promise.race(tasks)
        const index = tasks.findIndex(t => t === Promise.resolve(result))
        tasks.splice(index, 1)

        if (result.open) {
          results.push(result)
        }
      }
    }
  }

  // Wait for remaining tasks
  const remaining = await Promise.all(tasks)
  results.push(...remaining.filter(r => r.open))

  return results
}

// Usage
const tvPorts = [8001, 8002, 3000, 3001, 80, 7345, 8060, 10002, 36669]
const openPorts = await scanIPRange('192.168.1.1', '192.168.1.254', tvPorts)

console.log('Found TVs:')
openPorts.forEach(result => {
  console.log(`${result.ipAddress}:${result.port}`)
})
```

---

### 3. Brand Detection via HTTP

Once a TV is discovered, detect the brand by probing HTTP endpoints.

#### Detection Strategy

```typescript
import axios from 'axios'

interface BrandDetectionResult {
  brand: string
  model?: string
  confidence: 'high' | 'medium' | 'low'
}

async function detectTVBrand(ipAddress: string): Promise<BrandDetectionResult | null> {
  // Samsung detection
  try {
    const response = await axios.get(`http://${ipAddress}:8001/api/v2/`, { timeout: 2000 })
    if (response.data?.device?.name || response.data?.remote?.version) {
      return {
        brand: 'Samsung',
        model: response.data.device?.modelName,
        confidence: 'high'
      }
    }
  } catch {}

  // LG webOS detection
  try {
    const response = await axios.get(`http://${ipAddress}:3000/`, { timeout: 2000 })
    if (response.headers['server']?.includes('LG')) {
      return {
        brand: 'LG',
        confidence: 'high'
      }
    }
  } catch {}

  // Sony BRAVIA detection
  try {
    const response = await axios.post(
      `http://${ipAddress}/sony/system`,
      {
        id: 1,
        method: 'getSystemInformation',
        version: '1.0',
        params: []
      },
      { timeout: 2000 }
    )

    if (response.data?.result) {
      return {
        brand: 'Sony',
        model: response.data.result[0]?.model,
        confidence: 'high'
      }
    }
  } catch {}

  // Roku detection
  try {
    const response = await axios.get(`http://${ipAddress}:8060/query/device-info`, { timeout: 2000 })
    if (response.data?.includes('roku')) {
      return {
        brand: 'Roku',
        confidence: 'high'
      }
    }
  } catch {}

  // Vizio detection (DIAL)
  try {
    const response = await axios.get(`http://${ipAddress}:9000/pairing/list`, {
      timeout: 2000,
      httpsAgent: new (require('https').Agent)({ rejectUnauthorized: false })
    })

    if (response.data) {
      return {
        brand: 'Vizio',
        confidence: 'medium'
      }
    }
  } catch {}

  return null
}

// Usage
const brand = await detectTVBrand('192.168.1.100')
if (brand) {
  console.log(`Detected: ${brand.brand} ${brand.model || ''} (${brand.confidence} confidence)`)
}
```

---

### 4. HDMI-CEC Name Correlation

If TVs are connected to an HDMI matrix with CEC, use CEC device names to correlate with discovered network TVs.

#### Strategy

1. **Get CEC Device Names**:
   ```bash
   echo 'scan' | cec-client -s -d 1
   ```

2. **Match with Network Discovery**:
   - CEC names often include brand (e.g., "Samsung TV", "LG TV")
   - Physical addresses correlate to HDMI ports
   - Use brand hints to prioritize discovery methods

3. **Auto-Assignment**:
   - Map discovered 192.168.1.100 (Samsung) → Matrix Output 1 (CEC: "Samsung TV")
   - Requires brand match and physical topology understanding

---

## Authentication & Pairing

### Pairing Requirements by Brand

| Brand | Requires Pairing | Method | PIN Entry | Stored Credential |
|-------|-----------------|--------|-----------|------------------|
| Samsung | Yes | WebSocket prompt | No | Auth token |
| LG | Yes | WebSocket prompt | Sometimes (6-digit) | Client key |
| Sony | Yes | PSK or PIN | PSK: Yes (on TV) | Pre-shared key |
| Vizio | Yes | HTTPS pairing | Yes (4-digit) | Auth token |
| Roku | No | None | No | None |
| Sharp | No | None | No | None |
| Hisense | Sometimes | MQTT auth code | Yes (4-digit) | Username/password |

### Security Considerations

1. **Token Storage**:
   - Store auth tokens/keys in database with encryption
   - Associate with device IP (handle IP changes gracefully)
   - Implement token refresh/re-pairing flows

2. **SSL/TLS**:
   - Samsung port 8002, LG port 3001, Vizio port 7345 use HTTPS/WSS
   - All use self-signed certificates
   - Must disable certificate verification (security trade-off)

3. **Timeout Handling**:
   - Samsung: 60-second pairing window
   - LG: 45-second approval window
   - Vizio: 30-second PIN entry window
   - Implement retry mechanisms

4. **User Experience**:
   - Show clear on-screen instructions
   - Display countdown timer
   - Provide "Resend" button for expired pairings
   - Show TV brand-specific prompts

---

## Technical Implementation Examples

### Complete Discovery Flow

```typescript
import { EventEmitter } from 'events'

interface DiscoveryConfig {
  startIP: string
  endIP: string
  ports: number[]
  timeout: number
  methods: ('ssdp' | 'portscan')[]
}

interface DiscoveredTV {
  ipAddress: string
  port: number
  brand: string
  model?: string
  pairingRequired: boolean
  confidence: 'high' | 'medium' | 'low'
}

class TVDiscoveryService extends EventEmitter {
  async scan(config: DiscoveryConfig): Promise<DiscoveredTV[]> {
    const discovered = new Map<string, DiscoveredTV>()

    // Step 1: SSDP Discovery
    if (config.methods.includes('ssdp')) {
      this.emit('progress', { stage: 'ssdp', progress: 0 })

      const ssdpDevices = await discoverSSDP('ssdp:all', config.timeout)

      for (const device of ssdpDevices) {
        const brand = await detectTVBrand(device.ipAddress)
        if (brand) {
          discovered.set(device.ipAddress, {
            ipAddress: device.ipAddress,
            port: device.port,
            brand: brand.brand,
            model: brand.model,
            pairingRequired: this.requiresPairing(brand.brand),
            confidence: brand.confidence
          })

          this.emit('deviceFound', discovered.get(device.ipAddress))
        }
      }
    }

    // Step 2: Port Scanning
    if (config.methods.includes('portscan')) {
      this.emit('progress', { stage: 'portscan', progress: 0 })

      const scanResults = await scanIPRange(config.startIP, config.endIP, config.ports)

      for (const result of scanResults) {
        if (!discovered.has(result.ipAddress)) {
          const brand = await detectTVBrand(result.ipAddress)
          if (brand) {
            discovered.set(result.ipAddress, {
              ipAddress: result.ipAddress,
              port: result.port,
              brand: brand.brand,
              model: brand.model,
              pairingRequired: this.requiresPairing(brand.brand),
              confidence: brand.confidence
            })

            this.emit('deviceFound', discovered.get(result.ipAddress))
          }
        }
      }
    }

    return Array.from(discovered.values())
  }

  private requiresPairing(brand: string): boolean {
    return ['Samsung', 'LG', 'Sony', 'Vizio', 'Hisense'].includes(brand)
  }
}

// Usage
const discoveryService = new TVDiscoveryService()

discoveryService.on('progress', (data) => {
  console.log(`Stage: ${data.stage}, Progress: ${data.progress}%`)
})

discoveryService.on('deviceFound', (tv) => {
  console.log(`Found: ${tv.brand} at ${tv.ipAddress}`)
})

const tvs = await discoveryService.scan({
  startIP: '192.168.1.1',
  endIP: '192.168.1.254',
  ports: [8001, 8002, 3000, 3001, 80, 7345, 8060, 10002],
  timeout: 3000,
  methods: ['ssdp', 'portscan']
})

console.log('Discovery complete. Found TVs:', tvs)
```

---

## Commercial vs Consumer Differences

### Hardware Differences

| Feature | Consumer TV | Commercial Display |
|---------|-------------|-------------------|
| Network Control | Basic (often disabled) | Full RS-232/RJ45 control |
| Operating Hours | 8-10 hours/day | 16-24 hours/day |
| Warranty | 1-2 years | 3-5 years |
| Brightness | 250-400 nits | 500-700 nits |
| Cooling | Passive | Active (fans) |

### Network Control Differences

1. **RS-232 Serial Control**:
   - **Consumer**: Limited or absent
   - **Commercial**: Full command set via RS-232C

2. **LAN Control**:
   - **Consumer**: May require enabling in settings
   - **Commercial**: Always available, often documented

3. **Daisy Chaining**:
   - **Consumer**: Not supported
   - **Commercial**: IR/RS-232 daisy chain for multi-display control

4. **Lockout Features**:
   - **Consumer**: Basic parental controls
   - **Commercial**: Full UI lockout, remote disable, force-on modes

5. **API Documentation**:
   - **Consumer**: Reverse-engineered, unofficial
   - **Commercial**: Official documentation, SDK available

### Hospitality Mode

Commercial displays in "Hospitality Mode" offer:

- **Channel lockout**: Restrict available channels
- **Volume limits**: Max/min volume enforcement
- **Auto power-on**: Turn on at specific times
- **Source locking**: Prevent input switching
- **Custom branding**: Replace OEM logo/splash screen
- **Remote management**: Centralized control panel

**Note**: Hospitality mode may disable or complicate network control APIs. Check documentation.

---

## Technical Challenges

### 1. Power State Detection

**Problem**: Most TVs cannot report power state when fully powered off.

**Workarounds**:
- **Ping test**: Not reliable (network interface may stay active)
- **Port check**: Some TVs keep ports open in standby
- **Last command tracking**: Assume state based on last command sent
- **Power meter integration**: External hardware monitoring

**Recommendation**: Track state in application, send power-on commands optimistically.

---

### 2. Wake-on-LAN Limitations

**Problem**: Not all TVs support WOL, and it's brand/model specific.

**WOL Support**:
- ✅ Samsung: Some models (2018+)
- ✅ Sony BRAVIA: Supported when "Remote Start" enabled
- ✅ LG: Limited support, requires specific settings
- ❌ Vizio: Not supported
- ❌ Roku: Not supported
- ✅ Sharp: Commercial models support WOL

**WOL Implementation**:
```typescript
import dgram from 'dgram'

function sendWOL(macAddress: string): Promise<void> {
  return new Promise((resolve, reject) => {
    // Parse MAC address
    const mac = macAddress.replace(/[:-]/g, '')
    const macBuffer = Buffer.from(mac, 'hex')

    // Build magic packet: 6 bytes of 0xFF + 16 repetitions of MAC
    const magicPacket = Buffer.alloc(102)

    // First 6 bytes: 0xFF
    for (let i = 0; i < 6; i++) {
      magicPacket[i] = 0xFF
    }

    // Next 96 bytes: MAC address repeated 16 times
    for (let i = 0; i < 16; i++) {
      macBuffer.copy(magicPacket, 6 + (i * 6))
    }

    // Send via UDP broadcast
    const socket = dgram.createSocket('udp4')
    socket.bind(() => {
      socket.setBroadcast(true)
      socket.send(magicPacket, 0, magicPacket.length, 9, '255.255.255.255', (error) => {
        socket.close()
        if (error) reject(error)
        else resolve()
      })
    })
  })
}

// Usage
await sendWOL('AA:BB:CC:DD:EE:FF')
console.log('WOL packet sent')
```

---

### 3. Firewall & Network Security

**Challenge**: Enterprise/commercial networks often block:
- UDP multicast (SSDP)
- Non-standard ports
- Self-signed certificates

**Solutions**:
- **VLAN Segmentation**: Place TVs on dedicated VLAN
- **Firewall Rules**: Whitelist TV control ports
- **mDNS Relay**: For cross-VLAN discovery
- **Certificate Management**: Accept self-signed certs for TV IPs only

---

### 4. IP Address Changes

**Problem**: TVs on DHCP may get new IPs after power cycle.

**Solutions**:
1. **DHCP Reservations**: Bind MAC addresses to IPs
2. **Hostname Resolution**: Use mDNS names (e.g., `samsung-tv-123.local`)
3. **Re-discovery**: Periodically re-scan network
4. **MAC-based Tracking**: Store MAC as primary identifier

---

### 5. Concurrent Control

**Problem**: Some TV APIs don't handle concurrent requests well.

**Solution**: Implement command queue per TV:

```typescript
class TVCommandQueue {
  private queue: (() => Promise<any>)[] = []
  private running = false

  async enqueue<T>(command: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const result = await command()
          resolve(result)
        } catch (error) {
          reject(error)
        }
      })

      this.processQueue()
    })
  }

  private async processQueue(): Promise<void> {
    if (this.running || this.queue.length === 0) return

    this.running = true

    while (this.queue.length > 0) {
      const command = this.queue.shift()!
      try {
        await command()
      } catch (error) {
        console.error('Command failed:', error)
      }

      // Delay between commands
      await new Promise(resolve => setTimeout(resolve, 500))
    }

    this.running = false
  }
}

// Usage
const tvQueue = new TVCommandQueue()

await tvQueue.enqueue(() => tv.powerOn())
await tvQueue.enqueue(() => tv.switchInput(1))
await tvQueue.enqueue(() => tv.setVolume(20))
```

---

### 6. Model-Specific Quirks

**Examples**:
- Samsung 2020+ requires secure WebSocket, older models don't
- LG 2022+ displays 6-digit PIN, older models simple approval
- Sony commercial models use different port than consumer
- Vizio 2023+ changed HTTPS certificate handling

**Solution**: Maintain brand/model compatibility matrix and version detection.

---

## Recommended Implementation Strategy

### Phase 1: Core Discovery (Week 1)

1. **Implement SSDP Discovery**:
   - Generic SSDP scanner
   - Brand-specific search targets
   - Response parsing

2. **Implement Port Scanning**:
   - Multi-port scanner with concurrency
   - Timeout handling
   - Progress reporting

3. **Brand Detection**:
   - HTTP probing for each brand
   - Confidence scoring
   - Fallback methods

### Phase 2: Pairing & Authentication (Week 2)

1. **Samsung WebSocket Client**:
   - WS/WSS connection handling
   - Token storage
   - Command interface

2. **LG WebOS Client**:
   - WebSocket pairing flow
   - Client key persistence
   - SSAP command wrapper

3. **Sony BRAVIA Client**:
   - PSK authentication
   - HTTP JSON-RPC wrapper
   - Error handling

### Phase 3: Additional Brands (Week 3)

1. **Vizio SmartCast Client**
2. **Roku ECP Client**
3. **Sharp Aquos Client** (if needed)
4. **Hisense MQTT Client** (if needed)

### Phase 4: Integration & Testing (Week 4)

1. **Database Schema**:
   - `NetworkTVDevice` table
   - Token/credential storage
   - Matrix output associations

2. **API Endpoints**:
   - `/api/tv-discovery/scan`
   - `/api/tv-discovery/pair`
   - `/api/tv-discovery/assign`

3. **Frontend Wizard**:
   - Multi-step discovery UI
   - Real-time progress
   - Drag-and-drop assignment

4. **Testing**:
   - Unit tests for each client
   - Integration tests with mock TVs
   - Real hardware validation

### Database Schema

```typescript
// Add to /src/db/schema.ts

export const networkTVDevices = sqliteTable('NetworkTVDevice', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  ipAddress: text('ipAddress').notNull(),
  macAddress: text('macAddress'),
  brand: text('brand').notNull(), // Samsung, LG, Sony, etc.
  model: text('model'),
  port: integer('port').notNull(),

  // Authentication
  authToken: text('authToken'), // Encrypted
  clientKey: text('clientKey'), // Encrypted (LG)
  psk: text('psk'), // Encrypted (Sony)

  // Status
  status: text('status').notNull().default('offline'), // online, offline, pairing
  lastSeen: timestamp('lastSeen'),

  // Matrix integration
  matrixOutputId: text('matrixOutputId').references(() => matrixOutputs.id, { onDelete: 'set null' }),

  // Capabilities
  supportsPower: integer('supportsPower', { mode: 'boolean' }).default(true),
  supportsVolume: integer('supportsVolume', { mode: 'boolean' }).default(true),
  supportsInput: integer('supportsInput', { mode: 'boolean' }).default(true),

  createdAt: timestamp('createdAt').notNull().default(timestampNow()),
  updatedAt: timestamp('updatedAt').notNull().default(timestampNow()),
})
```

### Service Architecture

```
/src/lib/tv-network-control/
├── discovery/
│   ├── ssdp-scanner.ts
│   ├── port-scanner.ts
│   └── brand-detector.ts
├── clients/
│   ├── base-client.ts
│   ├── samsung-client.ts
│   ├── lg-webos-client.ts
│   ├── sony-bravia-client.ts
│   ├── vizio-smartcast-client.ts
│   └── roku-client.ts
├── pairing/
│   ├── pairing-service.ts
│   └── credential-store.ts
├── control/
│   ├── tv-control-service.ts
│   └── command-queue.ts
└── types.ts
```

---

## References & Resources

### Official Documentation

- **Samsung Tizen**: https://developer.samsung.com/smarttv/develop/api-references/tizen-web-device-api-references.html
- **LG webOS**: https://webostv.developer.lge.com/
- **Sony BRAVIA**: https://pro-bravia.sony.net/develop/integrate/rest-api/spec/
- **Roku ECP**: https://developer.roku.com/docs/developer-program/debugging/external-control-api.md

### Open Source Libraries

- **Samsung**: https://github.com/Ape/samsungctl
- **LG webOS**: https://github.com/supersaiyanmode/PyWebOSTV
- **Sony BRAVIA**: https://github.com/BrandonDusseau/braviaremotecontrolapi
- **Vizio SmartCast**: https://github.com/exiva/Vizio_SmartCast_API

### Network Discovery

- **SSDP Specification**: https://datatracker.ietf.org/doc/html/draft-cai-ssdp-v1-03
- **UPnP Device Architecture**: http://upnp.org/specs/arch/UPnP-arch-DeviceArchitecture-v1.0.pdf

---

## Conclusion

Network-based TV control provides a robust alternative to IR and CEC for commercial sports bar environments. Key takeaways:

1. **Brand Diversity**: Each manufacturer has unique protocols - no universal standard
2. **Discovery Methods**: Combine SSDP and port scanning for comprehensive coverage
3. **Authentication Required**: Most brands require one-time pairing before control
4. **Commercial Advantages**: Commercial displays often have better-documented APIs
5. **Reliability**: Network control is more reliable than IR (no line-of-sight) and CEC (no cable box firmware issues)

**Recommended Priority**:
1. **Samsung** (most common in sports bars, mature API)
2. **LG** (good webOS API, common in hospitality)
3. **Sony** (reliable BRAVIA API, PSK is simple)
4. **Roku/TCL** (no pairing needed, very common)
5. **Vizio** (growing market share)

This implementation will provide sports bars with comprehensive TV control that works across brands, doesn't require physical IR emitters or CEC cables, and can be managed entirely through the web interface.
