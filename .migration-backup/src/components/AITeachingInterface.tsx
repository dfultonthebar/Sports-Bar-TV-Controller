
'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/cards'
import { Button } from './ui/button'
import { Textarea } from './ui/textarea'
import { Badge } from './ui/badge'
import { 
  Upload, 
  BookOpen, 
  MessageSquare, 
  Brain, 
  CheckCircle, 
  AlertCircle, 
  Loader2,
  FileText,
  Trash2,
  RefreshCw,
  Database,
  Plus,
  X
} from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs'

import { logger } from '@/lib/logger'
interface KnowledgeEntry {
  id: string
  question: string
  answer: string
  category: string
  createdAt: string
}

interface UploadedDocument {
  name: string
  size: number
  uploadedAt: string
  type: string
}

interface KnowledgeStats {
  totalDocuments: number
  totalQAPairs: number
  totalCharacters: number
  lastUpdated: string
}

export default function AITeachingInterface() {
  const [activeTab, setActiveTab] = useState('upload')
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  
  // Upload state
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [uploadedDocs, setUploadedDocs] = useState<UploadedDocument[]>([])
  
  // Q&A state - Initialize with empty array to prevent undefined errors
  const [qaEntries, setQaEntries] = useState<KnowledgeEntry[]>([])
  const [newQuestion, setNewQuestion] = useState('')
  const [newAnswer, setNewAnswer] = useState('')
  const [newCategory, setNewCategory] = useState('general')
  
  // Knowledge base stats
  const [kbStats, setKbStats] = useState<KnowledgeStats | null>(null)
  
  // Test chat state
  const [testQuestion, setTestQuestion] = useState('')
  const [testResponse, setTestResponse] = useState('')
  const [isTesting, setIsTesting] = useState(false)

  useEffect(() => {
    loadKnowledgeStats()
    loadQAEntries()
  }, [])

  const loadKnowledgeStats = async () => {
    try {
      const response = await fetch('/api/ai/knowledge-stats')
      if (response.ok) {
        const data = await response.json()
        setKbStats(data.stats)
      }
    } catch (error) {
      logger.error('Error loading knowledge stats:', error)
    }
  }

  const loadQAEntries = async () => {
    try {
      const response = await fetch('/api/ai/qa-entries')
      if (response.ok) {
        const data = await response.json()
        // Handle both array response and object with entries property
        if (Array.isArray(data)) {
          setQaEntries(data)
        } else if (data.entries && Array.isArray(data.entries)) {
          setQaEntries(data.entries)
        } else {
          logger.warn('Unexpected Q&A entries response format:', data)
          setQaEntries([])
        }
      } else {
        logger.error('Failed to load Q&A entries:', response.status)
        setQaEntries([])
      }
    } catch (error) {
      logger.error('Error loading Q&A entries:', error)
      setQaEntries([])
    }
  }

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (files) {
      setSelectedFiles(Array.from(files))
    }
  }

  const handleUpload = async () => {
    if (selectedFiles.length === 0) return

    setIsLoading(true)
    setMessage(null)

    try {
      const formData = new FormData()
      selectedFiles.forEach(file => {
        formData.append('files', file)
      })

      const response = await fetch('/api/ai/upload-documents', {
        method: 'POST',
        body: formData
      })

      const data = await response.json()

      if (data.success) {
        setMessage({
          type: 'success',
          text: `Successfully uploaded ${data.uploaded} document(s)`
        })
        setSelectedFiles([])
        
        // Rebuild knowledge base
        await rebuildKnowledgeBase()
      } else {
        setMessage({
          type: 'error',
          text: data.error || 'Upload failed'
        })
      }
    } catch (error) {
      setMessage({
        type: 'error',
        text: 'Error uploading documents: ' + (error instanceof Error ? error.message : 'Unknown error')
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleAddQA = async () => {
    if (!newQuestion.trim() || !newAnswer.trim()) return

    setIsLoading(true)
    setMessage(null)

    try {
      const response = await fetch('/api/ai/qa-entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: newQuestion,
          answer: newAnswer,
          category: newCategory
        })
      })

      const data = await response.json()

      if (response.ok && data.id) {
        setMessage({
          type: 'success',
          text: 'Q&A entry added successfully'
        })
        setNewQuestion('')
        setNewAnswer('')
        setNewCategory('general')
        await loadQAEntries()
        await rebuildKnowledgeBase()
      } else {
        setMessage({
          type: 'error',
          text: data.error || 'Failed to add Q&A entry'
        })
      }
    } catch (error) {
      setMessage({
        type: 'error',
        text: 'Error adding Q&A entry: ' + (error instanceof Error ? error.message : 'Unknown error')
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleDeleteQA = async (id: string) => {
    if (!confirm('Are you sure you want to delete this Q&A entry?')) return

    setIsLoading(true)
    try {
      const response = await fetch(`/api/ai/qa-entries?id=${id}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        setMessage({
          type: 'success',
          text: 'Q&A entry deleted'
        })
        await loadQAEntries()
        await rebuildKnowledgeBase()
      } else {
        setMessage({
          type: 'error',
          text: 'Failed to delete Q&A entry'
        })
      }
    } catch (error) {
      setMessage({
        type: 'error',
        text: 'Error deleting Q&A entry'
      })
    } finally {
      setIsLoading(false)
    }
  }

  const rebuildKnowledgeBase = async () => {
    try {
      const response = await fetch('/api/ai/rebuild-knowledge-base', {
        method: 'POST'
      })

      if (response.ok) {
        await loadKnowledgeStats()
      }
    } catch (error) {
      logger.error('Error rebuilding knowledge base:', error)
    }
  }

  const handleTestQuestion = async () => {
    if (!testQuestion.trim() || isTesting) return

    setIsTesting(true)
    setTestResponse('')

    try {
      const response = await fetch('/api/ai/enhanced-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: testQuestion,
          useKnowledge: true,
          useCodebase: false,
          stream: false  // CRITICAL FIX: Explicitly request non-streaming response
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`)
      }

      const data = await response.json()

      if (data.response) {
        setTestResponse(data.response)
      } else if (data.error) {
        setTestResponse(`Error: ${data.error}${data.message ? '\n\n' + data.message : ''}${data.suggestion ? '\n\nSuggestion: ' + data.suggestion : ''}`)
      } else {
        setTestResponse('Error: No response received')
      }
    } catch (error) {
      logger.error('Test question error:', error)
      setTestResponse('Error: ' + (error instanceof Error ? error.message : 'Unknown error'))
    } finally {
      setIsTesting(false)
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
    <div className="space-y-6">
      {/* Quick Link to Q&A Training System */}
      <div className="mb-6">
        <Link href="/ai-hub/qa-training" className="block">
          <div className="card p-6 bg-gradient-to-r from-blue-600/20 to-purple-600/20 border-2 border-blue-500/50 hover:border-blue-400 transition-all cursor-pointer">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="p-3 bg-blue-600/30 rounded-lg">
                  <BookOpen className="w-8 h-8 text-blue-400" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-100 mb-1">Q&A Training System</h3>
                  <p className="text-sm text-slate-300">
                    Manage and organize question-answer pairs for AI training with advanced features
                  </p>
                </div>
              </div>
              <div className="text-blue-400">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </div>
          </div>
        </Link>
      </div>

      {/* Header */}
      <div className="text-center">
        <div className="flex items-center justify-center space-x-3 mb-2">
          <Brain className="w-8 h-8 text-purple-400" />
          <h2 className="text-2xl font-bold text-slate-100">Teach the AI</h2>
        </div>
        <p className="text-slate-300">
          Upload documents and add Q&A pairs to train the AI about your specific system
        </p>
      </div>

      {/* Status Message */}
      {message && (
        <div className={`p-4 rounded-lg flex items-center space-x-2 ${
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

      {/* Knowledge Base Stats */}
      {kbStats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2 mb-2">
                <FileText className="w-5 h-5 text-blue-400" />
                <span className="text-sm text-slate-300">Documents</span>
              </div>
              <div className="text-2xl font-bold text-slate-100">{kbStats.totalDocuments}</div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2 mb-2">
                <MessageSquare className="w-5 h-5 text-green-400" />
                <span className="text-sm text-slate-300">Q&A Pairs</span>
              </div>
              <div className="text-2xl font-bold text-slate-100">{kbStats.totalQAPairs}</div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2 mb-2">
                <Database className="w-5 h-5 text-purple-400" />
                <span className="text-sm text-slate-300">Total Content</span>
              </div>
              <div className="text-2xl font-bold text-slate-100">
                {formatBytes(kbStats.totalCharacters)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2 mb-2">
                <RefreshCw className="w-5 h-5 text-yellow-400" />
                <span className="text-sm text-slate-300">Last Updated</span>
              </div>
              <div className="text-sm text-slate-100">
                {new Date(kbStats.lastUpdated).toLocaleString()}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3 bg-sportsBar-800/50 p-1">
          <TabsTrigger value="upload" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">
            <Upload className="w-4 h-4 mr-2" />
            Upload Documents
          </TabsTrigger>
          <TabsTrigger value="qa" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">
            <BookOpen className="w-4 h-4 mr-2" />
            Q&A Training
          </TabsTrigger>
          <TabsTrigger value="test" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">
            <MessageSquare className="w-4 h-4 mr-2" />
            Test AI
          </TabsTrigger>
        </TabsList>

        {/* Upload Documents Tab */}
        <TabsContent value="upload" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Upload Training Documents</CardTitle>
              <CardDescription>
                Upload PDF, Markdown, or text files to teach the AI about your system
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="border-2 border-dashed border-slate-600 rounded-lg p-8 text-center">
                <Upload className="w-12 h-12 mx-auto mb-4 text-slate-400" />
                <input
                  type="file"
                  multiple
                  accept=".pdf,.md,.txt"
                  onChange={handleFileSelect}
                  className="hidden"
                  id="file-upload"
                />
                <label
                  htmlFor="file-upload"
                  className="cursor-pointer text-blue-400 hover:text-blue-300"
                >
                  Click to select files
                </label>
                <p className="text-sm text-slate-400 mt-2">
                  Supported formats: PDF, Markdown (.md), Text (.txt)
                </p>
              </div>

              {selectedFiles.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-medium text-slate-200">Selected Files:</h4>
                  {selectedFiles.map((file, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg">
                      <div className="flex items-center space-x-2">
                        <FileText className="w-4 h-4 text-blue-400" />
                        <span className="text-sm text-slate-200">{file.name}</span>
                        <span className="text-xs text-slate-400">({formatBytes(file.size)})</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedFiles(files => files.filter((_, i) => i !== index))}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              <Button
                onClick={handleUpload}
                disabled={isLoading || selectedFiles.length === 0}
                className="w-full"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-2" />
                    Upload {selectedFiles.length} File(s)
                  </>
                )}
              </Button>

              <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4">
                <h4 className="font-medium text-blue-200 mb-2">💡 Tips for Best Results:</h4>
                <ul className="text-sm text-blue-100 space-y-1 list-disc list-inside">
                  <li>Upload equipment manuals and technical documentation</li>
                  <li>Include troubleshooting guides and FAQs</li>
                  <li>Add configuration examples and best practices</li>
                  <li>Documents are automatically indexed and searchable</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Q&A Training Tab */}
        <TabsContent value="qa" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Add Q&A Training Pairs</CardTitle>
              <CardDescription>
                Teach the AI specific questions and answers about your system
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-200 mb-2">
                  Category
                </label>
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-slate-100"
                >
                  <option value="general">General</option>
                  <option value="equipment">Equipment</option>
                  <option value="troubleshooting">Troubleshooting</option>
                  <option value="configuration">Configuration</option>
                  <option value="maintenance">Maintenance</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-200 mb-2">
                  Question
                </label>
                <Textarea
                  value={newQuestion}
                  onChange={(e) => setNewQuestion(e.target.value)}
                  placeholder="e.g., How do I configure the Wolf Pack matrix switcher?"
                  className="min-h-[80px]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-200 mb-2">
                  Answer
                </label>
                <Textarea
                  value={newAnswer}
                  onChange={(e) => setNewAnswer(e.target.value)}
                  placeholder="Provide a detailed answer..."
                  className="min-h-[120px]"
                />
              </div>

              <Button
                onClick={handleAddQA}
                disabled={isLoading || !newQuestion.trim() || !newAnswer.trim()}
                className="w-full"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Adding...
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4 mr-2" />
                    Add Q&A Entry
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Existing Q&A Entries */}
          <Card>
            <CardHeader>
              <CardTitle>Existing Q&A Entries ({qaEntries.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {qaEntries.length === 0 ? (
                <div className="text-center py-8 text-slate-400">
                  <BookOpen className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No Q&A entries yet. Add your first one above!</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {qaEntries.map((entry) => (
                    <div key={entry.id} className="p-4 bg-slate-800/50 rounded-lg border border-slate-700">
                      <div className="flex items-start justify-between mb-2">
                        <Badge variant="outline">{entry.category}</Badge>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteQA(entry.id)}
                          className="text-red-400 hover:text-red-300"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                      <div className="space-y-2">
                        <div>
                          <span className="text-xs text-slate-400">Question:</span>
                          <p className="text-sm text-slate-200">{entry.question}</p>
                        </div>
                        <div>
                          <span className="text-xs text-slate-400">Answer:</span>
                          <p className="text-sm text-slate-300">{entry.answer}</p>
                        </div>
                        <div className="text-xs text-slate-500">
                          Added: {new Date(entry.createdAt).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Test AI Tab */}
        <TabsContent value="test" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Test AI Knowledge</CardTitle>
              <CardDescription>
                Ask questions to test what the AI has learned from your training
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-200 mb-2">
                  Test Question
                </label>
                <Textarea
                  value={testQuestion}
                  onChange={(e) => setTestQuestion(e.target.value)}
                  placeholder="Ask a question to test the AI's knowledge..."
                  className="min-h-[100px]"
                />
              </div>

              <Button
                onClick={handleTestQuestion}
                disabled={isTesting || !testQuestion.trim()}
                className="w-full"
              >
                {isTesting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Testing...
                  </>
                ) : (
                  <>
                    <MessageSquare className="w-4 h-4 mr-2" />
                    Test AI Response
                  </>
                )}
              </Button>

              {testResponse && (
                <div className="mt-4">
                  <label className="block text-sm font-medium text-slate-200 mb-2">
                    AI Response:
                  </label>
                  <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700">
                    <p className="text-sm text-slate-200 whitespace-pre-wrap">{testResponse}</p>
                  </div>
                </div>
              )}

              <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-lg p-4">
                <h4 className="font-medium text-yellow-200 mb-2">🧪 Testing Tips:</h4>
                <ul className="text-sm text-yellow-100 space-y-1 list-disc list-inside">
                  <li>Ask questions similar to what you've trained</li>
                  <li>Test different phrasings of the same question</li>
                  <li>Check if the AI uses your uploaded documents</li>
                  <li>Verify accuracy and add more training if needed</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
