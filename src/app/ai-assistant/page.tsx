
'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, FileText, BookOpen, RefreshCw, Sparkles } from 'lucide-react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  sources?: Array<{
    source: string;
    title?: string;
    section?: string;
  }>;
  timestamp: Date;
}

interface KBStats {
  stats: {
    totalDocuments: number;
    totalPDFs: number;
    totalMarkdown: number;
    totalCharacters: number;
  };
  lastUpdated: string;
}

export default function AIAssistant() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [useKnowledge, setUseKnowledge] = useState(true);
  const [kbStats, setKbStats] = useState<KBStats | null>(null);
  const [isRebuildingKB, setIsRebuildingKB] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadKBStats();
    // Add welcome message
    setMessages([{
      role: 'assistant',
      content: 'Hello! I\'m your Sports Bar AI Assistant with access to all system documentation. I can help you with:\n\n' +
        '• Troubleshooting AV equipment (Wolf Pack, DirecTV, Fire TV, etc.)\n' +
        '• Understanding Atlas audio processor configuration\n' +
        '• Explaining system architecture and setup\n' +
        '• Finding specific information in the documentation\n' +
        '• Suggesting system improvements and optimizations\n\n' +
        'Ask me anything about your system!',
      timestamp: new Date()
    }]);
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadKBStats = async () => {
    try {
      const response = await fetch('/api/ai/knowledge-query');
      if (response.ok) {
        const data = await response.json();
        setKbStats(data);
      }
    } catch (error) {
      console.error('Error loading KB stats:', error);
    }
  };

  const rebuildKnowledgeBase = async () => {
    setIsRebuildingKB(true);
    try {
      const response = await fetch('/api/ai/rebuild-knowledge-base', {
        method: 'POST'
      });
      if (response.ok) {
        await loadKBStats();
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: 'Knowledge base has been successfully rebuilt with the latest documentation!',
          timestamp: new Date()
        }]);
      } else {
        throw new Error('Failed to rebuild knowledge base');
      }
    } catch (error) {
      console.error('Error rebuilding KB:', error);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Error rebuilding knowledge base. Please check the server logs.',
        timestamp: new Date()
      }]);
    } finally {
      setIsRebuildingKB(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      role: 'user',
      content: input,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/ai/enhanced-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: input,
          useKnowledge
        })
      });

      if (!response.ok) {
        throw new Error('Failed to get AI response');
      }

      const data = await response.json();

      const assistantMessage: Message = {
        role: 'assistant',
        content: data.response,
        sources: data.sources,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Error getting AI response:', error);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Sorry, I encountered an error processing your request. Please make sure Ollama is running.',
        timestamp: new Date()
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 mb-4 border border-blue-500/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-3 bg-blue-500/20 rounded-lg">
                <Sparkles className="w-8 h-8 text-blue-400" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">AI System Assistant</h1>
                <p className="text-gray-400 text-sm">Powered by local AI with full system documentation</p>
              </div>
            </div>
            
            {kbStats && (
              <div className="flex items-center space-x-4">
                <div className="text-right">
                  <div className="text-sm text-gray-400">Knowledge Base</div>
                  <div className="text-lg font-bold text-blue-400">
                    {kbStats.stats.totalDocuments} chunks
                  </div>
                  <div className="text-xs text-gray-500">
                    {kbStats.stats.totalPDFs} PDFs • {kbStats.stats.totalMarkdown} MD files
                  </div>
                </div>
                <button
                  onClick={rebuildKnowledgeBase}
                  disabled={isRebuildingKB}
                  className="p-2 bg-blue-500/20 hover:bg-blue-500/30 rounded-lg transition-colors disabled:opacity-50"
                  title="Rebuild Knowledge Base"
                >
                  <RefreshCw className={`w-5 h-5 text-blue-400 ${isRebuildingKB ? 'animate-spin' : ''}`} />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Controls */}
        <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-4 mb-4 border border-blue-500/30">
          <label className="flex items-center space-x-3 cursor-pointer">
            <input
              type="checkbox"
              checked={useKnowledge}
              onChange={(e) => setUseKnowledge(e.target.checked)}
              className="w-5 h-5 rounded bg-slate-700 border-blue-500 text-blue-500 focus:ring-2 focus:ring-blue-500"
            />
            <div className="flex items-center space-x-2">
              <BookOpen className="w-5 h-5 text-blue-400" />
              <span className="text-white font-medium">Use Documentation Knowledge Base</span>
              <span className="text-sm text-gray-400">(Recommended for system-specific questions)</span>
            </div>
          </label>
        </div>

        {/* Messages */}
        <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-blue-500/30 mb-4 h-[600px] flex flex-col">
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {messages.map((message, index) => (
              <div
                key={index}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`flex items-start space-x-3 max-w-3xl ${message.role === 'user' ? 'flex-row-reverse space-x-reverse' : ''}`}>
                  <div className={`p-2 rounded-lg ${message.role === 'user' ? 'bg-blue-500' : 'bg-emerald-500'}`}>
                    {message.role === 'user' ? (
                      <User className="w-5 h-5 text-white" />
                    ) : (
                      <Bot className="w-5 h-5 text-white" />
                    )}
                  </div>
                  
                  <div className={`flex-1 ${message.role === 'user' ? 'text-right' : ''}`}>
                    <div className={`rounded-xl p-4 ${message.role === 'user' ? 'bg-blue-500/20' : 'bg-slate-700/50'}`}>
                      <p className="text-white whitespace-pre-wrap">{message.content}</p>
                      
                      {message.sources && message.sources.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-slate-600">
                          <div className="flex items-center space-x-2 mb-2">
                            <FileText className="w-4 h-4 text-blue-400" />
                            <span className="text-sm text-gray-400 font-medium">Sources:</span>
                          </div>
                          <div className="space-y-1">
                            {message.sources.map((source, idx) => (
                              <div key={idx} className="text-sm text-blue-300 flex items-start space-x-2">
                                <span className="text-blue-500">•</span>
                                <span>
                                  {source.title || source.source}
                                  {source.section && <span className="text-gray-500"> ({source.section})</span>}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      <div className="mt-2 text-xs text-gray-500">
                        {message.timestamp.toLocaleTimeString()}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
            
            {isLoading && (
              <div className="flex justify-start">
                <div className="flex items-start space-x-3 max-w-3xl">
                  <div className="p-2 rounded-lg bg-emerald-500">
                    <Bot className="w-5 h-5 text-white" />
                  </div>
                  <div className="rounded-xl p-4 bg-slate-700/50">
                    <div className="flex space-x-2">
                      <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                      <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                      <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input */}
        <form onSubmit={handleSubmit} className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-blue-500/30 p-4">
          <div className="flex space-x-3">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about your system, troubleshooting, or configuration..."
              className="flex-1 bg-slate-700/50 text-white placeholder-gray-400 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="bg-blue-500 hover:bg-blue-600 text-white rounded-lg px-6 py-3 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
            >
              <Send className="w-5 h-5" />
              <span>Send</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
