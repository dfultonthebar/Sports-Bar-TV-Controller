

'use client'

import { useState, useEffect } from 'react'
import { ArrowLeft, Save, Settings, Speaker, Volume2, Brain } from 'lucide-react'
import Link from 'next/link'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import AtlasProgrammingInterface from '@/components/AtlasProgrammingInterface'
import AtlasAIMonitor from '@/components/AtlasAIMonitor'

export default function AtlasConfigPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <header className="bg-white/90 backdrop-blur-sm border-b border-slate-200/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <Link href="/" className="p-2 rounded-lg hover:bg-slate-100 transition-colors">
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div className="bg-gradient-to-br from-teal-600 to-cyan-600 rounded-xl p-2.5 shadow-lg">
                <Speaker className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900">Atlas Audio System</h1>
                <p className="text-sm text-slate-500">Audio processing & zone management</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-6">
          <div className="flex items-center space-x-3 mb-6">
            <Volume2 className="w-6 h-6 text-teal-600" />
            <h2 className="text-2xl font-bold text-slate-900">Atlas Audio System</h2>
            <div className="flex-1" />
            <div className="text-sm text-slate-500">
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
    </div>
  )
}
