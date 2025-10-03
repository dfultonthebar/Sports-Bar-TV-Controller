
'use client'

import { useState, useEffect } from 'react'
import { X, Tv, Radio } from 'lucide-react'

interface WolfpackInput {
  id: string
  channelNumber: number
  label: string
  inputType: string
  deviceType: string
  currentChannel: string
  isActive: boolean
}

interface WolfpackInputSelectorProps {
  isOpen: boolean
  onClose: () => void
  matrixNumber: number
  onSelectInput: (inputNumber: number, inputLabel: string) => void
}

export default function WolfpackInputSelector({
  isOpen,
  onClose,
  matrixNumber,
  onSelectInput
}: WolfpackInputSelectorProps) {
  const [inputs, setInputs] = useState<WolfpackInput[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen) {
      fetchWolfpackInputs()
    }
  }, [isOpen])

  const fetchWolfpackInputs = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/wolfpack/inputs')
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch inputs')
      }

      setInputs(data.inputs || [])
    } catch (err) {
      console.error('Error fetching Wolfpack inputs:', err)
      setError(err instanceof Error ? err.message : 'Failed to load inputs')
    } finally {
      setLoading(false)
    }
  }

  const handleSelectInput = async (input: WolfpackInput) => {
    try {
      // Route the Wolfpack input to the Matrix output
      const response = await fetch('/api/wolfpack/route-to-matrix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wolfpackInputNumber: input.channelNumber,
          matrixOutputNumber: matrixNumber
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to route input')
      }

      // Notify parent component
      onSelectInput(input.channelNumber, input.label)
      onClose()
    } catch (err) {
      console.error('Error routing input:', err)
      setError(err instanceof Error ? err.message : 'Failed to route input')
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="bg-orange-500 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Radio className="w-6 h-6" />
            <h2 className="text-xl font-bold">
              Select Video Source for Matrix {matrixNumber}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="hover:bg-orange-600 p-2 rounded-lg transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {loading && (
            <div className="text-center py-8">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
              <p className="text-gray-400 mt-4">Loading video sources...</p>
            </div>
          )}

          {error && (
            <div className="bg-red-500/20 border border-red-500 text-red-200 px-4 py-3 rounded-lg mb-4">
              <p className="font-medium">Error</p>
              <p className="text-sm">{error}</p>
            </div>
          )}

          {!loading && !error && inputs.length === 0 && (
            <div className="text-center py-8 text-gray-400">
              <Tv className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No video sources available</p>
            </div>
          )}

          {!loading && !error && inputs.length > 0 && (
            <div className="space-y-2 max-h-[50vh] overflow-y-auto">
              {inputs.map((input) => (
                <button
                  key={input.id}
                  onClick={() => handleSelectInput(input)}
                  className="w-full bg-gray-700 hover:bg-gray-600 text-white p-4 rounded-lg transition-all text-left group"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3">
                        <div className="bg-orange-500 text-white px-3 py-1 rounded text-sm font-bold">
                          {input.channelNumber}
                        </div>
                        <div>
                          <p className="font-bold text-lg">{input.label}</p>
                          <p className="text-sm text-gray-400">
                            {input.deviceType} • {input.currentChannel}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="text-orange-500 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Tv className="w-6 h-6" />
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-gray-900 px-6 py-4 flex justify-between items-center">
          <p className="text-sm text-gray-400">
            Select a video source to route audio to Matrix {matrixNumber}
          </p>
          <button
            onClick={onClose}
            className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
