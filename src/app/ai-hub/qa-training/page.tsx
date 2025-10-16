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
      console.error('Error loading statistics:', error);
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
      console.error('Error updating entry:', error);
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
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Q&A Training</h1>
        <button
          onClick={() => {
            loadEntries();
            loadStatistics();
          }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Statistics Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Q&As</p>
              <p className="text-3xl font-bold">{statistics?.total || 0}</p>
            </div>
            <BarChart3 className="w-8 h-8 text-blue-600" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Active</p>
              <p className="text-3xl font-bold text-green-600">{statistics?.active || 0}</p>
            </div>
            <BarChart3 className="w-8 h-8 text-green-600" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <div>
            <p className="text-sm text-gray-600 mb-2">By Category</p>
            {statistics?.byCategory && statistics.byCategory.length > 0 ? (
              <div className="space-y-1">
                {statistics.byCategory.slice(0, 3).map((cat) => (
                  <div key={cat.category} className="flex justify-between text-sm">
                    <span className="text-gray-700">{cat.category}</span>
                    <span className="font-semibold">{cat.count}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400">No data</p>
            )}
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <div>
            <p className="text-sm text-gray-600 mb-2">By Source</p>
            {statistics?.bySource && statistics.bySource.length > 0 ? (
              <div className="space-y-1">
                {statistics.bySource.slice(0, 3).map((src) => (
                  <div key={src.source} className="flex justify-between text-sm">
                    <span className="text-gray-700">{src.source}</span>
                    <span className="font-semibold">{src.count}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400">No data</p>
            )}
          </div>
        </div>
      </div>

      {/* Generation Controls */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-4">Generate Q&As</h2>
        
        <div className="mb-4">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={forceRegenerate}
              onChange={(e) => setForceRegenerate(e.target.checked)}
              className="w-4 h-4"
            />
            <span className="text-sm text-gray-700">
              Force regenerate all files (ignore file tracking)
            </span>
          </label>
          <p className="text-xs text-gray-500 mt-1 ml-6">
            When unchecked, only new or modified files will be processed
          </p>
        </div>

        <div className="flex gap-4">
          <button
            onClick={() => handleGenerateQAs('repository')}
            disabled={generateLoading}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
          >
            <Sparkles className="w-4 h-4" />
            {generateLoading ? 'Generating...' : 'Generate from Repository'}
          </button>

          <label className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 cursor-pointer">
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
          <div className="mt-4 p-4 bg-gray-50 rounded-lg">
            <div className="flex justify-between items-center mb-2">
              <span className="font-semibold">Generation Progress</span>
              <span className={`px-2 py-1 rounded text-sm ${
                currentJob.status === 'completed' ? 'bg-green-100 text-green-800' :
                currentJob.status === 'failed' ? 'bg-red-100 text-red-800' :
                'bg-blue-100 text-blue-800'
              }`}>
                {currentJob.status}
              </span>
            </div>
            <div className="space-y-1 text-sm">
              <p>Files: {currentJob.processedFiles} / {currentJob.totalFiles}</p>
              <p>Generated Q&As: {currentJob.generatedQAs}</p>
              {currentJob.errorMessage && (
                <p className="text-red-600">{currentJob.errorMessage}</p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg shadow flex gap-4">
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className="px-4 py-2 border rounded-lg"
        >
          <option value="all">All Categories</option>
          <option value="general">General</option>
          <option value="technical">Technical</option>
          <option value="troubleshooting">Troubleshooting</option>
        </select>

        <select
          value={filterSourceType}
          onChange={(e) => setFilterSourceType(e.target.value)}
          className="px-4 py-2 border rounded-lg"
        >
          <option value="all">All Sources</option>
          <option value="manual">Manual</option>
          <option value="auto-generated">Auto-generated</option>
          <option value="imported">Imported</option>
        </select>
      </div>

      {/* Q&A Entries List */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-4 border-b">
          <h2 className="text-xl font-semibold">Q&A Entries ({entries.length})</h2>
        </div>
        
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading...</div>
        ) : entries.length === 0 ? (
          <div className="p-8 text-center text-gray-500">No Q&A entries found</div>
        ) : (
          <div className="divide-y">
            {entries.map((entry) => (
              <div key={entry.id} className="p-4 hover:bg-gray-50">
                {editingId === entry.id ? (
                  <div className="space-y-3">
                    <input
                      type="text"
                      value={editForm.question}
                      onChange={(e) => setEditForm({ ...editForm, question: e.target.value })}
                      className="w-full px-3 py-2 border rounded"
                      placeholder="Question"
                    />
                    <textarea
                      value={editForm.answer}
                      onChange={(e) => setEditForm({ ...editForm, answer: e.target.value })}
                      className="w-full px-3 py-2 border rounded"
                      rows={3}
                      placeholder="Answer"
                    />
                    <input
                      type="text"
                      value={editForm.category}
                      onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                      className="w-full px-3 py-2 border rounded"
                      placeholder="Category"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={handleSaveEdit}
                        className="flex items-center gap-1 px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700"
                      >
                        <Save className="w-4 h-4" />
                        Save
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="flex items-center gap-1 px-3 py-1 bg-gray-600 text-white rounded hover:bg-gray-700"
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
                        <p className="font-semibold text-lg">{entry.question}</p>
                        <p className="text-gray-700 mt-1">{entry.answer}</p>
                      </div>
                      <div className="flex gap-2 ml-4">
                        <button
                          onClick={() => handleEdit(entry)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(entry.id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    <div className="flex gap-2 text-sm text-gray-500">
                      <span className="px-2 py-1 bg-gray-100 rounded">{entry.category}</span>
                      <span className="px-2 py-1 bg-gray-100 rounded">{entry.sourceType}</span>
                      {entry.sourceFile && (
                        <span className="px-2 py-1 bg-gray-100 rounded text-xs">
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
