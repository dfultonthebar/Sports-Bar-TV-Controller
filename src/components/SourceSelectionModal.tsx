'use client'

import { useState, useEffect } from 'react'
import { X, Tv, Loader2, Check } from 'lucide-react'

interface MatrixInput {
  id: string
  channelNumber: number
  label: string
  inputType: string
  isActive: boolean
}

interface SourceSelectionModalProps {
  isOpen: boolean
  onClose: () => void
  tvNumber: number
  outputNumber: number
  currentSourceName?: string
  inputs: MatrixInput[]
  onSelectSource: (inputNumber: number) => Promise<void>
}

export default function SourceSelectionModal({
  isOpen,
  onClose,
  tvNumber,
  outputNumber,
  currentSourceName,
  inputs,
  onSelectSource
}: SourceSelectionModalProps) {
  const [isRouting, setIsRouting] = useState(false)
  const [selectedInput, setSelectedInput] = useState<number | null>(null)
  const [routingStatus, setRoutingStatus] = useState<string>('')

  useEffect(() => {
    // Reset state when modal opens
    if (isOpen) {
      setIsRouting(false)
      setSelectedInput(null)
      setRoutingStatus('')
    }
  }, [isOpen])

  if (!isOpen) return null

  const handleSelectSource = async (inputNumber: number) => {
    setIsRouting(true)
    setSelectedInput(inputNumber)
    setRoutingStatus('Routing...')
    
    try {
      await onSelectSource(inputNumber)
      setRoutingStatus('✓ Success!')
      
      // Close modal after a short delay
      setTimeout(() => {
        onClose()
      }, 1000)
    } catch (error) {
      console.error('Failed to route:', error)
      setRoutingStatus('✗ Failed')
      setTimeout(() => {
        setIsRouting(false)
        setRoutingStatus('')
      }, 2000)
    }
  }

  const getInputIcon = (inputType: string) => {
    switch (inputType.toLowerCase()) {
      case 'cable': return '📺'
      case 'satellite': return '🛰️'
      case 'streaming': return '📱'
      case 'gaming': return '🎮'
      default: return '📺'
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-slate-900 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden border border-slate-700">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-900/50 to-purple-900/50 p-4 border-b border-slate-700">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-white flex items-center">
                <Tv className="w-6 h-6 mr-2" />
                TV {tvNumber.toString().padStart(2, '0')} - Select Source
              </h2>
              <p className="text-sm text-slate-300 mt-1">
                Output {outputNumber} • {currentSourceName ? `Currently: ${currentSourceName}` : 'No source'}
              </p>
            </div>
            <button
              onClick={onClose}
              disabled={isRouting}
              className="text-slate-400 hover:text-white transition-colors disabled:opacity-50"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Status Message */}
        {routingStatus && (
          <div className={`p-3 text-center font-medium ${
            routingStatus.includes('Success') ? 'bg-green-500/20 text-green-300' :
            routingStatus.includes('Failed') ? 'bg-red-500/20 text-red-300' :
            'bg-blue-500/20 text-blue-300'
          }`}>
            {routingStatus}
          </div>
        )}

        {/* Source List */}
        <div className="p-4 overflow-y-auto max-h-[calc(80vh-200px)]">
          {inputs.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <Tv className="w-16 h-16 mx-auto mb-4 opacity-30" />
              <p className="text-lg font-medium">No input sources available</p>
              <p className="text-sm mt-2">Contact management to configure inputs</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {inputs.map((input) => {
                const isCurrentSource = currentSourceName?.includes(input.label)
                const isSelected = selectedInput === input.channelNumber
                
                return (
                  <button
                    key={input.id}
                    onClick={() => handleSelectSource(input.channelNumber)}
                    disabled={isRouting || isCurrentSource}
                    className={`
                      relative p-4 rounded-lg border-2 transition-all text-left
                      ${isCurrentSource 
                        ? 'bg-green-500/20 border-green-500 cursor-default' 
                        : isSelected
                          ? 'bg-blue-500/30 border-blue-400'
                          : 'bg-slate-800/50 border-slate-700 hover:bg-slate-800 hover:border-slate-600'
                      }
                      ${isRouting && !isSelected ? 'opacity-50 cursor-not-allowed' : ''}
                      ${!isRouting && !isCurrentSource ? 'hover:scale-102 hover:shadow-lg' : ''}
                    `}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3 flex-1 min-w-0">
                        <span className="text-3xl">{getInputIcon(input.inputType)}</span>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-white truncate">{input.label}</div>
                          <div className="text-sm text-slate-400">
                            Channel {input.channelNumber} • {input.inputType}
                          </div>
                        </div>
                      </div>
                      
                      {/* Status Indicator */}
                      <div className="ml-2">
                        {isCurrentSource ? (
                          <div className="flex items-center space-x-1 text-green-400">
                            <Check className="w-5 h-5" />
                            <span className="text-xs font-medium">Active</span>
                          </div>
                        ) : isSelected && isRouting ? (
                          <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
                        ) : null}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-slate-800/50 p-4 border-t border-slate-700 flex justify-end">
          <button
            onClick={onClose}
            disabled={isRouting}
            className="px-6 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
