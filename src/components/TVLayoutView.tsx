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
// Based on the actual physical layout:
// - TVs 5-10 are mounted back-to-back on the partial wall above the bar
// - TVs 5-7 face the dining room (East side of partial wall)
// - TVs 8-10 face the bar area (West side of partial wall)
// - TVs 1-4 are in various locations (East and other areas)
interface ExtendedTVDefinition extends TVDefinition {
  orientation?: 'facing-dining' | 'facing-bar' | 'normal'
}

const TV_LAYOUT: ExtendedTVDefinition[] = [
  // EAST area (top right corner) - TV 01, TV 02
  { tvNumber: 1, outputNumber: 1, area: 'EAST', gridColumn: '10 / 11', gridRow: '1 / 2', label: 'TV 01', orientation: 'normal' },
  { tvNumber: 2, outputNumber: 2, area: 'EAST', gridColumn: '11 / 12', gridRow: '1 / 2', label: 'TV 02', orientation: 'normal' },
  
  // PARTY EAST (left side) - TV 20, TV 13, TV 15, TV 21, TV 22
  { tvNumber: 20, outputNumber: 20, area: 'PARTY EAST', gridColumn: '1 / 2', gridRow: '2 / 3', label: 'TV 20', orientation: 'normal' },
  { tvNumber: 13, outputNumber: 13, area: 'PARTY EAST', gridColumn: '2 / 3', gridRow: '3 / 4', label: 'TV 13', orientation: 'normal' },
  { tvNumber: 15, outputNumber: 15, area: 'PARTY EAST', gridColumn: '2 / 3', gridRow: '4 / 5', label: 'TV 15', orientation: 'normal' },
  { tvNumber: 21, outputNumber: 21, area: 'PARTY EAST', gridColumn: '2 / 3', gridRow: '6 / 7', label: 'TV 21', orientation: 'normal' },
  { tvNumber: 22, outputNumber: 22, area: 'PARTY EAST', gridColumn: '3 / 4', gridRow: '6 / 7', label: 'TV 22', orientation: 'normal' },
  
  // Partial Wall TVs - BAR SIDE (TVs 8-10 facing the bar area - West side of partial wall)
  { tvNumber: 8, outputNumber: 8, area: 'BAR', gridColumn: '5 / 6', gridRow: '3 / 4', label: 'TV 08', orientation: 'facing-bar' },
  { tvNumber: 9, outputNumber: 9, area: 'BAR', gridColumn: '6 / 7', gridRow: '3 / 4', label: 'TV 09', orientation: 'facing-bar' },
  { tvNumber: 10, outputNumber: 10, area: 'BAR', gridColumn: '7 / 8', gridRow: '3 / 4', label: 'TV 10', orientation: 'facing-bar' },
  
  // Partial Wall TVs - DINING SIDE (TVs 5-7 facing the dining room - East side of partial wall)
  { tvNumber: 5, outputNumber: 5, area: 'DINING', gridColumn: '7 / 8', gridRow: '3 / 4', label: 'TV 05', orientation: 'facing-dining' },
  { tvNumber: 6, outputNumber: 6, area: 'DINING', gridColumn: '6 / 7', gridRow: '3 / 4', label: 'TV 06', orientation: 'facing-dining' },
  { tvNumber: 7, outputNumber: 7, area: 'DINING', gridColumn: '5 / 6', gridRow: '3 / 4', label: 'TV 07', orientation: 'facing-dining' },
  
  // Other BAR area TVs - TV 14, TV 16, TV 11, TV 19, TV 18, TV 12
  { tvNumber: 14, outputNumber: 14, area: 'BAR', gridColumn: '4 / 5', gridRow: '3 / 4', label: 'TV 14', orientation: 'normal' },
  { tvNumber: 19, outputNumber: 19, area: 'BAR', gridColumn: '8 / 9', gridRow: '3 / 4', label: 'TV 19', orientation: 'normal' },
  { tvNumber: 11, outputNumber: 11, area: 'BAR', gridColumn: '8 / 9', gridRow: '4 / 5', label: 'TV 11', orientation: 'normal' },
  { tvNumber: 16, outputNumber: 16, area: 'BAR', gridColumn: '5 / 6', gridRow: '4 / 5', label: 'TV 16', orientation: 'normal' },
  { tvNumber: 18, outputNumber: 18, area: 'BAR', gridColumn: '6 / 7', gridRow: '5 / 6', label: 'TV 18', orientation: 'normal' },
  { tvNumber: 12, outputNumber: 12, area: 'BAR', gridColumn: '6 / 7', gridRow: '7 / 8', label: 'TV 12', orientation: 'normal' },
  
  // DINING area TVs (remaining) - TV 01-04 are in dining/other areas per drawing
  { tvNumber: 4, outputNumber: 4, area: 'DINING', gridColumn: '10 / 11', gridRow: '8 / 9', label: 'TV 04', orientation: 'normal' },
  
  // PARTY WEST (bottom left) - TV 24, TV 25
  { tvNumber: 24, outputNumber: 24, area: 'PARTY WEST', gridColumn: '4 / 5', gridRow: '9 / 10', label: 'TV 24', orientation: 'normal' },
  { tvNumber: 25, outputNumber: 25, area: 'PARTY WEST', gridColumn: '5 / 6', gridRow: '10 / 11', label: 'TV 25', orientation: 'normal' },
  
  // PATIO (bottom left corner) - TV 23
  { tvNumber: 23, outputNumber: 23, area: 'PATIO', gridColumn: '1 / 2', gridRow: '10 / 11', label: 'TV 23', orientation: 'normal' },
  
  // WEST section (bottom center)
  { tvNumber: 3, outputNumber: 3, area: 'WEST', gridColumn: '11 / 12', gridRow: '9 / 10', label: 'TV 03', orientation: 'normal' },
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
            Physical floor plan with 25 TVs across 8 zones - TVs 5-10 mounted back-to-back on partial wall above bar
          </p>
          <p className="text-slate-500 text-xs mt-1">
            TVs 5-7 face dining room | TVs 8-10 face bar area | Click any TV to change its source
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
            <div className="w-3 h-3 bg-slate-700 border-2 border-white rounded-sm"></div>
            <span className="text-slate-300">Walls/Structure</span>
          </div>
          <div className="flex items-center space-x-1">
            <div className="w-3 h-3 bg-amber-900/40 border-2 border-amber-600 rounded-sm"></div>
            <span className="text-slate-300">Partial Wall (TVs 5-10)</span>
          </div>
        </div>
        
        {/* Layout Container with Room Walls */}
        <div className="relative">
          {/* Room Outer Walls - Black border representing physical walls */}
          <div className="absolute inset-0 border-4 border-white rounded-lg pointer-events-none z-10"></div>
          
          {/* Bar Structure - Central rectangular area */}
          <div 
            className="absolute bg-green-900/20 border-4 border-white rounded-md pointer-events-none z-10"
            style={{
              left: '33%',
              top: '30%',
              width: '28%',
              height: '35%'
            }}
          >
            <div className="flex items-center justify-center h-full">
              <span className="text-white font-bold text-lg opacity-30">BAR STRUCTURE</span>
            </div>
          </div>
          
          {/* Partial Wall Above Bar - Where TVs 5-10 are mounted back-to-back */}
          <div 
            className="absolute bg-amber-900/40 border-4 border-amber-600 rounded-sm pointer-events-none z-20"
            style={{
              left: '33%',
              top: '18%',
              width: '28%',
              height: '8%'
            }}
          >
            <div className="flex items-center justify-center h-full">
              <span className="text-amber-200 font-semibold text-xs">PARTIAL WALL (TVs 5-10 Back-to-Back)</span>
            </div>
          </div>
          
          {/* Directional Indicators */}
          <div className="absolute left-2 top-4 text-white font-bold text-sm bg-slate-800/70 px-3 py-1 rounded-lg border border-white z-30">
            ← NORTH
          </div>
          <div className="absolute right-2 top-4 text-white font-bold text-sm bg-slate-800/70 px-3 py-1 rounded-lg border border-white z-30">
            SOUTH →
          </div>
          <div className="absolute left-1/2 -translate-x-1/2 top-2 text-white font-bold text-sm bg-slate-800/70 px-3 py-1 rounded-lg border border-white z-30">
            ↑ EAST
          </div>
          <div className="absolute left-1/2 -translate-x-1/2 bottom-2 text-white font-bold text-sm bg-slate-800/70 px-3 py-1 rounded-lg border border-white z-30">
            ↓ WEST
          </div>
          
          {/* Grid Layout for TVs */}
          <div className="grid grid-cols-12 grid-rows-11 gap-3 min-h-[700px] relative z-20">
            {/* EAST Label (top right) */}
            <div className="col-span-2 row-span-1 flex items-center justify-center text-white font-bold text-base bg-blue-900/50 rounded-lg border-2 border-blue-700" style={{gridColumn: '10 / 12', gridRow: '1 / 2'}}>
              EAST
            </div>
            
            {/* PARTY EAST Label (left side) */}
            <div className="col-span-2 row-span-2 flex items-center justify-center text-white font-bold text-sm bg-red-900/50 rounded-lg border-2 border-red-700" style={{gridColumn: '1 / 3', gridRow: '2 / 4'}}>
              PARTY EAST
            </div>
            
            {/* DINING Label (right side) */}
            <div className="col-span-2 row-span-3 flex items-center justify-center text-white font-bold text-sm bg-purple-900/50 rounded-lg border-2 border-purple-700" style={{gridColumn: '10 / 12', gridRow: '4 / 7'}}>
              DINING ROOM
            </div>
            
            {/* PATIO Label (bottom left corner) */}
            <div className="col-span-1 row-span-1 flex items-center justify-center text-white font-bold text-xs bg-orange-900/50 rounded-lg border-2 border-orange-700" style={{gridColumn: '1 / 2', gridRow: '10 / 11'}}>
              PATIO
            </div>
            
            {/* PARTY WEST Label (bottom left) */}
            <div className="col-span-2 row-span-2 flex items-center justify-center text-white font-bold text-sm bg-yellow-900/50 rounded-lg border-2 border-yellow-700" style={{gridColumn: '3 / 5', gridRow: '9 / 11'}}>
              PARTY WEST
            </div>
            
            {/* Render all TVs */}
            {TV_LAYOUT.map((tv) => {
              const source = getSourceForOutput(tv.outputNumber)
              const output = outputs.find(o => o.channelNumber === tv.outputNumber)
              const isRouting = routingInProgress === tv.outputNumber
              
              // Add visual indicator for back-to-back TVs
              const isPartialWallTV = tv.orientation === 'facing-dining' || tv.orientation === 'facing-bar'
              const borderColor = tv.orientation === 'facing-dining' ? 'border-amber-400' : 
                                 tv.orientation === 'facing-bar' ? 'border-amber-600' : 
                                 'border-slate-500'
              
              return (
                <div
                  key={tv.tvNumber}
                  className={isPartialWallTV ? `border-2 ${borderColor} rounded-lg bg-amber-900/20` : ''}
                  style={{
                    gridColumn: tv.gridColumn,
                    gridRow: tv.gridRow
                  }}
                  title={isPartialWallTV ? `Mounted on partial wall - ${tv.orientation}` : ''}
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
                  {isPartialWallTV && (
                    <div className="text-center text-[10px] text-amber-300 font-semibold mt-1">
                      {tv.orientation === 'facing-dining' ? '→ Dining' : '← Bar'}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
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
