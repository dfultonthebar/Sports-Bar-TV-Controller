
'use client'

import { useState, useEffect } from 'react'
import { Grid, Wifi, WifiOff, Save, TestTube, RotateCcw } from 'lucide-react'

interface MatrixConfig {
  id?: string
  name: string
  ipAddress: string
  tcpPort: number
  udpPort: number
  protocol: string
  isActive: boolean
}

interface MatrixInput {
  id?: string
  configId?: string
  channelNumber: number
  label: string
  inputType: string
  isActive: boolean
}

interface MatrixOutput {
  id?: string
  configId?: string
  channelNumber: number
  label: string
  resolution: string
  isActive: boolean
}

export default function SimpleMatrixControl() {
  const [config, setConfig] = useState<MatrixConfig>({
    name: 'Wolf Pack Matrix',
    ipAddress: '192.168.1.100',
    tcpPort: 5000,
    udpPort: 4000,
    protocol: 'TCP',
    isActive: false
  })
  
  const [inputs, setInputs] = useState<MatrixInput[]>([])
  const [outputs, setOutputs] = useState<MatrixOutput[]>([])
  const [isConnected, setIsConnected] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [selectedInput, setSelectedInput] = useState<number>(1)
  const [selectedOutputs, setSelectedOutputs] = useState<number[]>([])
  const [activeTab, setActiveTab] = useState('connection')

  // Initialize with 36x36 matrix
  useEffect(() => {
    loadConfiguration()
    initializeMatrix()
  }, [])

  const initializeMatrix = () => {
    // Initialize 36 inputs
    const defaultInputs: MatrixInput[] = Array.from({ length: 36 }, (_, i) => ({
      channelNumber: i + 1,
      label: `Input ${i + 1}`,
      inputType: 'HDMI',
      isActive: true
    }))
    setInputs(defaultInputs)

    // Initialize 36 outputs  
    const defaultOutputs: MatrixOutput[] = Array.from({ length: 36 }, (_, i) => ({
      channelNumber: i + 1,
      label: `Output ${i + 1}`,
      resolution: '1920x1080',
      isActive: true
    }))
    setOutputs(defaultOutputs)
  }

  const loadConfiguration = async () => {
    try {
      setIsLoading(true)
      const response = await fetch('/api/matrix/config')
      if (response.ok) {
        const data = await response.json()
        if (data.config) setConfig(data.config)
        if (data.inputs?.length > 0) setInputs(data.inputs)
        if (data.outputs?.length > 0) setOutputs(data.outputs)
      }
    } catch (error) {
      console.error('Error loading configuration:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const saveConfiguration = async () => {
    try {
      setIsLoading(true)
      const response = await fetch('/api/matrix/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config, inputs, outputs })
      })

      if (response.ok) {
        alert('Configuration saved successfully!')
      } else {
        throw new Error('Failed to save configuration')
      }
    } catch (error) {
      alert('Failed to save configuration')
      console.error('Error saving configuration:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const testConnection = async () => {
    try {
      setIsLoading(true)
      const response = await fetch('/api/matrix/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          ipAddress: config.ipAddress, 
          port: config.protocol === 'TCP' ? config.tcpPort : config.udpPort,
          protocol: config.protocol
        })
      })

      const result = await response.json()
      
      if (result.success) {
        setIsConnected(true)
        alert('Connection successful!')
      } else {
        setIsConnected(false)
        alert('Connection failed: ' + result.error)
      }
    } catch (error) {
      setIsConnected(false)
      alert('Connection test failed')
    } finally {
      setIsLoading(false)
    }
  }

  const sendMatrixCommand = async (command: string, description: string) => {
    try {
      setIsLoading(true)
      const response = await fetch('/api/matrix/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          command,
          ipAddress: config.ipAddress,
          port: config.protocol === 'TCP' ? config.tcpPort : config.udpPort,
          protocol: config.protocol
        })
      })

      const result = await response.json()
      
      if (result.success) {
        alert(`${description} - Success!`)
      } else {
        alert(`${description} - Failed: ${result.error}`)
      }
    } catch (error) {
      alert(`${description} - Error`)
    } finally {
      setIsLoading(false)
    }
  }

  const routeInputToOutput = () => {
    if (selectedOutputs.length === 0) {
      alert('Please select at least one output')
      return
    }

    if (selectedOutputs.length === 1) {
      const command = `${selectedInput}X${selectedOutputs[0]}.`
      sendMatrixCommand(command, `Route Input ${selectedInput} to Output ${selectedOutputs[0]}`)
    } else {
      const outputList = selectedOutputs.join('&')
      const command = `${selectedInput}X${outputList}.`
      sendMatrixCommand(command, `Route Input ${selectedInput} to Outputs ${selectedOutputs.join(', ')}`)
    }
  }

  const routeToAll = () => {
    const command = `${selectedInput}ALL.`
    sendMatrixCommand(command, `Route Input ${selectedInput} to All Outputs`)
  }

  const setOneToOne = () => {
    sendMatrixCommand('All1.', 'Set One-to-One Mapping')
  }

  const restartSoftware = async () => {
    if (confirm('This will restart the Sports Bar AI Assistant application. Continue?')) {
      try {
        setIsLoading(true)
        const response = await fetch('/api/system/restart', {
          method: 'POST'
        })

        if (response.ok) {
          alert('Software restart initiated...')
        } else {
          alert('Failed to restart software')
        }
      } catch (error) {
        alert('Error restarting software')
      } finally {
        setIsLoading(false)
      }
    }
  }

  const updateInputLabel = (channelNumber: number, label: string) => {
    setInputs(prev => prev.map(input => 
      input.channelNumber === channelNumber ? { ...input, label } : input
    ))
  }

  const updateOutputLabel = (channelNumber: number, label: string) => {
    setOutputs(prev => prev.map(output => 
      output.channelNumber === channelNumber ? { ...output, label } : output
    ))
  }

  const toggleOutputSelection = (outputNum: number) => {
    setSelectedOutputs(prev => 
      prev.includes(outputNum) 
        ? prev.filter(num => num !== outputNum)
        : [...prev, outputNum]
    )
  }

  const inputTypes = ['HDMI', 'Component', 'Composite', 'VGA', 'DVI', 'SDI', '3G-SDI', '12G-SDI']
  const resolutions = ['1920x1080', '3840x2160', '1280x720', '1024x768', '1366x768', '2560x1440']

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between bg-blue-50 p-6 rounded-lg">
        <div className="flex items-center space-x-3">
          <Grid className="w-8 h-8 text-blue-500" />
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Wolf Pack Matrix Control (36x36)</h2>
            <p className="text-blue-600">Configure your matrix switcher and control routing</p>
          </div>
        </div>
        <div className="flex items-center space-x-4">
          <div className={`px-3 py-1 rounded-full text-sm font-medium flex items-center space-x-2 ${
            isConnected ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
          }`}>
            {isConnected ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
            <span>{isConnected ? 'Connected' : 'Disconnected'}</span>
          </div>
          <button 
            onClick={restartSoftware}
            className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 flex items-center space-x-2"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Restart Software</span>
          </button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {[
            { id: 'connection', name: 'Connection', icon: TestTube },
            { id: 'control', name: 'Matrix Control', icon: Grid },
            { id: 'inputs', name: 'Inputs', icon: Grid },
            { id: 'outputs', name: 'Outputs', icon: Grid }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              <span>{tab.name}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="bg-white p-6 rounded-lg shadow">
        {activeTab === 'connection' && (
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">Connection Settings</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Matrix Name</label>
                <input
                  type="text"
                  value={config.name}
                  onChange={(e) => setConfig(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  placeholder="Wolf Pack Matrix"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">IP Address</label>
                <input
                  type="text"
                  value={config.ipAddress}
                  onChange={(e) => setConfig(prev => ({ ...prev, ipAddress: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  placeholder="192.168.1.100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Protocol</label>
                <select 
                  value={config.protocol}
                  onChange={(e) => setConfig(prev => ({ ...prev, protocol: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                >
                  <option value="TCP">TCP (Port 5000)</option>
                  <option value="UDP">UDP (Port 4000)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">TCP Port</label>
                <input
                  type="number"
                  value={config.tcpPort}
                  onChange={(e) => setConfig(prev => ({ ...prev, tcpPort: parseInt(e.target.value) || 5000 }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  placeholder="5000"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">UDP Port</label>
                <input
                  type="number"
                  value={config.udpPort}
                  onChange={(e) => setConfig(prev => ({ ...prev, udpPort: parseInt(e.target.value) || 4000 }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  placeholder="4000"
                />
              </div>
            </div>
            
            <div className="flex space-x-3 mt-6">
              <button 
                onClick={testConnection} 
                disabled={isLoading}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 flex items-center space-x-2"
              >
                <TestTube className="w-4 h-4" />
                <span>Test Connection</span>
              </button>
              <button 
                onClick={saveConfiguration} 
                disabled={isLoading}
                className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50 flex items-center space-x-2"
              >
                <Save className="w-4 h-4" />
                <span>Save Configuration</span>
              </button>
            </div>
          </div>
        )}

        {activeTab === 'control' && (
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">Matrix Routing Control</h3>
            
            {/* Input Selection */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">Select Input (1-36)</label>
              <select 
                value={selectedInput} 
                onChange={(e) => setSelectedInput(parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              >
                {inputs.map(input => (
                  <option key={input.channelNumber} value={input.channelNumber}>
                    Input {input.channelNumber}: {input.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Output Selection */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">Select Output(s) (1-36)</label>
              <div className="grid grid-cols-6 gap-2 mt-2">
                {outputs.map(output => (
                  <button
                    key={output.channelNumber}
                    onClick={() => toggleOutputSelection(output.channelNumber)}
                    className={`p-2 text-sm font-medium rounded ${
                      selectedOutputs.includes(output.channelNumber)
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    {output.channelNumber}
                  </button>
                ))}
              </div>
              <p className="text-sm text-gray-600 mt-2">
                Selected outputs: {selectedOutputs.length > 0 ? selectedOutputs.join(', ') : 'None'}
              </p>
            </div>

            {/* Control Buttons */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <button 
                onClick={routeInputToOutput} 
                disabled={isLoading || selectedOutputs.length === 0}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
              >
                Route Input
              </button>
              
              <button 
                onClick={routeToAll} 
                disabled={isLoading}
                className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50"
              >
                Route to All
              </button>
              
              <button 
                onClick={setOneToOne} 
                disabled={isLoading}
                className="px-4 py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600 disabled:opacity-50"
              >
                One-to-One
              </button>
              
              <button 
                onClick={() => sendMatrixCommand('BeepON.', 'Enable Beep')} 
                disabled={isLoading}
                className="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600 disabled:opacity-50"
              >
                Beep On
              </button>
            </div>

            <div className="bg-blue-50 p-4 rounded-lg mt-6">
              <h4 className="font-medium text-blue-900 mb-2">Wolf Pack Commands</h4>
              <ul className="text-sm text-blue-800 space-y-1">
                <li><code className="bg-white px-1 rounded">1X2.</code> - Route Input 1 to Output 2</li>
                <li><code className="bg-white px-1 rounded">1X2&3&4.</code> - Route Input 1 to Outputs 2, 3, and 4</li>
                <li><code className="bg-white px-1 rounded">1ALL.</code> - Route Input 1 to All Outputs</li>
                <li><code className="bg-white px-1 rounded">All1.</code> - Set One-to-One Mapping</li>
                <li><code className="bg-white px-1 rounded">1?.</code> - Check Input 1 Status</li>
              </ul>
            </div>
          </div>
        )}

        {activeTab === 'inputs' && (
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">Input Configuration (1-36)</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {inputs.slice(0, 12).map((input) => (
                <div key={input.channelNumber} className="p-4 border border-gray-200 rounded-lg">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="font-medium text-gray-700">Input {input.channelNumber}</label>
                      <span className="px-2 py-1 bg-gray-100 text-xs rounded">{input.inputType}</span>
                    </div>
                    
                    <input
                      type="text"
                      value={input.label}
                      onChange={(e) => updateInputLabel(input.channelNumber, e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      placeholder={`Input ${input.channelNumber}`}
                    />
                    
                    <select 
                      value={input.inputType} 
                      onChange={(e) => {
                        setInputs(prev => prev.map(inp => 
                          inp.channelNumber === input.channelNumber ? { ...inp, inputType: e.target.value } : inp
                        ))
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    >
                      {inputTypes.map(type => (
                        <option key={type} value={type}>{type}</option>
                      ))}
                    </select>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-sm text-gray-600 mt-4">Showing first 12 inputs. All 36 inputs are available for routing.</p>
            
            <button 
              onClick={saveConfiguration} 
              disabled={isLoading}
              className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50 flex items-center space-x-2 mt-4"
            >
              <Save className="w-4 h-4" />
              <span>Save Input Labels</span>
            </button>
          </div>
        )}

        {activeTab === 'outputs' && (
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">Output Configuration (1-36)</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {outputs.slice(0, 12).map((output) => (
                <div key={output.channelNumber} className="p-4 border border-gray-200 rounded-lg">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="font-medium text-gray-700">Output {output.channelNumber}</label>
                      <span className="px-2 py-1 bg-gray-100 text-xs rounded">{output.resolution}</span>
                    </div>
                    
                    <input
                      type="text"
                      value={output.label}
                      onChange={(e) => updateOutputLabel(output.channelNumber, e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      placeholder={`Output ${output.channelNumber}`}
                    />
                    
                    <select 
                      value={output.resolution} 
                      onChange={(e) => {
                        setOutputs(prev => prev.map(out => 
                          out.channelNumber === output.channelNumber ? { ...out, resolution: e.target.value } : out
                        ))
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    >
                      {resolutions.map(res => (
                        <option key={res} value={res}>{res}</option>
                      ))}
                    </select>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-sm text-gray-600 mt-4">Showing first 12 outputs. All 36 outputs are available for routing.</p>
            
            <button 
              onClick={saveConfiguration} 
              disabled={isLoading}
              className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50 flex items-center space-x-2 mt-4"
            >
              <Save className="w-4 h-4" />
              <span>Save Output Labels</span>
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
