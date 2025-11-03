'use client';

import { useState, useEffect } from 'react';
import { Upload, Sparkles, Trash2, Edit2, Save, X, BarChart3, RefreshCw } from 'lucide-react';

import { logger } from '@/lib/logger'
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
  inactive?: number;
  byCategory?: Array<{ category: string; count: number }>;
  bySource?: Array<{ source: string; count: number }>;
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
  const [forceRegenerate, setForceRegenerate] = useState(false);

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
      const result = await response.json();

      // Handle paginated response format {data: [], pagination: {}}
      if (result && typeof result === 'object' && Array.isArray(result.data)) {
        setEntries(result.data);
      } else if (Array.isArray(result)) {
        // Fallback for direct array response
        setEntries(result);
      } else {
        logger.error('Unexpected API response format:', result);
        setEntries([]);
      }
    } catch (error) {
      logger.error('Error loading entries:', error);
      setEntries([]);
    } finally {
      setLoading(false);
    }
  };

  const loadStatistics = async () => {
    try {
      const response = await fetch('/api/ai-hub/qa-training/stats');
      const data = await response.json();
      
      const validatedData: QAStatistics = {
        total: data?.total || 0,
        active: data?.active || 0,
        inactive: data?.inactive || 0,
        byCategory: Array.isArray(data?.byCategory) ? data.byCategory : [],
        bySource: Array.isArray(data?.bySource) ? data.bySource : [],
      };
      
      setStatistics(validatedData);
    } catch (error) {
      logger.error('Error loading statistics:', error);
      setStatistics({
        total: 0,
        active: 0,
        inactive: 0,
        byCategory: [],
        bySource: [],
      });
    }
  };

  const handleGenerateQAs = async (sourceType: string) => {
    setGenerateLoading(true);
    try {
      const response = await fetch('/api/ai/qa-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          sourceType,
          forceRegenerate,
        }),
      });

      const data = await response.json();
      
      if (data.jobId) {
        setCurrentJob({ ...data, id: data.jobId });
        startJobPolling(data.jobId);
      }
    } catch (error) {
      logger.error('Error generating Q&As:', error);
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
        logger.error('Error polling job status:', error);
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
      logger.error('Error uploading file:', error);
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
        body: JSON.stringify({
          id: editingId,
          ...editForm,
        }),
      });

      if (response.ok) {
        loadEntries();
        setEditingId(null);
      }
    } catch (error) {
      logger.error('Error updating entry:', error);
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
      logger.error('Error deleting entry:', error);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-slate-100">Q&A Training System</h1>
        <button
          onClick={() => {
            loadEntries();
            loadStatistics();
          }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>
      
      <p className="text-slate-300 text-sm">Train the AI Assistant</p>

      {/* Statistics Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card-dark p-6 rounded-lg shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-400">Total Q&As</p>
              <p className="text-3xl font-bold text-slate-100">{statistics?.total || 0}</p>
            </div>
            <BarChart3 className="w-8 h-8 text-blue-400" />
          </div>
        </div>

        <div className="card-dark p-6 rounded-lg shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-400">Active</p>
              <p className="text-3xl font-bold text-green-400">{statistics?.active || 0}</p>
            </div>
            <BarChart3 className="w-8 h-8 text-green-400" />
          </div>
        </div>

        <div className="card-dark p-6 rounded-lg shadow-lg">
          <div>
            <p className="text-sm text-slate-400 mb-2">By Category</p>
            {statistics?.byCategory && statistics.byCategory.length > 0 ? (
              <div className="space-y-1">
                {statistics.byCategory.slice(0, 3).map((cat) => (
                  <div key={cat.category} className="flex justify-between text-sm">
                    <span className="text-slate-300">{cat.category}</span>
                    <span className="font-semibold text-slate-100">{cat.count}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500">No data</p>
            )}
          </div>
        </div>

        <div className="card-dark p-6 rounded-lg shadow-lg">
          <div>
            <p className="text-sm text-slate-400 mb-2">By Source</p>
            {statistics?.bySource && statistics.bySource.length > 0 ? (
              <div className="space-y-1">
                {statistics.bySource.slice(0, 3).map((src) => (
                  <div key={src.source} className="flex justify-between text-sm">
                    <span className="text-slate-300">{src.source}</span>
                    <span className="font-semibold text-slate-100">{src.count}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500">No data</p>
            )}
          </div>
        </div>
      </div>

      {/* Generation Controls */}
      <div className="card-dark p-6 rounded-lg shadow-lg">
        <h2 className="text-xl font-semibold mb-4 text-slate-100">Training Actions</h2>
        
        <div className="mb-4">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={forceRegenerate}
              onChange={(e) => setForceRegenerate(e.target.checked)}
              className="w-4 h-4 form-checkbox-dark"
            />
            <span className="text-sm text-slate-300">
              Force regenerate all files (ignore file tracking)
            </span>
          </label>
          <p className="text-xs text-slate-400 mt-1 ml-6">
            When unchecked, only new or modified files will be processed
          </p>
        </div>

        <div className="flex gap-4 flex-wrap">
          <button
            onClick={() => handleGenerateQAs('repository')}
            disabled={generateLoading}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Sparkles className="w-4 h-4" />
            {generateLoading ? 'Generating...' : 'Generate from Repository'}
          </button>

          <button
            onClick={() => handleGenerateQAs('docs')}
            disabled={generateLoading}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Sparkles className="w-4 h-4" />
            {generateLoading ? 'Generating...' : 'Generate from Docs'}
          </button>

          <label className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 cursor-pointer disabled:opacity-50 transition-colors">
            <Upload className="w-4 h-4" />
            {uploadLoading ? 'Uploading...' : 'Upload Q&A File'}
            <input
              type="file"
              accept=".json,.txt"
              onChange={handleFileUpload}
              disabled={uploadLoading}
              className="hidden"
            />
          </label>
        </div>

        {currentJob && (
          <div className="mt-4 p-4 bg-slate-700/50 rounded-lg border border-slate-600">
            <div className="flex justify-between items-center mb-2">
              <span className="font-semibold text-slate-100">Generation Progress</span>
              <span className={`px-2 py-1 rounded text-sm font-medium ${
                currentJob.status === 'completed' ? 'badge-dark-success' :
                currentJob.status === 'failed' ? 'badge-dark-error' :
                'badge-dark-info'
              }`}>
                {currentJob.status}
              </span>
            </div>
            <div className="space-y-1 text-sm text-slate-300">
              <p>Files: {currentJob.processedFiles} / {currentJob.totalFiles}</p>
              <p>Generated Q&As: {currentJob.generatedQAs}</p>
              {currentJob.errorMessage && (
                <div className="mt-2 p-3 bg-red-900/30 border-l-4 border-red-600 rounded">
                  <p className="text-red-200 text-sm break-words">{currentJob.errorMessage}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="card-dark p-4 rounded-lg shadow-lg flex gap-4 flex-wrap">
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className="form-select-dark px-4 py-2 rounded-lg"
        >
          <option value="all">All Categories</option>
          <option value="general">General</option>
          <option value="technical">Technical</option>
          <option value="troubleshooting">Troubleshooting</option>
        </select>

        <select
          value={filterSourceType}
          onChange={(e) => setFilterSourceType(e.target.value)}
          className="form-select-dark px-4 py-2 rounded-lg"
        >
          <option value="all">All Sources</option>
          <option value="manual">Manual</option>
          <option value="auto-generated">Auto-generated</option>
          <option value="imported">Imported</option>
        </select>
      </div>

      {/* Q&A Entries List */}
      <div className="card-dark rounded-lg shadow-lg overflow-hidden">
        <div className="p-4 border-b border-slate-700">
          <h2 className="text-xl font-semibold text-slate-100">Q&A Entries ({entries.length})</h2>
          <p className="text-sm text-slate-400 mt-1">
            {entries.length === 0 ? 'No Q&A entries found. Generate or upload some to get started!' : 
            'Manage your Q&A training data'}
          </p>
        </div>
        
        {loading ? (
          <div className="p-8 text-center text-slate-400">Loading...</div>
        ) : entries.length === 0 ? (
          <div className="p-8 text-center text-slate-400">No Q&A entries found</div>
        ) : (
          <div className="divide-y divide-slate-700">
            {entries.map((entry) => (
              <div key={entry.id} className="p-4 hover:bg-slate-700/50 transition-colors">
                {editingId === entry.id ? (
                  <div className="space-y-3">
                    <input
                      type="text"
                      value={editForm.question}
                      onChange={(e) => setEditForm({ ...editForm, question: e.target.value })}
                      className="form-input-dark w-full px-3 py-2 rounded"
                      placeholder="Question"
                    />
                    <textarea
                      value={editForm.answer}
                      onChange={(e) => setEditForm({ ...editForm, answer: e.target.value })}
                      className="form-input-dark w-full px-3 py-2 rounded"
                      rows={3}
                      placeholder="Answer"
                    />
                    <input
                      type="text"
                      value={editForm.category}
                      onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                      className="form-input-dark w-full px-3 py-2 rounded"
                      placeholder="Category"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={handleSaveEdit}
                        className="btn-dark-success flex items-center gap-1"
                      >
                        <Save className="w-4 h-4" />
                        Save
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="btn-dark-secondary flex items-center gap-1"
                      >
                        <X className="w-4 h-4" />
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1">
                        <p className="font-semibold text-lg text-slate-100">{entry.question}</p>
                        <p className="text-slate-300 mt-1 leading-relaxed">{entry.answer}</p>
                      </div>
                      <div className="flex gap-2 ml-4">
                        <button
                          onClick={() => handleEdit(entry)}
                          className="p-2 text-blue-400 hover:bg-slate-700 rounded transition-colors"
                          title="Edit"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(entry.id)}
                          className="p-2 text-red-400 hover:bg-slate-700 rounded transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    <div className="flex gap-2 text-sm flex-wrap">
                      <span className="badge-dark-info">{entry.category}</span>
                      <span className="badge-dark-neutral">{entry.sourceType}</span>
                      {entry.sourceFile && (
                        <span className="badge-dark-neutral text-xs" title={entry.sourceFile}>
                          {entry.sourceFile.split('/').pop()}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
