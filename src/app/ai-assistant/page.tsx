
'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, FileText, BookOpen, RefreshCw, Sparkles, Upload, X, AlertCircle, Activity, Download, Filter, Search, Zap } from 'lucide-react';

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

interface LogEntry {
  id: string;
  timestamp: string;
  level: 'debug' | 'info' | 'warn' | 'error' | 'critical';
  category: string;
  source: string;
  action: string;
  message: string;
  details?: any;
  success: boolean;
  duration?: number;
  deviceType?: string;
  deviceId?: string;
  errorStack?: string;
}

interface LogAnalytics {
  totalLogs: number;
  errorRate: number;
  topErrors: Array<{ message: string; count: number; lastOccurred: string }>;
  recommendations: string[];
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
  
  // Log viewing state
  const [showLogsModal, setShowLogsModal] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [logAnalytics, setLogAnalytics] = useState<LogAnalytics | null>(null);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [logFilters, setLogFilters] = useState({
    hours: 24,
    maxLines: 100,
    errorsOnly: false,
    severity: '',
    category: ''
  });
  const [isAnalyzingLogs, setIsAnalyzingLogs] = useState(false);
  const [includeLogsInContext, setIncludeLogsInContext] = useState(false);

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

  const loadLogs = async () => {
    setIsLoadingLogs(true);
    try {
      const params = new URLSearchParams({
        hours: logFilters.hours.toString(),
        maxLines: logFilters.maxLines.toString(),
        errorsOnly: logFilters.errorsOnly.toString(),
        ...(logFilters.severity && { severity: logFilters.severity }),
        ...(logFilters.category && { category: logFilters.category })
      });

      const response = await fetch(`/api/ai-assistant/logs?${params}`);
      if (!response.ok) {
        throw new Error('Failed to fetch logs');
      }

      const data = await response.json();
      setLogs(data.logs);
      setLogAnalytics(data.analytics);
    } catch (error) {
      console.error('Error loading logs:', error);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Error loading system logs. Please check the server.',
        timestamp: new Date()
      }]);
    } finally {
      setIsLoadingLogs(false);
    }
  };

  const analyzeRecentErrors = async () => {
    setIsAnalyzingLogs(true);
    setShowLogsModal(false);
    
    setMessages(prev => [...prev, {
      role: 'user',
      content: 'Analyze recent system errors and suggest fixes',
      timestamp: new Date()
    }]);

    try {
      const response = await fetch('/api/ai-assistant/analyze-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hours: logFilters.hours,
          category: logFilters.category || undefined,
          includeKnowledge: useKnowledge
        })
      });

      if (!response.ok) {
        throw new Error('Failed to analyze logs');
      }

      const data = await response.json();

      const assistantMessage: Message = {
        role: 'assistant',
        content: `## System Log Analysis\n\n${data.analysis}\n\n### Log Summary\n- Total Logs: ${data.logsSummary.totalLogs}\n- Errors: ${data.logsSummary.errorCount}\n- Warnings: ${data.logsSummary.warningCount}\n- Error Rate: ${data.logsSummary.errorRate.toFixed(2)}%\n- System Health: ${data.logsSummary.systemHealth.toUpperCase()}\n- Time Range: Last ${data.logsSummary.timeRange}`,
        sources: data.sources,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Error analyzing logs:', error);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Error analyzing logs. Please make sure Ollama is running.',
        timestamp: new Date()
      }]);
    } finally {
      setIsAnalyzingLogs(false);
    }
  };

  const exportLogs = async () => {
    try {
      const response = await fetch('/api/ai-assistant/logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'export',
          hours: logFilters.hours,
          category: logFilters.category || undefined
        })
      });

      if (!response.ok) {
        throw new Error('Failed to export logs');
      }

      const data = await response.json();
      
      // Create download
      const blob = new Blob([data.content], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = data.filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `Logs exported successfully as ${data.filename}`,
        timestamp: new Date()
      }]);
    } catch (error) {
      console.error('Error exporting logs:', error);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Error exporting logs. Please try again.',
        timestamp: new Date()
      }]);
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

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'critical': return 'text-red-500 bg-red-500/10';
      case 'error': return 'text-red-400 bg-red-400/10';
      case 'warn': return 'text-yellow-400 bg-yellow-400/10';
      case 'info': return 'text-blue-400 bg-blue-400/10';
      case 'debug': return 'text-gray-400 bg-gray-400/10';
      default: return 'text-gray-400 bg-gray-400/10';
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
          <div className="flex items-center justify-between">
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
            
            <div className="flex items-center space-x-3">
              <button
                onClick={analyzeRecentErrors}
                disabled={isAnalyzingLogs}
                className="flex items-center space-x-2 px-4 py-2 bg-orange-500/20 hover:bg-orange-500/30 text-orange-400 rounded-lg transition-colors disabled:opacity-50"
                title="Analyze Recent Errors"
              >
                <Zap className={`w-4 h-4 ${isAnalyzingLogs ? 'animate-pulse' : ''}`} />
                <span className="text-sm font-medium">Analyze Recent Errors</span>
              </button>
              
              <button
                onClick={() => {
                  setShowLogsModal(true);
                  loadLogs();
                }}
                className="flex items-center space-x-2 px-4 py-2 bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 rounded-lg transition-colors"
                title="View System Logs"
              >
                <Activity className="w-4 h-4" />
                <span className="text-sm font-medium">System Logs</span>
              </button>
            </div>
          </div>
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

        {/* System Logs Modal */}
        {showLogsModal && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-slate-800 rounded-xl border border-purple-500/30 max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
              {/* Modal Header */}
              <div className="p-6 border-b border-slate-700 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-purple-500/20 rounded-lg">
                    <Activity className="w-6 h-6 text-purple-400" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-white">System Logs</h2>
                    <p className="text-sm text-gray-400">View and analyze system operations and errors</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowLogsModal(false)}
                  className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>

              {/* Filters */}
              <div className="p-4 border-b border-slate-700 bg-slate-900/50">
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">Time Range</label>
                    <select
                      value={logFilters.hours}
                      onChange={(e) => setLogFilters({...logFilters, hours: parseInt(e.target.value)})}
                      className="w-full bg-slate-700 text-white rounded px-3 py-2 text-sm"
                    >
                      <option value="1">Last Hour</option>
                      <option value="6">Last 6 Hours</option>
                      <option value="24">Last 24 Hours</option>
                      <option value="72">Last 3 Days</option>
                      <option value="168">Last Week</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">Max Lines</label>
                    <select
                      value={logFilters.maxLines}
                      onChange={(e) => setLogFilters({...logFilters, maxLines: parseInt(e.target.value)})}
                      className="w-full bg-slate-700 text-white rounded px-3 py-2 text-sm"
                    >
                      <option value="50">50</option>
                      <option value="100">100</option>
                      <option value="200">200</option>
                      <option value="500">500</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">Severity</label>
                    <select
                      value={logFilters.severity}
                      onChange={(e) => setLogFilters({...logFilters, severity: e.target.value})}
                      className="w-full bg-slate-700 text-white rounded px-3 py-2 text-sm"
                    >
                      <option value="">All</option>
                      <option value="critical">Critical</option>
                      <option value="error">Error</option>
                      <option value="warn">Warning</option>
                      <option value="info">Info</option>
                      <option value="debug">Debug</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">Category</label>
                    <select
                      value={logFilters.category}
                      onChange={(e) => setLogFilters({...logFilters, category: e.target.value})}
                      className="w-full bg-slate-700 text-white rounded px-3 py-2 text-sm"
                    >
                      <option value="">All</option>
                      <option value="user_interaction">User Interaction</option>
                      <option value="system">System</option>
                      <option value="api">API</option>
                      <option value="hardware">Hardware</option>
                      <option value="configuration">Configuration</option>
                      <option value="performance">Performance</option>
                      <option value="security">Security</option>
                    </select>
                  </div>
                  
                  <div className="flex items-end">
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={logFilters.errorsOnly}
                        onChange={(e) => setLogFilters({...logFilters, errorsOnly: e.target.checked})}
                        className="w-4 h-4 rounded bg-slate-700 border-purple-500 text-purple-500"
                      />
                      <span className="text-sm text-white">Errors Only</span>
                    </label>
                  </div>
                </div>
                
                <div className="flex items-center justify-between mt-3">
                  <button
                    onClick={loadLogs}
                    disabled={isLoadingLogs}
                    className="flex items-center space-x-2 px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg transition-colors disabled:opacity-50"
                  >
                    <RefreshCw className={`w-4 h-4 ${isLoadingLogs ? 'animate-spin' : ''}`} />
                    <span>Refresh</span>
                  </button>
                  
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={exportLogs}
                      className="flex items-center space-x-2 px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded-lg transition-colors"
                    >
                      <Download className="w-4 h-4" />
                      <span>Export</span>
                    </button>
                    
                    <button
                      onClick={analyzeRecentErrors}
                      className="flex items-center space-x-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-colors"
                    >
                      <Zap className="w-4 h-4" />
                      <span>Analyze with AI</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Analytics Summary */}
              {logAnalytics && (
                <div className="p-4 border-b border-slate-700 bg-slate-900/30">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-slate-700/50 rounded-lg p-3">
                      <div className="text-xs text-gray-400 mb-1">Total Logs</div>
                      <div className="text-2xl font-bold text-white">{logAnalytics.totalLogs}</div>
                    </div>
                    <div className="bg-slate-700/50 rounded-lg p-3">
                      <div className="text-xs text-gray-400 mb-1">Error Rate</div>
                      <div className={`text-2xl font-bold ${logAnalytics.errorRate > 10 ? 'text-red-400' : logAnalytics.errorRate > 5 ? 'text-yellow-400' : 'text-green-400'}`}>
                        {logAnalytics.errorRate.toFixed(1)}%
                      </div>
                    </div>
                    <div className="bg-slate-700/50 rounded-lg p-3">
                      <div className="text-xs text-gray-400 mb-1">Top Error</div>
                      <div className="text-sm font-medium text-white truncate">
                        {logAnalytics.topErrors[0]?.message.substring(0, 30) || 'None'}
                      </div>
                      {logAnalytics.topErrors[0] && (
                        <div className="text-xs text-gray-400">{logAnalytics.topErrors[0].count} times</div>
                      )}
                    </div>
                    <div className="bg-slate-700/50 rounded-lg p-3">
                      <div className="text-xs text-gray-400 mb-1">System Health</div>
                      <div className={`text-lg font-bold ${logAnalytics.errorRate > 10 ? 'text-red-400' : logAnalytics.errorRate > 5 ? 'text-yellow-400' : 'text-green-400'}`}>
                        {logAnalytics.errorRate > 10 ? 'Critical' : logAnalytics.errorRate > 5 ? 'Warning' : 'Healthy'}
                      </div>
                    </div>
                  </div>
                  
                  {logAnalytics.recommendations.length > 0 && (
                    <div className="mt-3 p-3 bg-orange-500/10 border border-orange-500/30 rounded-lg">
                      <div className="flex items-start space-x-2">
                        <AlertCircle className="w-5 h-5 text-orange-400 flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <div className="text-sm font-medium text-orange-400 mb-1">Recommendations</div>
                          <ul className="text-xs text-gray-300 space-y-1">
                            {logAnalytics.recommendations.map((rec, idx) => (
                              <li key={idx}>• {rec}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Logs Display */}
              <div className="flex-1 overflow-y-auto p-4">
                {isLoadingLogs ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center">
                      <RefreshCw className="w-8 h-8 text-purple-400 animate-spin mx-auto mb-2" />
                      <p className="text-gray-400">Loading logs...</p>
                    </div>
                  </div>
                ) : logs.length === 0 ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center">
                      <Activity className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                      <p className="text-gray-400">No logs found for the selected filters</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2 font-mono text-xs">
                    {logs.map((log) => (
                      <div
                        key={log.id}
                        className="bg-slate-900/50 rounded-lg p-3 border border-slate-700 hover:border-slate-600 transition-colors"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center space-x-2">
                            <span className={`px-2 py-1 rounded text-xs font-bold ${getLevelColor(log.level)}`}>
                              {log.level.toUpperCase()}
                            </span>
                            <span className="text-gray-500">{new Date(log.timestamp).toLocaleString()}</span>
                            <span className="text-blue-400">[{log.category}]</span>
                            <span className="text-purple-400">{log.source}</span>
                          </div>
                          {log.duration && (
                            <span className="text-gray-500">{log.duration}ms</span>
                          )}
                        </div>
                        
                        <div className="text-white mb-1">
                          <span className="text-emerald-400">{log.action}</span>: {log.message}
                        </div>
                        
                        {log.deviceType && (
                          <div className="text-gray-400 text-xs mb-1">
                            Device: {log.deviceType} ({log.deviceId})
                          </div>
                        )}
                        
                        {log.details && (
                          <details className="mt-2">
                            <summary className="text-gray-400 cursor-pointer hover:text-gray-300">
                              Details
                            </summary>
                            <pre className="mt-2 p-2 bg-slate-950 rounded text-gray-300 overflow-x-auto">
                              {JSON.stringify(log.details, null, 2)}
                            </pre>
                          </details>
                        )}
                        
                        {log.errorStack && (
                          <details className="mt-2">
                            <summary className="text-red-400 cursor-pointer hover:text-red-300">
                              Stack Trace
                            </summary>
                            <pre className="mt-2 p-2 bg-slate-950 rounded text-red-300 overflow-x-auto text-xs">
                              {log.errorStack}
                            </pre>
                          </details>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

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
