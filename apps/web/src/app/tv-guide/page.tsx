
'use client'

import React from 'react'
import UnifiedTVGuideViewer from '@/components/tv-guide/UnifiedTVGuideViewer'
import TVGuideConfigurationPanel from '@/components/tv-guide/TVGuideConfigurationPanel'
import SportsBarLayout from '@/components/SportsBarLayout'
import SportsBarHeader from '@/components/SportsBarHeader'
import { Tv, Settings } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

export default function TVGuidePage() {
  return (
    <SportsBarLayout>
      <SportsBarHeader
        title="TV Guide"
        subtitle="Unified programming guide from all sources"
        icon={<Tv className="w-8 h-8 text-blue-400" />}
      />
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-7xl mx-auto">
          <Tabs defaultValue="guide" className="space-y-6">
            <TabsList className="grid w-full grid-cols-2 bg-sportsBar-800/50 p-1">
              <TabsTrigger value="guide" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">
                <Tv className="w-4 h-4 mr-2" />
                TV Guide
              </TabsTrigger>
              <TabsTrigger value="configuration" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">
                <Settings className="w-4 h-4 mr-2" />
                Configuration
              </TabsTrigger>
            </TabsList>

            <TabsContent value="guide" className="space-y-6">
              <UnifiedTVGuideViewer />
            </TabsContent>

            <TabsContent value="configuration" className="space-y-6">
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-slate-100 mb-2">TV Guide Configuration</h2>
                <p className="text-slate-400">
                  Configure your TV guide data sources for comprehensive sports bar programming information.
                </p>
              </div>
              
              <TVGuideConfigurationPanel />
              
              <div className="mt-8 bg-sportsBar-800/50 p-6 rounded-lg shadow border border-slate-700/20">
                <h3 className="text-xl font-semibold mb-4 text-slate-100">About Professional TV Guide Services</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div>
                      <h4 className="font-semibold text-lg text-blue-400 mb-2">Gracenote (Nielsen)</h4>
                      <p className="text-slate-300 text-sm mb-3">
                        Industry-standard professional TV guide data with comprehensive metadata, 
                        sports-focused features, and real-time updates. Perfect for sports bars 
                        requiring detailed programming information.
                      </p>
                      <ul className="text-sm text-slate-400 space-y-1">
                        <li>• Comprehensive sports metadata</li>
                        <li>• Team and league information</li>
                        <li>• Event status and scoring</li>
                        <li>• Professional-grade reliability</li>
                      </ul>
                    </div>
                    
                    <div className="bg-blue-900/20 p-4 rounded-lg border border-blue-500/30">
                      <h5 className="font-medium text-blue-300 mb-2">Getting Started with Gracenote:</h5>
                      <ol className="text-sm text-slate-300 space-y-1 list-decimal list-inside">
                        <li>Visit <a href="https://developer.gracenote.com" className="text-blue-400 underline hover:text-blue-300">developer.gracenote.com</a></li>
                        <li>Create a developer account</li>
                        <li>Register your application</li>
                        <li>Obtain API Key and Partner ID</li>
                        <li>Add credentials to your environment variables</li>
                      </ol>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <div>
                      <h4 className="font-semibold text-lg text-purple-400 mb-2">Spectrum Business API</h4>
                      <p className="text-slate-300 text-sm mb-3">
                        Direct integration with Spectrum Business TV services providing 
                        real-time channel lineup and programming data specific to your 
                        business account and service level.
                      </p>
                      <ul className="text-sm text-slate-400 space-y-1">
                        <li>• Account-specific channel lineup</li>
                        <li>• Subscription-aware programming</li>
                        <li>• Regional sports networks</li>
                        <li>• Package-level channel access</li>
                      </ul>
                    </div>
                    
                    <div className="bg-purple-900/20 p-4 rounded-lg border border-purple-500/30">
                      <h5 className="font-medium text-purple-300 mb-2">Getting Spectrum Business API Access:</h5>
                      <ol className="text-sm text-slate-300 space-y-1 list-decimal list-inside">
                        <li>Contact your Spectrum Business representative</li>
                        <li>Request API access for your account</li>
                        <li>Obtain API credentials and account ID</li>
                        <li>Configure region settings</li>
                        <li>Add credentials to your environment variables</li>
                      </ol>
                    </div>
                  </div>
                </div>
                
                <div className="mt-6 p-4 bg-yellow-900/20 rounded border border-yellow-500/30">
                  <h5 className="font-medium text-yellow-300 mb-2">💡 Pro Tip</h5>
                  <p className="text-yellow-200 text-sm">
                    You can use both services simultaneously! The unified TV guide will automatically 
                    merge data from both sources, providing the most comprehensive programming information 
                    available. Gracenote provides rich metadata while Spectrum ensures accuracy for your 
                    specific subscription.
                  </p>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </SportsBarLayout>
  )
}
