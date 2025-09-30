
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

const TVGuideConfigurationPanel: React.FC = () => {
  const [status, setStatus] = useState<ServicesStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [testResults, setTestResults] = useState<any>(null)

  useEffect(() => {
    checkServicesStatus()
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

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <p className="mt-2 text-gray-600">Checking TV Guide services...</p>
      </div>
    )
  }

  return (
    <div className="p-6 bg-white rounded-lg shadow">
      <h2 className="text-2xl font-bold mb-6">TV Guide Configuration</h2>
      
      {/* Service Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className={`p-4 rounded-lg border ${status?.gracenote.configured ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
          <div className="flex items-center mb-2">
            <div className={`w-3 h-3 rounded-full mr-2 ${status?.gracenote.configured ? 'bg-green-500' : 'bg-red-500'}`}></div>
            <h3 className="font-semibold">Gracenote API</h3>
          </div>
          <p className="text-sm text-gray-600 mb-3">{status?.gracenote.message}</p>
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
          <p className="text-sm text-gray-600 mb-3">{status?.spectrum.message}</p>
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
          <p className="text-sm text-gray-600 mb-3">{status?.unified.message}</p>
          <button
            onClick={testUnifiedService}
            className="px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600"
          >
            Test Service
          </button>
        </div>
      </div>

      {/* API Key Configuration Instructions */}
      <div className="bg-gray-50 p-4 rounded-lg mb-6">
        <h3 className="font-semibold mb-3">API Configuration Required</h3>
        
        <div className="space-y-4">
          <div>
            <h4 className="font-medium text-gray-700">Gracenote API Keys:</h4>
            <div className="text-sm text-gray-600 space-y-1">
              <p><code className="bg-white px-2 py-1 rounded">GRACENOTE_API_KEY</code> - Your Gracenote API key</p>
              <p><code className="bg-white px-2 py-1 rounded">GRACENOTE_PARTNER_ID</code> - Your Gracenote Partner ID</p>
              <p><code className="bg-white px-2 py-1 rounded">GRACENOTE_USER_ID</code> - Your Gracenote User ID (optional)</p>
            </div>
          </div>
          
          <div>
            <h4 className="font-medium text-gray-700">Spectrum Business API Keys:</h4>
            <div className="text-sm text-gray-600 space-y-1">
              <p><code className="bg-white px-2 py-1 rounded">SPECTRUM_BUSINESS_API_KEY</code> - Your Spectrum Business API key</p>
              <p><code className="bg-white px-2 py-1 rounded">SPECTRUM_BUSINESS_ACCOUNT_ID</code> - Your Spectrum Business Account ID</p>
              <p><code className="bg-white px-2 py-1 rounded">SPECTRUM_BUSINESS_REGION</code> - Your region (default: midwest)</p>
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
        <div className="bg-white border rounded-lg p-4">
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
                <div className="bg-gray-50 p-3 rounded">
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
      
      <div className="mt-6 flex space-x-3">
        <button
          onClick={checkServicesStatus}
          className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
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
