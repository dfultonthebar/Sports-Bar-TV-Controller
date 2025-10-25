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

// Define all 25 TVs with their physical locations and areas - mapped to Graystone Layout drawing
const TV_LAYOUT: TVDefinition[] = [
  // EAST area (top right corner) - TV 01, TV 02
  { tvNumber: 1, outputNumber: 1, area: 'EAST', gridColumn: '10 / 11', gridRow: '1 / 2', label: 'TV 01' },
  { tvNumber: 2, outputNumber: 2, area: 'EAST', gridColumn: '11 / 12', gridRow: '1 / 2', label: 'TV 02' },
  
  // PARTY EAST (left side) - TV 20, TV 13, TV 15, TV 21, TV 22
  { tvNumber: 20, outputNumber: 20, area: 'PARTY EAST', gridColumn: '1 / 2', gridRow: '2 / 3', label: 'TV 20' },
  { tvNumber: 13, outputNumber: 13, area: 'PARTY EAST', gridColumn: '2 / 3', gridRow: '3 / 4', label: 'TV 13' },
  { tvNumber: 15, outputNumber: 15, area: 'PARTY EAST', gridColumn: '2 / 3', gridRow: '4 / 5', label: 'TV 15' },
  { tvNumber: 21, outputNumber: 21, area: 'PARTY EAST', gridColumn: '2 / 3', gridRow: '6 / 7', label: 'TV 21' },
  { tvNumber: 22, outputNumber: 22, area: 'PARTY EAST', gridColumn: '3 / 4', gridRow: '6 / 7', label: 'TV 22' },
  
  // BAR area (center) - TV 14, TV 19, TV 11, TV 16, TV 18, TV 12
  { tvNumber: 14, outputNumber: 14, area: 'BAR', gridColumn: '5 / 6', gridRow: '3 / 4', label: 'TV 14' },
  { tvNumber: 19, outputNumber: 19, area: 'BAR', gridColumn: '7 / 8', gridRow: '3 / 4', label: 'TV 19' },
  { tvNumber: 11, outputNumber: 11, area: 'BAR', gridColumn: '7 / 8', gridRow: '4 / 5', label: 'TV 11' },
  { tvNumber: 16, outputNumber: 16, area: 'BAR', gridColumn: '5 / 6', gridRow: '4 / 5', label: 'TV 16' },
  { tvNumber: 18, outputNumber: 18, area: 'BAR', gridColumn: '6 / 7', gridRow: '5 / 6', label: 'TV 18' },
  { tvNumber: 12, outputNumber: 12, area: 'BAR', gridColumn: '6 / 7', gridRow: '7 / 8', label: 'TV 12' },
  
  // DINING area (right side) - TV 07, TV 09, TV 06, TV 08, TV 05, TV 10
  { tvNumber: 7, outputNumber: 7, area: 'DINING', gridColumn: '10 / 11', gridRow: '3 / 4', label: 'TV 07' },
  { tvNumber: 9, outputNumber: 9, area: 'DINING', gridColumn: '10 / 11', gridRow: '4 / 5', label: 'TV 09' },
  { tvNumber: 6, outputNumber: 6, area: 'DINING', gridColumn: '10 / 11', gridRow: '5 / 6', label: 'TV 06' },
  { tvNumber: 8, outputNumber: 8, area: 'DINING', gridColumn: '9 / 10', gridRow: '3 / 4', label: 'TV 08' },
  { tvNumber: 5, outputNumber: 5, area: 'DINING', gridColumn: '10 / 11', gridRow: '6 / 7', label: 'TV 05' },
  { tvNumber: 10, outputNumber: 10, area: 'DINING', gridColumn: '10 / 11', gridRow: '7 / 8', label: 'TV 10' },
  
  // PARTY WEST (bottom left) - TV 24, TV 25
  { tvNumber: 24, outputNumber: 24, area: 'PARTY WEST', gridColumn: '4 / 5', gridRow: '9 / 10', label: 'TV 24' },
  { tvNumber: 25, outputNumber: 25, area: 'PARTY WEST', gridColumn: '5 / 6', gridRow: '10 / 11', label: 'TV 25' },
  
  // PATIO (bottom left corner) - TV 23
  { tvNumber: 23, outputNumber: 23, area: 'PATIO', gridColumn: '1 / 2', gridRow: '10 / 11', label: 'TV 23' },
  
  // WEST section (bottom center) - TV 04
  { tvNumber: 4, outputNumber: 4, area: 'WEST', gridColumn: '6 / 7', gridRow: '9 / 10', label: 'TV 04' },
  
  // SOUTH section (bottom right) - TV 03
  { tvNumber: 3, outputNumber: 3, area: 'SOUTH', gridColumn: '11 / 12', gridRow: '9 / 10', label: 'TV 03' },
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
            Graystone Sports Bar TV Layout
          </h2>
          <p className="text-slate-400 text-sm mt-1">
            Floor plan with 25 TVs across 8 zones - Click any TV to change its source
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
        {/* Floor Plan Legend */}
        <div className="mb-4 flex flex-wrap gap-2 text-xs">
          <div className="flex items-center space-x-1">
            <div className="w-3 h-3 bg-blue-900/30 border border-blue-700/30 rounded"></div>
            <span className="text-slate-300">EAST</span>
          </div>
          <div className="flex items-center space-x-1">
            <div className="w-3 h-3 bg-red-900/30 border border-red-700/30 rounded"></div>
            <span className="text-slate-300">PARTY EAST</span>
          </div>
          <div className="flex items-center space-x-1">
            <div className="w-3 h-3 bg-green-900/30 border border-green-700/30 rounded"></div>
            <span className="text-slate-300">BAR</span>
          </div>
          <div className="flex items-center space-x-1">
            <div className="w-3 h-3 bg-purple-900/30 border border-purple-700/30 rounded"></div>
            <span className="text-slate-300">DINING</span>
          </div>
          <div className="flex items-center space-x-1">
            <div className="w-3 h-3 bg-yellow-900/30 border border-yellow-700/30 rounded"></div>
            <span className="text-slate-300">PARTY WEST</span>
          </div>
          <div className="flex items-center space-x-1">
            <div className="w-3 h-3 bg-orange-900/30 border border-orange-700/30 rounded"></div>
            <span className="text-slate-300">PATIO</span>
          </div>
          <div className="flex items-center space-x-1">
            <div className="w-3 h-3 bg-pink-900/30 border border-pink-700/30 rounded"></div>
            <span className="text-slate-300">WEST</span>
          </div>
          <div className="flex items-center space-x-1">
            <div className="w-3 h-3 bg-cyan-900/30 border border-cyan-700/30 rounded"></div>
            <span className="text-slate-300">SOUTH</span>
          </div>
        </div>
        
        {/* Area Labels */}
        <div className="grid grid-cols-12 grid-rows-11 gap-3 min-h-[700px]">
          {/* North Label (top left) */}
          <div className="col-span-1 row-span-1 flex items-center justify-center text-white font-semibold text-sm bg-slate-800/40 rounded-lg border border-slate-600/30" style={{gridColumn: '1 / 2', gridRow: '1 / 2'}}>
            North
          </div>
          
          {/* EAST Label (top right) */}
          <div className="col-span-2 row-span-1 flex items-center justify-center text-white font-bold text-base bg-blue-900/30 rounded-lg border border-blue-700/30" style={{gridColumn: '10 / 12', gridRow: '1 / 2'}}>
            EAST
          </div>
          
          {/* PARTY EAST Label (left side) */}
          <div className="col-span-2 row-span-1 flex items-center justify-center text-white font-bold text-sm bg-red-900/30 rounded-lg border border-red-700/30" style={{gridColumn: '1 / 3', gridRow: '3 / 4'}}>
            PARTY EAST
          </div>
          
          {/* BAR Label (center) */}
          <div className="col-span-2 row-span-2 flex items-center justify-center text-white font-bold text-lg bg-green-900/30 rounded-lg border border-green-700/30" style={{gridColumn: '6 / 8', gridRow: '3 / 5'}}>
            BAR
          </div>
          
          {/* DINING Label (right side) */}
          <div className="col-span-1 row-span-1 flex items-center justify-center text-white font-bold text-sm bg-purple-900/30 rounded-lg border border-purple-700/30" style={{gridColumn: '11 / 12', gridRow: '2 / 3'}}>
            DINING
          </div>
          
          {/* South Label (right side) */}
          <div className="col-span-1 row-span-1 flex items-center justify-center text-white font-semibold text-sm bg-slate-800/40 rounded-lg border border-slate-600/30" style={{gridColumn: '11 / 12', gridRow: '8 / 9'}}>
            South
          </div>
          
          {/* PATIO Label (bottom left corner) */}
          <div className="col-span-1 row-span-1 flex items-center justify-center text-white font-bold text-sm bg-orange-900/30 rounded-lg border border-orange-700/30" style={{gridColumn: '1 / 2', gridRow: '9 / 10'}}>
            PATIO
          </div>
          
          {/* PARTY WEST Label (bottom left) */}
          <div className="col-span-2 row-span-1 flex items-center justify-center text-white font-bold text-sm bg-yellow-900/30 rounded-lg border border-yellow-700/30" style={{gridColumn: '3 / 5', gridRow: '8 / 9'}}>
            PARTY WEST
          </div>
          
          {/* WEST Label (bottom center) */}
          <div className="col-span-2 row-span-1 flex items-center justify-center text-white font-bold text-sm bg-pink-900/30 rounded-lg border border-pink-700/30" style={{gridColumn: '5 / 7', gridRow: '8 / 9'}}>
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
