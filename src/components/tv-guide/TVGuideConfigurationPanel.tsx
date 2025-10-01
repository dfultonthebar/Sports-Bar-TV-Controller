
'use client'

import React, { useState, useEffect } from 'react'

interface ServiceStatus {
  configured: boolean
  message: string
}

interface ServicesStatus {
  gracenote: ServiceStatus
  spectrum: ServiceStatus
  unified: ServiceStatus & { ready: boolean }
}

interface ApiKey {
  id: string
  name: string
  provider: string
  isActive: boolean
  description?: string
  createdAt: string
  updatedAt: string
}

interface ApiKeyFormData {
  name: string
  provider: string
  keyValue: string
  description: string
}

const TVGuideConfigurationPanel: React.FC = () => {
  const [status, setStatus] = useState<ServicesStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [testResults, setTestResults] = useState<any>(null)
  
  // API Key Management State
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([])
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingKey, setEditingKey] = useState<ApiKey | null>(null)
  const [formData, setFormData] = useState<ApiKeyFormData>({
    name: '',
    provider: '',
    keyValue: '',
    description: '',
  })
  const [activeTab, setActiveTab] = useState<'status' | 'keys'>('status')

  useEffect(() => {
    checkServicesStatus()
    loadApiKeys()
  }, [])

  const checkServicesStatus = async () => {
    try {
      const response = await fetch('/api/tv-guide/unified?action=status')
      const data = await response.json()
      setStatus(data)
    } catch (error) {
      console.error('Error checking services status:', error)
    } finally {
      setLoading(false)
    }
  }

  const testGracenoteService = async () => {
    try {
      setTestResults({ type: 'gracenote', loading: true })
      
      const response = await fetch('/api/tv-guide/gracenote?action=channels&zipCode=53703')
      const data = await response.json()
      
      setTestResults({
        type: 'gracenote',
        loading: false,
        success: data.success,
        data: data.channels?.slice(0, 5) || [], // Show first 5 channels
        message: data.success ? 'Gracenote service working correctly' : 'Gracenote service error'
      })
    } catch (error) {
      setTestResults({
        type: 'gracenote',
        loading: false,
        success: false,
        message: `Gracenote test failed: ${error}`
      })
    }
  }

  const testSpectrumService = async () => {
    try {
      setTestResults({ type: 'spectrum', loading: true })
      
      const response = await fetch('/api/tv-guide/spectrum-business?action=channels')
      const data = await response.json()
      
      setTestResults({
        type: 'spectrum',
        loading: false,
        success: data.success,
        data: data.channels?.slice(0, 5) || [], // Show first 5 channels
        message: data.success ? 'Spectrum Business API working correctly' : 'Spectrum Business API error'
      })
    } catch (error) {
      setTestResults({
        type: 'spectrum',
        loading: false,
        success: false,
        message: `Spectrum test failed: ${error}`
      })
    }
  }

  const testUnifiedService = async () => {
    try {
      setTestResults({ type: 'unified', loading: true })
      
      const response = await fetch('/api/tv-guide/unified?action=channels')
      const data = await response.json()
      
      setTestResults({
        type: 'unified',
        loading: false,
        success: data.success,
        data: {
          totalChannels: data.totalChannels,
          sportsChannels: data.sportsChannels,
          channels: data.channels?.slice(0, 5) || []
        },
        message: data.success ? 'Unified TV Guide service working correctly' : 'Unified service error'
      })
    } catch (error) {
      setTestResults({
        type: 'unified',
        loading: false,
        success: false,
        message: `Unified test failed: ${error}`
      })
    }
  }

  // API Key Management Functions
  const loadApiKeys = async () => {
    try {
      const response = await fetch('/api/keys')
      const result = await response.json()
      
      if (result.success) {
        // Filter to show TV Guide and AI service keys
        const tvGuideKeys = result.data.filter((key: ApiKey) => 
          key.provider === 'gracenote' || 
          key.provider === 'spectrum-business' ||
          key.provider === 'xai' ||
          key.provider === 'openai' ||
          key.provider === 'anthropic'
        )
        setApiKeys(tvGuideKeys)
      }
    } catch (error) {
      console.error('Error loading API keys:', error)
    }
  }

  const saveApiKey = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      const url = editingKey ? `/api/keys` : '/api/keys'
      const method = editingKey ? 'PUT' : 'POST'
      
      const payload = editingKey 
        ? { id: editingKey.id, ...formData, isActive: true }
        : { ...formData, isActive: true }

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      if (response.ok) {
        await loadApiKeys()
        await checkServicesStatus() // Refresh service status after adding keys
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

  const deleteApiKey = async (id: string) => {
    if (!confirm('Are you sure you want to delete this API key?')) return

    try {
      const response = await fetch(`/api/keys?id=${id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        await loadApiKeys()
        await checkServicesStatus() // Refresh service status after deleting keys
      } else {
        const errorData = await response.json()
        alert(`Error: ${errorData.error}`)
      }
    } catch (error) {
      console.error('Error deleting API key:', error)
      alert('Error deleting API key')
    }
  }

  const toggleApiKeyActive = async (key: ApiKey) => {
    try {
      const response = await fetch(`/api/keys`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: key.id,
          isActive: !key.isActive,
        }),
      })

      if (response.ok) {
        await loadApiKeys()
        await checkServicesStatus() // Refresh service status
      }
    } catch (error) {
      console.error('Error toggling API key:', error)
    }
  }

  const startEdit = (key: ApiKey) => {
    setEditingKey(key)
    setFormData({
      name: key.name,
      provider: key.provider,
      keyValue: '', // Don't populate for security
      description: key.description || '',
    })
    setShowAddForm(true)
  }

  const resetForm = () => {
    setFormData({ name: '', provider: '', keyValue: '', description: '' })
    setShowAddForm(false)
    setEditingKey(null)
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <p className="mt-2 text-gray-600">Checking TV Guide services...</p>
      </div>
    )
  }

  return (
    <div className="p-6 bg-slate-800 or bg-slate-900 rounded-lg shadow">
      <h2 className="text-2xl font-bold mb-6">TV Guide Configuration</h2>
      
      {/* Tab Navigation */}
      <div className="flex space-x-1 mb-6 bg-slate-800 or bg-slate-900 rounded-lg p-1">
        <button
          onClick={() => setActiveTab('status')}
          className={`flex-1 py-2 px-4 rounded-md transition-colors ${
            activeTab === 'status'
              ? 'bg-slate-800 or bg-slate-900 shadow text-blue-600 font-medium'
              : 'text-gray-600 hover:text-slate-100'
          }`}
        >
          Service Status & Testing
        </button>
        <button
          onClick={() => setActiveTab('keys')}
          className={`flex-1 py-2 px-4 rounded-md transition-colors ${
            activeTab === 'keys'
              ? 'bg-slate-800 or bg-slate-900 shadow text-blue-600 font-medium'
              : 'text-gray-600 hover:text-slate-100'
          }`}
        >
          API Keys Management
        </button>
      </div>

      {/* Service Status Tab */}
      {activeTab === 'status' && (
        <>
          {/* Service Status Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className={`p-4 rounded-lg border ${status?.gracenote.configured ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
          <div className="flex items-center mb-2">
            <div className={`w-3 h-3 rounded-full mr-2 ${status?.gracenote.configured ? 'bg-green-500' : 'bg-red-500'}`}></div>
            <h3 className="font-semibold">Gracenote API</h3>
          </div>
          <p className="text-sm text-slate-300 mb-3">{status?.gracenote.message}</p>
          <button
            onClick={testGracenoteService}
            className="px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600"
          >
            Test Service
          </button>
        </div>

        <div className={`p-4 rounded-lg border ${status?.spectrum.configured ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
          <div className="flex items-center mb-2">
            <div className={`w-3 h-3 rounded-full mr-2 ${status?.spectrum.configured ? 'bg-green-500' : 'bg-red-500'}`}></div>
            <h3 className="font-semibold">Spectrum Business</h3>
          </div>
          <p className="text-sm text-slate-300 mb-3">{status?.spectrum.message}</p>
          <button
            onClick={testSpectrumService}
            className="px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600"
          >
            Test Service
          </button>
        </div>

        <div className={`p-4 rounded-lg border ${status?.unified.ready ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'}`}>
          <div className="flex items-center mb-2">
            <div className={`w-3 h-3 rounded-full mr-2 ${status?.unified.ready ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
            <h3 className="font-semibold">Unified Guide</h3>
          </div>
          <p className="text-sm text-slate-300 mb-3">{status?.unified.message}</p>
          <button
            onClick={testUnifiedService}
            className="px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600"
          >
            Test Service
          </button>
        </div>
      </div>

      {/* API Key Configuration Instructions */}
      <div className="bg-slate-800 or bg-slate-900 p-4 rounded-lg mb-6">
        <h3 className="font-semibold mb-3">API Configuration Required</h3>
        
        <div className="space-y-4">
          <div>
            <h4 className="font-medium text-slate-200">Gracenote API Keys:</h4>
            <div className="text-sm text-slate-300 space-y-1">
              <p><code className="bg-slate-800 or bg-slate-900 px-2 py-1 rounded">GRACENOTE_API_KEY</code> - Your Gracenote API key</p>
              <p><code className="bg-slate-800 or bg-slate-900 px-2 py-1 rounded">GRACENOTE_PARTNER_ID</code> - Your Gracenote Partner ID</p>
              <p><code className="bg-slate-800 or bg-slate-900 px-2 py-1 rounded">GRACENOTE_USER_ID</code> - Your Gracenote User ID (optional)</p>
            </div>
          </div>
          
          <div>
            <h4 className="font-medium text-slate-200">Spectrum Business API Keys:</h4>
            <div className="text-sm text-slate-300 space-y-1">
              <p><code className="bg-slate-800 or bg-slate-900 px-2 py-1 rounded">SPECTRUM_BUSINESS_API_KEY</code> - Your Spectrum Business API key</p>
              <p><code className="bg-slate-800 or bg-slate-900 px-2 py-1 rounded">SPECTRUM_BUSINESS_ACCOUNT_ID</code> - Your Spectrum Business Account ID</p>
              <p><code className="bg-slate-800 or bg-slate-900 px-2 py-1 rounded">SPECTRUM_BUSINESS_REGION</code> - Your region (default: midwest)</p>
            </div>
          </div>
        </div>
        
        <div className="mt-4 p-3 bg-blue-50 rounded border border-blue-200">
          <p className="text-sm text-blue-800">
            <strong>Note:</strong> Add these environment variables to your <code>.env</code> file and restart the application. 
            The system will use fallback data when APIs are not configured.
          </p>
        </div>
      </div>

      {/* Test Results */}
      {testResults && (
        <div className="bg-slate-800 or bg-slate-900 border rounded-lg p-4">
          <h3 className="font-semibold mb-3">
            Test Results - {testResults.type.charAt(0).toUpperCase() + testResults.type.slice(1)} Service
          </h3>
          
          {testResults.loading ? (
            <div className="flex items-center">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
              <span>Testing service...</span>
            </div>
          ) : (
            <div>
              <div className={`flex items-center mb-3 ${testResults.success ? 'text-green-600' : 'text-red-600'}`}>
                <div className={`w-3 h-3 rounded-full mr-2 ${testResults.success ? 'bg-green-500' : 'bg-red-500'}`}></div>
                <span>{testResults.message}</span>
              </div>
              
              {testResults.success && testResults.data && (
                <div className="bg-slate-800 or bg-slate-900 p-3 rounded">
                  {testResults.type === 'unified' ? (
                    <div>
                      <p className="text-sm mb-2">
                        <strong>Total Channels:</strong> {testResults.data.totalChannels} | 
                        <strong> Sports Channels:</strong> {testResults.data.sportsChannels}
                      </p>
                      <div className="text-sm">
                        <strong>Sample Channels:</strong>
                        <ul className="mt-1 space-y-1">
                          {testResults.data.channels.map((channel: any, index: number) => (
                            <li key={index} className="text-gray-600">
                              {channel.number} - {channel.name} ({channel.source})
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  ) : (
                    <div className="text-sm">
                      <strong>Sample Channels:</strong>
                      <ul className="mt-1 space-y-1">
                        {testResults.data.map((channel: any, index: number) => (
                          <li key={index} className="text-gray-600">
                            {channel.number || channel.channelNumber} - {channel.name || channel.channelName}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
      </>
      )}

      {/* API Keys Management Tab */}
      {activeTab === 'keys' && (
        <>
          {/* Add/Edit Form */}
          {showAddForm && (
            <div className="bg-slate-800 or bg-slate-900 border border-slate-700 rounded-lg p-6 mb-6">
              <h4 className="text-lg font-medium text-slate-100 mb-4">
                {editingKey ? 'Edit API Key' : 'Add TV Guide API Key'}
              </h4>
              
              <form onSubmit={saveApiKey} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-200 mb-1">
                      Key Name
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="e.g., Gracenote Production Key"
                      className="w-full border border-slate-700 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-200 mb-1">
                      Provider
                    </label>
                    <select
                      value={formData.provider}
                      onChange={(e) => setFormData({ ...formData, provider: e.target.value })}
                      className="w-full border border-slate-700 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    >
                      <option value="">Select provider</option>
                      <option value="gracenote">Gracenote API</option>
                      <option value="spectrum-business">Spectrum Business</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-200 mb-1">
                    API Key
                  </label>
                  <input
                    type="password"
                    value={formData.keyValue}
                    onChange={(e) => setFormData({ ...formData, keyValue: e.target.value })}
                    placeholder={editingKey ? "Leave empty to keep current key" : "Enter your API key"}
                    className="w-full border border-slate-700 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required={!editingKey}
                  />
                  {formData.provider === 'gracenote' && (
                    <p className="text-sm text-slate-400 mt-1">
                      For Gracenote, this should be your API Key. You may need separate entries for Partner ID if required.
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-200 mb-1">
                    Description (Optional)
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Optional description for this API key"
                    rows={2}
                    className="w-full border border-slate-700 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                    className="bg-gray-300 text-slate-200 px-4 py-2 rounded-md hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* API Keys List */}
          <div className="bg-slate-800 or bg-slate-900 border border-slate-700 rounded-lg">
            <div className="flex justify-between items-center p-4 border-b border-slate-700">
              <h4 className="text-lg font-medium text-slate-100">
                TV Guide API Keys ({apiKeys.length})
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
              <div className="p-8 text-center text-slate-400">
                <p className="mb-4">No TV Guide API keys configured yet.</p>
                <p className="text-sm">Add Gracenote and Spectrum Business API keys to enable TV guide functionality.</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {apiKeys.map((key) => (
                  <div key={key.id} className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3">
                          <h5 className="text-sm font-medium text-slate-100">{key.name}</h5>
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                            key.isActive 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-slate-800 or bg-slate-900 text-slate-100'
                          }`}>
                            {key.isActive ? 'Active' : 'Inactive'}
                          </span>
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            {key.provider === 'gracenote' ? 'Gracenote' : 'Spectrum Business'}
                          </span>
                        </div>
                        {key.description && (
                          <p className="text-sm text-slate-400 mt-1">{key.description}</p>
                        )}
                        <p className="text-xs text-slate-500 mt-1">
                          Created: {new Date(key.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => toggleApiKeyActive(key)}
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
                          onClick={() => deleteApiKey(key.id)}
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
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-6">
            <h5 className="text-sm font-medium text-blue-800 mb-2">
              How to get TV Guide API keys:
            </h5>
            <ul className="text-sm text-blue-700 space-y-2">
              <li>
                <strong>Gracenote API:</strong>
                <ul className="ml-4 mt-1 space-y-1">
                  <li>• Visit <a href="https://developer.gracenote.com" target="_blank" rel="noopener noreferrer" className="underline">developer.gracenote.com</a></li>
                  <li>• Create a developer account and register your application</li>
                  <li>• Obtain your API Key, Partner ID, and User ID (if required)</li>
                  <li>• You may need separate entries for API Key and Partner ID</li>
                </ul>
              </li>
              <li>
                <strong>Spectrum Business API:</strong>
                <ul className="ml-4 mt-1 space-y-1">
                  <li>• Contact your Spectrum Business representative</li>
                  <li>• Request API access for your business account</li>
                  <li>• Obtain API Key, Account ID, and region settings</li>
                  <li>• May require separate entries for different credentials</li>
                </ul>
              </li>
            </ul>
          </div>
        </>
      )}
      
      <div className="mt-6 flex space-x-3">
        <button
          onClick={checkServicesStatus}
          className="px-4 py-2 bg-slate-800 or bg-slate-9000 text-white rounded hover:bg-gray-600"
        >
          Refresh Status
        </button>
        
        <button
          onClick={() => window.location.href = '/tv-guide'}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          disabled={!status?.unified.ready}
        >
          View TV Guide
        </button>
      </div>
    </div>
  )
}

export default TVGuideConfigurationPanel
