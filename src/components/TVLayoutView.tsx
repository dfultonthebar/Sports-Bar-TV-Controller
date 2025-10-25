'use client'

import { useState, useEffect } from 'react'
import { Monitor, RefreshCw, Wifi, WifiOff, Loader2 } from 'lucide-react'
import TVButton from './TVButton'
import SourceSelectionModal from './SourceSelectionModal'

interface MatrixInput {
  id: string
  channelNumber: number
  label: string
  inputType: string
  isActive: boolean
}

interface MatrixOutput {
  id: string
  channelNumber: number
  label: string
  isActive: boolean
}

interface MatrixRoute {
  inputNum: number
  outputNum: number
  isActive: boolean
}

interface TVDefinition {
  tvNumber: number
  outputNumber: number
  area: string
  gridColumn: string
  gridRow: string
  label?: string
}

// Define all 25 TVs with their physical locations and areas
const TV_LAYOUT: TVDefinition[] = [
  // EAST area (top right)
  { tvNumber: 1, outputNumber: 1, area: 'EAST', gridColumn: '10 / 11', gridRow: '1 / 2' },
  { tvNumber: 2, outputNumber: 2, area: 'EAST', gridColumn: '11 / 12', gridRow: '1 / 2' },
  { tvNumber: 13, outputNumber: 13, area: 'EAST', gridColumn: '8 / 9', gridRow: '3 / 4' },
  { tvNumber: 14, outputNumber: 14, area: 'EAST', gridColumn: '9 / 10', gridRow: '2 / 3' },
  { tvNumber: 15, outputNumber: 15, area: 'EAST', gridColumn: '8 / 9', gridRow: '4 / 5' },
  
  // BAR area (center)
  { tvNumber: 11, outputNumber: 11, area: 'BAR', gridColumn: '7 / 8', gridRow: '3 / 4' },
  { tvNumber: 16, outputNumber: 16, area: 'BAR', gridColumn: '6 / 7', gridRow: '6 / 7' },
  { tvNumber: 12, outputNumber: 12, area: 'BAR', gridColumn: '6 / 7', gridRow: '7 / 8' },
  { tvNumber: 18, outputNumber: 18, area: 'BAR', gridColumn: '7 / 8', gridRow: '4 / 5' },
  { tvNumber: 19, outputNumber: 19, area: 'BAR', gridColumn: '9 / 10', gridRow: '3 / 4' },
  
  // DINING area (right side)
  { tvNumber: 3, outputNumber: 3, area: 'DINING', gridColumn: '11 / 12', gridRow: '8 / 9' },
  { tvNumber: 4, outputNumber: 4, area: 'DINING', gridColumn: '10 / 11', gridRow: '9 / 10' },
  { tvNumber: 5, outputNumber: 5, area: 'DINING', gridColumn: '10 / 11', gridRow: '5 / 6' },
  { tvNumber: 6, outputNumber: 6, area: 'DINING', gridColumn: '10 / 11', gridRow: '4 / 5' },
  { tvNumber: 7, outputNumber: 7, area: 'DINING', gridColumn: '10 / 11', gridRow: '3 / 4' },
  { tvNumber: 8, outputNumber: 8, area: 'DINING', gridColumn: '9 / 10', gridRow: '4 / 5' },
  { tvNumber: 9, outputNumber: 9, area: 'DINING', gridColumn: '10 / 11', gridRow: '6 / 7' },
  { tvNumber: 10, outputNumber: 10, area: 'DINING', gridColumn: '10 / 11', gridRow: '7 / 8' },
  
  // PARTY EAST (left side)
  { tvNumber: 20, outputNumber: 20, area: 'PARTY EAST', gridColumn: '1 / 2', gridRow: '2 / 3' },
  { tvNumber: 21, outputNumber: 21, area: 'PARTY EAST', gridColumn: '3 / 4', gridRow: '6 / 7' },
  { tvNumber: 22, outputNumber: 22, area: 'PARTY EAST', gridColumn: '4 / 5', gridRow: '6 / 7' },
  
  // PARTY WEST (bottom left)
  { tvNumber: 24, outputNumber: 24, area: 'PARTY WEST', gridColumn: '4 / 5', gridRow: '9 / 10' },
  { tvNumber: 25, outputNumber: 25, area: 'PARTY WEST', gridColumn: '5 / 6', gridRow: '10 / 11' },
  
  // PATIO (bottom left corner)
  { tvNumber: 23, outputNumber: 23, area: 'PATIO', gridColumn: '1 / 2', gridRow: '9 / 10' },
]

export default function TVLayoutView() {
  const [inputs, setInputs] = useState<MatrixInput[]>([])
  const [outputs, setOutputs] = useState<MatrixOutput[]>([])
  const [routes, setRoutes] = useState<MatrixRoute[]>([])
  const [loading, setLoading] = useState(true)
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected'>('disconnected')
  
  // Modal state
  const [selectedTV, setSelectedTV] = useState<TVDefinition | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [routingInProgress, setRoutingInProgress] = useState<number | null>(null)

  useEffect(() => {
    loadMatrixData()
    checkConnectionStatus()
    
    // Refresh data every 10 seconds
    const interval = setInterval(() => {
      loadMatrixData()
      checkConnectionStatus()
    }, 10000)
    
    return () => clearInterval(interval)
  }, [])

  const loadMatrixData = async () => {
    try {
      const response = await fetch('/api/matrix/config')
      if (response.ok) {
        const data = await response.json()
        
        if (data.configs?.length > 0) {
          const config = data.configs[0]
          setInputs(config.inputs?.filter((i: MatrixInput) => i.isActive) || [])
          setOutputs(config.outputs?.filter((o: MatrixOutput) => o.isActive) || [])
        } else if (data.config) {
          setInputs(data.inputs?.filter((i: MatrixInput) => i.isActive) || [])
          setOutputs(data.outputs?.filter((o: MatrixOutput) => o.isActive) || [])
        }
      }
      
      // Load current routes
      const routesResponse = await fetch('/api/matrix/routes')
      if (routesResponse.ok) {
        const routesData = await routesResponse.json()
        setRoutes(routesData.routes || [])
      }
    } catch (error) {
      console.error('Error loading matrix data:', error)
    } finally {
      setLoading(false)
    }
  }

  const checkConnectionStatus = async () => {
    try {
      const response = await fetch('/api/matrix/connection-manager')
      const result = await response.json()
      setConnectionStatus(result.success && result.connected ? 'connected' : 'disconnected')
    } catch (error) {
      setConnectionStatus('disconnected')
    }
  }

  const handleTVClick = (tv: TVDefinition) => {
    setSelectedTV(tv)
    setIsModalOpen(true)
  }

  const handleSelectSource = async (inputNumber: number) => {
    if (!selectedTV) return
    
    setRoutingInProgress(selectedTV.outputNumber)
    
    try {
      const response = await fetch('/api/matrix/route', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input: inputNumber,
          output: selectedTV.outputNumber
        })
      })
      
      if (response.ok) {
        // Refresh data to show new routing
        await loadMatrixData()
      } else {
        throw new Error('Failed to route')
      }
    } finally {
      setRoutingInProgress(null)
    }
  }

  const getSourceForOutput = (outputNumber: number): { sourceName: string; inputNumber: number } | null => {
    const route = routes.find(r => r.outputNum === outputNumber && r.isActive)
    if (!route) return null
    
    const input = inputs.find(i => i.channelNumber === route.inputNum)
    return input ? { sourceName: input.label, inputNumber: input.channelNumber } : null
  }

  const handleRefresh = async () => {
    setLoading(true)
    await loadMatrixData()
    await checkConnectionStatus()
    setLoading(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-blue-500 animate-spin mx-auto mb-4" />
          <p className="text-white text-lg">Loading TV Layout...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full h-full">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center">
            <Monitor className="w-6 h-6 mr-2" />
            Sports Bar TV Layout
          </h2>
          <p className="text-slate-400 text-sm mt-1">
            Click any TV to change its source
          </p>
        </div>
        
        <div className="flex items-center space-x-3">
          {/* Connection Status */}
          <div className={`px-3 py-1.5 rounded-lg text-sm font-medium flex items-center space-x-2 ${
            connectionStatus === 'connected' 
              ? 'bg-green-900/80 text-green-200 border border-green-700'
              : 'bg-red-900/80 text-red-200 border border-red-700'
          }`}>
            {connectionStatus === 'connected' ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
            <span>Matrix {connectionStatus}</span>
          </div>
          
          {/* Refresh Button */}
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="px-4 py-1.5 bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 border border-blue-500/30 rounded-lg text-sm font-medium transition-all flex items-center space-x-2 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Grid Layout */}
      <div className="relative w-full bg-slate-900/50 rounded-2xl p-6 border border-slate-700/50 backdrop-blur-sm">
        {/* Area Labels */}
        <div className="grid grid-cols-12 grid-rows-11 gap-3 min-h-[700px]">
          {/* EAST Label */}
          <div className="col-span-4 row-span-1 flex items-center justify-center text-white font-bold text-lg bg-blue-900/30 rounded-lg border border-blue-700/30" style={{gridColumn: '8 / 12', gridRow: '1 / 1'}}>
            EAST
          </div>
          
          {/* BAR Label */}
          <div className="col-span-2 row-span-1 flex items-center justify-center text-white font-bold text-lg bg-green-900/30 rounded-lg border border-green-700/30" style={{gridColumn: '6 / 8', gridRow: '2 / 2'}}>
            BAR
          </div>
          
          {/* DINING Label */}
          <div className="col-span-2 row-span-1 flex items-center justify-center text-white font-bold text-lg bg-purple-900/30 rounded-lg border border-purple-700/30" style={{gridColumn: '10 / 12', gridRow: '2 / 2'}}>
            DINING
          </div>
          
          {/* PARTY EAST Label */}
          <div className="col-span-3 row-span-1 flex items-center justify-center text-white font-bold text-lg bg-red-900/30 rounded-lg border border-red-700/30" style={{gridColumn: '1 / 4', gridRow: '1 / 1'}}>
            PARTY EAST
          </div>
          
          {/* PARTY WEST Label */}
          <div className="col-span-2 row-span-1 flex items-center justify-center text-white font-bold text-lg bg-yellow-900/30 rounded-lg border border-yellow-700/30" style={{gridColumn: '4 / 6', gridRow: '8 / 8'}}>
            PARTY WEST
          </div>
          
          {/* PATIO Label */}
          <div className="col-span-2 row-span-1 flex items-center justify-center text-white font-bold text-lg bg-orange-900/30 rounded-lg border border-orange-700/30" style={{gridColumn: '1 / 3', gridRow: '8 / 8'}}>
            PATIO
          </div>
          
          {/* WEST Label */}
          <div className="col-span-2 row-span-1 flex items-center justify-center text-white font-bold text-lg bg-pink-900/30 rounded-lg border border-pink-700/30" style={{gridColumn: '5 / 7', gridRow: '9 / 9'}}>
            WEST
          </div>
          
          {/* Render all TVs */}
          {TV_LAYOUT.map((tv) => {
            const source = getSourceForOutput(tv.outputNumber)
            const output = outputs.find(o => o.channelNumber === tv.outputNumber)
            const isRouting = routingInProgress === tv.outputNumber
            
            return (
              <div
                key={tv.tvNumber}
                style={{
                  gridColumn: tv.gridColumn,
                  gridRow: tv.gridRow
                }}
              >
                <TVButton
                  tvNumber={tv.tvNumber}
                  outputNumber={tv.outputNumber}
                  label={output?.label || tv.label}
                  currentSource={source?.inputNumber.toString()}
                  sourceName={source?.sourceName}
                  area={tv.area}
                  isRouting={isRouting}
                  onClick={() => handleTVClick(tv)}
                />
              </div>
            )
          })}
        </div>
      </div>

      {/* Source Selection Modal */}
      {selectedTV && (
        <SourceSelectionModal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false)
            setSelectedTV(null)
          }}
          tvNumber={selectedTV.tvNumber}
          outputNumber={selectedTV.outputNumber}
          currentSourceName={getSourceForOutput(selectedTV.outputNumber)?.sourceName}
          inputs={inputs}
          onSelectSource={handleSelectSource}
        />
      )}
    </div>
  )
}
