'use client'

import { useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs'
import { Volume2, Activity, Users } from 'lucide-react'
import AtlasInputMeters from './AtlasInputMeters'
import AtlasOutputMeters from './AtlasOutputMeters'
import AtlasGroupsControl from './AtlasGroupsControl'
import WolfpackMatrixOutputControl from './WolfpackMatrixOutputControl'

interface BartenderRemoteAudioPanelProps {
  processorIp: string
  processorId?: string
  showZoneControls?: boolean
  zoneControlsComponent?: React.ReactNode
}

export default function BartenderRemoteAudioPanel({
  processorIp,
  processorId,
  showZoneControls = true,
  zoneControlsComponent
}: BartenderRemoteAudioPanelProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Left Side - Wolfpack Matrix Output Controls */}
      <div className="lg:col-span-1">
        <WolfpackMatrixOutputControl processorIp={processorIp} />
      </div>

      {/* Right Side - Audio Controls */}
      <div className="lg:col-span-2">
        <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl shadow-2xl p-6">
          <h3 className="text-xl font-bold mb-6 flex items-center bg-gradient-to-r from-teal-400 via-cyan-400 to-blue-400 bg-clip-text text-transparent">
            <Volume2 className="mr-3 w-6 h-6 text-teal-400" />
            Audio Control
          </h3>

          <Tabs defaultValue="groups" className="w-full">
            <TabsList className="grid w-full grid-cols-3 backdrop-blur-xl bg-white/5 border border-white/10 rounded-xl p-1">
              <TabsTrigger
                value="groups"
                className="text-sm data-[state=active]:backdrop-blur-xl data-[state=active]:bg-gradient-to-br data-[state=active]:from-teal-500/20 data-[state=active]:to-purple-500/20 data-[state=active]:border data-[state=active]:border-teal-400/30 data-[state=active]:text-white rounded-lg transition-all duration-300"
              >
                <Users className="w-4 h-4 mr-2" />
                Groups
              </TabsTrigger>
              <TabsTrigger
                value="input-meters"
                className="text-sm data-[state=active]:backdrop-blur-xl data-[state=active]:bg-gradient-to-br data-[state=active]:from-teal-500/20 data-[state=active]:to-purple-500/20 data-[state=active]:border data-[state=active]:border-teal-400/30 data-[state=active]:text-white rounded-lg transition-all duration-300"
              >
                <Activity className="w-4 h-4 mr-2" />
                Input Meters
              </TabsTrigger>
              <TabsTrigger
                value="output-meters"
                className="text-sm data-[state=active]:backdrop-blur-xl data-[state=active]:bg-gradient-to-br data-[state=active]:from-teal-500/20 data-[state=active]:to-purple-500/20 data-[state=active]:border data-[state=active]:border-teal-400/30 data-[state=active]:text-white rounded-lg transition-all duration-300"
              >
                <Activity className="w-4 h-4 mr-2" />
                Output Meters
              </TabsTrigger>
            </TabsList>

            <TabsContent value="groups" className="mt-6">
              <AtlasGroupsControl
                processorIp={processorIp}
              />
            </TabsContent>

            <TabsContent value="input-meters" className="mt-6">
              <AtlasInputMeters
                processorId={processorId}
                processorIp={processorIp}
                autoRefresh={false}
                refreshInterval={1000}
              />
            </TabsContent>

            <TabsContent value="output-meters" className="mt-6">
              <AtlasOutputMeters
                processorId={processorId}
                processorIp={processorIp}
                showGroups={true}
                autoRefresh={false}
                refreshInterval={1000}
              />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  )
}
