
'use client'

import { useState, useEffect } from 'react'
import { RefreshCw, Database, FileCode, CheckCircle, AlertCircle, Loader2 } from 'lucide-react'

interface IndexStats {
  totalFiles: number
  indexed: number
  updated: number
  skipped: number
  deactivated: number
}

interface CodebaseStats {
  totalFiles: number
  totalSize: number
  filesByType: Array<{ type: string; count: number }>
  lastIndexed?: string
}

export default function AIAssistantPage() {
  const [isIndexing, setIsIndexing] = useState(false)
  const [indexProgress, setIndexProgress] = useState<IndexStats | null>(null)
  const [codebaseStats, setCodebaseStats] = useState<CodebaseStats | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [chatMessage, setChatMessage] = useState('')
  const [chatHistory, setChatHistory] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([])
  const [isChatting, setIsChatting] = useState(false)

  useEffect(() => {
    loadCodebaseStats()
  }, [])

  const loadCodebaseStats = async () => {
    try {
      const response = await fetch('/api/ai-assistant/index-codebase')
      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          setCodebaseStats(data.stats)
        }
      }
    } catch (error) {
      console.error('Error loading codebase stats:', error)
    }
  }

  const handleIndexCodebase = async () => {
    setIsIndexing(true)
    setMessage(null)
    setIndexProgress(null)

    try {
      const response = await fetch('/api/ai-assistant/index-codebase', {
        method: 'POST'
      })

      const data = await response.json()

      if (data.success) {
        setIndexProgress(data.stats)
        setMessage({
          type: 'success',
          text: `Successfully indexed ${data.stats.indexed} new files, updated ${data.stats.updated} files`
        })
        await loadCodebaseStats()
      } else {
        setMessage({
          type: 'error',
          text: data.error || 'Failed to index codebase'
        })
      }
    } catch (error) {
      setMessage({
        type: 'error',
        text: 'Error indexing codebase: ' + (error instanceof Error ? error.message : 'Unknown error')
      })
    } finally {
      setIsIndexing(false)
    }
  }

  const handleSendMessage = async () => {
    if (!chatMessage.trim() || isChatting) return

    const userMessage = chatMessage.trim()
    setChatMessage('')
    setChatHistory(prev => [...prev, { role: 'user', content: userMessage }])
    setIsChatting(true)

    try {
      const response = await fetch('/api/ai/enhanced-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage,
          useKnowledge: true,
          useCodebase: true
        })
      })

      const data = await response.json()

      if (data.response) {
        setChatHistory(prev => [...prev, { role: 'assistant', content: data.response }])
      } else {
        setChatHistory(prev => [...prev, { 
          role: 'assistant', 
          content: 'Sorry, I encountered an error processing your request.' 
        }])
      }
    } catch (error) {
      setChatHistory(prev => [...prev, { 
        role: 'assistant', 
        content: 'Error: ' + (error instanceof Error ? error.message : 'Unknown error')
      }])
    } finally {
      setIsChatting(false)
    }
  }

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
  }

  return (
    <div className="min-h-screen bg-sports-gradient">
      <header className="sports-header">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <div className="bg-primary-gradient rounded-xl p-2.5 shadow-lg">
                <span className="text-2xl">🤖</span>
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-100">AI Assistant</h1>
                <p className="text-sm text-slate-300">Codebase-Aware Troubleshooting</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Codebase Index Status */}
        <div className="card mb-8">
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-3">
                <Database className="w-6 h-6 text-blue-400" />
                <h2 className="text-xl font-bold text-slate-100">Codebase Index</h2>
              </div>
              <button
                onClick={handleIndexCodebase}
                disabled={isIndexing}
                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white rounded-lg transition-colors"
              >
                {isIndexing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Indexing...</span>
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4" />
                    <span>Sync Codebase</span>
                  </>
                )}
              </button>
            </div>

            {/* Status Message */}
            {message && (
              <div className={`mb-4 p-4 rounded-lg flex items-center space-x-2 ${
                message.type === 'success' 
                  ? 'bg-green-900/30 border border-green-500/50' 
                  : 'bg-red-900/30 border border-red-500/50'
              }`}>
                {message.type === 'success' ? (
                  <CheckCircle className="w-5 h-5 text-green-400" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-red-400" />
                )}
                <span className={message.type === 'success' ? 'text-green-200' : 'text-red-200'}>
                  {message.text}
                </span>
              </div>
            )}

            {/* Index Progress */}
            {indexProgress && (
              <div className="mb-4 p-4 bg-slate-800/50 rounded-lg">
                <h3 className="text-sm font-semibold text-slate-300 mb-2">Indexing Results:</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <div className="text-2xl font-bold text-green-400">{indexProgress.indexed}</div>
                    <div className="text-xs text-slate-400">New Files</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-blue-400">{indexProgress.updated}</div>
                    <div className="text-xs text-slate-400">Updated</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-yellow-400">{indexProgress.skipped}</div>
                    <div className="text-xs text-slate-400">Unchanged</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-gray-400">{indexProgress.deactivated}</div>
                    <div className="text-xs text-slate-400">Removed</div>
                  </div>
                </div>
              </div>
            )}

            {/* Codebase Stats */}
            {codebaseStats && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 bg-slate-800/50 rounded-lg">
                  <div className="flex items-center space-x-2 mb-2">
                    <FileCode className="w-5 h-5 text-blue-400" />
                    <span className="text-sm text-slate-300">Total Files</span>
                  </div>
                  <div className="text-2xl font-bold text-slate-100">{codebaseStats.totalFiles}</div>
                </div>
                
                <div className="p-4 bg-slate-800/50 rounded-lg">
                  <div className="flex items-center space-x-2 mb-2">
                    <Database className="w-5 h-5 text-purple-400" />
                    <span className="text-sm text-slate-300">Total Size</span>
                  </div>
                  <div className="text-2xl font-bold text-slate-100">{formatBytes(codebaseStats.totalSize)}</div>
                </div>
                
                <div className="p-4 bg-slate-800/50 rounded-lg">
                  <div className="flex items-center space-x-2 mb-2">
                    <CheckCircle className="w-5 h-5 text-green-400" />
                    <span className="text-sm text-slate-300">Last Indexed</span>
                  </div>
                  <div className="text-sm text-slate-100">
                    {codebaseStats.lastIndexed 
                      ? new Date(codebaseStats.lastIndexed).toLocaleString()
                      : 'Never'
                    }
                  </div>
                </div>
              </div>
            )}

            {/* File Types Breakdown */}
            {codebaseStats && codebaseStats.filesByType.length > 0 && (
              <div className="mt-4 p-4 bg-slate-800/50 rounded-lg">
                <h3 className="text-sm font-semibold text-slate-300 mb-3">Files by Type:</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {codebaseStats.filesByType.map(ft => (
                    <div key={ft.type} className="flex items-center justify-between p-2 bg-slate-700/50 rounded">
                      <span className="text-xs text-slate-300">{ft.type}</span>
                      <span className="text-sm font-bold text-slate-100">{ft.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* AI Chat Interface */}
        <div className="card">
          <div className="p-6">
            <h2 className="text-xl font-bold text-slate-100 mb-4">Ask About Your Codebase</h2>
            
            {/* Chat History */}
            <div className="mb-4 h-96 overflow-y-auto bg-slate-800/50 rounded-lg p-4 space-y-4">
              {chatHistory.length === 0 ? (
                <div className="text-center text-slate-400 py-8">
                  <p>Ask me anything about your codebase!</p>
                  <p className="text-sm mt-2">I have access to all your source files and can help with troubleshooting.</p>
                </div>
              ) : (
                chatHistory.map((msg, idx) => (
                  <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-3xl p-3 rounded-lg ${
                      msg.role === 'user' 
                        ? 'bg-blue-600 text-white' 
                        : 'bg-slate-700 text-slate-100'
                    }`}>
                      <div className="text-sm whitespace-pre-wrap">{msg.content}</div>
                    </div>
                  </div>
                ))
              )}
              {isChatting && (
                <div className="flex justify-start">
                  <div className="bg-slate-700 text-slate-100 p-3 rounded-lg">
                    <Loader2 className="w-5 h-5 animate-spin" />
                  </div>
                </div>
              )}
            </div>

            {/* Chat Input */}
            <div className="flex space-x-2">
              <input
                type="text"
                value={chatMessage}
                onChange={(e) => setChatMessage(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                placeholder="Ask about your code, troubleshoot issues, or request help..."
                className="flex-1 px-4 py-2 bg-slate-800 border border-slate-600 rounded-lg text-slate-100 placeholder-slate-400 focus:outline-none focus:border-blue-500"
                disabled={isChatting}
              />
              <button
                onClick={handleSendMessage}
                disabled={isChatting || !chatMessage.trim()}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white rounded-lg transition-colors"
              >
                Send
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
