
'use client'

import { useState, useEffect } from 'react'

interface MatrixInput {
  id?: string
  channelNumber: number
  label: string
  inputType: string
}

interface MatrixOutput {
  id?: string
  channelNumber: number
  label: string
  resolution: string
}

interface MatrixConfig {
  id?: string
  name: string
  ipAddress: string
  port: number
  tcpPort?: number
  udpPort?: number
  protocol?: string
  connectionStatus?: string
  lastTested?: string
  isActive?: boolean
  inputs: MatrixInput[]
  outputs: MatrixOutput[]
}

export default function MatrixControl() {
  const [configs, setConfigs] = useState<MatrixConfig[]>([])
  const [currentConfig, setCurrentConfig] = useState<MatrixConfig>({
    name: 'Wolf Pack Matrix',
    ipAddress: '',
    port: 4999,
    tcpPort: 5000,
    udpPort: 4000,
    protocol: 'TCP',
    isActive: true,
    inputs: Array.from({ length: 36 }, (_, i) => ({
      channelNumber: i + 1,
      label: `Input ${i + 1}`,
      inputType: 'HDMI'
    })),
    outputs: Array.from({ length: 36 }, (_, i) => ({
      channelNumber: i + 1,
      label: `Output ${i + 1}`,
      resolution: '1080p'
    }))
  })
  const [activeConfigId, setActiveConfigId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [testingConnection, setTestingConnection] = useState(false)
  const [connectionResult, setConnectionResult] = useState<{success: boolean, message: string} | null>(null)
  const [activeSection, setActiveSection] = useState<'config' | 'inputs' | 'outputs'>('config')

  const inputTypes = ['HDMI', 'Component', 'Composite', 'SDI', 'DVI', 'VGA']
  const resolutions = ['720p', '1080p', '4K', '1080i', '480p']

  useEffect(() => {
    fetchConfigurations()
  }, [])

  const fetchConfigurations = async () => {
    try {
      const response = await fetch('/api/matrix/config')
      if (response.ok) {
        const data = await response.json()
        if (data.config) {
          // Single config with inputs/outputs
          const configWithInputsOutputs = {
            ...data.config,
            inputs: data.inputs || currentConfig.inputs,
            outputs: data.outputs || currentConfig.outputs
          }
          setConfigs([configWithInputsOutputs])
          setActiveConfigId(data.config.id)
          setCurrentConfig(configWithInputsOutputs)
        } else {
          // No saved config, ensure we have 36 inputs/outputs
          if (currentConfig.inputs.length < 36) {
            setCurrentConfig({
              ...currentConfig,
              inputs: Array.from({ length: 36 }, (_, i) => ({
                channelNumber: i + 1,
                label: `Input ${i + 1}`,
                inputType: 'HDMI'
              })),
              outputs: Array.from({ length: 36 }, (_, i) => ({
                channelNumber: i + 1,
                label: `Output ${i + 1}`,
                resolution: '1080p'
              }))
            })
          }
        }
      }
    } catch (error) {
      console.error('Error fetching configurations:', error)
    }
  }

  const saveConfiguration = async () => {
    setIsLoading(true)
    try {
      // Prepare data in the format the API expects
      const configData = {
        config: {
          id: activeConfigId,
          name: currentConfig.name,
          ipAddress: currentConfig.ipAddress,
          port: currentConfig.port,
          tcpPort: currentConfig.tcpPort || 5000,
          udpPort: currentConfig.udpPort || 4000,
          protocol: currentConfig.protocol || 'TCP',
          isActive: currentConfig.isActive !== false
        },
        inputs: currentConfig.inputs.map(input => ({
          channelNumber: input.channelNumber,
          label: input.label,
          inputType: input.inputType,
          isActive: true
        })),
        outputs: currentConfig.outputs.map(output => ({
          channelNumber: output.channelNumber,
          label: output.label,
          resolution: output.resolution,
          isActive: true
        }))
      }

      const response = await fetch('/api/matrix/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(configData)
      })

      if (response.ok) {
        const data = await response.json()
        await fetchConfigurations()
        setActiveConfigId(data.config.id)
        alert('Configuration saved successfully!')
      } else {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to save configuration')
      }
    } catch (error) {
      console.error('Error saving configuration:', error)
      alert('Error saving configuration: ' + (error instanceof Error ? error.message : 'Unknown error'))
    } finally {
      setIsLoading(false)
    }
  }

  const testConnection = async () => {
    if (!currentConfig.ipAddress) {
      alert('Please enter an IP address first')
      return
    }

    setTestingConnection(true)
    setConnectionResult(null)

    try {
      const response = await fetch('/api/matrix/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ipAddress: currentConfig.ipAddress,
          port: currentConfig.port,
          configId: activeConfigId
        })
      })

      const result = await response.json()
      setConnectionResult(result)
      
      if (result.success) {
        await fetchConfigurations()
      }
    } catch (error) {
      setConnectionResult({ 
        success: false, 
        message: 'Network error occurred' 
      })
    } finally {
      setTestingConnection(false)
    }
  }

  const loadConfiguration = (config: MatrixConfig) => {
    setCurrentConfig(config)
    setActiveConfigId(config.id || null)
    setConnectionResult(null)
  }

  const updateInput = (index: number, field: keyof MatrixInput, value: string) => {
    const newInputs = [...currentConfig.inputs]
    newInputs[index] = { ...newInputs[index], [field]: value }
    setCurrentConfig({ ...currentConfig, inputs: newInputs })
  }

  const updateOutput = (index: number, field: keyof MatrixOutput, value: string) => {
    const newOutputs = [...currentConfig.outputs]
    newOutputs[index] = { ...newOutputs[index], [field]: value }
    setCurrentConfig({ ...currentConfig, outputs: newOutputs })
  }

  const getConnectionStatusColor = (status?: string) => {
    switch (status) {
      case 'connected': return 'text-green-600 bg-green-100'
      case 'error': return 'text-red-600 bg-red-100'
      default: return 'text-gray-600 bg-gray-100'
    }
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="bg-white rounded-lg shadow-lg p-6">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">🔄 Matrix Control Configuration</h2>
          <p className="text-gray-600">
            Configure your Wolf Pack matrix switcher IP settings and manage input/output labels.
          </p>
        </div>

        {/* Section Navigation */}
        <div className="border-b border-gray-200 mb-6">
          <nav className="-mb-px flex space-x-8">
            {[
              { id: 'config', name: 'Connection', icon: '🔧' },
              { id: 'inputs', name: 'Input Labels', icon: '📥' },
              { id: 'outputs', name: 'Output Labels', icon: '📤' }
            ].map((section) => (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id as any)}
                className={`${
                  activeSection === section.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                } whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm flex items-center space-x-2`}
              >
                <span>{section.icon}</span>
                <span>{section.name}</span>
              </button>
            ))}
          </nav>
        </div>

        {/* Configuration Section */}
        {activeSection === 'config' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900">Matrix Configuration</h3>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Configuration Name
                </label>
                <input
                  type="text"
                  value={currentConfig.name}
                  onChange={(e) => setCurrentConfig({ ...currentConfig, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Wolf Pack Matrix"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  IP Address *
                </label>
                <input
                  type="text"
                  value={currentConfig.ipAddress}
                  onChange={(e) => setCurrentConfig({ ...currentConfig, ipAddress: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="192.168.1.100"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Port
                </label>
                <input
                  type="number"
                  value={currentConfig.port}
                  onChange={(e) => setCurrentConfig({ ...currentConfig, port: parseInt(e.target.value) || 4999 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="4999"
                />
              </div>

              <div className="flex space-x-3">
                <button
                  onClick={testConnection}
                  disabled={testingConnection || !currentConfig.ipAddress}
                  className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                >
                  {testingConnection ? 'Testing...' : 'Test Connection'}
                </button>
                <button
                  onClick={saveConfiguration}
                  disabled={isLoading}
                  className="flex-1 bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                >
                  {isLoading ? 'Saving...' : 'Save Configuration'}
                </button>
              </div>

              {connectionResult && (
                <div className={`p-3 rounded-md ${connectionResult.success ? 'bg-green-100 border border-green-400 text-green-700' : 'bg-red-100 border border-red-400 text-red-700'}`}>
                  {connectionResult.message}
                </div>
              )}
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Saved Configurations</h3>
              {configs.length === 0 ? (
                <div className="text-gray-500 text-center py-8">
                  No saved configurations yet
                </div>
              ) : (
                <div className="space-y-2">
                  {configs.map((config) => (
                    <div
                      key={config.id}
                      onClick={() => loadConfiguration(config)}
                      className={`p-3 border rounded-md cursor-pointer hover:bg-gray-50 ${
                        activeConfigId === config.id ? 'border-blue-500 bg-blue-50' : 'border-gray-300'
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="font-medium">{config.name}</div>
                          <div className="text-sm text-gray-600">
                            {config.ipAddress}:{config.port}
                          </div>
                        </div>
                        <span className={`px-2 py-1 text-xs rounded-full ${getConnectionStatusColor(config.connectionStatus)}`}>
                          {config.connectionStatus || 'unknown'}
                        </span>
                      </div>
                      {config.lastTested && (
                        <div className="text-xs text-gray-500 mt-1">
                          Last tested: {new Date(config.lastTested).toLocaleString()}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Inputs Section */}
        {activeSection === 'inputs' && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Input Channel Labels (1-36)</h3>
              <span className="text-sm text-gray-500">Configure all 36 input channels</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-96 overflow-y-auto">
              {currentConfig.inputs.map((input, index) => (
                <div key={index} className="border border-gray-300 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-gray-900">Input {input.channelNumber}</span>
                    <span className="text-xs text-gray-500">Ch {input.channelNumber}</span>
                  </div>
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={input.label}
                      onChange={(e) => updateInput(index, 'label', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder={`Input ${input.channelNumber} label`}
                    />
                    <select
                      value={input.inputType}
                      onChange={(e) => updateInput(index, 'inputType', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {inputTypes.map(type => (
                        <option key={type} value={type}>{type}</option>
                      ))}
                    </select>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Outputs Section */}
        {activeSection === 'outputs' && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Output Channel Labels (1-36)</h3>
              <span className="text-sm text-gray-500">Configure all 36 output channels</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-96 overflow-y-auto">
              {currentConfig.outputs.map((output, index) => (
                <div key={index} className="border border-gray-300 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-gray-900">Output {output.channelNumber}</span>
                    <span className="text-xs text-gray-500">Ch {output.channelNumber}</span>
                  </div>
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={output.label}
                      onChange={(e) => updateOutput(index, 'label', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder={`Output ${output.channelNumber} label`}
                    />
                    <select
                      value={output.resolution}
                      onChange={(e) => updateOutput(index, 'resolution', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {resolutions.map(res => (
                        <option key={res} value={res}>{res}</option>
                      ))}
                    </select>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Save Button for Inputs/Outputs */}
        {(activeSection === 'inputs' || activeSection === 'outputs') && (
          <div className="mt-6 flex justify-end">
            <button
              onClick={saveConfiguration}
              disabled={isLoading}
              className="bg-green-600 text-white px-6 py-2 rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              {isLoading ? 'Saving...' : 'Save Labels'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
