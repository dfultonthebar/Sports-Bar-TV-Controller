
/**
 * CEC Discovery Panel Component
 * 
 * UI for running CEC discovery to detect TV brands on WolfPack outputs
 */

'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/cards'
import { Badge } from '@/components/ui/badge'
import { Loader2, Search, CheckCircle, XCircle, RefreshCw, Tv } from 'lucide-react'

interface OutputDiscoveryInfo {
  outputNumber: number
  label: string
  brand?: string
  model?: string
  cecAddress?: string
  lastDiscovery?: string
  discovered: boolean
}

export default function CECDiscoveryPanel() {
  const [outputs, setOutputs] = useState<OutputDiscoveryInfo[]>([])
  const [discovering, setDiscovering] = useState(false)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState<string>('')
  
  // Load existing discovery data
  useEffect(() => {
    loadDiscoveryData()
  }, [])
  
  const loadDiscoveryData = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/cec/discovery')
      const data = await response.json()
      
      if (data.success) {
        setOutputs(data.outputs)
      }
    } catch (error) {
      console.error('Error loading discovery data:', error)
    } finally {
      setLoading(false)
    }
  }
  
  const runDiscovery = async (outputNumber?: number) => {
    try {
      setDiscovering(true)
      setMessage(outputNumber 
        ? `Discovering TV on output ${outputNumber}...` 
        : 'Discovering all TVs...'
      )
      
      const response = await fetch('/api/cec/discovery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(outputNumber ? { outputNumber } : {})
      })
      
      const data = await response.json()
      
      if (data.success) {
        setMessage(data.message)
        await loadDiscoveryData() // Reload to show updated results
      } else {
        setMessage(`Error: ${data.error}`)
      }
    } catch (error: any) {
      console.error('Error running discovery:', error)
      setMessage(`Error: ${error.message}`)
    } finally {
      setDiscovering(false)
    }
  }
  
  if (loading) {
    return (
      <Card className="bg-[#1e3a5f]">
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-blue-400" />
        </CardContent>
      </Card>
    )
  }
  
  return (
    <Card className="bg-[#1e3a5f] border-blue-800">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-white flex items-center gap-2">
              <Tv className="h-5 w-5" />
              CEC TV Discovery
            </CardTitle>
            <CardDescription className="text-blue-200">
              Automatically detect TV brands connected to WolfPack outputs
            </CardDescription>
          </div>
          <Button
            onClick={() => runDiscovery()}
            disabled={discovering}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {discovering ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Discovering...
              </>
            ) : (
              <>
                <Search className="mr-2 h-4 w-4" />
                Discover All
              </>
            )}
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {message && (
          <div className="p-3 bg-blue-900/50 rounded-lg border border-blue-700">
            <p className="text-sm text-blue-100">{message}</p>
          </div>
        )}
        
        <div className="grid gap-3">
          {outputs.map((output) => (
            <div
              key={output.outputNumber}
              className="p-4 bg-[#2a4a6f] rounded-lg border border-blue-700 hover:border-blue-600 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-lg font-semibold text-white">
                      Output {output.outputNumber}
                    </span>
                    <span className="text-blue-200">{output.label}</span>
                    {output.discovered ? (
                      <Badge className="bg-green-600/20 text-green-300 border-green-600">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Detected
                      </Badge>
                    ) : (
                      <Badge className="bg-gray-600/20 text-gray-300 border-gray-600">
                        <XCircle className="h-3 w-3 mr-1" />
                        Not Detected
                      </Badge>
                    )}
                  </div>
                  
                  {output.brand && (
                    <div className="space-y-1 text-sm">
                      <div className="flex items-center gap-2">
                        <span className="text-blue-300 font-medium">Brand:</span>
                        <span className="text-white">{output.brand}</span>
                      </div>
                      {output.model && (
                        <div className="flex items-center gap-2">
                          <span className="text-blue-300 font-medium">Model:</span>
                          <span className="text-white">{output.model}</span>
                        </div>
                      )}
                      {output.cecAddress && (
                        <div className="flex items-center gap-2">
                          <span className="text-blue-300 font-medium">CEC Address:</span>
                          <span className="text-white font-mono">{output.cecAddress}</span>
                        </div>
                      )}
                      {output.lastDiscovery && (
                        <div className="flex items-center gap-2">
                          <span className="text-blue-300 font-medium">Last Discovery:</span>
                          <span className="text-gray-300">
                            {new Date(output.lastDiscovery).toLocaleString()}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => runDiscovery(output.outputNumber)}
                  disabled={discovering}
                  className="border-blue-600 text-blue-200 hover:bg-blue-900/50"
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
        
        {outputs.length === 0 && (
          <div className="text-center py-8 text-blue-200">
            <Tv className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No active outputs configured</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

