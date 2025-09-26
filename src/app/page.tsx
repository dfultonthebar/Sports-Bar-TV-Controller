'use client'

import { useState } from 'react'
import DocumentUpload from '../components/DocumentUpload'
import TroubleshootingChat from '../components/TroubleshootingChat'
import EnhancedAIChat from '../components/EnhancedAIChat'
import SystemEnhancement from '../components/SystemEnhancement'
import ApiKeysManager from '../components/ApiKeysManager'
import GitHubSync from '../components/GitHubSync'
import FileSystemManager from '../components/FileSystemManager'
import MatrixControl from '../components/MatrixControl'
import BartenderInterface from '../components/BartenderInterface'
import IRDeviceControl from '../components/IRDeviceControl'
import BartenderRemoteControl from '../components/BartenderRemoteControl'
import AudioZoneControl from '../components/AudioZoneControl'
import AudioProcessorManager from '../components/AudioProcessorManager'
import { FileText, MessageCircle, Wrench, Grid, Key, Zap, GitBranch, HardDrive, Users, Radio, Smartphone, Volume2, Speaker, Settings, ChevronDown, ChevronRight } from 'lucide-react'

const tabCategories = {
  operations: {
    title: 'Daily Operations',
    icon: Users,
    color: 'bg-green-500/10 border-green-500/20',
    tabs: [
      { id: 'bartender-remote', name: 'Remote Control', icon: Smartphone, description: 'Quick TV and audio control for bartenders' },
      { id: 'audio-zones', name: 'Audio Zones', icon: Volume2, description: 'Live audio zone control and monitoring' },
    ]
  },
  management: {
    title: 'AV System Management',
    icon: Settings,
    color: 'bg-blue-500/10 border-blue-500/20',
    tabs: [
      { id: 'bartender', name: 'Bartender Setup', icon: Users, description: 'Configure bartender interfaces and layouts' },
      { id: 'matrix-control', name: 'Matrix Control', icon: Grid, description: 'Video matrix routing and configuration' },
      { id: 'audio-processors', name: 'Audio Processors', icon: Speaker, description: 'Manage AtlasIED audio processors and zones' },
      { id: 'ir-control', name: 'IR Devices', icon: Radio, description: 'Configure infrared device control' },
    ]
  },
  support: {
    title: 'Documentation & AI Support',
    icon: MessageCircle,
    color: 'bg-purple-500/10 border-purple-500/20',
    tabs: [
      { id: 'document-upload', name: 'Documents', icon: FileText, description: 'Upload and manage AV documentation' },
      { id: 'ai-chat', name: 'AI Assistant', icon: MessageCircle, description: 'Get help with troubleshooting and setup' },
      { id: 'enhanced-ai', name: 'Advanced AI', icon: Zap, description: 'Enhanced AI features and analysis' },
    ]
  },
  admin: {
    title: 'System Administration',
    icon: Wrench,
    color: 'bg-orange-500/10 border-orange-500/20',
    tabs: [
      { id: 'api-keys', name: 'API Keys', icon: Key, description: 'Manage external service API keys' },
      { id: 'github-sync', name: 'GitHub Sync', icon: GitBranch, description: 'Sync with GitHub repository' },
      { id: 'file-system', name: 'File System', icon: HardDrive, description: 'Manage system files and storage' },
      { id: 'system-enhancement', name: 'System Tools', icon: Wrench, description: 'System maintenance and enhancements' },
    ]
  }
}

export default function Home() {
  const [activeTab, setActiveTab] = useState('bartender-remote')
  const [activeCategory, setActiveCategory] = useState('operations')
  const [expandedCategories, setExpandedCategories] = useState<string[]>(['operations', 'management'])

  const toggleCategory = (categoryId: string) => {
    if (expandedCategories.includes(categoryId)) {
      setExpandedCategories(expandedCategories.filter(id => id !== categoryId))
    } else {
      setExpandedCategories([...expandedCategories, categoryId])
    }
  }

  const handleTabSelect = (tabId: string, categoryId: string) => {
    setActiveTab(tabId)
    setActiveCategory(categoryId)
    // Auto-expand the category if it's not already
    if (!expandedCategories.includes(categoryId)) {
      setExpandedCategories([...expandedCategories, categoryId])
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <div className="bg-white/10 backdrop-blur-sm rounded-full p-4 shadow-xl">
              <span className="text-4xl">🏈</span>
            </div>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-2">
            Sports Bar AI Assistant
          </h1>
          <p className="text-xl text-blue-200 mb-6">
            Professional AV System Management & Control
          </p>
          <div className="flex justify-center space-x-4">
            <a 
              href="/remote" 
              className="inline-flex items-center space-x-2 px-6 py-3 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-xl hover:bg-emerald-500/30 transition-all duration-200 shadow-lg hover:shadow-xl"
            >
              <Smartphone className="w-5 h-5" />
              <span>Quick Remote</span>
            </a>
            <button
              onClick={() => setActiveTab('bartender-remote')}
              className="inline-flex items-center space-x-2 px-6 py-3 bg-blue-500/20 text-blue-300 border border-blue-500/30 rounded-xl hover:bg-blue-500/30 transition-all duration-200 shadow-lg hover:shadow-xl"
            >
              <Settings className="w-5 h-5" />
              <span>Full Management</span>
            </button>
          </div>
        </div>

        {/* Main Content */}
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            
            {/* Sidebar Navigation */}
            <div className="lg:col-span-1">
              <div className="bg-white/95 backdrop-blur-sm shadow-2xl rounded-2xl overflow-hidden sticky top-4">
                <div className="p-6">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">System Modules</h2>
                  <div className="space-y-2">
                    {Object.entries(tabCategories).map(([categoryId, category]) => (
                      <div key={categoryId} className={`border rounded-xl ${category.color} overflow-hidden transition-all duration-200`}>
                        {/* Category Header */}
                        <button
                          onClick={() => toggleCategory(categoryId)}
                          className="w-full flex items-center justify-between p-4 hover:bg-black/5 transition-colors"
                        >
                          <div className="flex items-center space-x-3">
                            <category.icon className="w-5 h-5 text-gray-700" />
                            <span className="font-medium text-gray-900">{category.title}</span>
                          </div>
                          {expandedCategories.includes(categoryId) ? 
                            <ChevronDown className="w-4 h-4 text-gray-500" /> : 
                            <ChevronRight className="w-4 h-4 text-gray-500" />
                          }
                        </button>
                        
                        {/* Category Tabs */}
                        {expandedCategories.includes(categoryId) && (
                          <div className="border-t border-gray-200/50">
                            {category.tabs.map((tab) => (
                              <button
                                key={tab.id}
                                onClick={() => handleTabSelect(tab.id, categoryId)}
                                className={`w-full text-left p-3 pl-6 hover:bg-black/5 transition-colors border-l-3 ${
                                  activeTab === tab.id 
                                    ? 'bg-black/10 border-l-blue-500' 
                                    : 'border-l-transparent'
                                }`}
                              >
                                <div className="flex items-center space-x-3">
                                  <tab.icon className="w-4 h-4 text-gray-600" />
                                  <div>
                                    <div className={`text-sm font-medium ${
                                      activeTab === tab.id ? 'text-blue-700' : 'text-gray-700'
                                    }`}>
                                      {tab.name}
                                    </div>
                                    <div className="text-xs text-gray-500 mt-1">
                                      {tab.description}
                                    </div>
                                  </div>
                                </div>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Main Content Area */}
            <div className="lg:col-span-3">
              <div className="bg-white/95 backdrop-blur-sm shadow-2xl rounded-2xl overflow-hidden">
                <div className="p-8">
                  {/* Active Tab Content */}
                  <div className="space-y-6">
                    {activeTab === 'bartender-remote' && <BartenderRemoteControl />}
                    {activeTab === 'audio-zones' && <AudioZoneControl />}
                    {activeTab === 'bartender' && <BartenderInterface />}
                    {activeTab === 'ir-control' && <IRDeviceControl />}
                    {activeTab === 'document-upload' && <DocumentUpload />}
                    {activeTab === 'ai-chat' && <TroubleshootingChat />}
                    {activeTab === 'enhanced-ai' && <EnhancedAIChat />}
                    {activeTab === 'api-keys' && <ApiKeysManager />}
                    {activeTab === 'github-sync' && <GitHubSync />}
                    {activeTab === 'file-system' && <FileSystemManager />}
                    {activeTab === 'matrix-control' && <MatrixControl />}
                    {activeTab === 'audio-processors' && <AudioProcessorManager />}
                    {activeTab === 'system-enhancement' && <SystemEnhancement />}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
