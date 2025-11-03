
'use client'

import { useState, useEffect, useRef } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs'
import { Card, CardContent, CardHeader, CardTitle } from './ui/cards'
import { Button } from './ui/button'
import { Textarea } from './ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import { Badge } from './ui/badge'
import { Code, Cpu, MessageSquare, Settings, Download, Copy } from 'lucide-react'

interface Message {
  id: number
  text: string
  sender: 'user' | 'ai'
  timestamp: Date
  type?: 'general' | 'script' | 'feature' | 'analysis'
}

interface ScriptRequest {
  description: string
  scriptType: 'bash' | 'python' | 'javascript' | 'powershell' | 'config'
  requirements: string[]
  context?: string
}

interface FeatureRequest {
  featureName: string
  description: string
  requirements: string[]
  technology: string
  complexity: 'simple' | 'medium' | 'complex'
}

export default function EnhancedAIChat() {
  const [messages, setMessages] = useState<Message[]>([])
  const [inputText, setInputText] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState('chat')
  const [streamingEnabled, setStreamingEnabled] = useState(true)
  const [currentStreamingMessage, setCurrentStreamingMessage] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  // Script Generation State
  const [scriptRequest, setScriptRequest] = useState<ScriptRequest>({
    description: '',
    scriptType: 'bash',
    requirements: [] as any[],
    context: ''
  })
  const [generatedScript, setGeneratedScript] = useState('')

  // Feature Design State
  const [featureRequest, setFeatureRequest] = useState<FeatureRequest>({
    featureName: '',
    description: '',
    requirements: [] as any[],
    technology: 'React/Next.js',
    complexity: 'medium'
  })
  const [featureDesign, setFeatureDesign] = useState('')

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  useEffect(() => {
    setMessages([
      {
        id: 1,
        text: "Hello! I'm your Enhanced Sports Bar AI Assistant with advanced capabilities:\n\n🔧 **Advanced Troubleshooting** - Deep AV system analysis\n📝 **Script Generation** - Automated script creation\n🏗️ **Feature Design** - Complete feature specifications\n📊 **System Optimization** - Performance recommendations\n\nHow can I help you today?",
        sender: 'ai',
        timestamp: new Date(),
        type: 'general'
      }
    ])
  }, [])

  const handleSendMessage = async () => {
    if (!inputText.trim() || isLoading) return

    const userMessage: Message = {
      id: messages.length + 1,
      text: inputText,
      sender: 'user',
      timestamp: new Date(),
      type: 'general'
    }

    setMessages(prev => [...prev, userMessage])
    const userInputText = inputText
    setInputText('')
    setIsLoading(true)
    setCurrentStreamingMessage('')

    // Create abort controller for this request
    abortControllerRef.current = new AbortController()

    try {
      if (streamingEnabled) {
        // Streaming mode
        const response = await fetch('/api/ai/enhanced-chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: userInputText,
            stream: true,
            useKnowledge: true,
            useCodebase: true
          }),
          signal: abortControllerRef.current.signal
        })

        if (!response.ok) {
          if (response.status === 429) {
            const errorData = await response.json()
            throw new Error(`Rate limit exceeded. ${errorData.message || 'Please try again later.'}`)
          }
          throw new Error('Failed to get response')
        }

        // Read streaming response
        const reader = response.body?.getReader()
        if (!reader) {
          throw new Error('No response body')
        }

        const decoder = new TextDecoder()
        let streamedText = ''
        let buffer = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() || ''

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6))

                if (data.type === 'token') {
                  streamedText += data.content
                  setCurrentStreamingMessage(streamedText)
                } else if (data.type === 'done') {
                  // Finalize the message
                  const aiResponse: Message = {
                    id: messages.length + 2,
                    text: streamedText,
                    sender: 'ai',
                    timestamp: new Date(),
                    type: 'general'
                  }
                  setMessages(prev => [...prev, aiResponse])
                  setCurrentStreamingMessage('')
                } else if (data.type === 'error') {
                  throw new Error(data.error)
                }
              } catch (e) {
                console.error('Error parsing SSE:', e)
              }
            }
          }
        }
      } else {
        // Non-streaming mode
        const response = await fetch('/api/ai/enhanced-chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: userInputText,
            stream: false,
            useKnowledge: true,
            useCodebase: true
          }),
          signal: abortControllerRef.current.signal
        })

        if (!response.ok) {
          if (response.status === 429) {
            const errorData = await response.json()
            throw new Error(`Rate limit exceeded. ${errorData.message || 'Please try again later.'}`)
          }
          throw new Error('Failed to get response')
        }

        const data = await response.json()

        const aiResponse: Message = {
          id: messages.length + 2,
          text: data.response,
          sender: 'ai',
          timestamp: new Date(),
          type: 'general'
        }

        setMessages(prev => [...prev, aiResponse])

        if (data.sessionId) {
          setSessionId(data.sessionId)
        }
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.log('Request cancelled')
        return
      }

      console.error('Chat error:', error)
      const errorMessage: Message = {
        id: messages.length + 2,
        text: `Sorry, I encountered an error: ${error.message || 'Please try again.'}`,
        sender: 'ai',
        timestamp: new Date(),
        type: 'general'
      }
      setMessages(prev => [...prev, errorMessage])
      setCurrentStreamingMessage('')
    } finally {
      setIsLoading(false)
      abortControllerRef.current = null
    }
  }

  const cancelRequest = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      setIsLoading(false)
      setCurrentStreamingMessage('')
    }
  }

  const generateScript = async () => {
    if (!scriptRequest.description.trim()) return

    setIsLoading(true)
    try {
      const response = await fetch('/api/generate-script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(scriptRequest),
      })

      if (response.ok) {
        const data = await response.json()
        setGeneratedScript(data.script)
        
        // Add to chat messages
        const scriptMessage: Message = {
          id: messages.length + 1,
          text: `Generated ${scriptRequest.scriptType} script: ${scriptRequest.description}`,
          sender: 'user',
          timestamp: new Date(),
          type: 'script'
        }
        
        const aiResponse: Message = {
          id: messages.length + 2,
          text: data.script,
          sender: 'ai',
          timestamp: new Date(),
          type: 'script'
        }

        setMessages(prev => [...prev, scriptMessage, aiResponse])
      } else {
        const errorData = await response.json()
        throw new Error(errorData.error)
      }
    } catch (error) {
      console.error('Script generation error:', error)
      alert(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setIsLoading(false)
    }
  }

  const designFeature = async () => {
    if (!featureRequest.featureName.trim() || !featureRequest.description.trim()) return

    setIsLoading(true)
    try {
      const response = await fetch('/api/design-feature', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(featureRequest),
      })

      if (response.ok) {
        const data = await response.json()
        setFeatureDesign(data.design)
        
        // Add to chat messages
        const featureMessage: Message = {
          id: messages.length + 1,
          text: `Designed feature: ${featureRequest.featureName}`,
          sender: 'user',
          timestamp: new Date(),
          type: 'feature'
        }
        
        const aiResponse: Message = {
          id: messages.length + 2,
          text: data.design,
          sender: 'ai',
          timestamp: new Date(),
          type: 'feature'
        }

        setMessages(prev => [...prev, featureMessage, aiResponse])
      } else {
        const errorData = await response.json()
        throw new Error(errorData.error)
      }
    } catch (error) {
      console.error('Feature design error:', error)
      alert(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setIsLoading(false)
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    alert('Copied to clipboard!')
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="text-xl font-semibold text-slate-100 mb-2">
          Enhanced AI Assistant
        </h3>
        <p className="text-gray-600">
          Advanced AI capabilities for script generation, feature design, and system optimization
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="chat" className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4" />
            Chat
          </TabsTrigger>
          <TabsTrigger value="scripts" className="flex items-center gap-2">
            <Code className="w-4 h-4" />
            Scripts
          </TabsTrigger>
          <TabsTrigger value="features" className="flex items-center gap-2">
            <Cpu className="w-4 h-4" />
            Features
          </TabsTrigger>
          <TabsTrigger value="optimization" className="flex items-center gap-2">
            <Settings className="w-4 h-4" />
            Optimize
          </TabsTrigger>
        </TabsList>

        <TabsContent value="chat" className="space-y-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium">Streaming Mode:</label>
                  <Button
                    variant={streamingEnabled ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setStreamingEnabled(!streamingEnabled)}
                    disabled={isLoading}
                  >
                    {streamingEnabled ? 'ON' : 'OFF'}
                  </Button>
                  <span className="text-xs text-gray-500">
                    {streamingEnabled ? 'Responses stream in real-time' : 'Wait for complete responses'}
                  </span>
                </div>
              </div>

              <div className="h-96 overflow-y-auto mb-4 space-y-4 border rounded p-4 bg-slate-800 or bg-slate-900">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                        message.sender === 'user'
                          ? 'bg-blue-500 text-white'
                          : 'bg-slate-800 or bg-slate-900 text-slate-100 border'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        {message.type && (
                          <Badge variant={message.type === 'script' ? 'destructive' :
                                        message.type === 'feature' ? 'secondary' : 'default'}>
                            {message.type}
                          </Badge>
                        )}
                        <span className="text-xs opacity-70">
                          {message.timestamp.toLocaleTimeString()}
                        </span>
                      </div>
                      <p className="text-sm whitespace-pre-wrap">{message.text}</p>
                      {message.sender === 'ai' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="mt-2 h-6 text-xs"
                          onClick={() => copyToClipboard(message.text)}
                        >
                          <Copy className="w-3 h-3 mr-1" />
                          Copy
                        </Button>
                      )}
                    </div>
                  </div>
                ))}

                {currentStreamingMessage && (
                  <div className="flex justify-start">
                    <div className="bg-slate-800 or bg-slate-900 text-slate-100 px-4 py-2 rounded-lg border">
                      <p className="text-sm whitespace-pre-wrap">{currentStreamingMessage}</p>
                      <div className="mt-2 flex items-center space-x-2">
                        <div className="animate-pulse h-2 w-2 bg-blue-600 rounded-full"></div>
                        <span className="text-xs opacity-70">Streaming...</span>
                      </div>
                    </div>
                  </div>
                )}

                {isLoading && !currentStreamingMessage && (
                  <div className="flex justify-start">
                    <div className="bg-slate-800 or bg-slate-900 text-slate-100 px-4 py-2 rounded-lg border">
                      <div className="flex items-center space-x-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                        <span className="text-sm">AI is thinking...</span>
                      </div>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              <div className="flex space-x-2">
                <Textarea
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
                  placeholder="Ask about AV systems, request scripts, or describe features..."
                  className="flex-1 min-h-[80px]"
                  disabled={isLoading}
                />
                {isLoading ? (
                  <Button
                    onClick={cancelRequest}
                    variant="destructive"
                    className="h-[80px]"
                  >
                    Cancel
                  </Button>
                ) : (
                  <Button
                    onClick={handleSendMessage}
                    disabled={!inputText.trim()}
                    className="h-[80px]"
                  >
                    Send
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="scripts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Script Generator</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Script Type</label>
                  <Select
                    value={scriptRequest.scriptType}
                    onValueChange={(value) => setScriptRequest(prev => ({ 
                      ...prev, 
                      scriptType: value as any 
                    }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="bash">Bash</SelectItem>
                      <SelectItem value="python">Python</SelectItem>
                      <SelectItem value="javascript">JavaScript</SelectItem>
                      <SelectItem value="powershell">PowerShell</SelectItem>
                      <SelectItem value="config">Configuration</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">Description</label>
                <Textarea
                  value={scriptRequest.description}
                  onChange={(e) => setScriptRequest(prev => ({ 
                    ...prev, 
                    description: e.target.value 
                  }))}
                  placeholder="Describe what the script should do..."
                  className="min-h-[100px]"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">Context (Optional)</label>
                <Textarea
                  value={scriptRequest.context}
                  onChange={(e) => setScriptRequest(prev => ({ 
                    ...prev, 
                    context: e.target.value 
                  }))}
                  placeholder="Additional context or constraints..."
                />
              </div>
              
              <Button
                onClick={generateScript}
                disabled={isLoading || !scriptRequest.description.trim()}
                className="w-full"
              >
                {isLoading ? 'Generating...' : 'Generate Script'}
              </Button>
              
              {generatedScript && (
                <div className="mt-4">
                  <div className="flex justify-between items-center mb-2">
                    <h4 className="font-medium">Generated Script:</h4>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyToClipboard(generatedScript)}
                    >
                      <Copy className="w-4 h-4 mr-2" />
                      Copy Script
                    </Button>
                  </div>
                  <pre className="bg-gray-900 text-green-400 p-4 rounded overflow-auto max-h-96 text-sm">
                    {generatedScript}
                  </pre>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="features" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Feature Designer</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Feature Name</label>
                  <input
                    type="text"
                    value={featureRequest.featureName}
                    onChange={(e) => setFeatureRequest(prev => ({ 
                      ...prev, 
                      featureName: e.target.value 
                    }))}
                    placeholder="e.g., Live Sports Notifications"
                    className="w-full border border-slate-700 rounded-md px-3 py-2"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-2">Technology</label>
                  <Select
                    value={featureRequest.technology}
                    onValueChange={(value) => setFeatureRequest(prev => ({ 
                      ...prev, 
                      technology: value 
                    }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="React/Next.js">React/Next.js</SelectItem>
                      <SelectItem value="Vue.js">Vue.js</SelectItem>
                      <SelectItem value="Angular">Angular</SelectItem>
                      <SelectItem value="Python/Django">Python/Django</SelectItem>
                      <SelectItem value="Node.js">Node.js</SelectItem>
                      <SelectItem value="Mobile App">Mobile App</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">Complexity</label>
                <Select
                  value={featureRequest.complexity}
                  onValueChange={(value) => setFeatureRequest(prev => ({ 
                    ...prev, 
                    complexity: value as any 
                  }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="simple">Simple</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="complex">Complex</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">Description</label>
                <Textarea
                  value={featureRequest.description}
                  onChange={(e) => setFeatureRequest(prev => ({ 
                    ...prev, 
                    description: e.target.value 
                  }))}
                  placeholder="Describe the feature functionality..."
                  className="min-h-[100px]"
                />
              </div>
              
              <Button
                onClick={designFeature}
                disabled={isLoading || !featureRequest.featureName.trim() || !featureRequest.description.trim()}
                className="w-full"
              >
                {isLoading ? 'Designing...' : 'Design Feature'}
              </Button>
              
              {featureDesign && (
                <div className="mt-4">
                  <div className="flex justify-between items-center mb-2">
                    <h4 className="font-medium">Feature Design:</h4>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyToClipboard(featureDesign)}
                    >
                      <Copy className="w-4 h-4 mr-2" />
                      Copy Design
                    </Button>
                  </div>
                  <div className="bg-slate-800 or bg-slate-900 p-4 rounded overflow-auto max-h-96 text-sm whitespace-pre-wrap">
                    {featureDesign}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="optimization" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>System Optimization</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">
                System optimization features coming soon! This will include:
              </p>
              <ul className="list-disc list-inside mt-2 space-y-1 text-sm text-slate-300">
                <li>Performance analysis and recommendations</li>
                <li>Hardware upgrade suggestions</li>
                <li>Configuration optimization</li>
                <li>Security hardening recommendations</li>
                <li>Maintenance scheduling</li>
              </ul>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
