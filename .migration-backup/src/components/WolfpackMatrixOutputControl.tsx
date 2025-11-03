'use client'

import { useState, useEffect } from 'react'
import { Monitor, Loader2, CheckCircle2, AlertCircle } from 'lucide-react'

import { logger } from '@/lib/logger'
interface MatrixInput {
  id: string
  channelNumber: number
  label: string
  inputType: string
  isActive: boolean
}

interface MatrixRouting {
  matrixOutputNumber: number
  wolfpackInputNumber: number
  wolfpackInputLabel: string
}

interface WolfpackMatrixOutputControlProps {
  processorIp?: string
}

export default function WolfpackMatrixOutputControl({ processorIp }: WolfpackMatrixOutputControlProps) {
  const [inputs, setInputs] = useState<MatrixInput[]>([])
  const [routings, setRoutings] = useState<MatrixRouting[]>([])
  const [selectedOutput, setSelectedOutput] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [routing, setRouting] = useState(false)
  const [statusMessage, setStatusMessage] = useState<string>('')
  const [statusType, setStatusType] = useState<'success' | 'error' | ''>('')

  useEffect(() => {
    loadMatrixData()
    loadCurrentRoutings()
  }, [])

  const loadMatrixData = async () => {
    try {
      const response = await fetch('/api/matrix/config')
      if (response.ok) {
        const data = await response.json()
        if (data.configs?.length > 0) {
          const activeConfig = data.configs[0]
          const matrixInputs = activeConfig.inputs?.filter((input: MatrixInput) => 
            input.isActive
          ) || []
          setInputs(matrixInputs)
        }
      }
    } catch (error) {
      logger.error('Error loading matrix data:', error)
    }
  }

  const loadCurrentRoutings = async () => {
    try {
      const response = await fetch('/api/wolfpack/current-routings')
      if (response.ok) {
        const data = await response.json()
        setRoutings(data.routings || [])
      }
    } catch (error) {
      logger.error('Error loading current routings:', error)
    }
  }

  const handleOutputClick = (outputNumber: number) => {
    if (selectedOutput === outputNumber) {
      setSelectedOutput(null)
    } else {
      setSelectedOutput(outputNumber)
      setStatusMessage('')
      setStatusType('')
    }
  }

  const handleInputSelection = async (inputNumber: number, inputLabel: string) => {
    if (!selectedOutput) return

    setRouting(true)
    setStatusMessage('')
    setStatusType('')

    try {
      const response = await fetch('/api/wolfpack/route-to-matrix', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          wolfpackInputNumber: inputNumber,
          matrixOutputNumber: selectedOutput,
        }),
      })

      const data = await response.json()

      if (response.ok) {
        setStatusMessage(`Routed ${inputLabel} to Matrix ${selectedOutput}`)
        setStatusType('success')
        
        // Update local routing state
        setRoutings(prev => {
          const newRoutings = prev.filter(r => r.matrixOutputNumber !== selectedOutput)
          return [...newRoutings, {
            matrixOutputNumber: selectedOutput,
            wolfpackInputNumber: inputNumber,
            wolfpackInputLabel: inputLabel
          }]
        })

        // Close the input selection after successful routing
        setTimeout(() => {
          setSelectedOutput(null)
          setStatusMessage('')
          setStatusType('')
        }, 2000)
      } else {
        setStatusMessage(data.error || 'Failed to route input')
        setStatusType('error')
      }
    } catch (error) {
      logger.error('Error routing input:', error)
      setStatusMessage('Network error occurred')
      setStatusType('error')
    } finally {
      setRouting(false)
    }
  }

  const getCurrentRouting = (outputNumber: number): MatrixRouting | undefined => {
    return routings.find(r => r.matrixOutputNumber === outputNumber)
  }

  return (
    <div className="bg-slate-800/50 backdrop-blur-sm rounded-lg p-4">
      <h3 className="text-lg font-bold text-white mb-4 flex items-center">
        <Monitor className="mr-2 w-5 h-5 text-blue-400" />
        Matrix Outputs
      </h3>

      {/* Status Message */}
      {statusMessage && (
        <div className={`mb-4 p-3 rounded-lg flex items-center space-x-2 ${
          statusType === 'success' 
            ? 'bg-green-500/20 text-green-300 border border-green-500/30' 
            : 'bg-red-500/20 text-red-300 border border-red-500/30'
        }`}>
          {statusType === 'success' ? (
            <CheckCircle2 className="w-4 h-4" />
          ) : (
            <AlertCircle className="w-4 h-4" />
          )}
          <span className="text-sm">{statusMessage}</span>
        </div>
      )}

      {/* Matrix Outputs */}
      <div className="space-y-3">
        {[1, 2, 3, 4].map((outputNumber) => {
          const currentRouting = getCurrentRouting(outputNumber)
          const isSelected = selectedOutput === outputNumber

          return (
            <div key={outputNumber} className="space-y-2">
              {/* Output Button */}
              <button
                onClick={() => handleOutputClick(outputNumber)}
                disabled={routing}
                className={`w-full p-3 rounded-lg transition-all ${
                  isSelected
                    ? 'bg-blue-500/30 border-2 border-blue-400'
                    : 'bg-slate-700/50 border-2 border-slate-600 hover:border-slate-500'
                } ${routing ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="bg-slate-900/50 px-3 py-1 rounded font-bold text-white">
                      {outputNumber}
                    </div>
                    <div className="text-left">
                      <div className="font-medium text-white">Matrix {outputNumber}</div>
                      {currentRouting ? (
                        <div className="text-xs text-blue-300">
                          → {currentRouting.wolfpackInputLabel}
                        </div>
                      ) : (
                        <div className="text-xs text-slate-500">
                          No input routed
                        </div>
                      )}
                    </div>
                  </div>
                  {routing && isSelected && (
                    <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
                  )}
                </div>
              </button>

              {/* Input Selection Panel */}
              {isSelected && (
                <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-700">
                  <div className="text-xs font-medium text-slate-400 mb-2">
                    Select Input for Matrix {outputNumber}:
                  </div>
                  <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto">
                    {inputs.map((input) => (
                      <button
                        key={input.id}
                        onClick={() => handleInputSelection(input.channelNumber, input.label)}
                        disabled={routing}
                        className={`p-2 rounded text-left transition-all ${
                          currentRouting?.wolfpackInputNumber === input.channelNumber
                            ? 'bg-blue-500/30 border border-blue-400 text-blue-200'
                            : 'bg-slate-800 hover:bg-slate-700 border border-slate-600 text-white'
                        } ${routing ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        <div className="font-medium text-sm">{input.label}</div>
                        <div className="text-xs opacity-75">Input {input.channelNumber}</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {inputs.length === 0 && (
        <div className="text-center text-slate-500 py-8">
          <Monitor className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No matrix inputs configured</p>
        </div>
      )}
    </div>
  )
}
