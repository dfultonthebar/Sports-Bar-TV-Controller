
'use client'

import { useState } from 'react'
import SportsGuide from '@/components/SportsGuide'
import SportsBarHeader from '@/components/SportsBarHeader'
import SportsBarLayout from '@/components/SportsBarLayout'
import { Calendar, Settings, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

export default function SportsGuidePage() {
  return (
    <SportsBarLayout>
      <SportsBarHeader
        title="Sports Guide"
        subtitle="Find where to watch your favorite sports"
        icon={<Calendar className="w-6 h-6 text-white" />}
        actions={
          <Link href="/remote" className="btn-success">
            <span>TV Remote</span>
          </Link>
        }
      />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Tabs defaultValue="guide" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 bg-sportsBar-800/50 p-1">
            <TabsTrigger value="guide" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">
              <Calendar className="w-4 h-4 mr-2" />
              Sports Guide
            </TabsTrigger>
            <TabsTrigger value="configuration" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">
              <Settings className="w-4 h-4 mr-2" />
              Configuration
            </TabsTrigger>
          </TabsList>

          <TabsContent value="guide" className="space-y-6">
            <SportsGuide />
          </TabsContent>

          <TabsContent value="configuration" className="space-y-6">
            <div className="card p-6">
              <div className="mb-6">
                <h2 className="text-xl font-bold text-slate-100 mb-2">Sports Guide Configuration</h2>
                <p className="text-sm text-slate-300">
                  Configure providers, location, and favorite teams for personalized sports viewing
                </p>
              </div>

              <div className="bg-blue-900/30 rounded-lg p-6 border border-blue-500/30">
                <div className="flex items-start space-x-3">
                  <Settings className="w-6 h-6 text-blue-300 mt-0.5" />
                  <div>
                    <h3 className="font-medium text-blue-200 mb-3">Configuration Options</h3>
                    <div className="space-y-3">
                      <div className="bg-sportsBar-800/30 rounded-lg p-4">
                        <h4 className="font-medium text-white mb-2">📺 TV Providers</h4>
                        <p className="text-sm text-slate-300 mb-3">
                          Configure your cable, satellite, and streaming providers with channel lineups
                        </p>
                        <Link 
                          href="/sports-guide-config"
                          className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                        >
                          <Settings className="w-4 h-4" />
                          <span>Manage Providers</span>
                        </Link>
                      </div>

                      <div className="bg-sportsBar-800/30 rounded-lg p-4">
                        <h4 className="font-medium text-white mb-2">📍 Location & Timezone</h4>
                        <p className="text-sm text-slate-300 mb-3">
                          Set your location for accurate local programming and game times
                        </p>
                        <Link 
                          href="/sports-guide-config"
                          className="inline-flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm"
                        >
                          <Settings className="w-4 h-4" />
                          <span>Set Location</span>
                        </Link>
                      </div>

                      <div className="bg-sportsBar-800/30 rounded-lg p-4">
                        <h4 className="font-medium text-white mb-2">⭐ Favorite Teams</h4>
                        <p className="text-sm text-slate-300 mb-3">
                          Select your home teams to prioritize their games in the guide
                        </p>
                        <Link 
                          href="/sports-guide-config"
                          className="inline-flex items-center space-x-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm"
                        >
                          <Settings className="w-4 h-4" />
                          <span>Manage Teams</span>
                        </Link>
                      </div>

                      <div className="bg-sportsBar-800/30 rounded-lg p-4">
                        <h4 className="font-medium text-white mb-2">🏆 Sports Leagues</h4>
                        <p className="text-sm text-slate-300 mb-3">
                          Choose which sports and leagues to track (NFL, NBA, NASCAR, etc.)
                        </p>
                        <Link 
                          href="/sports-guide-config"
                          className="inline-flex items-center space-x-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors text-sm"
                        >
                          <Settings className="w-4 h-4" />
                          <span>Select Leagues</span>
                        </Link>
                      </div>
                    </div>

                    <div className="mt-6 pt-4 border-t border-blue-500/30">
                      <Link 
                        href="/sports-guide-config"
                        className="inline-flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 transition-colors font-medium"
                      >
                        <Settings className="w-5 h-5" />
                        <span>Open Full Configuration Panel</span>
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </SportsBarLayout>
  )
}
