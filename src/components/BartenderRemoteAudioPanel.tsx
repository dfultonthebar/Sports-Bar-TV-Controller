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
        <div className="bg-slate-800/50 backdrop-blur-sm rounded-lg p-4">
          <h3 className="text-lg font-bold text-white mb-4 flex items-center">
            <Volume2 className="mr-2 w-5 h-5 text-teal-400" />
            Audio Control
          </h3>

          <Tabs defaultValue="groups" className="w-full">
            <TabsList className="grid w-full grid-cols-3 bg-slate-900/50">
              <TabsTrigger 
                value="groups"
                className="text-xs data-[state=active]:bg-slate-700 data-[state=active]:text-slate-100"
              >
                <Users className="w-3 h-3 mr-1" />
                Groups
              </TabsTrigger>
              <TabsTrigger 
                value="input-meters"
                className="text-xs data-[state=active]:bg-slate-700 data-[state=active]:text-slate-100"
              >
                <Activity className="w-3 h-3 mr-1" />
                Input Meters
              </TabsTrigger>
              <TabsTrigger 
                value="output-meters"
                className="text-xs data-[state=active]:bg-slate-700 data-[state=active]:text-slate-100"
              >
                <Activity className="w-3 h-3 mr-1" />
                Output Meters
              </TabsTrigger>
            </TabsList>

            <TabsContent value="groups" className="mt-4">
              <AtlasGroupsControl 
                processorIp={processorIp}
              />
            </TabsContent>

            <TabsContent value="input-meters" className="mt-4">
              <AtlasInputMeters 
                processorId={processorId}
                processorIp={processorIp}
                autoRefresh={true}
                refreshInterval={100}
              />
            </TabsContent>

            <TabsContent value="output-meters" className="mt-4">
              <AtlasOutputMeters 
                processorId={processorId}
                processorIp={processorIp}
                showGroups={true}
                autoRefresh={true}
                refreshInterval={100}
              />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  )
}
