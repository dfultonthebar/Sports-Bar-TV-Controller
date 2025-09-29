'use client'

import { useState, useEffect } from 'react'
import DocumentUpload from '../components/DocumentUpload'
import TroubleshootingChat from '../components/TroubleshootingChat'
import EnhancedAIChat from '../components/EnhancedAIChat'
import AIInsightsDashboard from '../components/AIInsightsDashboard'
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
import AtlasProgrammingInterface from '../components/AtlasProgrammingInterface'
import CECPowerControl from '../components/CECPowerControl'
import SportsGuide from '../components/SportsGuide'
import DirecTVController from '../components/DirecTVController'
import { 
  FileText, 
  MessageCircle, 
  Wrench, 
  Grid, 
  Key, 
  Zap, 
  GitBranch, 
  HardDrive, 
  Users, 
  Radio, 
  Smartphone, 
  Volume2, 
  Speaker, 
  Settings, 
  MonitorPlay,
  Wifi,
  Activity,
  Clock,
  Shield,
  BarChart3,
  Calendar,
  Tv,
  Power,
  Satellite
} from 'lucide-react'

const tabCategories = {
  quick: {
    title: 'Quick Access',
    icon: Zap,
    color: 'bg-emerald-500/10 border-emerald-500/30 hover:bg-emerald-500/20',
    priority: true,
    tabs: [
      { id: 'bartender-remote', name: 'Remote Control', icon: Smartphone, description: 'Instant TV and audio control', color: 'text-emerald-600' },
      { id: 'audio-zones', name: 'Live Audio', icon: Volume2, description: 'Real-time audio monitoring', color: 'text-emerald-600' },
    ]
  },
  control: {
    title: 'AV Control',
    icon: MonitorPlay,
    color: 'bg-blue-500/10 border-blue-500/30 hover:bg-blue-500/20',
    priority: false,
    tabs: [
      { id: 'directv-control', name: 'DirecTV IP Control', icon: Satellite, description: 'Direct IP control of DirecTV receivers', color: 'text-blue-600' },
      { id: 'matrix-control', name: 'Video Matrix', icon: Grid, description: 'Video routing & switching', color: 'text-blue-600' },
      { id: 'cec-power', name: 'CEC Power', icon: Power, description: 'TV power control via CEC', color: 'text-blue-600' },
      { id: 'audio-processors', name: 'Audio Systems', icon: Speaker, description: 'AtlasIED processor management', color: 'text-blue-600' },
      { id: 'atlas-programming', name: 'Atlas Programming', icon: Settings, description: 'Comprehensive Atlas I/O programming', color: 'text-blue-600' },
      { id: 'ir-control', name: 'IR Control', icon: Radio, description: 'Infrared device management', color: 'text-blue-600' },
    ]
  },
  setup: {
    title: 'Configuration',
    icon: Settings,
    color: 'bg-indigo-500/10 border-indigo-500/30 hover:bg-indigo-500/20',
    priority: false,
    tabs: [
      { id: 'bartender', name: 'Staff Interface', icon: Users, description: 'Bartender setup & layout config', color: 'text-indigo-600' },
      { id: 'document-upload', name: 'Documentation', icon: FileText, description: 'System manuals & guides', color: 'text-indigo-600' },
    ]
  },
  content: {
    title: 'Sports & Entertainment',
    icon: Calendar,
    color: 'bg-orange-500/10 border-orange-500/30 hover:bg-orange-500/20',
    priority: false,
    tabs: [
      { id: 'sports-guide', name: 'Sports Guide', icon: Tv, description: 'Find where to watch sports', color: 'text-orange-600' },
    ]
  },
  support: {
    title: 'AI Support',
    icon: MessageCircle,
    color: 'bg-purple-500/10 border-purple-500/30 hover:bg-purple-500/20',
    priority: false,
    tabs: [
      { id: 'ai-chat', name: 'AI Assistant', icon: MessageCircle, description: 'Troubleshooting & guidance', color: 'text-purple-600' },
      { id: 'enhanced-ai', name: 'Advanced AI', icon: Zap, description: 'Enhanced analysis tools', color: 'text-purple-600' },
      { id: 'ai-insights', name: 'Log Analysis', icon: BarChart3, description: 'AI-powered operation insights', color: 'text-purple-600' },
    ]
  },
  admin: {
    title: 'Administration',
    icon: Shield,
    color: 'bg-slate-500/10 border-slate-500/30 hover:bg-slate-500/20',
    priority: false,
    tabs: [
      { id: 'api-keys', name: 'API Management', icon: Key, description: 'External service credentials', color: 'text-slate-600' },
      { id: 'github-sync', name: 'Version Control', icon: GitBranch, description: 'Code & configuration sync', color: 'text-slate-600' },
      { id: 'file-system', name: 'File Manager', icon: HardDrive, description: 'System files & storage', color: 'text-slate-600' },
      { id: 'system-enhancement', name: 'System Tools', icon: Wrench, description: 'Maintenance & optimization', color: 'text-slate-600' },
    ]
  }
}

export default function Home() {
  const [activeTab, setActiveTab] = useState('bartender-remote')
  const [currentTime, setCurrentTime] = useState('')
  const [systemStatus, setSystemStatus] = useState({
    online: true,
    connections: 3,
    lastUpdate: 'Just now'
  })

  useEffect(() => {
    const updateTime = () => {
      const now = new Date()
      setCurrentTime(now.toLocaleTimeString('en-US', { 
        hour12: true, 
        hour: 'numeric', 
        minute: '2-digit'
      }))
    }
    
    updateTime()
    const interval = setInterval(updateTime, 1000)
    return () => clearInterval(interval)
  }, [])

  const getActiveTabInfo = () => {
    for (const category of Object.values(tabCategories)) {
      const tab = category.tabs.find(t => t.id === activeTab)
      if (tab) return { tab, category }
    }
    return null
  }

  const activeTabInfo = getActiveTabInfo()

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      
      {/* Header */}
      <header className="bg-white/90 backdrop-blur-sm border-b border-slate-200/50 sticky top-0 z-50">
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
            
            <div className="flex items-center space-x-6">
              {/* System Status */}
              <div className="flex items-center space-x-3">
                <div className="flex items-center space-x-2 text-sm">
                  <div className={`w-2 h-2 rounded-full ${systemStatus.online ? 'bg-green-500' : 'bg-red-500'}`}></div>
                  <span className="text-slate-600">
                    {systemStatus.online ? 'Online' : 'Offline'}
                  </span>
                </div>
                
                <div className="flex items-center space-x-1 text-sm text-slate-500">
                  <Wifi className="w-4 h-4" />
                  <span>{systemStatus.connections} devices</span>
                </div>
                
                <div className="flex items-center space-x-1 text-sm text-slate-500">
                  <Clock className="w-4 h-4" />
                  <span>{currentTime}</span>
                </div>
              </div>
              
              {/* Quick Actions */}
              <div className="flex items-center space-x-2">
                <a 
                  href="/sports-guide" 
                  className="inline-flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-orange-500 to-red-600 text-white rounded-lg hover:from-orange-600 hover:to-red-700 transition-all duration-200 shadow-md hover:shadow-lg text-sm font-medium"
                >
                  <Calendar className="w-4 h-4" />
                  <span>Sports Guide</span>
                </a>
                <a 
                  href="/remote" 
                  className="inline-flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-emerald-500 to-green-600 text-white rounded-lg hover:from-emerald-600 hover:to-green-700 transition-all duration-200 shadow-md hover:shadow-lg text-sm font-medium"
                >
                  <Smartphone className="w-4 h-4" />
                  <span>Quick Remote</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Category Navigation */}
        <div className="mb-8">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {Object.entries(tabCategories).map(([categoryId, category]) => (
              <div key={categoryId} className={`relative group`}>
                <div className={`
                  border-2 rounded-2xl p-6 transition-all duration-200 cursor-pointer
                  ${category.color}
                  ${category.priority ? 'ring-2 ring-emerald-200' : ''}
                  transform group-hover:scale-105 group-hover:shadow-lg
                `}>
                  <div className="text-center">
                    <category.icon className="w-8 h-8 mx-auto mb-3 text-slate-700" />
                    <h3 className="font-semibold text-slate-900 text-sm mb-1">{category.title}</h3>
                    <p className="text-xs text-slate-600">{category.tabs.length} tools</p>
                  </div>
                  
                  {/* Priority badge */}
                  {category.priority && (
                    <div className="absolute -top-2 -right-2 bg-emerald-500 text-white text-xs px-2 py-1 rounded-full font-medium shadow-lg">
                      Quick
                    </div>
                  )}
                </div>
                
                {/* Module List */}
                <div className="absolute top-full left-0 right-0 bg-white rounded-lg shadow-xl border border-slate-200 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10 mt-2">
                  <div className="p-4 space-y-2">
                    {category.tabs.map((tab) => (
                      <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`w-full text-left p-3 rounded-lg hover:bg-slate-50 transition-colors border border-transparent ${
                          activeTab === tab.id ? 'bg-blue-50 border-blue-200' : ''
                        }`}
                      >
                        <div className="flex items-center space-x-3">
                          <tab.icon className={`w-4 h-4 ${tab.color || 'text-slate-600'}`} />
                          <div>
                            <div className={`text-sm font-medium ${
                              activeTab === tab.id ? 'text-blue-700' : 'text-slate-700'
                            }`}>
                              {tab.name}
                            </div>
                            <div className="text-xs text-slate-500">
                              {tab.description}
                            </div>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Active Module Display */}
        {activeTabInfo && (
          <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
            {/* Module Header */}
            <div className="bg-gradient-to-r from-slate-50 to-blue-50 px-6 py-4 border-b border-slate-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className={`p-2 rounded-lg bg-white shadow-sm`}>
                    <activeTabInfo.tab.icon className={`w-6 h-6 ${activeTabInfo.tab.color || 'text-slate-600'}`} />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">{activeTabInfo.tab.name}</h2>
                    <p className="text-sm text-slate-600">{activeTabInfo.tab.description}</p>
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  <div className="text-xs text-slate-500 px-3 py-1 bg-white rounded-full border">
                    {activeTabInfo.category.title}
                  </div>
                  <div className="flex items-center space-x-1">
                    <Activity className="w-4 h-4 text-green-500" />
                    <span className="text-sm text-slate-600">Active</span>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Module Content */}
            <div className="p-6">
              {activeTab === 'bartender-remote' && <BartenderRemoteControl />}
              {activeTab === 'audio-zones' && <AudioZoneControl />}
              {activeTab === 'bartender' && <BartenderInterface />}
              {activeTab === 'directv-control' && <DirecTVController />}
              {activeTab === 'ir-control' && <IRDeviceControl />}
              {activeTab === 'cec-power' && <CECPowerControl />}
              {activeTab === 'document-upload' && <DocumentUpload />}
              {activeTab === 'sports-guide' && <SportsGuide />}
              {activeTab === 'ai-chat' && <TroubleshootingChat />}
              {activeTab === 'enhanced-ai' && <EnhancedAIChat />}
              {activeTab === 'ai-insights' && <AIInsightsDashboard />}
              {activeTab === 'api-keys' && <ApiKeysManager />}
              {activeTab === 'github-sync' && <GitHubSync />}
              {activeTab === 'file-system' && <FileSystemManager />}
              {activeTab === 'matrix-control' && <MatrixControl />}
              {activeTab === 'audio-processors' && <AudioProcessorManager />}
              {activeTab === 'atlas-programming' && <AtlasProgrammingInterface />}
              {activeTab === 'system-enhancement' && <SystemEnhancement />}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
