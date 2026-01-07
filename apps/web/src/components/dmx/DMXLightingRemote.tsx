'use client'

import { useState, useEffect } from 'react'
import {
  Lightbulb,
  Zap,
  Moon,
  Sun,
  PartyPopper,
  AlertTriangle,
  RefreshCw,
  Loader2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@sports-bar/ui-utils'

interface DMXScene {
  id: string
  name: string
  description?: string
  category: string
  iconName?: string
  iconColor?: string
  isFavorite: boolean
  usageCount: number
}

interface DMXControllerStatus {
  id: string
  name: string
  status: 'online' | 'offline' | 'error'
  controllerType: string
}

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  general: Sun,
  'game-day': Zap,
  celebration: PartyPopper,
  ambient: Moon,
  special: Lightbulb,
}

const CATEGORY_COLORS: Record<string, string> = {
  general: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  'game-day': 'bg-green-500/20 text-green-400 border-green-500/30',
  celebration: 'bg-pink-500/20 text-pink-400 border-pink-500/30',
  ambient: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  special: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
}

export default function DMXLightingRemote() {
  const [scenes, setScenes] = useState<DMXScene[]>([])
  const [favorites, setFavorites] = useState<DMXScene[]>([])
  const [controllers, setControllers] = useState<DMXControllerStatus[]>([])
  const [activeScene, setActiveScene] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadingScene, setLoadingScene] = useState<string | null>(null)
  const [status, setStatus] = useState<{ type: 'success' | 'error' | null; message: string }>({ type: null, message: '' })
  const [expanded, setExpanded] = useState(true)
  const [showAllScenes, setShowAllScenes] = useState(false)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      // Load bartender scenes
      const scenesRes = await fetch('/api/dmx/scenes/bartender')
      if (scenesRes.ok) {
        const data = await scenesRes.json()
        setScenes(data.scenes || [])
        setFavorites(data.favorites || [])
      }

      // Load controller status
      const controllersRes = await fetch('/api/dmx/controllers')
      if (controllersRes.ok) {
        const data = await controllersRes.json()
        setControllers(data.controllers || [])
      }
    } catch (error) {
      console.error('Failed to load DMX data:', error)
    } finally {
      setLoading(false)
    }
  }

  const recallScene = async (sceneId: string, sceneName: string) => {
    setLoadingScene(sceneId)
    try {
      const response = await fetch('/api/dmx/scenes/recall', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sceneId }),
      })

      if (response.ok) {
        setActiveScene(sceneId)
        setStatus({ type: 'success', message: `${sceneName} activated` })
      } else {
        const data = await response.json()
        setStatus({ type: 'error', message: data.error || 'Failed to recall scene' })
      }
    } catch (error) {
      setStatus({ type: 'error', message: 'Failed to recall scene' })
    } finally {
      setLoadingScene(null)
      setTimeout(() => setStatus({ type: null, message: '' }), 3000)
    }
  }

  const handleBlackout = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/dmx/control/blackout', {
        method: 'POST',
      })

      if (response.ok) {
        setActiveScene(null)
        setStatus({ type: 'success', message: 'Blackout activated' })
      } else {
        setStatus({ type: 'error', message: 'Failed to blackout' })
      }
    } catch (error) {
      setStatus({ type: 'error', message: 'Failed to blackout' })
    } finally {
      setLoading(false)
      setTimeout(() => setStatus({ type: null, message: '' }), 3000)
    }
  }

  const onlineControllers = controllers.filter(c => c.status === 'online')
  const hasControllers = controllers.length > 0

  return (
    <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-3">
          <Lightbulb className="w-6 h-6 text-purple-400" />
          <h3 className="text-lg font-bold bg-gradient-to-r from-purple-400 via-pink-400 to-red-400 bg-clip-text text-transparent">
            Lighting Control
          </h3>
          {hasControllers && (
            <span className={cn(
              'text-xs px-2 py-0.5 rounded-full',
              onlineControllers.length > 0
                ? 'bg-green-500/20 text-green-400'
                : 'bg-red-500/20 text-red-400'
            )}>
              {onlineControllers.length}/{controllers.length} Online
            </span>
          )}
        </div>
        {expanded ? (
          <ChevronUp className="w-5 h-5 text-slate-400" />
        ) : (
          <ChevronDown className="w-5 h-5 text-slate-400" />
        )}
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-4">
          {/* Status Message */}
          {status.type && (
            <div className={cn(
              'px-3 py-2 rounded-lg text-sm flex items-center gap-2',
              status.type === 'success' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
            )}>
              {status.type === 'success' ? (
                <Lightbulb className="w-4 h-4" />
              ) : (
                <AlertTriangle className="w-4 h-4" />
              )}
              {status.message}
            </div>
          )}

          {/* No Controllers Warning */}
          {!hasControllers && !loading && (
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 text-sm text-amber-400 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>No DMX controllers configured. Add one in Device Config.</span>
            </div>
          )}

          {/* Quick Actions */}
          <div className="grid grid-cols-2 gap-2">
            <Button
              onClick={handleBlackout}
              disabled={loading || !hasControllers}
              variant="outline"
              className="flex items-center gap-2 bg-slate-800/50 border-slate-700 hover:bg-red-500/20 hover:border-red-500/50 hover:text-red-400"
            >
              <Moon className="w-4 h-4" />
              Blackout
            </Button>
            <Button
              onClick={loadData}
              disabled={loading}
              variant="outline"
              className="flex items-center gap-2 bg-slate-800/50 border-slate-700"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
              Refresh
            </Button>
          </div>

          {/* Favorite Scenes */}
          {favorites.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                Favorites
              </h4>
              <div className="grid grid-cols-2 gap-2">
                {favorites.map((scene) => (
                  <SceneButton
                    key={scene.id}
                    scene={scene}
                    isActive={activeScene === scene.id}
                    isLoading={loadingScene === scene.id}
                    onClick={() => recallScene(scene.id, scene.name)}
                    disabled={!hasControllers}
                  />
                ))}
              </div>
            </div>
          )}

          {/* All Scenes */}
          {scenes.length > 0 && (
            <div className="space-y-2">
              <button
                onClick={() => setShowAllScenes(!showAllScenes)}
                className="flex items-center gap-2 text-xs font-medium text-slate-400 uppercase tracking-wider hover:text-slate-300"
              >
                All Scenes ({scenes.length})
                {showAllScenes ? (
                  <ChevronUp className="w-3 h-3" />
                ) : (
                  <ChevronDown className="w-3 h-3" />
                )}
              </button>

              {showAllScenes && (
                <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto">
                  {scenes.map((scene) => (
                    <SceneButton
                      key={scene.id}
                      scene={scene}
                      isActive={activeScene === scene.id}
                      isLoading={loadingScene === scene.id}
                      onClick={() => recallScene(scene.id, scene.name)}
                      disabled={!hasControllers}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* No Scenes Message */}
          {scenes.length === 0 && hasControllers && !loading && (
            <div className="text-center text-slate-400 text-sm py-4">
              No scenes configured yet.
              <br />
              Create scenes in Device Config.
            </div>
          )}
        </div>
      )}
    </div>
  )
}

interface SceneButtonProps {
  scene: DMXScene
  isActive: boolean
  isLoading: boolean
  onClick: () => void
  disabled?: boolean
}

function SceneButton({ scene, isActive, isLoading, onClick, disabled }: SceneButtonProps) {
  const Icon = CATEGORY_ICONS[scene.category] || Lightbulb
  const colorClass = CATEGORY_COLORS[scene.category] || CATEGORY_COLORS.general

  return (
    <button
      onClick={onClick}
      disabled={disabled || isLoading}
      className={cn(
        'flex items-center gap-2 px-3 py-2 rounded-lg border transition-all text-left',
        isActive
          ? 'bg-purple-500/30 border-purple-500/50 text-purple-300'
          : cn('hover:bg-white/5', colorClass),
        disabled && 'opacity-50 cursor-not-allowed'
      )}
    >
      {isLoading ? (
        <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />
      ) : (
        <Icon className="w-4 h-4 flex-shrink-0" />
      )}
      <span className="truncate text-sm">{scene.name}</span>
    </button>
  )
}
