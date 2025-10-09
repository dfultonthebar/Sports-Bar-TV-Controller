
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
  const [processors, setProcessors] = useState<any[]>([])
  const [selectedProcessor, setSelectedProcessor] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchProcessors()
  }, [])

  const fetchProcessors = async () => {
    try {
      const response = await fetch('/api/audio-processor')
      const data = await response.json()
      
      if (data.success && data.processors) {
        setProcessors(data.processors)
        if (data.processors.length > 0) {
          setSelectedProcessor(data.processors[0])
        }
      }
    } catch (error) {
      console.error('Failed to fetch processors:', error)
    } finally {
      setLoading(false)
    }
  }

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
            
            {/* Processor Selector */}
            {processors.length > 0 && (
              <select
                value={selectedProcessor?.id || ''}
                onChange={(e) => {
                  const processor = processors.find(p => p.id === e.target.value)
                  setSelectedProcessor(processor)
                }}
                className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200"
              >
                {processors.map(processor => (
                  <option key={processor.id} value={processor.id}>
                    {processor.name} ({processor.model})
                  </option>
                ))}
              </select>
            )}
            
            <div className="text-sm text-slate-300">
              AI-Powered Audio Processing & Zone Management
            </div>
          </div>
          
          {loading ? (
            <div className="text-center py-12 text-slate-400">
              Loading Atlas processors...
            </div>
          ) : processors.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-slate-400 mb-4">No Atlas processors configured</p>
              <p className="text-sm text-slate-500">
                Add an Atlas processor in the Audio Control page to get started
              </p>
            </div>
          ) : (
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
                {selectedProcessor ? (
                  <AtlasAIMonitor 
                    processorId={selectedProcessor.id}
                    processorModel={selectedProcessor.model}
                    autoRefresh={true}
                    refreshInterval={30000}
                  />
                ) : (
                  <div className="text-center py-12 text-slate-400">
                    Select a processor to view AI monitoring
                  </div>
                )}
              </TabsContent>
            </Tabs>
          )}
        </div>
      </main>
    </SportsBarLayout>
  )
}
