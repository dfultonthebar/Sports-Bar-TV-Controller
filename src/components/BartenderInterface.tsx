
'use client'

import { useState, useEffect } from 'react'
import { toast } from 'react-hot-toast'

interface MatrixConfig {
  id: string
  name: string
  ipAddress: string
  protocol: string
  tcpPort?: number
  udpPort?: number
}

interface MatrixInput {
  id: string
  channelNumber: number
  label: string
  isActive: boolean
}

interface MatrixOutput {
  id: string
  channelNumber: number
  label: string
  isActive: boolean
}

export default function BartenderInterface() {
  const [matrixConfig, setMatrixConfig] = useState<MatrixConfig | null>(null)
  const [inputs, setInputs] = useState<MatrixInput[]>([])
  const [outputs, setOutputs] = useState<MatrixOutput[]>([])
  const [selectedInput, setSelectedInput] = useState<number | null>(null)
  const [selectedOutput, setSelectedOutput] = useState<number | null>(null)
  const [switching, setSwitching] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadConfiguration()
  }, [])

  const loadConfiguration = async () => {
    try {
      const response = await fetch('/api/matrix/config')
      if (response.ok) {
        const data = await response.json()
        const activeConfig = data.configs?.find((c: MatrixConfig) => c.isActive)
        
        if (activeConfig) {
          setMatrixConfig(activeConfig)
          
          // Load inputs and outputs
          const inputsResponse = await fetch(`/api/matrix/config?configId=${activeConfig.id}&type=inputs`)
          const outputsResponse = await fetch(`/api/matrix/config?configId=${activeConfig.id}&type=outputs`)
          
          if (inputsResponse.ok && outputsResponse.ok) {
            const inputsData = await inputsResponse.json()
            const outputsData = await outputsResponse.json()
            
            setInputs(inputsData.inputs?.filter((i: MatrixInput) => i.isActive) || [])
            setOutputs(outputsData.outputs?.filter((o: MatrixOutput) => o.isActive) || [])
          }
        }
      }
    } catch (error) {
      console.error('Error loading configuration:', error)
      toast.error('Failed to load matrix configuration')
    } finally {
      setLoading(false)
    }
  }

  const switchInput = async () => {
    if (!selectedInput || !selectedOutput || !matrixConfig) {
      toast.error('Please select both input and output')
      return
    }

    setSwitching(true)
    try {
      const port = matrixConfig.protocol === 'UDP' ? (matrixConfig.udpPort || 4000) : (matrixConfig.tcpPort || 23)
      
      const response = await fetch('/api/matrix/switch-input', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ipAddress: matrixConfig.ipAddress,
          port,
          protocol: matrixConfig.protocol,
          inputChannel: selectedInput,
          outputChannel: selectedOutput
        })
      })

      const data = await response.json()
      
      if (data.success) {
        toast.success(`Switched Input ${selectedInput} to Output ${selectedOutput}`)
      } else {
        toast.error(data.error || 'Failed to switch input')
      }
    } catch (error) {
      console.error('Error switching input:', error)
      toast.error('Failed to switch input')
    } finally {
      setSwitching(false)
    }
  }

  const quickSwitch = async (inputNum: number, outputNum: number) => {
    if (!matrixConfig) return

    setSwitching(true)
    try {
      const port = matrixConfig.protocol === 'UDP' ? (matrixConfig.udpPort || 4000) : (matrixConfig.tcpPort || 23)
      
      const response = await fetch('/api/matrix/switch-input', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ipAddress: matrixConfig.ipAddress,
          port,
          protocol: matrixConfig.protocol,
          inputChannel: inputNum,
          outputChannel: outputNum
        })
      })

      const data = await response.json()
      
      if (data.success) {
        const input = inputs.find(i => i.channelNumber === inputNum)
        const output = outputs.find(o => o.channelNumber === outputNum)
        toast.success(`${input?.label || `Input ${inputNum}`} → ${output?.label || `Output ${outputNum}`}`)
      } else {
        toast.error(data.error || 'Failed to switch')
      }
    } catch (error) {
      console.error('Error in quick switch:', error)
      toast.error('Failed to switch')
    } finally {
      setSwitching(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-slate-400">Loading matrix configuration...</div>
      </div>
    )
  }

  if (!matrixConfig) {
    return (
      <div className="bg-slate-900 rounded-lg shadow-xl p-6 border border-slate-700">
        <div className="text-center text-slate-400">
          <p className="mb-4">No active matrix configuration found</p>
          <a href="/matrix-control" className="text-indigo-400 hover:text-indigo-300">
            Configure Matrix →
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="bg-slate-900 rounded-lg shadow-xl p-6 border border-slate-700">
        <h2 className="text-2xl font-bold mb-6 text-slate-100">Quick Switch</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div>
            <label className="block text-sm font-medium mb-2 text-slate-200">Select Input</label>
            <select
              value={selectedInput || ''}
              onChange={(e) => setSelectedInput(parseInt(e.target.value))}
              className="w-full px-3 py-2 border border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-800 text-slate-100"
            >
              <option value="">Choose input...</option>
              {inputs.map(input => (
                <option key={input.id} value={input.channelNumber}>
                  {input.channelNumber}: {input.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2 text-slate-200">Select Output</label>
            <select
              value={selectedOutput || ''}
              onChange={(e) => setSelectedOutput(parseInt(e.target.value))}
              className="w-full px-3 py-2 border border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-800 text-slate-100"
            >
              <option value="">Choose output...</option>
              {outputs.map(output => (
                <option key={output.id} value={output.channelNumber}>
                  {output.channelNumber}: {output.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <button
          onClick={switchInput}
          disabled={switching || !selectedInput || !selectedOutput}
          className="w-full px-4 py-3 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:bg-slate-600 disabled:cursor-not-allowed transition-colors font-medium"
        >
          {switching ? 'Switching...' : 'Switch Now'}
        </button>
      </div>

      <div className="bg-slate-900 rounded-lg shadow-xl p-6 border border-slate-700">
        <h3 className="text-xl font-semibold mb-4 text-slate-100">Quick Access Buttons</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {inputs.slice(0, 8).map(input => (
            <button
              key={input.id}
              onClick={() => outputs[0] && quickSwitch(input.channelNumber, outputs[0].channelNumber)}
              disabled={switching || outputs.length === 0}
              className="px-4 py-3 bg-slate-800 text-slate-100 rounded-md hover:bg-slate-700 disabled:bg-slate-700 disabled:cursor-not-allowed transition-colors border border-slate-600"
            >
              <div className="text-sm font-medium">{input.label}</div>
              <div className="text-xs text-slate-400">Input {input.channelNumber}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
