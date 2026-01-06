'use client'

import { useState, useEffect } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Cable, Monitor, Zap, Grid3X3, Tv2 } from 'lucide-react'
import MatrixControl from '@/components/MatrixControl'
import CrestronMatrixManager from '@/components/CrestronMatrixManager'
import MultiViewCardManager from '@/components/MultiViewCardManager'
import SportsBarLayout from '@/components/SportsBarLayout'
import SportsBarHeader from '@/components/SportsBarHeader'

export default function MatrixControlPage() {
  return (
    <SportsBarLayout>
      <SportsBarHeader
        title="Matrix Control"
        subtitle="Video switching & routing management"
        icon={<Cable className="w-8 h-8 text-indigo-400" />}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="card p-6">
          <div className="flex items-center space-x-3 mb-6">
            <Monitor className="w-6 h-6 text-indigo-400" />
            <h2 className="text-2xl font-bold text-slate-100">Video Matrix Configuration</h2>
          </div>

          <Tabs defaultValue="wolfpack" className="space-y-6">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="wolfpack" className="flex items-center gap-2">
                <Zap className="w-4 h-4" />
                Wolf Pack
              </TabsTrigger>
              <TabsTrigger value="crestron" className="flex items-center gap-2">
                <Grid3X3 className="w-4 h-4" />
                Crestron DM
              </TabsTrigger>
              <TabsTrigger value="multiview" className="flex items-center gap-2">
                <Tv2 className="w-4 h-4" />
                Multi-View
              </TabsTrigger>
            </TabsList>

            <TabsContent value="wolfpack" className="space-y-4">
              <MatrixControl />
            </TabsContent>

            <TabsContent value="crestron" className="space-y-4">
              <CrestronMatrixManager />
            </TabsContent>

            <TabsContent value="multiview" className="space-y-4">
              <MultiViewCardManager />
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </SportsBarLayout>
  )
}
