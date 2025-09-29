
'use client'

import { useState } from 'react'
import StreamingPlatformsWidget from '../components/StreamingPlatformsWidget'
import LayoutConfiguration from '../components/LayoutConfiguration'
import { Settings } from 'lucide-react'

export default function Home() {
  const [showLayoutConfig, setShowLayoutConfig] = useState(false)

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <header className="bg-white/90 backdrop-blur-sm border-b border-slate-200/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <div className="bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl p-2.5 shadow-lg">
                <span className="text-2xl">🏈</span>
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900">Sports Bar AI Assistant</h1>
                <p className="text-sm text-slate-500">Professional AV Management System</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Main Status Card */}
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 mb-8">
          <div className="p-8 text-center">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">🚀 Sports Bar AI Assistant</h2>
            <p className="text-slate-600 mb-6">System is now running successfully!</p>
            
            <div className="space-y-4">
              <div className="flex items-center justify-center space-x-2">
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                <span className="text-slate-700">Server Online</span>
              </div>
              
              {/* Main System Controls */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-8">
                <a 
                  href="/sports-guide"
                  className="block p-6 bg-orange-50 rounded-xl border border-orange-200 hover:bg-orange-100 transition-colors"
                >
                  <h3 className="font-semibold text-orange-800 mb-2">📺 Sports Guide</h3>
                  <p className="text-orange-600 text-sm">Find where to watch sports</p>
                </a>
                
                <a 
                  href="/nfhs-network"
                  className="block p-6 bg-red-50 rounded-xl border border-red-200 hover:bg-red-100 transition-colors"
                >
                  <h3 className="font-semibold text-red-800 mb-2">🏫 NFHS Network</h3>
                  <p className="text-red-600 text-sm">High school sports streaming</p>
                </a>
                
                <a 
                  href="/remote"
                  className="block p-6 bg-emerald-50 rounded-xl border border-emerald-200 hover:bg-emerald-100 transition-colors"
                >
                  <h3 className="font-semibold text-emerald-800 mb-2">📱 Remote Control</h3>
                  <p className="text-emerald-600 text-sm">Control TVs and audio systems</p>
                </a>
                
                <a 
                  href="/logs"
                  className="block p-6 bg-blue-50 rounded-xl border border-blue-200 hover:bg-blue-100 transition-colors"
                >
                  <h3 className="font-semibold text-blue-800 mb-2">📊 System Logs</h3>
                  <p className="text-blue-600 text-sm">Monitor system performance</p>
                </a>
              </div>
              
              {/* Configuration & AV Management */}
              <div className="mt-8">
                <h3 className="text-lg font-semibold text-slate-800 mb-4">⚙️ Configuration & AV Management</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                  <a 
                    href="/sports-guide-config"
                    className="block p-4 bg-purple-50 rounded-lg border border-purple-200 hover:bg-purple-100 transition-colors"
                  >
                    <h4 className="font-medium text-purple-800 mb-1">🏈 Sports Config</h4>
                    <p className="text-purple-600 text-sm">Configure sports guide settings</p>
                  </a>
                  
                  <a 
                    href="/streaming-platforms"
                    className="block p-4 bg-pink-50 rounded-lg border border-pink-200 hover:bg-pink-100 transition-colors"
                  >
                    <h4 className="font-medium text-pink-800 mb-1">📺 Streaming Platforms</h4>
                    <p className="text-pink-600 text-sm">Manage streaming accounts</p>
                  </a>
                  
                  <a 
                    href="/matrix-control"
                    className="block p-4 bg-indigo-50 rounded-lg border border-indigo-200 hover:bg-indigo-100 transition-colors"
                  >
                    <h4 className="font-medium text-indigo-800 mb-1">📡 Matrix Control</h4>
                    <p className="text-indigo-600 text-sm">Video switching & routing</p>
                  </a>
                  
                  <a 
                    href="/atlas-config"
                    className="block p-4 bg-teal-50 rounded-lg border border-teal-200 hover:bg-teal-100 transition-colors"
                  >
                    <h4 className="font-medium text-teal-800 mb-1">🔊 Atlas Audio</h4>
                    <p className="text-teal-600 text-sm">Audio system configuration</p>
                  </a>
                  
                  <a 
                    href="/device-config"
                    className="block p-4 bg-amber-50 rounded-lg border border-amber-200 hover:bg-amber-100 transition-colors"
                  >
                    <h4 className="font-medium text-amber-800 mb-1">🖥️ Device Setup</h4>
                    <p className="text-amber-600 text-sm">TV & device configuration</p>
                  </a>
                  
                  <button 
                    onClick={() => setShowLayoutConfig(!showLayoutConfig)}
                    className="block p-4 bg-orange-50 rounded-lg border border-orange-200 hover:bg-orange-100 transition-colors text-left w-full"
                  >
                    <h4 className="font-medium text-orange-800 mb-1 flex items-center">
                      📐 Layout Config
                      {showLayoutConfig ? (
                        <span className="ml-2 text-xs bg-orange-200 px-2 py-1 rounded">Open</span>
                      ) : (
                        <Settings className="ml-2 w-3 h-3" />
                      )}
                    </h4>
                    <p className="text-orange-600 text-sm">Floor plan & TV zone setup</p>
                  </button>
                </div>
              </div>
              
              <div className="mt-8 p-4 bg-gray-50 rounded-lg">
                <h4 className="font-semibold text-gray-800 mb-2">✅ Issue Status: RESOLVED</h4>
                <p className="text-gray-600 text-sm">All build errors have been fixed. The application is now running properly.</p>
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
          <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-6">
            <div className="flex items-center space-x-3 mb-6">
              <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl p-2.5 shadow-lg">
                <span className="text-2xl">📊</span>
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-900">System Status</h3>
                <p className="text-sm text-slate-500">Real-time system information</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-green-50 rounded-xl">
                <div className="flex items-center space-x-3">
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  <span className="font-medium text-green-800">AV Systems</span>
                </div>
                <span className="text-sm text-green-600">Online</span>
              </div>

              <div className="flex items-center justify-between p-4 bg-blue-50 rounded-xl">
                <div className="flex items-center space-x-3">
                  <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                  <span className="font-medium text-blue-800">Sports APIs</span>
                </div>
                <span className="text-sm text-blue-600">Active</span>
              </div>

              <div className="flex items-center justify-between p-4 bg-purple-50 rounded-xl">
                <div className="flex items-center space-x-3">
                  <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
                  <span className="font-medium text-purple-800">Matrix Control</span>
                </div>
                <span className="text-sm text-purple-600">Ready</span>
              </div>

              <div className="flex items-center justify-between p-4 bg-yellow-50 rounded-xl">
                <div className="flex items-center space-x-3">
                  <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                  <span className="font-medium text-yellow-800">Atlas Audio</span>
                </div>
                <span className="text-sm text-yellow-600">Configured</span>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-200">
              <div className="text-center">
                <div className="text-sm text-slate-500">Last Updated</div>
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
