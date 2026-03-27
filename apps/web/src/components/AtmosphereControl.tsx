'use client'

import { useState } from 'react'
import {
  ChevronUp,
  ChevronDown,
  Home,
  CheckCircle,
  AlertCircle
} from 'lucide-react'

const ATMOSPHERE_DEVICE = {
  deviceId: 'atmosphere_holmgren1',
  ipAddress: '10.11.3.48',
  port: 5555
}

const ATMOSPHERE_BUTTONS = [
  { label: 'Channel Up', command: 'CHANNEL_UP', icon: ChevronUp, color: 'bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800' },
  { label: 'Channel Down', command: 'CHANNEL_DOWN', icon: ChevronDown, color: 'bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800' },
  { label: 'Home', command: 'HOME', icon: Home, color: 'bg-slate-600 hover:bg-slate-500 active:bg-slate-700' },
  { label: 'Select', command: 'SELECT', icon: CheckCircle, color: 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800' },
]

export default function AtmosphereControl() {
  const [status, setStatus] = useState<{ type: 'success' | 'error' | null; message: string }>({ type: null, message: '' })
  const [lastCommand, setLastCommand] = useState<string>('')

  const sendCommand = async (command: string, displayName: string) => {
    setLastCommand(displayName)

    fetch('/api/firetv-devices/send-command', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deviceId: ATMOSPHERE_DEVICE.deviceId,
        command,
        ipAddress: ATMOSPHERE_DEVICE.ipAddress,
        port: ATMOSPHERE_DEVICE.port
      })
    })
      .then(response => response.json())
      .then(data => {
        if (data.success) {
          setStatus({ type: 'success', message: `${displayName} sent` })
        } else {
          setStatus({ type: 'error', message: data.message || 'Command failed' })
        }
        setTimeout(() => setStatus({ type: null, message: '' }), 1500)
      })
      .catch(() => {
        setStatus({ type: 'error', message: 'Failed to send command' })
        setTimeout(() => setStatus({ type: null, message: '' }), 1500)
      })
  }

  return (
    <div className="bg-slate-900/90 backdrop-blur rounded-lg p-4 border border-slate-700/50 w-full max-w-sm">
      {/* Header */}
      <div className="text-center mb-4">
        <h3 className="text-lg font-bold text-white">Atmosphere TV</h3>
        <p className="text-xs text-slate-400">Channel Control</p>
      </div>

      {/* 2x2 Button Grid */}
      <div className="grid grid-cols-2 gap-3">
        {ATMOSPHERE_BUTTONS.map((btn) => {
          const Icon = btn.icon
          return (
            <button
              key={btn.command}
              onClick={() => sendCommand(btn.command, btn.label)}
              className={`${btn.color} text-white rounded-lg p-4 min-h-[64px] flex flex-col items-center justify-center gap-1.5 transition-colors font-medium text-sm`}
            >
              <Icon className="w-6 h-6" />
              {btn.label}
            </button>
          )
        })}
      </div>

      {/* Status */}
      {status.type && (
        <div className={`mt-3 flex items-center justify-center gap-1.5 text-xs font-medium ${
          status.type === 'success' ? 'text-green-400' : 'text-red-400'
        }`}>
          {status.type === 'success'
            ? <CheckCircle className="w-3.5 h-3.5" />
            : <AlertCircle className="w-3.5 h-3.5" />
          }
          {status.message}
        </div>
      )}
    </div>
  )
}
