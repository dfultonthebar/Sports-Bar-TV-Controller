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
import { FileText, MessageCircle, Wrench, Grid, Key, Zap, GitBranch, HardDrive, Users, Radio, Smartphone, Volume2, Speaker } from 'lucide-react'

export default function Home() {
  const [activeTab, setActiveTab] = useState('bartender-remote')

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-purple-900">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <div className="bg-white/10 backdrop-blur-sm rounded-full p-4">
              <span className="text-4xl">🏈</span>
            </div>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-2">
            Sports Bar AI Assistant
          </h1>
          <p className="text-xl text-blue-200 mb-4">
            AI-Powered AV System Management & Troubleshooting
          </p>
          <div className="flex justify-center space-x-4">
            <a 
              href="/remote" 
              className="inline-flex items-center space-x-2 px-4 py-2 bg-green-500/20 text-green-300 border border-green-500/30 rounded-lg hover:bg-green-500/30 transition-all"
            >
              <Smartphone className="w-4 h-4" />
              <span>Bartender Remote</span>
            </a>
            <button
              onClick={() => setActiveTab('bartender-remote')}
              className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-500/20 text-blue-300 border border-blue-500/30 rounded-lg hover:bg-blue-500/30 transition-all"
            >
              <Users className="w-4 h-4" />
              <span>Management Panel</span>
            </button>
          </div>
        </div>

        {/* Main Content */}
        <div className="max-w-6xl mx-auto bg-white/95 backdrop-blur-sm shadow-2xl rounded-lg">
          <div className="p-6">
            <div className="w-full">
              {/* Tab Navigation */}
              <div className="border-b border-gray-200 mb-6">
                <nav className="-mb-px flex space-x-8">
                  {[
                    // Bartender Operations
                    { id: 'bartender-remote', name: 'Remote Control', icon: Smartphone, section: 'operations' },
                    { id: 'audio-zones', name: 'Audio Control', icon: Volume2, section: 'operations' },
                    { id: 'bartender', name: 'Bartender Mgmt', icon: Users, section: 'management' },
                    
                    // System Management
                    { id: 'ir-control', name: 'IR Device Setup', icon: Radio, section: 'management' },
                    { id: 'matrix-control', name: 'Matrix Control', icon: Grid, section: 'management' },
                    { id: 'audio-processors', name: 'Audio Processors', icon: Speaker, section: 'management' },
                    
                    // Documentation & Support
                    { id: 'document-upload', name: 'Document Upload', icon: FileText, section: 'support' },
                    { id: 'ai-chat', name: 'AI Chat', icon: MessageCircle, section: 'support' },
                    { id: 'enhanced-ai', name: 'Enhanced AI', icon: Zap, section: 'support' },
                    
                    // System Administration
                    { id: 'api-keys', name: 'API Keys', icon: Key, section: 'admin' },
                    { id: 'github-sync', name: 'GitHub Sync', icon: GitBranch, section: 'admin' },
                    { id: 'file-system', name: 'File System', icon: HardDrive, section: 'admin' },
                    { id: 'system-enhancement', name: 'System Enhancement', icon: Wrench, section: 'admin' },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${
                        activeTab === tab.id
                          ? 'border-blue-500 text-blue-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      <tab.icon className="w-4 h-4" />
                      <span className="hidden sm:inline">{tab.name}</span>
                    </button>
                  ))}
                </nav>
              </div>

              {/* Tab Content */}
              <div className="mt-6">
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
  )
}
