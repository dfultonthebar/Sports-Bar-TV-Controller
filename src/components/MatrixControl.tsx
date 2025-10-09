
'use client'

import { useState, useEffect } from 'react'
import { toast } from 'react-hot-toast'

interface MatrixInput {
  channelNumber: number
  label: string
  inputType: string
  deviceType: string
  status: string
  isActive: boolean
}

interface MatrixOutput {
  channelNumber: number
  label: string
  resolution: string
  status: string
  audioOutput?: string
  isActive: boolean
}

interface MatrixConfig {
  id?: string
  name: string
  ipAddress: string
  port: number
  tcpPort?: number
  udpPort?: number
  protocol: string
  isActive: boolean
  inputs: MatrixInput[]
  outputs: MatrixOutput[]
}

type TabType = 'inputs' | 'outputs'

export default function MatrixControl() {
  const [configs, setConfigs] = useState<MatrixConfig[]>([])
  const [currentConfig, setCurrentConfig] = useState<MatrixConfig>({
    name: 'Wolf Pack Matrix',
    ipAddress: '',
    port: 23,
    tcpPort: 23,
    udpPort: 4000,
    protocol: 'TCP',
    isActive: true,
    inputs: Array.from({ length: 36 }, (_, i) => ({
      channelNumber: i + 1,
      label: i < 17 ? `Input ${i + 1}` : 
             i < 32 ? `Additional Input ${i - 16}` :
             `Matrix ${i - 31}`,
      inputType: 'HDMI',
      deviceType: 'Other',
      status: 'active',
      isActive: true
    })),
    outputs: Array.from({ length: 36 }, (_, i) => ({
      channelNumber: i + 1,
      label: i < 5 ? `Matrix ${i + 1}` :
             i < 29 ? `TV ${String(i - 3).padStart(2, '0')}` :
             i < 32 ? `Additional TV ${i - 23}` :
             `Additional Output ${i - 31}`,
      resolution: '1080p',
      status: 'active',
      audioOutput: i < 4 ? `Matrix ${i + 1}` : undefined,
      isActive: true
    }))
  })
  const [loading, setLoading] = useState(false)
  const [testingConnection, setTestingConnection] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<string>('')
  const [activeTab, setActiveTab] = useState<TabType>('inputs')

  useEffect(() => {
    loadConfigurations()
  }, [])

  const loadConfigurations = async () => {
    try {
      const response = await fetch('/api/matrix/config')
      if (response.ok) {
        const data = await response.json()
        setConfigs(data.configs || [])
        if (data.configs && data.configs.length > 0) {
          const activeConfig = data.configs.find((c: MatrixConfig) => c.isActive) || data.configs[0]
          setCurrentConfig(activeConfig)
        }
      }
    } catch (error) {
      console.error('Error loading configurations:', error)
      toast.error('Failed to load configurations')
    }
  }

  const saveConfiguration = async () => {
    setLoading(true)
    try {
      // Extract inputs and outputs from currentConfig, and send the rest as config
      const { inputs, outputs, ...configData } = currentConfig
      
      const response = await fetch('/api/matrix/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          config: configData,
          inputs: inputs,
          outputs: outputs
        })
      })

      if (response.ok) {
        toast.success('Configuration saved successfully')
        await loadConfigurations()
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to save configuration')
      }
    } catch (error) {
      console.error('Error saving configuration:', error)
      toast.error('Failed to save configuration')
    } finally {
      setLoading(false)
    }
  }

  const testConnection = async () => {
    setTestingConnection(true)
    setConnectionStatus('Testing connection...')
    
    try {
      const response = await fetch('/api/matrix/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ipAddress: currentConfig.ipAddress,
          port: currentConfig.protocol === 'TCP' ? currentConfig.tcpPort : currentConfig.udpPort,
          protocol: currentConfig.protocol
        })
      })

      const data = await response.json()
      
      if (data.success) {
        setConnectionStatus('✓ Connected successfully')
        toast.success('Connection successful')
      } else {
        setConnectionStatus(`✗ Connection failed: ${data.error}`)
        toast.error('Connection failed')
      }
    } catch (error) {
      setConnectionStatus('✗ Connection error')
      toast.error('Connection test failed')
    } finally {
      setTestingConnection(false)
    }
  }

  const updateInput = (index: number, field: keyof MatrixInput, value: any) => {
    const newInputs = [...currentConfig.inputs]
    newInputs[index] = { ...newInputs[index], [field]: value }
    setCurrentConfig({ ...currentConfig, inputs: newInputs })
  }

  const updateOutput = (index: number, field: keyof MatrixOutput, value: any) => {
    const newOutputs = [...currentConfig.outputs]
    newOutputs[index] = { ...newOutputs[index], [field]: value }
    setCurrentConfig({ ...currentConfig, outputs: newOutputs })
  }

  return (
    <div className="space-y-6">
      <div className="bg-slate-900 rounded-lg shadow-xl p-6 border border-slate-700">
        <h2 className="text-2xl font-bold mb-6 text-slate-100">Matrix Configuration</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div>
            <label className="block text-sm font-medium mb-2 text-slate-200">Configuration Name</label>
            <input
              type="text"
              value={currentConfig.name}
              onChange={(e) => setCurrentConfig({ ...currentConfig, name: e.target.value })}
              className="w-full px-3 py-2 border border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-800 text-slate-100"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-2 text-slate-200">IP Address</label>
            <input
              type="text"
              value={currentConfig.ipAddress}
              onChange={(e) => setCurrentConfig({ ...currentConfig, ipAddress: e.target.value })}
              placeholder="192.168.1.100"
              className="w-full px-3 py-2 border border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-800 text-slate-100"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2 text-slate-200">Protocol</label>
            <select
              value={currentConfig.protocol}
              onChange={(e) => setCurrentConfig({ ...currentConfig, protocol: e.target.value })}
              className="w-full px-3 py-2 border border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-800 text-slate-100"
            >
              <option value="TCP">TCP</option>
              <option value="UDP">UDP</option>
            </select>
          </div>

          {currentConfig.protocol === 'TCP' && (
            <div>
              <label className="block text-sm font-medium mb-2 text-slate-200">TCP Port</label>
              <input
                type="number"
                value={currentConfig.tcpPort || 23}
                onChange={(e) => setCurrentConfig({ ...currentConfig, tcpPort: parseInt(e.target.value) })}
                className="w-full px-3 py-2 border border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-800 text-slate-100"
              />
              <p className="text-xs text-slate-400 mt-1">Default: 23 (Telnet/Wolfpack standard)</p>
            </div>
          )}

          {currentConfig.protocol === 'UDP' && (
            <div>
              <label className="block text-sm font-medium mb-2 text-slate-200">UDP Port</label>
              <input
                type="number"
                value={currentConfig.udpPort || 4000}
                onChange={(e) => setCurrentConfig({ ...currentConfig, udpPort: parseInt(e.target.value) })}
                className="w-full px-3 py-2 border border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-800 text-slate-100"
              />
              <p className="text-xs text-slate-400 mt-1">Default: 4000</p>
            </div>
          )}
        </div>

        <div className="flex gap-4 mb-6">
          <button
            onClick={testConnection}
            disabled={testingConnection || !currentConfig.ipAddress}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-slate-600 disabled:cursor-not-allowed transition-colors"
          >
            {testingConnection ? 'Testing...' : 'Test Connection'}
          </button>
          
          <button
            onClick={saveConfiguration}
            disabled={loading}
            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-slate-600 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Saving...' : 'Save Configuration'}
          </button>
        </div>

        {connectionStatus && (
          <div className={`p-3 rounded-md mb-6 ${
            connectionStatus.includes('✓') ? 'bg-green-900/30 text-green-300' : 'bg-red-900/30 text-red-300'
          }`}>
            {connectionStatus}
          </div>
        )}

        {/* Tab Navigation */}
        <div className="border-b border-slate-700 mb-6">
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('inputs')}
              className={`px-6 py-3 font-medium transition-colors relative ${
                activeTab === 'inputs'
                  ? 'text-indigo-400 border-b-2 border-indigo-400'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Inputs (1-36)
            </button>
            <button
              onClick={() => setActiveTab('outputs')}
              className={`px-6 py-3 font-medium transition-colors relative ${
                activeTab === 'outputs'
                  ? 'text-indigo-400 border-b-2 border-indigo-400'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Outputs (1-36)
            </button>
          </div>
        </div>

        {/* Tab Content */}
        <div className="min-h-[600px]">
          {activeTab === 'inputs' && (
            <div>
              <h3 className="text-xl font-semibold mb-4 text-slate-100">Input Configuration</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {currentConfig.inputs.map((input, index) => (
                  <div key={index} className="bg-slate-800 p-4 rounded-md border border-slate-700 hover:border-slate-600 transition-colors">
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-semibold text-slate-200">Input {input.channelNumber}</span>
                      <label className="flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={input.isActive}
                          onChange={(e) => updateInput(index, 'isActive', e.target.checked)}
                          className="mr-2 w-4 h-4 cursor-pointer"
                        />
                        <span className="text-sm text-slate-300">Active</span>
                      </label>
                    </div>
                    <input
                      type="text"
                      value={input.label}
                      onChange={(e) => updateInput(index, 'label', e.target.value)}
                      placeholder="Label"
                      className="w-full px-3 py-2 text-sm border border-slate-600 rounded bg-slate-900 text-slate-100 mb-3 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <div className="space-y-2">
                      <select
                        value={input.inputType}
                        onChange={(e) => updateInput(index, 'inputType', e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-slate-600 rounded bg-slate-900 text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="HDMI">HDMI</option>
                        <option value="Component">Component</option>
                        <option value="Composite">Composite</option>
                      </select>
                      <select
                        value={input.deviceType}
                        onChange={(e) => updateInput(index, 'deviceType', e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-slate-600 rounded bg-slate-900 text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="Cable Box">Cable Box</option>
                        <option value="DirecTV">DirecTV</option>
                        <option value="Fire TV">Fire TV</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'outputs' && (
            <div>
              <h3 className="text-xl font-semibold mb-4 text-slate-100">Output Configuration</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {currentConfig.outputs.map((output, index) => (
                  <div key={index} className="bg-slate-800 p-4 rounded-md border border-slate-700 hover:border-slate-600 transition-colors">
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-semibold text-slate-200">Output {output.channelNumber}</span>
                      <label className="flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={output.isActive}
                          onChange={(e) => updateOutput(index, 'isActive', e.target.checked)}
                          className="mr-2 w-4 h-4 cursor-pointer"
                        />
                        <span className="text-sm text-slate-300">Active</span>
                      </label>
                    </div>
                    <input
                      type="text"
                      value={output.label}
                      onChange={(e) => updateOutput(index, 'label', e.target.value)}
                      placeholder="Label"
                      className="w-full px-3 py-2 text-sm border border-slate-600 rounded bg-slate-900 text-slate-100 mb-3 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <div className="space-y-2">
                      <select
                        value={output.resolution}
                        onChange={(e) => updateOutput(index, 'resolution', e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-slate-600 rounded bg-slate-900 text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="1080p">1080p</option>
                        <option value="4K">4K</option>
                        <option value="720p">720p</option>
                      </select>
                      {index < 4 && (
                        <input
                          type="text"
                          value={output.audioOutput || ''}
                          onChange={(e) => updateOutput(index, 'audioOutput', e.target.value)}
                          placeholder="Audio Output"
                          className="w-full px-3 py-2 text-sm border border-slate-600 rounded bg-slate-900 text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
