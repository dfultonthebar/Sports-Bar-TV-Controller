
'use client';

import { useState, useEffect } from 'react';
import { Upload, Sparkles, Trash2, Edit2, Save, X, BarChart3, RefreshCw } from 'lucide-react';

interface QAEntry {
  id: string;
  question: string;
  answer: string;
  category: string;
  tags: string | null;
  sourceType: string;
  sourceFile: string | null;
  confidence: number;
  isActive: boolean;
  usageCount: number;
  createdAt: string;
  updatedAt: string;
}

interface QAStatistics {
  total: number;
  active: number;
  byCategory?: Array<{ category: string; _count: number }>;
  bySourceType?: Array<{ sourceType: string; _count: number }>;
  topUsed?: Array<{ id: string; question: string; usageCount: number; category: string }>;
}

interface GenerationJob {
  id: string;
  status: string;
  sourceType: string;
  totalFiles: number;
  processedFiles: number;
  generatedQAs: number;
  errorMessage: string | null;
}

export default function QATrainingPage() {
  const [entries, setEntries] = useState<QAEntry[]>([]);
  const [statistics, setStatistics] = useState<QAStatistics | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [generateLoading, setGenerateLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ question: '', answer: '', category: '' });
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterSourceType, setFilterSourceType] = useState<string>('all');
  const [currentJob, setCurrentJob] = useState<GenerationJob | null>(null);
  const [jobPolling, setJobPolling] = useState<NodeJS.Timeout | null>(null);

  useEffect(() => {
    loadEntries();
    loadStatistics();
  }, [filterCategory, filterSourceType]);

  useEffect(() => {
    return () => {
      if (jobPolling) clearInterval(jobPolling);
    };
  }, [jobPolling]);

  const loadEntries = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterCategory !== 'all') params.append('category', filterCategory);
      if (filterSourceType !== 'all') params.append('sourceType', filterSourceType);

      const response = await fetch(`/api/ai/qa-entries?${params}`);
      const data = await response.json();
      setEntries(data);
    } catch (error) {
      console.error('Error loading entries:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadStatistics = async () => {
    try {
      const response = await fetch('/api/ai/qa-entries?stats=true');
      const data = await response.json();
      setStatistics(data);
    } catch (error) {
      console.error('Error loading statistics:', error);
    }
  };

  const handleGenerateQAs = async (sourceType: string) => {
    setGenerateLoading(true);
    try {
      const response = await fetch('/api/ai/qa-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceType }),
      });

      const data = await response.json();
      
      if (data.jobId) {
        setCurrentJob({ ...data, id: data.jobId });
        startJobPolling(data.jobId);
      }
    } catch (error) {
      console.error('Error generating Q&As:', error);
      alert('Failed to start Q&A generation');
    } finally {
      setGenerateLoading(false);
    }
  };

  const startJobPolling = (jobId: string) => {
    const interval = setInterval(async () => {
      try {
        const response = await fetch(`/api/ai/qa-generate?jobId=${jobId}`);
        const job = await response.json();
        setCurrentJob(job);

        if (job.status === 'completed' || job.status === 'failed') {
          clearInterval(interval);
          setJobPolling(null);
          loadEntries();
          loadStatistics();
        }
      } catch (error) {
        console.error('Error polling job status:', error);
      }
    }, 2000);

    setJobPolling(interval);
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/ai/qa-upload', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (result.success) {
        alert(`Successfully uploaded ${result.saved} Q&A pairs!`);
        loadEntries();
        loadStatistics();
      } else {
        alert(`Upload completed with errors:\n${result.errors.join('\n')}`);
      }
    } catch (error) {
      console.error('Error uploading file:', error);
      alert('Failed to upload file');
    } finally {
      setUploadLoading(false);
      event.target.value = '';
    }
  };

  const handleEdit = (entry: QAEntry) => {
    setEditingId(entry.id);
    setEditForm({
      question: entry.question,
      answer: entry.answer,
      category: entry.category,
    });
  };

  const handleSaveEdit = async () => {
    if (!editingId) return;

    try {
      const response = await fetch('/api/ai/qa-entries', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editingId, ...editForm }),
      });

      if (response.ok) {
        loadEntries();
        setEditingId(null);
      }
    } catch (error) {
      console.error('Error saving edit:', error);
      alert('Failed to save changes');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this Q&A entry?')) return;

    try {
      const response = await fetch(`/api/ai/qa-entries?id=${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        loadEntries();
        loadStatistics();
      }
    } catch (error) {
      console.error('Error deleting entry:', error);
      alert('Failed to delete entry');
    }
  };

  const categories = ['all', 'system', 'api', 'features', 'configuration', 'troubleshooting', 'general'];
  const sourceTypes = ['all', 'manual', 'auto-generated', 'uploaded'];

  return (
    <div className="min-h-screen bg-sports-gradient">
      <header className="sports-header">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <a href="/" className="text-slate-300 hover:text-white">← Back</a>
              <div>
                <h1 className="text-xl font-bold text-slate-100">Q&A Training System</h1>
                <p className="text-sm text-slate-300">Train the AI Assistant</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Statistics Cards */}
        {statistics && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <div className="card p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-400 text-sm">Total Q&As</p>
                  <p className="text-3xl font-bold text-slate-100">{statistics.total || 0}</p>
                </div>
                <BarChart3 className="w-8 h-8 text-blue-400" />
              </div>
            </div>
            <div className="card p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-400 text-sm">Active</p>
                  <p className="text-3xl font-bold text-green-400">{statistics.active || 0}</p>
                </div>
                <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
              </div>
            </div>
            <div className="card p-6">
              <div>
                <p className="text-slate-400 text-sm mb-2">By Category</p>
                {statistics.byCategory && Array.isArray(statistics.byCategory) && statistics.byCategory.length > 0 ? (
                  statistics.byCategory.slice(0, 3).map((cat) => (
                    <div key={cat.category} className="flex justify-between text-sm mb-1">
                      <span className="text-slate-300">{cat.category}</span>
                      <span className="text-slate-100 font-semibold">{cat._count}</span>
                    </div>
                  ))
                ) : (
                  <p className="text-slate-500 text-sm">No data</p>
                )}
              </div>
            </div>
            <div className="card p-6">
              <div>
                <p className="text-slate-400 text-sm mb-2">By Source</p>
                {statistics.bySourceType && Array.isArray(statistics.bySourceType) && statistics.bySourceType.length > 0 ? (
                  statistics.bySourceType.map((src) => (
                    <div key={src.sourceType} className="flex justify-between text-sm mb-1">
                      <span className="text-slate-300">{src.sourceType}</span>
                      <span className="text-slate-100 font-semibold">{src._count}</span>
                    </div>
                  ))
                ) : (
                  <p className="text-slate-500 text-sm">No data</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="card p-6 mb-8">
          <h2 className="text-xl font-bold text-slate-100 mb-4">Training Actions</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button
              onClick={() => handleGenerateQAs('repository')}
              disabled={generateLoading}
              className="btn-primary flex items-center justify-center space-x-2 py-4"
            >
              <Sparkles className="w-5 h-5" />
              <span>Generate from Repository</span>
            </button>
            <button
              onClick={() => handleGenerateQAs('documentation')}
              disabled={generateLoading}
              className="btn-primary flex items-center justify-center space-x-2 py-4"
            >
              <Sparkles className="w-5 h-5" />
              <span>Generate from Docs</span>
            </button>
            <label className="btn-primary flex items-center justify-center space-x-2 py-4 cursor-pointer">
              <Upload className="w-5 h-5" />
              <span>{uploadLoading ? 'Uploading...' : 'Upload Q&A File'}</span>
              <input
                type="file"
                accept=".txt,.json,.md"
                onChange={handleFileUpload}
                disabled={uploadLoading}
                className="hidden"
              />
            </label>
          </div>

          {/* Generation Progress */}
          {currentJob && (
            <div className="mt-4 p-4 bg-slate-800/50 rounded-lg border border-slate-700">
              <div className="flex items-center justify-between mb-2">
                <span className="text-slate-300">Generation Status: {currentJob.status}</span>
                {currentJob.status === 'running' && (
                  <RefreshCw className="w-4 h-4 text-blue-400 animate-spin" />
                )}
              </div>
              {currentJob.totalFiles > 0 && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm text-slate-400">
                    <span>Files: {currentJob.processedFiles} / {currentJob.totalFiles}</span>
                    <span>Generated: {currentJob.generatedQAs} Q&As</span>
                  </div>
                  <div className="w-full bg-slate-700 rounded-full h-2">
                    <div
                      className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${(currentJob.processedFiles / currentJob.totalFiles) * 100}%` }}
                    />
                  </div>
                </div>
              )}
              {currentJob.errorMessage && (
                <p className="text-red-400 text-sm mt-2">{currentJob.errorMessage}</p>
              )}
            </div>
          )}
        </div>

        {/* Filters */}
        <div className="card p-6 mb-8">
          <div className="flex flex-wrap gap-4">
            <div>
              <label className="text-slate-400 text-sm mb-2 block">Category</label>
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="bg-slate-800 text-slate-100 border border-slate-700 rounded-lg px-4 py-2"
              >
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat.charAt(0).toUpperCase() + cat.slice(1)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-slate-400 text-sm mb-2 block">Source Type</label>
              <select
                value={filterSourceType}
                onChange={(e) => setFilterSourceType(e.target.value)}
                className="bg-slate-800 text-slate-100 border border-slate-700 rounded-lg px-4 py-2"
              >
                {sourceTypes.map((type) => (
                  <option key={type} value={type}>
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </option>
                ))}
              </select>
            </div>
            <button
              onClick={loadEntries}
              className="btn-secondary flex items-center space-x-2 mt-auto"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Q&A Entries List */}
        <div className="card p-6">
          <h2 className="text-xl font-bold text-slate-100 mb-4">Q&A Entries ({entries.length})</h2>
          
          {loading ? (
            <div className="text-center py-8">
              <RefreshCw className="w-8 h-8 text-blue-400 animate-spin mx-auto mb-2" />
              <p className="text-slate-400">Loading entries...</p>
            </div>
          ) : entries.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-slate-400">No Q&A entries found. Generate or upload some to get started!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {entries.map((entry) => (
                <div
                  key={entry.id}
                  className="bg-slate-800/50 rounded-lg p-4 border border-slate-700 hover:border-slate-600 transition-colors"
                >
                  {editingId === entry.id ? (
                    <div className="space-y-3">
                      <div>
                        <label className="text-slate-400 text-sm mb-1 block">Question</label>
                        <input
                          type="text"
                          value={editForm.question}
                          onChange={(e) => setEditForm({ ...editForm, question: e.target.value })}
                          className="w-full bg-slate-900 text-slate-100 border border-slate-700 rounded px-3 py-2"
                        />
                      </div>
                      <div>
                        <label className="text-slate-400 text-sm mb-1 block">Answer</label>
                        <textarea
                          value={editForm.answer}
                          onChange={(e) => setEditForm({ ...editForm, answer: e.target.value })}
                          rows={4}
                          className="w-full bg-slate-900 text-slate-100 border border-slate-700 rounded px-3 py-2"
                        />
                      </div>
                      <div>
                        <label className="text-slate-400 text-sm mb-1 block">Category</label>
                        <select
                          value={editForm.category}
                          onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                          className="bg-slate-900 text-slate-100 border border-slate-700 rounded px-3 py-2"
                        >
                          {categories.filter(c => c !== 'all').map((cat) => (
                            <option key={cat} value={cat}>{cat}</option>
                          ))}
                        </select>
                      </div>
                      <div className="flex space-x-2">
                        <button
                          onClick={handleSaveEdit}
                          className="btn-primary flex items-center space-x-2"
                        >
                          <Save className="w-4 h-4" />
                          <span>Save</span>
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="btn-secondary flex items-center space-x-2"
                        >
                          <X className="w-4 h-4" />
                          <span>Cancel</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-2">
                            <span className="px-2 py-1 bg-blue-500/20 text-blue-300 text-xs rounded">
                              {entry.category}
                            </span>
                            <span className="px-2 py-1 bg-purple-500/20 text-purple-300 text-xs rounded">
                              {entry.sourceType}
                            </span>
                            {entry.usageCount > 0 && (
                              <span className="text-slate-400 text-xs">
                                Used {entry.usageCount} times
                              </span>
                            )}
                          </div>
                          <h3 className="text-slate-100 font-semibold mb-2">{entry.question}</h3>
                          <p className="text-slate-300 text-sm">{entry.answer}</p>
                          {entry.sourceFile && (
                            <p className="text-slate-500 text-xs mt-2">Source: {entry.sourceFile}</p>
                          )}
                        </div>
                        <div className="flex space-x-2 ml-4">
                          <button
                            onClick={() => handleEdit(entry)}
                            className="p-2 hover:bg-slate-700 rounded transition-colors"
                            title="Edit"
                          >
                            <Edit2 className="w-4 h-4 text-slate-400" />
                          </button>
                          <button
                            onClick={() => handleDelete(entry.id)}
                            className="p-2 hover:bg-slate-700 rounded transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4 text-red-400" />
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
