
'use client'

import { useState, useEffect, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from './ui/cards'
import { Button } from './ui/button'
import { Textarea } from './ui/textarea'
import { Badge } from './ui/badge'
import { logger } from '@/lib/logger'
import { 
  MessageSquare, 
  Code, 
  FileText, 
  Terminal, 
  CheckCircle, 
  XCircle,
  Loader2,
  Settings,
  AlertTriangle
} from 'lucide-react'

interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: Date
  toolCalls?: ToolCall[]
  toolResults?: ToolResult[]
}

interface ToolCall {
  id: string
  name: string
  parameters: Record<string, any>
}

interface ToolResult {
  id: string
  name: string
  result: any
  success: boolean
  error?: string
}

export default function ToolChatInterface() {
  const [messages, setMessages] = useState<Message[]>([])
  const [inputText, setInputText] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [enableTools, setEnableTools] = useState(true)
  const [useKnowledge, setUseKnowledge] = useState(true)
  const [useCodebase, setUseCodebase] = useState(true)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  useEffect(() => {
    // Welcome message
    setMessages([
      {
        id: '1',
        role: 'assistant',
        content: `Hello! I'm your enhanced AI assistant with advanced capabilities:

🔧 **File System Access** - Read, write, search, and manage files
💻 **Code Execution** - Run Python, JavaScript, and shell commands
📊 **Code Analysis** - Analyze code for issues and improvements
📚 **Knowledge Base** - Access project documentation and codebase

I can help you with:
- Reading and analyzing project files
- Writing or modifying code files
- Running scripts and commands
- Searching through the codebase
- Analyzing code quality
- And much more!

What would you like me to help you with?`,
        timestamp: new Date(),
      }
    ])
  }, [])

  const handleSendMessage = async () => {
    if (!inputText.trim() || isLoading) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: inputText,
      timestamp: new Date(),
    }

    setMessages(prev => [...prev, userMessage])
    setInputText('')
    setIsLoading(true)

    try {
      const response = await fetch('/api/ai/tool-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: inputText,
          enableTools,
          useKnowledge,
          useCodebase,
          conversationHistory: messages.slice(-10), // Last 10 messages for context
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to get response')
      }

      const data = await response.json()

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.response,
        timestamp: new Date(),
        toolCalls: data.toolCalls,
        toolResults: data.toolResults,
      }

      setMessages(prev => [...prev, assistantMessage])

    } catch (error) {
      logger.error('Chat error:', error)
      
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `❌ Error: ${error instanceof Error ? error.message : 'Failed to process request'}`,
        timestamp: new Date(),
      }

      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  return (
    <Card className="w-full h-[800px] flex flex-col">
      <CardHeader className="border-b">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5" />
            AI Assistant with Tools
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant={enableTools ? 'default' : 'secondary'}>
              {enableTools ? 'Tools Enabled' : 'Tools Disabled'}
            </Badge>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEnableTools(!enableTools)}
            >
              <Settings className="w-4 h-4" />
            </Button>
          </div>
        </div>
        <div className="flex gap-2 mt-2">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={useKnowledge}
              onChange={(e) => setUseKnowledge(e.target.checked)}
              className="rounded"
            />
            Use Knowledge Base
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={useCodebase}
              onChange={(e) => setUseCodebase(e.target.checked)}
              className="rounded"
            />
            Use Codebase Context
          </label>
        </div>
      </CardHeader>

      <CardContent className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-lg p-4 ${
                message.role === 'user'
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 dark:bg-gray-800'
              }`}
            >
              <div className="whitespace-pre-wrap">{message.content}</div>

              {/* Tool Calls Display */}
              {message.toolCalls && message.toolCalls.length > 0 && (
                <div className="mt-3 space-y-2">
                  <div className="text-sm font-semibold flex items-center gap-2">
                    <Terminal className="w-4 h-4" />
                    Tool Calls:
                  </div>
                  {message.toolCalls.map((call) => (
                    <div
                      key={call.id}
                      className="bg-white dark:bg-gray-900 rounded p-2 text-sm"
                    >
                      <div className="font-mono text-blue-600 dark:text-blue-400">
                        {call.name}
                      </div>
                      <pre className="text-xs mt-1 overflow-x-auto">
                        {JSON.stringify(call.parameters, null, 2)}
                      </pre>
                    </div>
                  ))}
                </div>
              )}

              {/* Tool Results Display */}
              {message.toolResults && message.toolResults.length > 0 && (
                <div className="mt-3 space-y-2">
                  <div className="text-sm font-semibold flex items-center gap-2">
                    <Code className="w-4 h-4" />
                    Tool Results:
                  </div>
                  {message.toolResults.map((result) => (
                    <div
                      key={result.id}
                      className={`rounded p-2 text-sm ${
                        result.success
                          ? 'bg-green-50 dark:bg-green-900/20'
                          : 'bg-red-50 dark:bg-red-900/20'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        {result.success ? (
                          <CheckCircle className="w-4 h-4 text-green-600" />
                        ) : (
                          <XCircle className="w-4 h-4 text-red-600" />
                        )}
                        <span className="font-mono">{result.name}</span>
                      </div>
                      {result.success ? (
                        <pre className="text-xs mt-1 overflow-x-auto max-h-40">
                          {typeof result.result === 'string'
                            ? result.result
                            : JSON.stringify(result.result, null, 2)}
                        </pre>
                      ) : (
                        <div className="text-red-600 text-xs">{result.error}</div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <div className="text-xs opacity-70 mt-2">
                {message.timestamp.toLocaleTimeString()}
              </div>
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-4">
              <Loader2 className="w-5 h-5 animate-spin" />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </CardContent>

      <div className="border-t p-4">
        <div className="flex gap-2">
          <Textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Ask me anything... I can read files, execute code, and more!"
            className="flex-1 min-h-[60px] max-h-[200px]"
            disabled={isLoading}
          />
          <Button
            onClick={handleSendMessage}
            disabled={isLoading || !inputText.trim()}
            className="self-end"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              'Send'
            )}
          </Button>
        </div>
        {enableTools && (
          <div className="mt-2 text-xs text-gray-500 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" />
            Tools are enabled. The AI can read/write files and execute code within security constraints.
          </div>
        )}
      </div>
    </Card>
  )
}
