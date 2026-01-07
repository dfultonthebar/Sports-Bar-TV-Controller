'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { Badge } from '@/components/ui/badge'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { RefreshCw, Lightbulb, ChevronDown, Power, PowerOff, Sun, Layers } from 'lucide-react'

interface LightingSystem {
  id: string
  name: string
  systemType: string
  status: string
}

interface LightingZone {
  id: string
  systemId: string
  name: string
  currentLevel: number
  isOn: boolean
  bartenderVisible: boolean
}

interface LightingScene {
  id: string
  systemId: string | null
  name: string
  category: string
  bartenderVisible: boolean
  iconName: string | null
  iconColor: string | null
}

export default function CommercialLightingRemote() {
  const [systems, setSystems] = useState<LightingSystem[]>([])
  const [zones, setZones] = useState<LightingZone[]>([])
  const [scenes, setScenes] = useState<LightingScene[]>([])
  const [loading, setLoading] = useState(true)
  const [executing, setExecuting] = useState<string | null>(null)
  const [isOpen, setIsOpen] = useState(true)

  const fetchData = useCallback(async () => {
    try {
      const [systemsRes, zonesRes, scenesRes] = await Promise.all([
        fetch('/api/commercial-lighting/systems'),
        fetch('/api/commercial-lighting/zones'),
        fetch('/api/commercial-lighting/scenes/bartender'),
      ])

      const [systemsData, zonesData, scenesData] = await Promise.all([
        systemsRes.json(),
        zonesRes.json(),
        scenesRes.json(),
      ])

      if (systemsData.success && Array.isArray(systemsData.data)) {
        setSystems(systemsData.data.filter((s: LightingSystem) => s.status === 'online'))
      }
      if (zonesData.success && Array.isArray(zonesData.data)) {
        setZones(zonesData.data.filter((z: LightingZone) => z.bartenderVisible))
      }
      if (scenesData.success) {
        // scenes/bartender endpoint returns { all: [], byCategory: {}, ... }
        const scenesArray = Array.isArray(scenesData.data)
          ? scenesData.data
          : (scenesData.data?.all || [])
        setScenes(scenesArray)
      }
    } catch (error) {
      console.error('Failed to fetch lighting data:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
    // Refresh every 30 seconds
    const interval = setInterval(fetchData, 30000)
    return () => clearInterval(interval)
  }, [fetchData])

  const handleQuickAction = async (action: 'all_on' | 'all_off') => {
    setExecuting(action)
    try {
      const response = await fetch('/api/commercial-lighting/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, triggeredBy: 'bartender-remote' }),
      })
      const data = await response.json()
      if (data.success) {
        await fetchData()
      }
    } catch (error) {
      console.error('Failed to execute quick action:', error)
    } finally {
      setExecuting(null)
    }
  }

  const handleRecallScene = async (sceneId: string) => {
    setExecuting(sceneId)
    try {
      const response = await fetch('/api/commercial-lighting/scenes/recall', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sceneId, triggeredBy: 'bartender-remote' }),
      })
      const data = await response.json()
      if (data.success) {
        await fetchData()
      }
    } catch (error) {
      console.error('Failed to recall scene:', error)
    } finally {
      setExecuting(null)
    }
  }

  const handleZoneLevel = async (zoneId: string, level: number) => {
    try {
      await fetch('/api/commercial-lighting/zones/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ zoneId, level, triggeredBy: 'bartender-remote' }),
      })
      // Optimistically update the UI
      setZones(prev =>
        prev.map(z =>
          z.id === zoneId ? { ...z, currentLevel: level, isOn: level > 0 } : z
        )
      )
    } catch (error) {
      console.error('Failed to set zone level:', error)
    }
  }

  // Group scenes by category
  const scenesByCategory = scenes.reduce((acc, scene) => {
    const category = scene.category || 'general'
    if (!acc[category]) acc[category] = []
    acc[category].push(scene)
    return acc
  }, {} as Record<string, LightingScene[]>)

  if (loading) {
    return (
      <Card className="bg-gradient-to-br from-amber-50 to-yellow-50 border-amber-200">
        <CardContent className="p-4 text-center">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-amber-600" />
          <p className="text-sm text-amber-700">Loading lighting controls...</p>
        </CardContent>
      </Card>
    )
  }

  if (systems.length === 0) {
    return null // Don't show panel if no systems configured
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="bg-gradient-to-br from-amber-50 to-yellow-50 border-amber-200">
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-amber-100/50 transition-colors pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Lightbulb className="w-5 h-5 text-amber-600" />
                <CardTitle className="text-lg text-amber-900">Commercial Lighting</CardTitle>
                <Badge variant="outline" className="ml-2 text-xs">
                  {systems.length} system{systems.length !== 1 ? 's' : ''} online
                </Badge>
              </div>
              <ChevronDown className={`w-5 h-5 text-amber-600 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </div>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="space-y-4 pt-2">
            {/* Quick Actions */}
            <div className="flex gap-2">
              <Button
                onClick={() => handleQuickAction('all_on')}
                disabled={executing !== null}
                className="flex-1 bg-amber-500 hover:bg-amber-600 text-white"
              >
                {executing === 'all_on' ? (
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Power className="w-4 h-4 mr-2" />
                )}
                All Lights On
              </Button>
              <Button
                onClick={() => handleQuickAction('all_off')}
                disabled={executing !== null}
                variant="outline"
                className="flex-1 border-amber-300 text-amber-700 hover:bg-amber-100"
              >
                {executing === 'all_off' ? (
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <PowerOff className="w-4 h-4 mr-2" />
                )}
                All Lights Off
              </Button>
            </div>

            {/* Scenes */}
            {Object.keys(scenesByCategory).length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium text-amber-800">
                  <Layers className="w-4 h-4" />
                  Scenes
                </div>
                {Object.entries(scenesByCategory).map(([category, categoryScenes]) => (
                  <div key={category} className="space-y-1">
                    {categoryScenes.length > 3 && (
                      <p className="text-xs text-amber-600 uppercase tracking-wide">
                        {category}
                      </p>
                    )}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {categoryScenes.map((scene) => (
                        <Button
                          key={scene.id}
                          onClick={() => handleRecallScene(scene.id)}
                          disabled={executing !== null}
                          variant="outline"
                          size="sm"
                          className="border-amber-200 hover:bg-amber-100 text-amber-800 justify-start"
                          style={
                            scene.iconColor
                              ? { borderLeftColor: scene.iconColor, borderLeftWidth: '3px' }
                              : undefined
                          }
                        >
                          {executing === scene.id ? (
                            <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
                          ) : null}
                          {scene.name}
                        </Button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Zone Sliders */}
            {zones.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium text-amber-800">
                  <Sun className="w-4 h-4" />
                  Zone Dimming
                </div>
                {zones.map((zone) => (
                  <div key={zone.id} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-amber-900">{zone.name}</span>
                      <span className="text-xs text-amber-600 w-12 text-right">
                        {zone.currentLevel}%
                      </span>
                    </div>
                    <Slider
                      value={[zone.currentLevel]}
                      onValueChange={([value]) => handleZoneLevel(zone.id, value)}
                      max={100}
                      step={5}
                      className="w-full"
                    />
                  </div>
                ))}
              </div>
            )}

            {/* Refresh button */}
            <Button
              onClick={fetchData}
              variant="ghost"
              size="sm"
              className="w-full text-amber-600 hover:text-amber-700 hover:bg-amber-100"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh Status
            </Button>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  )
}
