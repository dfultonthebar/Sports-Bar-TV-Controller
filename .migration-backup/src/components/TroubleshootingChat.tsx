
'use client'

import { useState, useEffect, useRef } from 'react'

import { logger } from '@/lib/logger'
interface Message {
  id: number
  text: string
  sender: 'user' | 'ai'
  timestamp: Date
}

interface RelevantDocument {
  id: string
  name: string
}

export default function TroubleshootingChat() {
  const [messages, setMessages] = useState<Message[]>([])
  const [inputText, setInputText] = useState('')
  const [isInitialized, setIsInitialized] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [relevantDocs, setRelevantDocs] = useState<RelevantDocument[]>([])
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // Initialize messages only on client side to prevent hydration mismatch
  useEffect(() => {
    if (!isInitialized) {
      setMessages([
        {
          id: 1,
          text: "Hello! I'm your Sports Bar AI Assistant. I can help you troubleshoot AV system issues using your uploaded documentation. What problem are you experiencing?",
          sender: 'ai',
          timestamp: new Date()
        }
      ])
      setIsInitialized(true)
    }
  }, [isInitialized])

  const handleSendMessage = async () => {
    if (!inputText.trim() || isLoading) return

    const userMessage: Message = {
      id: messages.length + 1,
      text: inputText,
      sender: 'user',
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMessage])
    setInputText('')
    setIsLoading(true)

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: inputText,
          sessionId: sessionId,
          stream: false,  // CRITICAL FIX: Explicitly request non-streaming response
        }),
      })

      if (response.ok) {
        const data = await response.json()
        
        const aiResponse: Message = {
          id: messages.length + 2,
          text: data.response,
          sender: 'ai',
          timestamp: new Date()
        }

        setMessages(prev => [...prev, aiResponse])
        
        if (data.sessionId) {
          setSessionId(data.sessionId)
        }
        
        if (data.relevantDocuments) {
          setRelevantDocs(data.relevantDocuments)
        }
      } else {
        const errorData = await response.json()
        const errorMessage: Message = {
          id: messages.length + 2,
          text: `Sorry, I encountered an error: ${errorData.error || 'Unknown error'}`,
          sender: 'ai',
          timestamp: new Date()
        }
        setMessages(prev => [...prev, errorMessage])
      }
    } catch (error) {
      logger.error('Chat error:', error)
      const errorMessage: Message = {
        id: messages.length + 2,
        text: `Error: ${error instanceof Error ? error.message : 'Network error. Please try again.'}`,
        sender: 'ai',
        timestamp: new Date()
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  const clearChat = () => {
    setMessages([
      {
        id: 1,
        text: "Hello! I'm your Sports Bar AI Assistant. I can help you troubleshoot AV system issues using your uploaded documentation. What problem are you experiencing?",
        sender: 'ai',
        timestamp: new Date()
      }
    ])
    setSessionId(null)
    setRelevantDocs([])
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="text-xl font-semibold text-slate-100 mb-2">
          AI Troubleshooting Assistant
        </h3>
        <p className="text-gray-600">
          Describe your AV system issues and get AI-powered guidance using your uploaded documentation
        </p>
      </div>

      <div className="bg-slate-800 or bg-slate-900 border border-slate-700 rounded-lg shadow-sm">
        <div className="flex justify-between items-center p-4 border-b border-slate-700">
          <div className="text-sm text-slate-300">
            {sessionId ? `Session: ${sessionId.substring(0, 8)}...` : 'New Session'}
          </div>
          <button
            onClick={clearChat}
            className="text-sm text-slate-400 hover:text-slate-200"
          >
            Clear Chat
          </button>
        </div>

        <div className="h-96 overflow-y-auto p-4 space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                  message.sender === 'user'
                    ? 'bg-blue-500 text-white'
                    : 'bg-slate-800 or bg-slate-900 text-slate-100'
                }`}
              >
                <p className="text-sm whitespace-pre-wrap">{message.text}</p>
                <p className="text-xs mt-1 opacity-70">
                  {message.timestamp.toLocaleTimeString()}
                </p>
              </div>
            </div>
          ))}
          
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-slate-800 or bg-slate-900 text-slate-100 px-4 py-2 rounded-lg">
                <div className="flex items-center space-x-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600"></div>
                  <span className="text-sm">AI is thinking...</span>
                </div>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>
        
        {/* Relevant Documents */}
        {relevantDocs.length > 0 && (
          <div className="border-t border-slate-700 p-4 bg-blue-50">
            <h5 className="text-sm font-medium text-blue-800 mb-2">
              Referenced Documents:
            </h5>
            <div className="flex flex-wrap gap-2">
              {relevantDocs.map((doc) => (
                <span
                  key={doc.id}
                  className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                >
                  📄 {doc.name}
                </span>
              ))}
            </div>
          </div>
        )}
        
        <div className="border-t border-slate-700 p-4">
          <div className="flex space-x-2">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
              placeholder="Describe your AV system issue..."
              className="flex-1 border border-slate-700 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isLoading}
            />
            <button
              onClick={handleSendMessage}
              disabled={isLoading || !inputText.trim()}
              className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Send
            </button>
          </div>
          <p className="text-xs text-slate-400 mt-2">
            Press Enter to send, Shift+Enter for new line
          </p>
        </div>
      </div>
    </div>
  )
}
