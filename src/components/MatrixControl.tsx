
'use client'

import { useState, useEffect } from 'react'
import WolfpackAIMonitor from './WolfpackAIMonitor'

interface MatrixInput {
  id?: string
  channelNumber: number
  label: string
  inputType: string
  deviceType: string
  status: 'active' | 'unused' | 'no' | 'na'
}

interface MatrixOutput {
  id?: string
  channelNumber: number
  label: string
  resolution: string
  status: 'active' | 'unused' | 'no' | 'na'
  audioOutput?: string  // For audio routing to Atlas system
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
      inputType: 'HDMI',
      deviceType: 'Other',
      status: 'active' as const
    })),
    outputs: Array.from({ length: 36 }, (_, i) => ({
      channelNumber: i + 1,
      label: `Output ${i + 1}`,
      resolution: '1080p',
      status: 'active' as const,
      audioOutput: i < 4 ? `Matrix Audio ${i + 1}` : ''  // First 4 outputs get audio labels
    }))
  })
  const [activeConfigId, setActiveConfigId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [testingConnection, setTestingConnection] = useState(false)
  const [connectionResult, setConnectionResult] = useState<{success: boolean, message: string} | null>(null)
  const [activeSection, setActiveSection] = useState<'config' | 'inputs' | 'outputs' | 'ai'>('config')
  const [showAIMonitor, setShowAIMonitor] = useState(true)
  const [matrixDataForAI, setMatrixDataForAI] = useState<any>(null)

  const inputTypes = ['HDMI', 'Component', 'Composite', 'SDI', 'DVI', 'VGA']
  const deviceTypes = [
    'Cable Box', 'DirecTV Receiver', 'Dish Network Receiver', 
    'Fire TV', 'Apple TV', 'Roku', 'Chromecast', 
    'Gaming Console', 'Streaming Box', 'Local HDMI', 
    'Computer', 'Laptop', 'Other'
  ]
  const resolutions = ['720p', '1080p', '4K', '1080i', '480p']
  const statusOptions = [
    { value: 'active', label: 'Active' },
    { value: 'unused', label: 'Unused' },
    { value: 'no', label: 'NO' },
    { value: 'na', label: 'N/A' }
  ]
  const audioOutputOptions = ['', 'Matrix Audio 1', 'Matrix Audio 2', 'Matrix Audio 3', 'Matrix Audio 4']

  useEffect(() => {
    fetchConfigurations()
  }, [])

  // Update AI data when configuration changes
  useEffect(() => {
    if (currentConfig && currentConfig.name && currentConfig.inputs && currentConfig.outputs) {
      const aiData = {
        config: {
          name: currentConfig.name,
          ipAddress: currentConfig.ipAddress,
          port: currentConfig.port,
          tcpPort: currentConfig.tcpPort,
          udpPort: currentConfig.udpPort,
          protocol: currentConfig.protocol,
          connectionStatus: connectionResult?.success ? 'connected' : 
                           connectionResult?.success === false ? 'error' : 'unknown',
          lastTested: connectionResult ? new Date().toISOString() : undefined,
          isActive: currentConfig.isActive
        },
        inputs: currentConfig.inputs,
        outputs: currentConfig.outputs,
        systemHealth: {
          connectionStable: connectionResult?.success || false,
          commandLatency: Math.random() * 200 + 50, // Simulated for now
          errorRate: Math.random() * 5,
          lastError: connectionResult?.success === false ? connectionResult.message : undefined
        }
      }
      setMatrixDataForAI(aiData)
    }
  }, [currentConfig, connectionResult])

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
                inputType: 'HDMI',
                deviceType: 'Other',
                status: 'active' as const
              })),
              outputs: Array.from({ length: 36 }, (_, i) => ({
                channelNumber: i + 1,
                label: `Output ${i + 1}`,
                resolution: '1080p',
                status: 'active' as const,
                audioOutput: i < 4 ? `Matrix Audio ${i + 1}` : ''
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
          deviceType: input.deviceType || 'Other',
          status: input.status || 'active',
          isActive: input.status === 'active'
        })),
        outputs: currentConfig.outputs.map(output => ({
          channelNumber: output.channelNumber,
          label: output.label,
          resolution: output.resolution,
          status: output.status || 'active',
          audioOutput: output.audioOutput || '',
          isActive: output.status === 'active'
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
    if (field === 'status') {
      newInputs[index] = { ...newInputs[index], [field]: value as MatrixInput['status'] }
    } else {
      newInputs[index] = { ...newInputs[index], [field]: value }
    }
    setCurrentConfig({ ...currentConfig, inputs: newInputs })
  }

  const updateOutput = (index: number, field: keyof MatrixOutput, value: string) => {
    const newOutputs = [...currentConfig.outputs]
    if (field === 'status') {
      newOutputs[index] = { ...newOutputs[index], [field]: value as MatrixOutput['status'] }
    } else {
      newOutputs[index] = { ...newOutputs[index], [field]: value }
    }
    setCurrentConfig({ ...currentConfig, outputs: newOutputs })
  }

  const getConnectionStatusColor = (status?: string) => {
    switch (status) {
      case 'connected': return 'text-green-600 bg-green-100'
      case 'error': return 'text-red-600 bg-red-100'
      default: return 'text-gray-600 bg-gray-100'
    }
  }

  const loadLayoutMapping = async () => {
    try {
      // Fetch the current TV layout
      const response = await fetch('/api/bartender/layout')
      if (response.ok) {
        const data = await response.json()
        if (data.layout && data.layout.zones) {
          const newOutputs = [...currentConfig.outputs]
          
          // Map layout zones to outputs
          data.layout.zones.forEach((zone: any) => {
            const outputIndex = zone.outputNumber - 1
            if (outputIndex >= 0 && outputIndex < newOutputs.length) {
              newOutputs[outputIndex] = {
                ...newOutputs[outputIndex],
                label: zone.label || `TV ${zone.outputNumber}`,
                channelNumber: zone.outputNumber
              }
            }
          })
          
          setCurrentConfig({ ...currentConfig, outputs: newOutputs })
          alert(`Successfully imported ${data.layout.zones.length} TV positions from layout!`)
        } else {
          alert('No TV layout found. Please upload and analyze a layout first.')
        }
      }
    } catch (error) {
      console.error('Error loading layout mapping:', error)
      alert('Error loading layout mapping. Please try again.')
    }
  }

  const generateSampleLabels = () => {
    const sampleLabels = [
      // Main bar area (outputs 1-8)
      'Main Bar Center TV', 'Main Bar Left TV', 'Main Bar Right TV', 'Main Bar Corner',
      'Main Bar High Left', 'Main Bar High Right', 'Main Bar Side Wall', 'Main Bar Back Wall',
      
      // Side areas (outputs 9-16)
      'Side Area 1', 'Side Area 2', 'Side Area 3', 'Side Area Corner',
      'Side Wall Left', 'Side Wall Right', 'Side Dining Area', 'Side Booth Area',
      
      // Lower sections (outputs 17-24)
      'Lower Section 1', 'Lower Section 2', 'Lower Section 3', 'Lower Section Corner',
      'Pool Table Area', 'Gaming Area', 'Lower Dining', 'Lower Booth',
      
      // Additional positions (outputs 25-32)
      'Upper Level 1', 'Upper Level 2', 'Upper Level 3', 'Upper Level 4',
      'Private Area 1', 'Private Area 2', 'VIP Section 1', 'VIP Section 2',
      
      // Extra outputs (33-36)
      'Outdoor Patio TV', 'Kitchen Display', 'Office TV', 'Backup Display'
    ]

    const newOutputs = currentConfig.outputs.map((output, index) => ({
      ...output,
      label: sampleLabels[index] || `TV ${output.channelNumber}`
    }))

    setCurrentConfig({ ...currentConfig, outputs: newOutputs })
    alert('Sample labels applied! Customize them as needed for your layout.')
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
              { id: 'outputs', name: 'Output Labels', icon: '📤' },
              { id: 'ai', name: 'AI Monitor', icon: '🤖' }
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
              {currentConfig.inputs.map((input, index) => {
                const isUnused = input.status && input.status !== 'active';
                return (
                  <div key={index} className={`border rounded-lg p-4 ${
                    isUnused 
                      ? 'border-red-300 bg-red-50' 
                      : 'border-gray-300'
                  }`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-gray-900">Input {input.channelNumber}</span>
                      <div className="flex items-center space-x-1">
                        <span className="text-xs text-gray-500">Ch {input.channelNumber}</span>
                        {isUnused && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                            {input.status.toUpperCase()}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <input
                        type="text"
                        value={input.label}
                        onChange={(e) => updateInput(index, 'label', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder={isUnused ? `Unused Input ${input.channelNumber}` : `Input ${input.channelNumber} label`}
                        disabled={isUnused}
                      />
                      <select
                        value={input.deviceType || 'Other'}
                        onChange={(e) => updateInput(index, 'deviceType', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        disabled={isUnused}
                      >
                        {deviceTypes.map(type => (
                          <option key={type} value={type}>{type}</option>
                        ))}
                      </select>
                      <select
                        value={input.inputType}
                        onChange={(e) => updateInput(index, 'inputType', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        disabled={isUnused}
                      >
                        {inputTypes.map(type => (
                          <option key={type} value={type}>{type}</option>
                        ))}
                      </select>
                      <select
                        value={input.status || 'active'}
                        onChange={(e) => updateInput(index, 'status', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        {statusOptions.map(status => (
                          <option key={status.value} value={status.value}>{status.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Outputs Section */}
        {activeSection === 'outputs' && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Output Channel Labels & Layout Mapping</h3>
              <div className="flex space-x-2">
                <button
                  onClick={loadLayoutMapping}
                  className="bg-blue-600 text-white px-3 py-1 rounded-md hover:bg-blue-700 text-sm font-medium"
                >
                  📍 Import Layout Positions
                </button>
                <button
                  onClick={generateSampleLabels}
                  className="bg-gray-600 text-white px-3 py-1 rounded-md hover:bg-gray-700 text-sm font-medium"
                >
                  🏷️ Sample Labels
                </button>
              </div>
            </div>
            
            {/* Layout Integration Info */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
              <div className="flex items-center space-x-2">
                <span className="text-blue-600">💡</span>
                <div>
                  <h4 className="font-medium text-blue-900">Output Configuration & Audio Routing</h4>
                  <p className="text-sm text-blue-700 mb-2">
                    Configure output labels to match your TV layout positions and set up audio routing to your Atlas audio matrix:
                  </p>
                  <ul className="text-sm text-blue-700 list-disc pl-4 space-y-1">
                    <li><strong>Layout Labels:</strong> Use descriptive names that match your TV positions (e.g., "Main Bar Left", "Side Area 1")</li>
                    <li><strong>Audio Routing:</strong> Select Matrix Audio 1-4 for outputs that need audio routed to the Atlas system</li>
                    <li><strong>Unused Outputs:</strong> Mark unused outputs as "NO", "N/A", or "Unused" so the AI won't try to assign TVs to them</li>
                    <li><strong>Status:</strong> Only "Active" outputs will be used for TV control and layout mapping</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-96 overflow-y-auto">
              {currentConfig.outputs.map((output, index) => {
                const hasCustomLabel = output.label && !output.label.match(/^Output \d+$/);
                const isUnused = output.status && output.status !== 'active';
                const hasAudioOutput = output.audioOutput && output.audioOutput.trim() !== '';
                const isLayoutMapped = hasCustomLabel && (
                  output.label.includes('Main Bar') ||
                  output.label.includes('Side Area') ||
                  output.label.includes('Lower Section') ||
                  output.label.includes('TV')
                );
                
                return (
                  <div key={index} className={`border rounded-lg p-4 ${
                    isUnused 
                      ? 'border-red-300 bg-red-50'
                      : isLayoutMapped 
                        ? 'border-green-300 bg-green-50' 
                        : hasCustomLabel 
                          ? 'border-blue-300 bg-blue-50' 
                          : 'border-gray-300'
                  }`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-gray-900">Output {output.channelNumber}</span>
                      <div className="flex items-center space-x-1 flex-wrap">
                        <span className="text-xs text-gray-500">Ch {output.channelNumber}</span>
                        {isUnused && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                            {output.status.toUpperCase()}
                          </span>
                        )}
                        {!isUnused && isLayoutMapped && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            📍 Mapped
                          </span>
                        )}
                        {!isUnused && hasCustomLabel && !isLayoutMapped && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            🏷️ Custom
                          </span>
                        )}
                        {!isUnused && hasAudioOutput && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                            🔊 Audio
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <input
                        type="text"
                        value={output.label}
                        onChange={(e) => updateOutput(index, 'label', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder={isUnused ? `Unused Output ${output.channelNumber}` : `e.g., Main Bar Left, Side Area 1, Lower Section TV`}
                        disabled={isUnused}
                      />
                      <select
                        value={output.resolution}
                        onChange={(e) => updateOutput(index, 'resolution', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        disabled={isUnused}
                      >
                        {resolutions.map(res => (
                          <option key={res} value={res}>{res}</option>
                        ))}
                      </select>
                      <select
                        value={output.status || 'active'}
                        onChange={(e) => updateOutput(index, 'status', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        {statusOptions.map(status => (
                          <option key={status.value} value={status.value}>{status.label}</option>
                        ))}
                      </select>
                      {!isUnused && (
                        <select
                          value={output.audioOutput || ''}
                          onChange={(e) => updateOutput(index, 'audioOutput', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="">No Audio Output</option>
                          {audioOutputOptions.slice(1).map(audio => (
                            <option key={audio} value={audio}>{audio}</option>
                          ))}
                        </select>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Layout Mapping Statistics */}
            <div className="mt-4 p-4 bg-gray-50 rounded-lg">
              <h4 className="font-medium text-gray-900 mb-2">Mapping & Status Overview</h4>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {currentConfig.outputs.filter(o => 
                      o.status === 'active' && o.label && !o.label.match(/^Output \d+$/) && (
                        o.label.includes('Main Bar') ||
                        o.label.includes('Side Area') ||
                        o.label.includes('Lower Section') ||
                        o.label.includes('TV')
                      )
                    ).length}
                  </div>
                  <div className="text-gray-600">Layout Mapped</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    {currentConfig.outputs.filter(o => 
                      o.status === 'active' && o.label && !o.label.match(/^Output \d+$/)
                    ).length}
                  </div>
                  <div className="text-gray-600">Active Custom</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600">
                    {currentConfig.outputs.filter(o => 
                      o.status === 'active' && o.audioOutput && o.audioOutput.trim() !== ''
                    ).length}
                  </div>
                  <div className="text-gray-600">Audio Outputs</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-600">
                    {currentConfig.outputs.filter(o => 
                      o.status && o.status !== 'active'
                    ).length}
                  </div>
                  <div className="text-gray-600">Unused</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-gray-600">36</div>
                  <div className="text-gray-600">Total Outputs</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* AI Monitor Section */}
        {activeSection === 'ai' && (
          <div>
            <div className="mb-6">
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-6">
                <div className="flex items-center space-x-3 mb-4">
                  <span className="text-3xl">🤖</span>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">Wolfpack Matrix AI Assistant</h3>
                    <p className="text-gray-600">
                      Advanced AI analysis of your matrix configuration, performance, and optimization opportunities
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div className="bg-white rounded-md p-3 border border-blue-100">
                    <div className="font-semibold text-blue-900 mb-1">🔗 Connection Analysis</div>
                    <div className="text-gray-700">Network connectivity, protocol optimization, and troubleshooting</div>
                  </div>
                  <div className="bg-white rounded-md p-3 border border-blue-100">
                    <div className="font-semibold text-blue-900 mb-1">🔄 Routing Intelligence</div>
                    <div className="text-gray-700">Command optimization, switching patterns, and performance insights</div>
                  </div>
                  <div className="bg-white rounded-md p-3 border border-blue-100">
                    <div className="font-semibold text-blue-900 mb-1">📍 Layout Integration</div>
                    <div className="text-gray-700">TV mapping analysis, audio routing, and configuration recommendations</div>
                  </div>
                </div>
              </div>
            </div>

            {/* AI Monitor Component */}
            <WolfpackAIMonitor 
              matrixData={matrixDataForAI}
              isVisible={showAIMonitor}
              className="mb-6"
            />

            {/* AI Insights Summary */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="font-semibold text-gray-900 mb-2">💡 How to Use the AI Monitor</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-700">
                <div>
                  <div className="font-medium mb-1">Real-time Analysis:</div>
                  <ul className="list-disc pl-4 space-y-1">
                    <li>Click "Analyze Now" to get instant insights</li>
                    <li>AI updates automatically when you make changes</li>
                    <li>Filter by category and priority level</li>
                  </ul>
                </div>
                <div>
                  <div className="font-medium mb-1">Optimization Features:</div>
                  <ul className="list-disc pl-4 space-y-1">
                    <li>Connection troubleshooting guidance</li>
                    <li>Configuration best practices</li>
                    <li>Performance optimization tips</li>
                  </ul>
                </div>
              </div>
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
