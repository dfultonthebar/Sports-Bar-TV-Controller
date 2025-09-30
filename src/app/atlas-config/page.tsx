

'use client'

import { useState, useEffect } from 'react'
import { ArrowLeft, Save, Settings, Speaker, Volume2, Brain } from 'lucide-react'
import Link from 'next/link'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import AtlasProgrammingInterface from '@/components/AtlasProgrammingInterface'
import AtlasAIMonitor from '@/components/AtlasAIMonitor'
import SportsBarLayout from '@/components/SportsBarLayout'
import SportsBarHeader from '@/components/SportsBarHeader'

export default function AtlasConfigPage() {
  return (
    <SportsBarLayout>
      <SportsBarHeader
        title="Atlas Audio System"
        subtitle="Audio processing & zone management"
        icon={<Speaker className="w-8 h-8 text-teal-400" />}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="card p-6">
          <div className="flex items-center space-x-3 mb-6">
            <Volume2 className="w-6 h-6 text-teal-400" />
            <h2 className="text-2xl font-bold text-slate-100">Atlas Audio System</h2>
            <div className="flex-1" />
            <div className="text-sm text-slate-300">
              AI-Powered Audio Processing & Zone Management
            </div>
          </div>
          
          <Tabs defaultValue="configuration" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="configuration" className="flex items-center space-x-2">
                <Settings className="w-4 h-4" />
                <span>Configuration</span>
              </TabsTrigger>
              <TabsTrigger value="ai-monitor" className="flex items-center space-x-2">
                <Brain className="w-4 h-4" />
                <span>AI Monitor</span>
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="configuration" className="mt-6">
              <AtlasProgrammingInterface />
            </TabsContent>
            
            <TabsContent value="ai-monitor" className="mt-6">
              {/* Example with a processor - in real implementation, this would be dynamic */}
              <AtlasAIMonitor 
                processorId="atlas-001"
                processorModel="AZM8"
                autoRefresh={true}
                refreshInterval={30000}
              />
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </SportsBarLayout>
  )
}
