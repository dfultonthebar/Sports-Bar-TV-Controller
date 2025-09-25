'use client'

import { useState } from 'react'
import DocumentUpload from '../components/DocumentUpload'
import TroubleshootingChat from '../components/TroubleshootingChat'
import EnhancedAIChat from '../components/EnhancedAIChat'
import SystemEnhancement from '../components/SystemEnhancement'
import ApiKeysManager from '../components/ApiKeysManager'
import SimpleMatrixControl from '../../components/matrix/SimpleMatrixControl'
import { FileText, MessageCircle, Wrench, Grid, Key, Zap } from 'lucide-react'

export default function Home() {
  const [activeTab, setActiveTab] = useState('document-upload')

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
          <p className="text-xl text-blue-200">
            AI-Powered AV System Management & Troubleshooting
          </p>
        </div>

        {/* Main Content */}
        <div className="max-w-6xl mx-auto bg-white/95 backdrop-blur-sm shadow-2xl rounded-lg">
          <div className="p-6">
            <div className="w-full">
              {/* Tab Navigation */}
              <div className="border-b border-gray-200 mb-6">
                <nav className="-mb-px flex space-x-8">
                  {[
                    { id: 'document-upload', name: 'Document Upload', icon: FileText },
                    { id: 'ai-chat', name: 'AI Chat', icon: MessageCircle },
                    { id: 'enhanced-ai', name: 'Enhanced AI', icon: Zap },
                    { id: 'api-keys', name: 'API Keys', icon: Key },
                    { id: 'matrix-control', name: 'Matrix Control', icon: Grid },
                    { id: 'system-enhancement', name: 'System Enhancement', icon: Wrench },
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
                {activeTab === 'document-upload' && <DocumentUpload />}
                {activeTab === 'ai-chat' && <TroubleshootingChat />}
                {activeTab === 'enhanced-ai' && <EnhancedAIChat />}
                {activeTab === 'api-keys' && <ApiKeysManager />}
                {activeTab === 'matrix-control' && <SimpleMatrixControl />}
                {activeTab === 'system-enhancement' && <SystemEnhancement />}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
