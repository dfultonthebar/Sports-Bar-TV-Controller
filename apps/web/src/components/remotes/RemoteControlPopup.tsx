
'use client'

import React, { useEffect } from 'react'
import { X } from 'lucide-react'
import FireTVRemote from './FireTVRemote'
import DirecTVRemote from './DirecTVRemote'
import CableBoxRemote from './CableBoxRemote'

interface IRDevice {
  id: string
  name: string
  brand: string
  deviceType: string
  inputChannel: number
  controlMethod: 'IP' | 'GlobalCache'
  deviceIpAddress?: string
  ipControlPort?: number
  iTachAddress?: string
  iTachPort?: number
  codesetId?: string
  isActive: boolean
}

interface DirecTVDevice {
  id: string
  name: string
  ipAddress: string
  port: number
  isOnline: boolean
  receiverType: 'Genie HD DVR' | 'Genie Mini' | 'HR Series DVR' | 'C61K Mini' | 'HS17 Server'
  inputChannel?: number
  lastResponse?: string
  softwareVersion?: string
  serialNumber?: string
}

interface FireTVDevice {
  id: string
  name: string
  ipAddress: string
  port: number
  isOnline: boolean
  deviceType: 'Fire TV Cube' | 'Fire TV Stick' | 'Fire TV' | 'Fire TV Stick 4K Max'
  inputChannel?: number
  lastResponse?: string
  softwareVersion?: string
  serialNumber?: string
  adbEnabled?: boolean
}

interface EverPassDevice {
  id: string
  name: string
  cecDevicePath: string
  inputChannel: number
  deviceModel?: string
  isOnline: boolean
  lastSeen?: string
  addedAt: string
  updatedAt?: string
}

type Device = IRDevice | DirecTVDevice | FireTVDevice | EverPassDevice

interface RemoteControlPopupProps {
  device: Device
  deviceType: 'cable' | 'satellite' | 'streaming'
  onClose: () => void
}

export default function RemoteControlPopup({ device, deviceType, onClose }: RemoteControlPopupProps) {
  // Close on Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [onClose])

  // Prevent body scroll when modal is open
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [])

  const renderRemote = () => {
    switch (deviceType) {
      case 'streaming':
        const fireTVDevice = device as FireTVDevice
        return (
          <FireTVRemote
            deviceId={fireTVDevice.id}
            deviceName={fireTVDevice.name}
            ipAddress={fireTVDevice.ipAddress}
            port={fireTVDevice.port}
            onClose={onClose}
          />
        )
      
      case 'satellite':
        const direcTVDevice = device as DirecTVDevice
        return (
          <DirecTVRemote
            deviceId={direcTVDevice.id}
            deviceName={direcTVDevice.name}
            ipAddress={direcTVDevice.ipAddress}
            port={direcTVDevice.port}
            onClose={onClose}
          />
        )
      
      case 'cable':
        const irDevice = device as IRDevice
        return (
          <CableBoxRemote
            deviceId={irDevice.id}
            deviceName={irDevice.name}
            iTachAddress={irDevice.iTachAddress || ''}
            onClose={onClose}
          />
        )
      
      default:
        return (
          <div className="bg-slate-900 rounded-lg p-6 text-center">
            <p className="text-white">Unsupported device type</p>
            <button
              onClick={onClose}
              className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
            >
              Close
            </button>
          </div>
        )
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm z-0"
        onClick={onClose}
      />

      {/* Modal Container */}
      <div className="relative z-50 max-h-[90vh] overflow-y-auto">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-2 right-2 z-20 p-2 bg-slate-800 hover:bg-slate-700 text-white rounded-full shadow-lg transition-all"
          aria-label="Close remote control"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Remote Control Content */}
        <div className="relative">
          {renderRemote()}
        </div>
      </div>
    </div>
  )
}
