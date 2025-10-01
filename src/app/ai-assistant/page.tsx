
'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, FileText, BookOpen, RefreshCw, Sparkles, Upload, X } from 'lucide-react';

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
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const validFiles = files.filter(file => 
      file.type === 'application/pdf' || 
      file.name.endsWith('.md') || 
      file.name.endsWith('.txt')
    );
    
    if (validFiles.length !== files.length) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Some files were filtered out. Only PDF, MD, and TXT files are supported.',
        timestamp: new Date()
      }]);
    }
    
    setSelectedFiles(prev => [...prev, ...validFiles]);
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const uploadDocuments = async () => {
    if (selectedFiles.length === 0) return;

    setIsUploading(true);
    try {
      const formData = new FormData();
      selectedFiles.forEach(file => {
        formData.append('files', file);
      });

      const response = await fetch('/api/ai/upload-documents', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error('Failed to upload documents');
      }

      const result = await response.json();
      
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `Successfully uploaded ${result.uploaded} document(s)! Rebuilding knowledge base...`,
        timestamp: new Date()
      }]);

      // Auto-rebuild knowledge base after upload
      await rebuildKnowledgeBase();
      
      // Clear selected files and close modal
      setSelectedFiles([]);
      setShowUploadModal(false);
    } catch (error) {
      console.error('Error uploading documents:', error);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Error uploading documents. Please check the server logs.',
        timestamp: new Date()
      }]);
    } finally {
      setIsUploading(false);
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
                <div className="flex space-x-2">
                  <button
                    onClick={() => setShowUploadModal(true)}
                    className="p-2 bg-emerald-500/20 hover:bg-emerald-500/30 rounded-lg transition-colors"
                    title="Upload Documents"
                  >
                    <Upload className="w-5 h-5 text-emerald-400" />
                  </button>
                  <button
                    onClick={rebuildKnowledgeBase}
                    disabled={isRebuildingKB}
                    className="p-2 bg-blue-500/20 hover:bg-blue-500/30 rounded-lg transition-colors disabled:opacity-50"
                    title="Rebuild Knowledge Base"
                  >
                    <RefreshCw className={`w-5 h-5 text-blue-400 ${isRebuildingKB ? 'animate-spin' : ''}`} />
                  </button>
                </div>
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

        {/* Upload Modal */}
        {showUploadModal && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-slate-800 rounded-xl border border-blue-500/30 max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col">
              {/* Modal Header */}
              <div className="p-6 border-b border-slate-700 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-emerald-500/20 rounded-lg">
                    <Upload className="w-6 h-6 text-emerald-400" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-white">Upload Documents</h2>
                    <p className="text-sm text-gray-400">Add PDFs, Markdown, or Text files to the knowledge base</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setShowUploadModal(false);
                    setSelectedFiles([]);
                  }}
                  className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>

              {/* File Selection */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-blue-500/30 rounded-xl p-8 text-center cursor-pointer hover:border-blue-500/50 hover:bg-slate-700/30 transition-all"
                >
                  <Upload className="w-12 h-12 text-blue-400 mx-auto mb-3" />
                  <p className="text-white font-medium mb-1">Click to select files</p>
                  <p className="text-sm text-gray-400">Supports PDF, MD, and TXT files</p>
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".pdf,.md,.txt"
                  onChange={handleFileSelect}
                  className="hidden"
                />

                {/* Selected Files List */}
                {selectedFiles.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="text-sm font-medium text-gray-400">Selected Files ({selectedFiles.length})</h3>
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {selectedFiles.map((file, index) => (
                        <div
                          key={index}
                          className="bg-slate-700/50 rounded-lg p-3 flex items-center justify-between"
                        >
                          <div className="flex items-center space-x-3 flex-1 min-w-0">
                            <FileText className="w-5 h-5 text-blue-400 flex-shrink-0" />
                            <div className="min-w-0 flex-1">
                              <p className="text-white text-sm font-medium truncate">{file.name}</p>
                              <p className="text-xs text-gray-400">
                                {(file.size / 1024).toFixed(1)} KB
                              </p>
                            </div>
                          </div>
                          <button
                            onClick={() => removeFile(index)}
                            className="p-1 hover:bg-slate-600 rounded transition-colors flex-shrink-0"
                          >
                            <X className="w-4 h-4 text-gray-400" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="p-6 border-t border-slate-700 flex items-center justify-between">
                <p className="text-sm text-gray-400">
                  {selectedFiles.length > 0 
                    ? `${selectedFiles.length} file(s) ready to upload` 
                    : 'No files selected'}
                </p>
                <div className="flex space-x-3">
                  <button
                    onClick={() => {
                      setShowUploadModal(false);
                      setSelectedFiles([]);
                    }}
                    className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
                    disabled={isUploading}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={uploadDocuments}
                    disabled={selectedFiles.length === 0 || isUploading}
                    className="px-6 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                  >
                    {isUploading ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Uploading...</span>
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4" />
                        <span>Upload & Add to KB</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
