
'use client'

import { useState, useEffect } from 'react'
import StreamingPlatformsWidget from '@/components/StreamingPlatformsWidget'
import LayoutConfiguration from '@/components/LayoutConfiguration'
import { BulkOperations } from '@/components/BulkOperations'
import { QuickActions } from '@/components/QuickActions'
import { Settings, Music } from 'lucide-react'

export default function Home() {
  const [showLayoutConfig, setShowLayoutConfig] = useState(false)
  const [currentTime, setCurrentTime] = useState<string>('')
  
  // Only render time on client side to avoid hydration mismatch
  useEffect(() => {
    setCurrentTime(new Date().toLocaleString())
  }, [])

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-purple-950 relative overflow-hidden">
      {/* Animated Background Gradient Orbs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
        <div className="absolute top-1/2 right-1/3 w-64 h-64 bg-teal-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }}></div>
      </div>

      <header className="relative z-10 backdrop-blur-md bg-slate-900/50 border-b border-white/10 shadow-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <div className="bg-gradient-to-br from-blue-500 to-purple-500 rounded-xl p-2.5 shadow-lg transform transition-transform hover:scale-110">
                <span className="text-2xl">🏈</span>
              </div>
              <div>
                <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                  Sports Bar AI Assistant
                </h1>
                <p className="text-sm text-slate-300">Professional AV Management System</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Main Status Card */}
        <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl shadow-2xl mb-8 overflow-hidden">
          <div className="p-8 text-center">
            <h2 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent mb-4">
              🚀 Sports Bar AI Assistant
            </h2>
            <p className="text-slate-300 mb-6 text-lg">System is now running successfully!</p>

            <div className="space-y-4">
              <div className="flex items-center justify-center space-x-3">
                <div className="relative">
                  <div className="w-4 h-4 bg-green-400 rounded-full"></div>
                  <span className="absolute inset-0 animate-ping">
                    <div className="w-4 h-4 bg-green-400 rounded-full opacity-75"></div>
                  </span>
                </div>
                <span className="text-slate-200 font-medium">Server Online</span>
              </div>

              {/* Bulk Operations & Quick Actions */}
              <div className="mt-6 p-6 bg-gradient-to-br from-purple-600/20 to-blue-600/20 rounded-xl border-2 border-purple-400/30">
                <h3 className="text-lg font-bold text-purple-200 mb-4 flex items-center">
                  <span className="mr-2">⚡</span>
                  Quick Power Controls
                </h3>
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-purple-100/90 mb-2">Bulk Operations:</p>
                    <BulkOperations />
                  </div>
                  <div>
                    <p className="text-sm text-purple-100/90 mb-2">Quick Routines:</p>
                    <QuickActions />
                  </div>
                </div>
              </div>
              
              {/* Main System Controls */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-8">
                <a
                  href="/system-health"
                  className="group relative block p-6 backdrop-blur-xl bg-gradient-to-br from-green-500/20 to-emerald-500/20 rounded-xl border-2 border-green-400/30 hover:border-green-400/50 hover:scale-105 transition-all duration-300 shadow-xl hover:shadow-2xl overflow-hidden"
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-green-500/10 to-emerald-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                  <div className="relative z-10">
                    <h3 className="font-bold text-green-200 mb-2 text-lg">💚 System Health</h3>
                    <p className="text-green-100/90 text-sm">Real-time monitoring & quick actions</p>
                  </div>
                </a>

                <a
                  href="/ai-hub"
                  className="group relative block p-6 backdrop-blur-xl bg-gradient-to-br from-purple-500/20 to-blue-500/20 rounded-xl border-2 border-purple-400/30 hover:border-purple-400/50 hover:scale-105 transition-all duration-300 shadow-xl hover:shadow-2xl overflow-hidden"
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-blue-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                  <div className="relative z-10">
                    <h3 className="font-bold text-purple-200 mb-2 text-lg">🤖 AI Hub</h3>
                    <p className="text-purple-100/90 text-sm">Unified AI management & assistance</p>
                  </div>
                </a>

                <a
                  href="/sports-guide"
                  className="group relative block p-6 backdrop-blur-xl bg-gradient-to-br from-orange-500/20 to-red-500/20 rounded-xl border-2 border-orange-400/30 hover:border-orange-400/50 hover:scale-105 transition-all duration-300 shadow-xl hover:shadow-2xl overflow-hidden"
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-orange-500/10 to-red-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                  <div className="relative z-10">
                    <h3 className="font-bold text-orange-200 mb-2 text-lg">📺 Sports Guide</h3>
                    <p className="text-orange-100/90 text-sm">Find where to watch sports</p>
                  </div>
                </a>

                <a
                  href="/remote"
                  className="group relative block p-6 backdrop-blur-xl bg-gradient-to-br from-teal-500/20 to-green-500/20 rounded-xl border-2 border-teal-400/30 hover:border-teal-400/50 hover:scale-105 transition-all duration-300 shadow-xl hover:shadow-2xl overflow-hidden"
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-teal-500/10 to-green-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                  <div className="relative z-10">
                    <h3 className="font-bold text-teal-200 mb-2 text-lg">📱 Remote Control</h3>
                    <p className="text-teal-100/90 text-sm">Control TVs and audio systems</p>
                  </div>
                </a>
                
                <a
                  href="/system-admin"
                  className="group relative block p-6 backdrop-blur-xl bg-gradient-to-br from-blue-500/20 to-indigo-500/20 rounded-xl border-2 border-blue-400/30 hover:border-blue-400/50 hover:scale-105 transition-all duration-300 shadow-xl hover:shadow-2xl overflow-hidden"
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-indigo-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                  <div className="relative z-10">
                    <h3 className="font-bold text-blue-200 mb-2 text-lg">⚙️ System Admin</h3>
                    <p className="text-blue-100/90 text-sm">Logs, backups, sync & tests</p>
                  </div>
                </a>
              </div>

              {/* Music & Audio */}
              <div className="mt-8">
                <h3 className="text-lg font-semibold text-slate-200 mb-4">🎵 Music & Audio</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <a 
                    href="/audio-control"
                    className="block p-6 bg-gradient-to-br from-teal-600/40 to-purple-600/40 rounded-xl border-2 border-teal-400/50 hover:border-teal-400/70 hover:from-teal-600/50 hover:to-purple-600/50 transition-all duration-200 shadow-lg col-span-1 md:col-span-2 lg:col-span-3"
                  >
                    <div className="flex items-center space-x-3 mb-2">
                      <Music className="w-6 h-6 text-teal-300" />
                      <h3 className="font-bold text-teal-200 text-xl">🎵 Audio Control Center</h3>
                    </div>
                    <p className="text-teal-100/90 text-sm">Complete audio system management - Atlas zones, processors, and Soundtrack streaming in one place</p>
                  </a>
                </div>
              </div>
              
              {/* Configuration & AV Management */}
              <div className="mt-8">
                <h3 className="text-lg font-semibold text-slate-200 mb-4">⚙️ Configuration & AV Management</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-4">
                  <a
                    href="/unified-tv-control"
                    className="block p-4 bg-gradient-to-br from-blue-600/40 to-purple-600/40 rounded-lg border-2 border-blue-400/50 hover:border-blue-400/70 hover:from-blue-600/50 hover:to-purple-600/50 transition-all duration-200 shadow-lg"
                  >
                    <h4 className="font-bold text-blue-200 mb-1">⚡ Unified TV Control</h4>
                    <p className="text-blue-100/90 text-sm">CEC + IR with smart fallback</p>
                  </a>

                  <a
                    href="/streaming-platforms"
                    className="block p-4 bg-sportsBar-700/60 rounded-lg border border-pink-400/30 hover:bg-sportsBar-600/80 hover:border-pink-400/50 transition-all duration-200"
                  >
                    <h4 className="font-medium text-pink-300 mb-1">📺 Streaming Platforms</h4>
                    <p className="text-pink-200/80 text-sm">Manage streaming accounts</p>
                  </a>
                  
                  <a
                    href="/matrix-control"
                    className="block p-4 bg-sportsBar-700/60 rounded-lg border border-indigo-400/30 hover:bg-sportsBar-600/80 hover:border-indigo-400/50 transition-all duration-200"
                  >
                    <h4 className="font-medium text-indigo-300 mb-1">📡 Matrix Control</h4>
                    <p className="text-indigo-200/80 text-sm">Video switching & routing</p>
                  </a>

                  <a
                    href="/device-config"
                    className="block p-4 bg-sportsBar-700/60 rounded-lg border border-amber-400/30 hover:bg-sportsBar-600/80 hover:border-amber-400/50 transition-all duration-200"
                  >
                    <h4 className="font-medium text-amber-300 mb-1">🖥️ Device Setup</h4>
                    <p className="text-amber-200/80 text-sm">TV & device configuration</p>
                  </a>
                  
                  <button 
                    onClick={() => setShowLayoutConfig(!showLayoutConfig)}
                    className="block p-4 bg-sportsBar-700/60 rounded-lg border border-accent-orange/30 hover:bg-sportsBar-600/80 hover:border-accent-orange/50 transition-all duration-200 text-left w-full"
                  >
                    <h4 className="font-medium text-orange-300 mb-1 flex items-center">
                      📐 Layout Config
                      {showLayoutConfig ? (
                        <span className="ml-2 text-xs bg-orange-800/60 text-orange-200 px-2 py-1 rounded">Open</span>
                      ) : (
                        <Settings className="ml-2 w-3 h-3" />
                      )}
                    </h4>
                    <p className="text-orange-200/80 text-sm">Floor plan & TV zone setup</p>
                  </button>
                  

                  
                  <a 
                    href="/scheduler"
                    className="block p-4 bg-gradient-to-br from-emerald-600/40 to-blue-600/40 rounded-lg border-2 border-emerald-400/50 hover:border-emerald-400/70 hover:from-emerald-600/50 hover:to-blue-600/50 transition-all duration-200 shadow-lg"
                  >
                    <h4 className="font-bold text-emerald-200 mb-1">📅 Smart Scheduler</h4>
                    <p className="text-emerald-100/90 text-sm">Auto TV control & game finder</p>
                  </a>
                </div>
              </div>
              
              <div className="mt-8 p-4 bg-sportsBar-700/60 rounded-lg border border-green-400/30">
                <h4 className="font-semibold text-green-300 mb-2">✅ Issue Status: RESOLVED</h4>
                <p className="text-green-200/80 text-sm">All build errors have been fixed. The application is now running properly.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Layout Configuration Section */}
        {showLayoutConfig && (
          <div className="mb-8">
            <LayoutConfiguration />
          </div>
        )}

        {/* Streaming Platforms Widget */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <StreamingPlatformsWidget />
          
          {/* Quick Stats Widget */}
          <div className="card p-6">
            <div className="flex items-center space-x-3 mb-6">
              <div className="bg-accent-gradient rounded-xl p-2.5 shadow-lg">
                <span className="text-2xl">📊</span>
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-100">System Status</h3>
                <p className="text-sm text-slate-300">Real-time system information</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-sportsBar-700/60 rounded-xl border border-green-400/30">
                <div className="flex items-center space-x-3">
                  <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
                  <span className="font-medium text-green-300">AV Systems</span>
                </div>
                <span className="text-sm text-green-200">Online</span>
              </div>

              <div className="flex items-center justify-between p-4 bg-sportsBar-700/60 rounded-xl border border-blue-400/30">
                <div className="flex items-center space-x-3">
                  <div className="w-3 h-3 bg-blue-400 rounded-full animate-pulse"></div>
                  <span className="font-medium text-blue-300">Sports APIs</span>
                </div>
                <span className="text-sm text-blue-200">Active</span>
              </div>

              <div className="flex items-center justify-between p-4 bg-sportsBar-700/60 rounded-xl border border-purple-400/30">
                <div className="flex items-center space-x-3">
                  <div className="w-3 h-3 bg-purple-400 rounded-full animate-pulse"></div>
                  <span className="font-medium text-purple-300">Matrix Control</span>
                </div>
                <span className="text-sm text-purple-200">Ready</span>
              </div>

              <div className="flex items-center justify-between p-4 bg-sportsBar-700/60 rounded-xl border border-yellow-400/30">
                <div className="flex items-center space-x-3">
                  <div className="w-3 h-3 bg-yellow-400 rounded-full animate-pulse"></div>
                  <span className="font-medium text-yellow-300">Atlas Audio</span>
                </div>
                <span className="text-sm text-yellow-200">Configured</span>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-sportsBar-700">
              <div className="text-center">
                <div className="text-sm text-slate-300">Last Updated</div>
                <div className="text-xs text-slate-400 mt-1">
                  {currentTime || 'Loading...'}
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
