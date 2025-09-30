
'use client'

import React from 'react'
import SportsBarLayout from '@/components/SportsBarLayout'
import SportsBarHeader from '@/components/SportsBarHeader'
import AudioProcessorManager from '@/components/AudioProcessorManager'
import AudioZoneControl from '@/components/AudioZoneControl'
import SoundtrackControl from '@/components/SoundtrackControl'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Music, Sliders, Disc } from 'lucide-react'
import Link from 'next/link'

export default function AudioManagerPage() {
  const headerActions = (
    <Link href="/" className="btn-secondary">
      <span>← Back to Home</span>
    </Link>
  )

  return (
    <SportsBarLayout>
      <SportsBarHeader
        title="Audio Management"
        subtitle="Complete audio system control"
        icon={<Music className="w-8 h-8 text-teal-400" />}
        actions={headerActions}
      />
      
      <div className="p-6">
        {/* Tabbed Interface */}
        <Tabs defaultValue="zones" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="zones" className="flex items-center gap-2">
              <Sliders className="w-4 h-4" />
              Zone Control
            </TabsTrigger>
            <TabsTrigger value="soundtrack" className="flex items-center gap-2">
              <Disc className="w-4 h-4" />
              Soundtrack
            </TabsTrigger>
            <TabsTrigger value="processors" className="flex items-center gap-2">
              <Music className="w-4 h-4" />
              Processors
            </TabsTrigger>
          </TabsList>

          <TabsContent value="zones" className="mt-6">
            <AudioZoneControl />
          </TabsContent>

          <TabsContent value="soundtrack" className="mt-6">
            <div className="grid grid-cols-1 gap-6">
              <SoundtrackControl zoneName="Main Audio System" />
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <SoundtrackControl zoneId="mainbar" zoneName="Main Bar" compact />
                <SoundtrackControl zoneId="pavilion" zoneName="Pavilion" compact />
                <SoundtrackControl zoneId="partyroom" zoneName="Party Room" compact />
                <SoundtrackControl zoneId="upstairs" zoneName="Upstairs" compact />
                <SoundtrackControl zoneId="patio" zoneName="Patio" compact />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="processors" className="mt-6">
            <AudioProcessorManager />
          </TabsContent>
        </Tabs>
      </div>
    </SportsBarLayout>
  )
}
