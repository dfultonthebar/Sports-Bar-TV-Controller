
'use client'

import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from './ui/cards'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import { 
  Volume2, 
  VolumeX, 
  ChevronUp, 
  ChevronDown,
  Music,
  Tv,
  Radio
} from 'lucide-react'

interface AudioSource {
  id: string
  name: string
  type: 'tv' | 'streaming' | 'soundtrack' | 'input'
  icon: React.ReactNode
}

interface IntegratedAudioZoneProps {
  zoneId: string
  zoneName: string
  onSourceChange?: (sourceId: string) => void
  onVolumeChange?: (volume: number) => void
}

export default function IntegratedAudioZone({
  zoneId,
  zoneName,
  onSourceChange,
  onVolumeChange
}: IntegratedAudioZoneProps) {
  const [volume, setVolume] = useState(50)
  const [isMuted, setIsMuted] = useState(false)
  const [selectedSource, setSelectedSource] = useState<string>('soundtrack')

  const sources: AudioSource[] = [
    { id: 'soundtrack', name: 'Soundtrack', type: 'soundtrack', icon: <Music className="w-4 h-4" /> },
    { id: 'tv1', name: 'TV 1', type: 'tv', icon: <Tv className="w-4 h-4" /> },
    { id: 'tv2', name: 'TV 2', type: 'tv', icon: <Tv className="w-4 h-4" /> },
    { id: 'cable', name: 'Cable Box', type: 'input', icon: <Radio className="w-4 h-4" /> },
    { id: 'dtv', name: 'DirecTV', type: 'input', icon: <Radio className="w-4 h-4" /> },
  ]

  const handleVolumeChange = (delta: number) => {
    const newVolume = Math.max(0, Math.min(100, volume + delta))
    setVolume(newVolume)
    onVolumeChange?.(newVolume)
  }

  const handleSourceChange = (sourceId: string) => {
    setSelectedSource(sourceId)
    onSourceChange?.(sourceId)
  }

  const handleMuteToggle = () => {
    setIsMuted(!isMuted)
  }

  return (
    <Card className="bg-gray-800 border-gray-700">
      <CardHeader>
        <CardTitle className="text-white flex items-center justify-between">
          <span>{zoneName}</span>
          <Badge variant={isMuted ? "secondary" : "default"}>
            {isMuted ? 'Muted' : 'Active'}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Source Selection */}
        <div>
          <label className="text-sm text-slate-500 mb-2 block">Audio Source</label>
          <div className="grid grid-cols-2 gap-2">
            {sources.map((source) => (
              <button
                key={source.id}
                onClick={() => handleSourceChange(source.id)}
                className={`flex items-center justify-center space-x-2 p-3 rounded-lg border transition-colors ${
                  selectedSource === source.id
                    ? 'bg-teal-500/20 border-teal-500 text-white'
                    : 'bg-gray-700/50 border-gray-600 text-gray-300 hover:bg-gray-700 hover:border-gray-500'
                }`}
              >
                {source.icon}
                <span className="text-sm font-medium">{source.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Volume Control */}
        <div>
          <label className="text-sm text-slate-500 mb-2 block">Volume</label>
          <div className="flex items-center justify-between bg-gray-700/50 rounded-lg p-4">
            <Button
              onClick={() => handleVolumeChange(-5)}
              size="sm"
              variant="outline"
              disabled={volume === 0}
            >
              <ChevronDown className="w-4 h-4" />
            </Button>

            <div className="flex items-center space-x-3">
              <span className="text-white font-mono text-2xl w-16 text-center">
                {isMuted ? '--' : volume}
              </span>
              <div className="w-32 h-2 bg-gray-600 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-teal-500 to-teal-400 transition-all"
                  style={{ width: `${isMuted ? 0 : volume}%` }}
                />
              </div>
            </div>

            <Button
              onClick={() => handleVolumeChange(5)}
              size="sm"
              variant="outline"
              disabled={volume === 100}
            >
              <ChevronUp className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Mute Control */}
        <Button
          onClick={handleMuteToggle}
          variant={isMuted ? "destructive" : "outline"}
          className="w-full"
        >
          {isMuted ? (
            <>
              <VolumeX className="w-5 h-5 mr-2" />
              Unmute
            </>
          ) : (
            <>
              <Volume2 className="w-5 h-5 mr-2" />
              Mute
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  )
}
