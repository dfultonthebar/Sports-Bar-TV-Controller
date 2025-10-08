

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
  dailyTurnOn?: boolean  // Auto turn-on for daily morning schedule
  dailyTurnOff?: boolean // Auto turn-off for nightly closing schedule
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
  cecInputChannel?: number | null
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
          protocol: currentConfig.protocol
        },
        inputs: currentConfig.inputs,
        outputs: currentConfig.outputs,
        timestamp: new Date().toISOString()
      }
      setMatrixDataForAI(aiData)
    }
  }, [currentConfig])

  const fetchConfigurations = async () => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/matrix/config')
      const data = await response.json()
      
      if (response.ok) {
        if (data.configs && data.configs.length > 0) {
          setConfigs(data.configs)
          
          // Find active config or use first one
          const activeConfig = data.configs.find((c: MatrixConfig) => c.isActive) || data.configs[0]
          
          // Ensure we have 36 inputs and outputs
          const configWithDefaults = {
            ...activeConfig,
            inputs: activeConfig.inputs || currentConfig.inputs,
            outputs: activeConfig.outputs || currentConfig.outputs,
          }
          
          setCurrentConfig(configWithDefaults)
          setActiveConfigId(activeConfig.id || null)
        } else if (data.config) {
          // Single config with inputs/outputs
          const configWithDefaults = {
            ...data.config,
            inputs: data.inputs || currentConfig.inputs,
            outputs: data.outputs || currentConfig.outputs
          }
          setCurrentConfig(configWithDefaults)
          setActiveConfigId(data.config.id || null)
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
    } finally {
      setIsLoading(false)
    }
  }

  const saveConfiguration = async () => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/matrix/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: activeConfigId,
          config: currentConfig,
          inputs: currentConfig.inputs.map(input => ({
            channelNumber: input.channelNumber,
            label: input.label,
            inputType: input.inputType,
            deviceType: input.deviceType,
            status: input.status,
            isActive: input.status === 'active'
          })),
          outputs: currentConfig.outputs.map(output => ({
            channelNumber: output.channelNumber,
            label: output.label,
            resolution: output.resolution,
            status: output.status,
            isActive: output.status === 'active',
            audioOutput: output.audioOutput || '',
            dailyTurnOn: output.dailyTurnOn || false,
            dailyTurnOff: output.dailyTurnOff || false
          }))
        })
      })

      if (response.ok) {
        const data = await response.json()
        setActiveConfigId(data.configId)
        alert('Configuration saved successfully!')
        await fetchConfigurations()
      } else {
        const error = await response.json()
        alert(`Failed to save configuration: ${error.error}`)
      }
    } catch (error) {
      console.error('Error saving configuration:', error)
      alert('Failed to save configuration')
    } finally {
      setIsLoading(false)
    }
  }

  const testConnection = async () => {
    setTestingConnection(true)
    setConnectionResult(null)
    
    try {
      const response = await fetch('/api/matrix/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ipAddress: currentConfig.ipAddress,
          port: currentConfig.port,
          protocol: currentConfig.protocol || 'TCP'
        })
      })

      const data = await response.json()
      setConnectionResult({
        success: response.ok,
        message: data.message || (response.ok ? 'Connection successful!' : 'Connection failed')
      })
    } catch (error) {
      setConnectionResult({
        success: false,
        message: 'Failed to test connection'
      })
    } finally {
      setTestingConnection(false)
    }
  }

  const updateInput = (index: number, field: keyof MatrixInput, value: any) => {
    const newInputs = [...currentConfig.inputs]
    newInputs[index] = { ...newInputs[index], [field]: value }
    
    // If status is changed to unused/no/na, update label to reflect that
    if (field === 'status' && value !== 'active') {
      newInputs[index].label = `${value.toUpperCase()} - Input ${newInputs[index].channelNumber}`
    }
    
    setCurrentConfig({ ...currentConfig, inputs: newInputs })
  }

  const updateOutput = (index: number, field: keyof MatrixOutput, value: any) => {
    const newOutputs = [...currentConfig.outputs]
    newOutputs[index] = { ...newOutputs[index], [field]: value }
    
    // If status is changed to unused/no/na, update label to reflect that
    if (field === 'status' && value !== 'active') {
      newOutputs[index].label = `${value.toUpperCase()} - Output ${newOutputs[index].channelNumber}`
    }
    
    setCurrentConfig({ ...currentConfig, outputs: newOutputs })
  }

  const importFromLayout = async () => {
    try {
      const response = await fetch('/api/bartender/layout')
      const data = await response.json()
      
      if (response.ok && data.layout && data.layout.zones) {
        const zones = data.layout.zones
        
        if (zones.length > 0) {
          const newOutputs = [...currentConfig.outputs]
          
          // Map layout zones to outputs
          zones.forEach((zone: any, index: number) => {
            if (index < newOutputs.length) {
              newOutputs[index] = {
                ...newOutputs[index],
                label: zone.label || `TV ${zone.tvNumber}`,
                status: 'active' as const
              }
            }
          })
          
          setCurrentConfig({ ...currentConfig, outputs: newOutputs })
          alert(`Imported ${zones.length} TV zones from layout!`)
        } else {
          alert('No TV zones found in layout')
        }
      } else {
        alert('No layout configuration found')
      }
    } catch (error) {
      console.error('Error importing from layout:', error)
      alert('Failed to import from layout')
    }
  }

  const autoLabelOutputs = () => {
    const newOutputs = currentConfig.outputs.map((output, index) => ({
      ...output,
      label: 
        // Main bar area (outputs 1-8)
        index < 8 ? `Main Bar TV ${index + 1}` :
        // Side areas (outputs 9-16)
        index < 16 ? `Side Area TV ${index - 7}` :
        // Lower sections (outputs 17-24)
        index < 24 ? `Lower Section TV ${index - 15}` :
        // Additional positions (outputs 25-32)
        index < 32 ? `Additional TV ${index - 23}` :
        // Extra outputs (33-36)
        `Extra Output ${index - 31}`
    }))
    
    setCurrentConfig({ ...currentConfig, outputs: newOutputs })
  }

  return (
    <div className="space-y-6">
      {/* Section Tabs */}
      <div className="flex space-x-2 border-b border-slate-700">
        <button
          onClick={() => setActiveSection('config')}
          className={`px-6 py-3 font-medium transition-colors ${
            activeSection === 'config'
              ? 'text-indigo-400 border-b-2 border-indigo-400'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Configuration
        </button>
        <button
          onClick={() => setActiveSection('inputs')}
          className={`px-6 py-3 font-medium transition-colors ${
            activeSection === 'inputs'
              ? 'text-indigo-400 border-b-2 border-indigo-400'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Inputs (1-36)
        </button>
        <button
          onClick={() => setActiveSection('outputs')}
          className={`px-6 py-3 font-medium transition-colors ${
            activeSection === 'outputs'
              ? 'text-indigo-400 border-b-2 border-indigo-400'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Outputs (1-36)
        </button>
        <button
          onClick={() => setActiveSection('ai')}
          className={`px-6 py-3 font-medium transition-colors ${
            activeSection === 'ai'
              ? 'text-indigo-400 border-b-2 border-indigo-400'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          🤖 AI Monitor
        </button>
      </div>

      {/* Configuration Section */}
      {activeSection === 'config' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Basic Configuration */}
            <div className="border border-slate-600 rounded-lg p-6 bg-slate-700/50">
              <h3 className="text-lg font-semibold mb-4 text-slate-100">Basic Configuration</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2 text-slate-200">Matrix Name</label>
                  <input
                    type="text"
                    value={currentConfig.name}
                    onChange={(e) => setCurrentConfig({ ...currentConfig, name: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-800 text-slate-100"
                    placeholder="e.g., Wolf Pack Matrix"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2 text-slate-200">IP Address</label>
                  <input
                    type="text"
                    value={currentConfig.ipAddress}
                    onChange={(e) => setCurrentConfig({ ...currentConfig, ipAddress: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-800 text-slate-100"
                    placeholder="e.g., 192.168.1.100"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2 text-slate-200">Protocol</label>
                  <select
                    value={currentConfig.protocol || 'TCP'}
                    onChange={(e) => setCurrentConfig({ ...currentConfig, protocol: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-800 text-slate-100"
                  >
                    <option value="TCP">TCP</option>
                    <option value="UDP">UDP</option>
                    <option value="HTTP">HTTP</option>
                  </select>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2 text-slate-200">Main Port</label>
                    <input
                      type="number"
                      value={currentConfig.port}
                      onChange={(e) => setCurrentConfig({ ...currentConfig, port: parseInt(e.target.value) })}
                      className="w-full px-3 py-2 border border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-800 text-slate-100"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2 text-slate-200">TCP Port</label>
                    <input
                      type="number"
                      value={currentConfig.tcpPort || 5000}
                      onChange={(e) => setCurrentConfig({ ...currentConfig, tcpPort: parseInt(e.target.value) })}
                      className="w-full px-3 py-2 border border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-800 text-slate-100"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2 text-slate-200">UDP Port</label>
                    <input
                      type="number"
                      value={currentConfig.udpPort || 4000}
                      onChange={(e) => setCurrentConfig({ ...currentConfig, udpPort: parseInt(e.target.value) })}
                      className="w-full px-3 py-2 border border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-800 text-slate-100"
                    />
                  </div>
                </div>
                <div>
                  <button
                    onClick={testConnection}
                    disabled={testingConnection || !currentConfig.ipAddress}
                    className="w-full bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {testingConnection ? 'Testing...' : 'Test Connection'}
                  </button>
                  {connectionResult && (
                    <div className={`mt-2 p-3 rounded-md ${
                      connectionResult.success 
                        ? 'bg-green-500/20 text-green-200 border border-green-500' 
                        : 'bg-red-500/20 text-red-200 border border-red-500'
                    }`}>
                      {connectionResult.message}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="border border-slate-600 rounded-lg p-6 bg-slate-700/50">
              <h3 className="text-lg font-semibold mb-4 text-slate-100">Quick Actions</h3>
              <div className="space-y-3">
                <button
                  onClick={importFromLayout}
                  className="w-full bg-blue-600 text-white px-4 py-3 rounded-md hover:bg-blue-700 text-left flex items-center justify-between"
                >
                  <span>Import TV Zones from Layout</span>
                  <span className="text-sm opacity-75">Auto-label outputs</span>
                </button>
                <button
                  onClick={autoLabelOutputs}
                  className="w-full bg-purple-600 text-white px-4 py-3 rounded-md hover:bg-purple-700 text-left flex items-center justify-between"
                >
                  <span>Auto-Label All Outputs</span>
                  <span className="text-sm opacity-75">Standard naming</span>
                </button>
                <button
                  onClick={saveConfiguration}
                  disabled={isLoading}
                  className="w-full bg-green-600 text-white px-4 py-3 rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? 'Saving...' : 'Save Configuration'}
                </button>
              </div>

              {/* Info Box */}
              <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/30 rounded-md">
                <h4 className="font-medium text-blue-200 mb-2">💡 Configuration Tips</h4>
                <ul className="text-sm text-blue-100 space-y-1">
                  <li>• Test connection before saving</li>
                  <li>• Import layout to auto-configure outputs</li>
                  <li>• First 4 outputs route audio to Atlas</li>
                  <li>• Use status filters to hide unused channels</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Hardware Layout Info */}
          <div className="border border-indigo-600 rounded-lg p-6 bg-indigo-900/20">
            <h3 className="text-lg font-semibold mb-4 text-indigo-200">🔌 Wolfpack Hardware Layout</h3>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
              <div className="bg-slate-800 p-4 rounded-lg">
                <div className="font-medium text-indigo-300 mb-2">Card 1</div>
                <div className="text-slate-300">Inputs 1-4</div>
                <div className="text-xs text-slate-400 mt-1">HDMI Inputs</div>
              </div>
              <div className="bg-slate-800 p-4 rounded-lg">
                <div className="font-medium text-indigo-300 mb-2">Card 2</div>
                <div className="text-slate-300">Inputs 5-8</div>
                <div className="text-xs text-slate-400 mt-1">HDMI Inputs</div>
              </div>
              <div className="bg-slate-800 p-4 rounded-lg">
                <div className="font-medium text-indigo-300 mb-2">Card 3</div>
                <div className="text-slate-300">Inputs 9-12</div>
                <div className="text-xs text-slate-400 mt-1">HDMI Inputs</div>
              </div>
              <div className="bg-slate-800 p-4 rounded-lg">
                <div className="font-medium text-green-300 mb-2">Card 1</div>
                <div className="text-slate-300">Outputs 1-4</div>
                <div className="text-xs text-slate-400 mt-1">→ Atlas Audio</div>
              </div>
              <div className="bg-slate-800 p-4 rounded-lg">
                <div className="font-medium text-green-300 mb-2">Card 2</div>
                <div className="text-slate-300">Outputs 5-8</div>
                <div className="text-xs text-slate-400 mt-1">HDMI Outputs</div>
              </div>
            </div>
            <div className="mt-4 text-sm text-indigo-200">
              <p className="mb-2">📌 <strong>Important:</strong> Each Wolfpack card has exactly 4 ports (either inputs OR outputs)</p>
              <p>The configuration interface displays channels in rows of 4 to match the physical hardware layout.</p>
            </div>
          </div>

          {/* Status Legend */}
          <div className="border border-slate-600 rounded-lg p-6 bg-slate-700/50">
            <h3 className="text-lg font-semibold mb-4 text-slate-100">Status Options</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <div className="font-medium text-green-400 mb-1">Active</div>
                <div className="text-slate-300">Channel is in use and configured</div>
              </div>
              <div>
                <div className="font-medium text-yellow-400 mb-1">Unused</div>
                <div className="text-slate-300">Channel exists but not currently used</div>
              </div>
              <div>
                <div className="font-medium text-red-400 mb-1">NO / N/A</div>
                <div className="text-slate-300">Channel not available or not installed</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Inputs Section - FIXED: Changed from grid-cols-3 to grid-cols-4 */}
      {activeSection === 'inputs' && (
        <div>
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-semibold text-slate-100">Input Channel Labels (1-36)</h3>
            <span className="text-sm text-slate-400 bg-slate-700/50 px-3 py-1 rounded-full">Configure all 36 input channels • Rows of 4 match hardware cards</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
            {currentConfig.inputs.map((input, index) => {
              const isUnused = input.status && input.status !== 'active';
              return (
                <div key={index} className={`border rounded-lg p-4 transition-all ${
                  isUnused 
                    ? 'border-red-600 bg-red-900/20' 
                    : 'border-slate-600 bg-slate-700/50'
                }`}>
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-medium text-slate-100">Input {input.channelNumber}</span>
                    <div className="flex items-center space-x-2">
                      <span className="text-xs text-slate-400 bg-slate-800 px-2 py-1 rounded">Ch {input.channelNumber}</span>
                      {isUnused && (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-800 text-red-200">
                          {input.status.toUpperCase()}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="space-y-2.5">
                    <div>
                      <label className="block text-xs font-medium mb-1 text-slate-300">Label</label>
                      <input
                        type="text"
                        value={input.label}
                        onChange={(e) => updateInput(index, 'label', e.target.value)}
                        className="w-full px-2 py-1.5 text-sm border border-slate-600 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-slate-800 text-slate-100"
                        placeholder={`Input ${input.channelNumber}`}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1 text-slate-300">Status</label>
                      <select
                        value={input.status}
                        onChange={(e) => updateInput(index, 'status', e.target.value)}
                        className="w-full px-2 py-1.5 text-sm border border-slate-600 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-slate-800 text-slate-100"
                      >
                        {statusOptions.map(opt => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1 text-slate-300">Input Type</label>
                      <select
                        value={input.inputType}
                        onChange={(e) => updateInput(index, 'inputType', e.target.value)}
                        className="w-full px-2 py-1.5 text-sm border border-slate-600 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-slate-800 text-slate-100"
                        disabled={isUnused}
                      >
                        {inputTypes.map(type => (
                          <option key={type} value={type}>{type}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1 text-slate-300">Device Type</label>
                      <select
                        value={input.deviceType}
                        onChange={(e) => updateInput(index, 'deviceType', e.target.value)}
                        className="w-full px-2 py-1.5 text-sm border border-slate-600 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-slate-800 text-slate-100"
                        disabled={isUnused}
                      >
                        {deviceTypes.map(type => (
                          <option key={type} value={type}>{type}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
          
          {/* Hardware Card Indicators */}
          <div className="mt-6 p-4 bg-indigo-900/20 border border-indigo-600 rounded-lg">
            <h4 className="font-medium text-indigo-200 mb-3">🔌 Hardware Card Layout (4 inputs per card)</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-9 gap-2 text-xs">
              {Array.from({ length: 9 }, (_, i) => (
                <div key={i} className="bg-slate-800 p-2 rounded text-center">
                  <div className="font-medium text-indigo-300">Card {i + 1}</div>
                  <div className="text-slate-400">Ch {i * 4 + 1}-{i * 4 + 4}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Outputs Section - FIXED: Changed from grid-cols-3 to grid-cols-4 */}
      {activeSection === 'outputs' && (
        <div>
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-semibold text-slate-100">Output Channel Labels (1-36)</h3>
            <div className="flex items-center space-x-3">
              <span className="text-sm text-slate-400 bg-slate-700/50 px-3 py-1 rounded-full">Configure all 36 output channels • Rows of 4 match hardware cards</span>
              <button
                onClick={importFromLayout}
                className="text-sm bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700"
              >
                Import from Layout
              </button>
            </div>
          </div>

          {/* Audio Routing Info */}
          <div className="mb-6 p-4 bg-green-900/20 border border-green-600 rounded-lg">
            <h4 className="font-medium text-green-200 mb-2">🔊 Audio Routing to Atlas System</h4>
            <div className="text-sm text-green-100">
              <p className="mb-2">The first 4 outputs (Outputs 1-4) are configured to route audio to the Atlas audio processor:</p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>Output 1 → Matrix Audio 1 (Atlas Input 1)</li>
                <li>Output 2 → Matrix Audio 2 (Atlas Input 2)</li>
                <li>Output 3 → Matrix Audio 3 (Atlas Input 3)</li>
                <li>Output 4 → Matrix Audio 4 (Atlas Input 4)</li>
              </ul>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
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
                <div key={index} className={`border rounded-lg p-4 transition-all ${
                  isUnused 
                    ? 'border-red-600 bg-red-900/20'
                    : isLayoutMapped 
                      ? 'border-green-600 bg-green-900/20' 
                      : hasCustomLabel 
                        ? 'border-indigo-600 bg-indigo-900/20' 
                        : 'border-slate-600 bg-slate-700/50'
                }`}>
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-medium text-slate-100">Output {output.channelNumber}</span>
                    <div className="flex items-center space-x-2">
                      <span className="text-xs text-slate-400 bg-slate-800 px-2 py-1 rounded">Ch {output.channelNumber}</span>
                      {hasAudioOutput && (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-800 text-green-200">
                          🔊 Audio
                        </span>
                      )}
                      {isLayoutMapped && (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-800 text-blue-200">
                          📍 Mapped
                        </span>
                      )}
                      {isUnused && (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-800 text-red-200">
                          {output.status.toUpperCase()}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="space-y-2.5">
                    <div>
                      <label className="block text-xs font-medium mb-1 text-slate-300">Label</label>
                      <input
                        type="text"
                        value={output.label}
                        onChange={(e) => updateOutput(index, 'label', e.target.value)}
                        className="w-full px-2 py-1.5 text-sm border border-slate-600 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-slate-800 text-slate-100"
                        placeholder={`Output ${output.channelNumber}`}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1 text-slate-300">Status</label>
                      <select
                        value={output.status}
                        onChange={(e) => updateOutput(index, 'status', e.target.value)}
                        className="w-full px-2 py-1.5 text-sm border border-slate-600 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-slate-800 text-slate-100"
                      >
                        {statusOptions.map(opt => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1 text-slate-300">Resolution</label>
                      <select
                        value={output.resolution}
                        onChange={(e) => updateOutput(index, 'resolution', e.target.value)}
                        className="w-full px-2 py-1.5 text-sm border border-slate-600 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-slate-800 text-slate-100"
                        disabled={isUnused}
                      >
                        {resolutions.map(res => (
                          <option key={res} value={res}>{res}</option>
                        ))}
                      </select>
                    </div>
                    {index < 4 && (
                      <div>
                        <label className="block text-xs font-medium mb-1 text-green-300">Audio Output</label>
                        <select
                          value={output.audioOutput || ''}
                          onChange={(e) => updateOutput(index, 'audioOutput', e.target.value)}
                          className="w-full px-2 py-1.5 text-sm border border-green-600 rounded focus:outline-none focus:ring-1 focus:ring-green-500 bg-slate-800 text-slate-100"
                          disabled={isUnused}
                        >
                          {audioOutputOptions.map(opt => (
                            <option key={opt} value={opt}>{opt || 'None'}</option>
                          ))}
                        </select>
                      </div>
                    )}
                    <div className="flex items-center space-x-3 pt-2 border-t border-slate-600">
                      <label className="flex items-center space-x-2 text-xs text-slate-300">
                        <input
                          type="checkbox"
                          checked={output.dailyTurnOn || false}
                          onChange={(e) => updateOutput(index, 'dailyTurnOn', e.target.checked)}
                          className="rounded border-slate-600 text-indigo-600 focus:ring-indigo-500"
                          disabled={isUnused}
                        />
                        <span>Daily ON</span>
                      </label>
                      <label className="flex items-center space-x-2 text-xs text-slate-300">
                        <input
                          type="checkbox"
                          checked={output.dailyTurnOff || false}
                          onChange={(e) => updateOutput(index, 'dailyTurnOff', e.target.checked)}
                          className="rounded border-slate-600 text-indigo-600 focus:ring-indigo-500"
                          disabled={isUnused}
                        />
                        <span>Daily OFF</span>
                      </label>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Hardware Card Indicators */}
          <div className="mt-6 p-4 bg-indigo-900/20 border border-indigo-600 rounded-lg">
            <h4 className="font-medium text-indigo-200 mb-3">🔌 Hardware Card Layout (4 outputs per card)</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-9 gap-2 text-xs">
              {Array.from({ length: 9 }, (_, i) => (
                <div key={i} className={`p-2 rounded text-center ${
                  i === 0 ? 'bg-green-900/30 border border-green-600' : 'bg-slate-800'
                }`}>
                  <div className={`font-medium ${i === 0 ? 'text-green-300' : 'text-indigo-300'}`}>
                    Card {i + 1}
                    {i === 0 && ' 🔊'}
                  </div>
                  <div className="text-slate-400">Ch {i * 4 + 1}-{i * 4 + 4}</div>
                  {i === 0 && <div className="text-green-400 text-[10px] mt-1">→ Atlas Audio</div>}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* AI Monitor Section */}
      {activeSection === 'ai' && (
        <div>
          <WolfpackAIMonitor 
            matrixData={matrixDataForAI}
            isVisible={showAIMonitor}
            className="w-full"
          />
        </div>
      )}

      {/* Save Button (always visible at bottom) */}
      <div className="sticky bottom-0 bg-slate-800 border-t border-slate-700 p-4 -mx-6 -mb-6 mt-6">
        <div className="flex justify-between items-center max-w-7xl mx-auto">
          <div className="text-sm text-slate-400">
            {activeSection === 'inputs' && 'Configure input channels and device types'}
            {activeSection === 'outputs' && 'Configure output channels and audio routing'}
            {activeSection === 'config' && 'Configure matrix connection settings'}
            {activeSection === 'ai' && 'AI-powered analysis and recommendations'}
          </div>
          <button
            onClick={saveConfiguration}
            disabled={isLoading}
            className="bg-green-600 text-white px-6 py-2 rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            {isLoading ? 'Saving...' : 'Save All Changes'}
          </button>
        </div>
      </div>
    </div>
  )
}

