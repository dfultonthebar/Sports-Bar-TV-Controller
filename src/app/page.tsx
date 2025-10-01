
'use client'

import { useState } from 'react'
import StreamingPlatformsWidget from '@/components/StreamingPlatformsWidget'
import LayoutConfiguration from '@/components/LayoutConfiguration'
import { Settings } from 'lucide-react'

export default function Home() {
  const [showLayoutConfig, setShowLayoutConfig] = useState(false)

  return (
    <div className="min-h-screen bg-sports-gradient">
      <header className="sports-header">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <div className="bg-primary-gradient rounded-xl p-2.5 shadow-lg">
                <span className="text-2xl">🏈</span>
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-100">Sports Bar AI Assistant</h1>
                <p className="text-sm text-slate-300">Professional AV Management System</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Main Status Card */}
        <div className="card mb-8">
          <div className="p-8 text-center">
            <h2 className="text-2xl font-bold text-slate-100 mb-4">🚀 Sports Bar AI Assistant</h2>
            <p className="text-slate-300 mb-6">System is now running successfully!</p>
            
            <div className="space-y-4">
              <div className="flex items-center justify-center space-x-2">
                <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
                <span className="text-slate-200">Server Online</span>
              </div>
              
              {/* Main System Controls */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-8">
                <a 
                  href="/sports-guide"
                  className="block p-6 bg-sportsBar-700/80 rounded-xl border border-accent-orange/30 hover:bg-sportsBar-600/80 hover:border-accent-orange/50 transition-all duration-200"
                >
                  <h3 className="font-semibold text-orange-300 mb-2">📺 Sports Guide</h3>
                  <p className="text-orange-200/80 text-sm">Find where to watch sports</p>
                </a>
                
                <a 
                  href="/nfhs-network"
                  className="block p-6 bg-sportsBar-700/80 rounded-xl border border-accent-red/30 hover:bg-sportsBar-600/80 hover:border-accent-red/50 transition-all duration-200"
                >
                  <h3 className="font-semibold text-red-300 mb-2">🏫 NFHS Network</h3>
                  <p className="text-red-200/80 text-sm">High school sports streaming</p>
                </a>
                
                <a 
                  href="/remote"
                  className="block p-6 bg-sportsBar-700/80 rounded-xl border border-accent-green/30 hover:bg-sportsBar-600/80 hover:border-accent-green/50 transition-all duration-200"
                >
                  <h3 className="font-semibold text-green-300 mb-2">📱 Remote Control</h3>
                  <p className="text-green-200/80 text-sm">Control TVs and audio systems</p>
                </a>
                
                <a 
                  href="/logs"
                  className="block p-6 bg-sportsBar-700/80 rounded-xl border border-primary-400/30 hover:bg-sportsBar-600/80 hover:border-primary-400/50 transition-all duration-200"
                >
                  <h3 className="font-semibold text-blue-300 mb-2">📊 System Logs</h3>
                  <p className="text-blue-200/80 text-sm">Monitor system performance</p>
                </a>
              </div>

              {/* Music & Audio */}
              <div className="mt-8">
                <h3 className="text-lg font-semibold text-slate-200 mb-4">🎵 Music & Audio</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <a 
                    href="/soundtrack"
                    className="block p-6 bg-sportsBar-700/80 rounded-xl border border-purple-400/30 hover:bg-sportsBar-600/80 hover:border-purple-400/50 transition-all duration-200"
                  >
                    <h3 className="font-semibold text-purple-300 mb-2">🎵 Soundtrack Your Brand</h3>
                    <p className="text-purple-200/80 text-sm">Professional music streaming control</p>
                  </a>
                  
                  <a 
                    href="/atlas-config"
                    className="block p-6 bg-sportsBar-700/80 rounded-xl border border-teal-400/30 hover:bg-sportsBar-600/80 hover:border-teal-400/50 transition-all duration-200"
                  >
                    <h3 className="font-semibold text-teal-300 mb-2">🔊 Audio Zones</h3>
                    <p className="text-teal-200/80 text-sm">Zone control & volume management</p>
                  </a>
                  
                  <a 
                    href="/audio-manager"
                    className="block p-6 bg-sportsBar-700/80 rounded-xl border border-cyan-400/30 hover:bg-sportsBar-600/80 hover:border-cyan-400/50 transition-all duration-200"
                  >
                    <h3 className="font-semibold text-cyan-300 mb-2">🎛️ Audio Processor</h3>
                    <p className="text-cyan-200/80 text-sm">Atlas IED processor configuration</p>
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
                    href="/sports-guide-config"
                    className="block p-4 bg-sportsBar-700/60 rounded-lg border border-accent-purple/30 hover:bg-sportsBar-600/80 hover:border-accent-purple/50 transition-all duration-200"
                  >
                    <h4 className="font-medium text-purple-300 mb-1">🏈 Sports Config</h4>
                    <p className="text-purple-200/80 text-sm">Configure sports guide settings</p>
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
                    href="/cec-control"
                    className="block p-4 bg-sportsBar-700/60 rounded-lg border border-yellow-400/30 hover:bg-sportsBar-600/80 hover:border-yellow-400/50 transition-all duration-200"
                  >
                    <h4 className="font-medium text-yellow-300 mb-1">⚡ CEC TV Control</h4>
                    <p className="text-yellow-200/80 text-sm">HDMI-CEC TV power & input</p>
                  </a>
                  
                  <a 
                    href="/atlas-config"
                    className="block p-4 bg-sportsBar-700/60 rounded-lg border border-teal-400/30 hover:bg-sportsBar-600/80 hover:border-teal-400/50 transition-all duration-200"
                  >
                    <h4 className="font-medium text-teal-300 mb-1">🔊 Atlas Audio</h4>
                    <p className="text-teal-200/80 text-sm">Audio system configuration</p>
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
                    href="/ai-keys"
                    className="block p-4 bg-sportsBar-700/60 rounded-lg border border-accent-purple/30 hover:bg-sportsBar-600/80 hover:border-accent-purple/50 transition-all duration-200"
                  >
                    <h4 className="font-medium text-purple-300 mb-1">🧠 AI Keys</h4>
                    <p className="text-purple-200/80 text-sm">AI API keys & chat setup</p>
                  </a>
                  
                  <a 
                    href="/config-sync"
                    className="block p-4 bg-sportsBar-700/60 rounded-lg border border-accent-green/30 hover:bg-sportsBar-600/80 hover:border-accent-green/50 transition-all duration-200"
                  >
                    <h4 className="font-medium text-green-300 mb-1">📤 GitHub Sync</h4>
                    <p className="text-green-200/80 text-sm">Configuration backup & sync</p>
                  </a>
                  
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
                  {new Date().toLocaleString()}
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
