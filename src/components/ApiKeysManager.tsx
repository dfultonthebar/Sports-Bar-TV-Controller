
'use client'

import { useState, useEffect } from 'react'

interface ApiKey {
  id: string
  name: string
  provider: string
  isActive: boolean
  description?: string
  createdAt: string
  updatedAt: string
}

const PROVIDERS = [
  { value: 'abacus', label: 'Abacus AI', description: 'Abacus.AI enhanced models with advanced reasoning' },
  { value: 'openai', label: 'OpenAI', description: 'OpenAI GPT models' },
  { value: 'claude', label: 'Claude (Anthropic)', description: 'Anthropic\'s Claude models' },
  { value: 'grok', label: 'Grok (X.AI)', description: 'X.AI\'s Grok model' },
  { value: 'ollama', label: 'Ollama (Local)', description: 'Local LLM server running on localhost:11434' },
  { value: 'localai', label: 'LocalAI', description: 'Local AI server running on localhost:8080' },
  { value: 'custom-local', label: 'Custom Local AI', description: 'Local AI service running on localhost:8000' },
  { value: 'gracenote', label: 'Gracenote API', description: 'Professional TV guide data with comprehensive sports metadata' },
  { value: 'spectrum-business', label: 'Spectrum Business', description: 'Account-specific channel lineup and programming data' },
]

export default function ApiKeysManager() {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingKey, setEditingKey] = useState<ApiKey | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    provider: '',
    keyValue: '',
    description: '',
  })

  useEffect(() => {
    fetchApiKeys()
  }, [])

  const fetchApiKeys = async () => {
    try {
      const response = await fetch('/api/api-keys')
      if (response.ok) {
        const data = await response.json()
        setApiKeys(data.apiKeys || [])
      }
    } catch (error) {
      console.error('Error fetching API keys:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      const url = editingKey ? `/api/api-keys/${editingKey.id}` : '/api/api-keys'
      const method = editingKey ? 'PUT' : 'POST'
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          isActive: true,
        }),
      })

      if (response.ok) {
        await fetchApiKeys()
        resetForm()
      } else {
        const errorData = await response.json()
        alert(`Error: ${errorData.error}`)
      }
    } catch (error) {
      console.error('Error saving API key:', error)
      alert('Error saving API key')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this API key?')) return

    try {
      const response = await fetch(`/api/api-keys/${id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        await fetchApiKeys()
      } else {
        const errorData = await response.json()
        alert(`Error: ${errorData.error}`)
      }
    } catch (error) {
      console.error('Error deleting API key:', error)
      alert('Error deleting API key')
    }
  }

  const handleToggleActive = async (key: ApiKey) => {
    try {
      const response = await fetch(`/api/api-keys/${key.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: key.name,
          provider: key.provider,
          description: key.description,
          isActive: !key.isActive,
        }),
      })

      if (response.ok) {
        await fetchApiKeys()
      }
    } catch (error) {
      console.error('Error toggling API key:', error)
    }
  }

  const resetForm = () => {
    setFormData({ name: '', provider: '', keyValue: '', description: '' })
    setShowAddForm(false)
    setEditingKey(null)
  }

  const startEdit = (key: ApiKey) => {
    setEditingKey(key)
    setFormData({
      name: key.name,
      provider: key.provider,
      keyValue: '', // Don't populate the key value for security
      description: key.description || '',
    })
    setShowAddForm(true)
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="text-xl font-semibold text-gray-900 mb-2">
          API Keys Management
        </h3>
        <p className="text-gray-600">
          Configure API keys for AI providers to enable chat functionality
        </p>
      </div>

      {/* Add/Edit Form */}
      {showAddForm && (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h4 className="text-lg font-medium text-gray-900 mb-4">
            {editingKey ? 'Edit API Key' : 'Add New API Key'}
          </h4>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Name
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., My Grok API Key"
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Provider
              </label>
              <select
                value={formData.provider}
                onChange={(e) => setFormData({ ...formData, provider: e.target.value })}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="">Select a provider</option>
                {PROVIDERS.map((provider) => (
                  <option key={provider.value} value={provider.value}>
                    {provider.label}
                  </option>
                ))}
              </select>
              {formData.provider && (
                <p className="text-sm text-gray-500 mt-1">
                  {PROVIDERS.find(p => p.value === formData.provider)?.description}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                API Key
              </label>
              <input
                type="password"
                value={formData.keyValue}
                onChange={(e) => setFormData({ ...formData, keyValue: e.target.value })}
                placeholder={editingKey ? "Leave empty to keep current key" : "Enter your API key"}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required={!editingKey}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description (Optional)
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Optional description for this API key"
                rows={2}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex space-x-3">
              <button
                type="submit"
                className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {editingKey ? 'Update' : 'Add'} API Key
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="bg-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* API Keys List */}
      <div className="bg-white border border-gray-200 rounded-lg">
        <div className="flex justify-between items-center p-4 border-b border-gray-200">
          <h4 className="text-lg font-medium text-gray-900">
            Configured API Keys ({apiKeys.length})
          </h4>
          {!showAddForm && (
            <button
              onClick={() => setShowAddForm(true)}
              className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              Add API Key
            </button>
          )}
        </div>

        {apiKeys.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <p className="mb-4">No API keys configured yet.</p>
            <p className="text-sm">Add an API key to enable AI chat functionality.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {apiKeys.map((key) => (
              <div key={key.id} className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3">
                      <h5 className="text-sm font-medium text-gray-900">{key.name}</h5>
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        key.isActive 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {key.isActive ? 'Active' : 'Inactive'}
                      </span>
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {PROVIDERS.find(p => p.value === key.provider)?.label || key.provider}
                      </span>
                    </div>
                    {key.description && (
                      <p className="text-sm text-gray-500 mt-1">{key.description}</p>
                    )}
                    <p className="text-xs text-gray-400 mt-1">
                      Created: {new Date(key.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => handleToggleActive(key)}
                      className={`text-sm px-3 py-1 rounded ${
                        key.isActive
                          ? 'text-orange-600 hover:text-orange-800'
                          : 'text-green-600 hover:text-green-800'
                      }`}
                    >
                      {key.isActive ? 'Deactivate' : 'Activate'}
                    </button>
                    <button
                      onClick={() => startEdit(key)}
                      className="text-blue-600 hover:text-blue-800 text-sm"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(key.id)}
                      className="text-red-600 hover:text-red-800 text-sm"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Usage Instructions */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h5 className="text-sm font-medium text-blue-800 mb-2">
          How to get API keys:
        </h5>
        <ul className="text-sm text-blue-700 space-y-1">
          <li>• <strong>Abacus AI:</strong> Visit <a href="https://abacus.ai/app/route-llm-apis" target="_blank" rel="noopener noreferrer" className="underline">abacus.ai/app/route-llm-apis</a> to get your RouteLLM API key</li>
          <li>• <strong>OpenAI:</strong> Visit <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="underline">platform.openai.com/api-keys</a></li>
          <li>• <strong>Claude (Anthropic):</strong> Visit <a href="https://console.anthropic.com" target="_blank" rel="noopener noreferrer" className="underline">console.anthropic.com</a></li>
          <li>• <strong>Grok (X.AI):</strong> Visit <a href="https://x.ai" target="_blank" rel="noopener noreferrer" className="underline">x.ai</a> to get your API key</li>
          <li>• <strong>Ollama (Local):</strong> Install Ollama locally and pull a model (e.g., <code className="bg-blue-100 px-1 rounded">ollama pull llama3.2:3b</code>) - No API key required</li>
          <li>• <strong>LocalAI:</strong> Run LocalAI server on port 8080 - No API key required for local usage</li>
          <li>• <strong>Custom Local AI:</strong> Configure your local AI service to run on port 8000 - No API key required</li>
          <li>• <strong>Gracenote API:</strong> Visit <a href="https://developer.gracenote.com" target="_blank" rel="noopener noreferrer" className="underline">developer.gracenote.com</a> to get your API key and Partner ID</li>
          <li>• <strong>Spectrum Business:</strong> Contact your Spectrum Business representative to request API access credentials</li>
        </ul>
        
        <div className="mt-3 pt-3 border-t border-blue-200">
          <h6 className="text-sm font-medium text-blue-800 mb-2">Local AI Services Status:</h6>
          <div className="text-xs text-blue-600 space-y-1">
            <div>• Port 8000: <span className="text-green-700">Active</span> (Custom service detected)</div>
            <div>• Port 11434: <span className="text-gray-600">Check if Ollama is running</span></div>
            <div>• Port 8080: <span className="text-gray-600">Check if LocalAI is running</span></div>
          </div>
        </div>
      </div>
    </div>
  )
}
