
'use client'

import { useState, useEffect } from 'react'
import { X, Tv, Radio, ChevronUp, ChevronDown, Grid3X3 } from 'lucide-react'

import { logger } from '@/lib/logger'
interface ChannelPreset {
  id: string
  name: string
  channelNumber: string
  deviceType: string
  order: number
}

interface ChannelPresetPopupProps {
  isOpen: boolean
  onClose: () => void
  deviceType: 'cable' | 'directv'
  deviceIp?: string
  inputLabel: string
}

export default function ChannelPresetPopup({
  isOpen,
  onClose,
  deviceType,
  deviceIp,
  inputLabel
}: ChannelPresetPopupProps) {
  const [presets, setPresets] = useState<ChannelPreset[]>([])
  const [loading, setLoading] = useState(true)
  const [tuning, setTuning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [manualChannel, setManualChannel] = useState('')

  useEffect(() => {
    if (isOpen) {
      fetchPresets()
    }
  }, [isOpen, deviceType])

  const fetchPresets = async () => {
    setLoading(true)
    setError(null)
    
    try {
      const response = await fetch(`/api/channel-presets?deviceType=${deviceType}`)
      const data = await response.json()
      
      if (data.success) {
        setPresets(data.presets)
      } else {
        setError(data.error || 'Failed to load presets')
      }
    } catch (err) {
      logger.error('Error fetching presets:', err)
      setError('Failed to load channel presets')
    } finally {
      setLoading(false)
    }
  }

  const tuneToChannel = async (channelNumber: string) => {
    setTuning(true)
    setError(null)
    
    try {
      const response = await fetch('/api/channel-presets/tune', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          channelNumber,
          deviceType,
          deviceIp
        })
      })
      
      const data = await response.json()
      
      if (data.success) {
        // Success - optionally close popup after a delay
        setTimeout(() => {
          onClose()
        }, 1500)
      } else {
        setError(data.error || 'Failed to change channel')
      }
    } catch (err) {
      logger.error('Error tuning channel:', err)
      setError('Failed to change channel')
    } finally {
      setTuning(false)
    }
  }

  const handlePresetClick = (preset: ChannelPreset) => {
    tuneToChannel(preset.channelNumber)
  }

  const handleManualTune = () => {
    if (manualChannel.trim()) {
      tuneToChannel(manualChannel.trim())
      setManualChannel('')
    }
  }

  const handleNumberPad = (digit: string) => {
    setManualChannel(prev => prev + digit)
  }

  const handleClear = () => {
    setManualChannel('')
  }

  const handleEnter = () => {
    handleManualTune()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <div className="flex items-center gap-3">
            {deviceType === 'directv' ? (
              <Radio className="w-6 h-6 text-blue-400" />
            ) : (
              <Tv className="w-6 h-6 text-green-400" />
            )}
            <div>
              <h2 className="text-xl font-bold text-white">Channel Presets</h2>
              <p className="text-sm text-gray-400">
                {inputLabel} ({deviceType === 'directv' ? 'DirecTV' : 'Cable Box'})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            </div>
          ) : error ? (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 text-red-400">
              {error}
            </div>
          ) : (
            <div className="space-y-4">
              {/* Channel Presets Grid */}
              {presets.length > 0 ? (
                <div>
                  <h3 className="text-sm font-semibold text-gray-400 mb-3 flex items-center gap-2">
                    <Grid3X3 className="w-4 h-4" />
                    Quick Access Channels
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {presets.map((preset) => (
                      <button
                        key={preset.id}
                        onClick={() => handlePresetClick(preset)}
                        disabled={tuning}
                        className="bg-gray-800 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg p-3 text-left transition-colors border border-gray-700 hover:border-blue-500"
                      >
                        <div className="text-sm font-medium text-white truncate">
                          {preset.name}
                        </div>
                        <div className="text-xs text-gray-400 mt-1">
                          Ch {preset.channelNumber}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-400">
                  <p>No channel presets configured</p>
                  <p className="text-sm mt-2">Add presets in Sports Guide Config → Presets tab</p>
                </div>
              )}

              {/* Manual Channel Entry */}
              <div>
                <h3 className="text-sm font-semibold text-gray-400 mb-3">
                  Manual Channel Entry
                </h3>
                
                {/* Display */}
                <div className="bg-gray-800 rounded-lg p-4 mb-3 border border-gray-700">
                  <div className="text-2xl font-mono text-white text-center">
                    {manualChannel || '---'}
                  </div>
                </div>

                {/* Number Pad */}
                <div className="grid grid-cols-3 gap-2">
                  {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                    <button
                      key={digit}
                      onClick={() => handleNumberPad(digit)}
                      disabled={tuning}
                      className="bg-gray-800 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg p-4 text-xl font-semibold text-white transition-colors border border-gray-700 hover:border-blue-500"
                    >
                      {digit}
                    </button>
                  ))}
                  <button
                    onClick={handleClear}
                    disabled={tuning}
                    className="bg-gray-800 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg p-4 text-sm font-semibold text-red-400 transition-colors border border-gray-700 hover:border-red-500"
                  >
                    Clear
                  </button>
                  <button
                    onClick={() => handleNumberPad('0')}
                    disabled={tuning}
                    className="bg-gray-800 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg p-4 text-xl font-semibold text-white transition-colors border border-gray-700 hover:border-blue-500"
                  >
                    0
                  </button>
                  <button
                    onClick={handleEnter}
                    disabled={tuning || !manualChannel}
                    className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg p-4 text-sm font-semibold text-white transition-colors"
                  >
                    Enter
                  </button>
                </div>
              </div>

              {/* Tuning Status */}
              {tuning && (
                <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4 text-blue-400 text-center">
                  Tuning channel...
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
