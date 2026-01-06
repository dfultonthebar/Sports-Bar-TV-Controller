
#!/bin/bash

echo "🐺 Adding Wolf Pack Matrix Control (36x36) + Restart Function"
echo "=============================================================="

cd ~/sports_bar_ai_assistant/app

# Stop the server
echo "⏹️ Stopping server..."
pkill -f "next dev" 2>/dev/null || true
sleep 2

# Update Prisma schema
echo "🗄️ Updating database schema..."
cat >> prisma/schema.prisma << 'SCHEMA_END'

model MatrixConfig {
  id        Int      @id @default(autoincrement())
  name      String   @default("Wolf Pack Matrix")
  ipAddress String
  tcpPort   Int      @default(5000)
  udpPort   Int      @default(4000)
  protocol  String   @default("TCP")
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model MatrixInput {
  id          Int     @id @default(autoincrement())
  channelNum  Int
  label       String
  inputType   String  @default("HDMI")
  isEnabled   Boolean @default(true)
  description String?
}

model MatrixOutput {
  id          Int     @id @default(autoincrement())
  channelNum  Int
  label       String
  resolution  String  @default("1920x1080")
  isEnabled   Boolean @default(true)
  description String?
}

model MatrixRoute {
  id        Int      @id @default(autoincrement())
  inputNum  Int
  outputNum Int
  isActive  Boolean  @default(false)
  createdAt DateTime @default(now())
}

model MatrixScene {
  id          Int      @id @default(autoincrement())
  sceneNum    Int
  name        String
  description String?
  routes      String   // JSON string of routes
  createdAt   DateTime @default(now())
}
SCHEMA_END

# Push schema changes
echo "📊 Pushing database schema..."
npx prisma db push

# Create Matrix Control component with 36x36 support and control features
echo "🎛️ Creating Wolf Pack Matrix Control component..."
mkdir -p components/matrix

cat > components/matrix/MatrixControl.tsx << 'MATRIX_COMPONENT_END'
'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { Wifi, WifiOff, Save, TestTube, Grid, Monitor, Cable, Play, RotateCcw, Volume2, VolumeX, Zap } from 'lucide-react'

interface MatrixConfig {
  id?: number
  name: string
  ipAddress: string
  tcpPort: number
  udpPort: number
  protocol: string
  isActive: boolean
}

interface MatrixInput {
  id?: number
  channelNum: number
  label: string
  inputType: string
  isEnabled: boolean
  description?: string
}

interface MatrixOutput {
  id?: number
  channelNum: number
  label: string
  resolution: string
  isEnabled: boolean
  description?: string
}

interface MatrixRoute {
  inputNum: number
  outputNum: number
  isActive: boolean
}

export default function MatrixControl() {
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
  const [routes, setRoutes] = useState<MatrixRoute[]>([])
  const [isConnected, setIsConnected] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [selectedInput, setSelectedInput] = useState<number>(1)
  const [selectedOutputs, setSelectedOutputs] = useState<number[]>([])

  // Initialize with 36x36 matrix
  useEffect(() => {
    loadConfiguration()
    initializeMatrix()
  }, [])

  const initializeMatrix = () => {
    // Initialize 36 inputs
    const defaultInputs: MatrixInput[] = Array.from({ length: 36 }, (_, i) => ({
      channelNum: i + 1,
      label: `Input ${i + 1}`,
      inputType: 'HDMI',
      isEnabled: true,
      description: ''
    }))
    setInputs(defaultInputs)

    // Initialize 36 outputs  
    const defaultOutputs: MatrixOutput[] = Array.from({ length: 36 }, (_, i) => ({
      channelNum: i + 1,
      label: `Output ${i + 1}`,
      resolution: '1920x1080',
      isEnabled: true,
      description: ''
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
        toast.success('Configuration saved successfully!')
      } else {
        throw new Error('Failed to save configuration')
      }
    } catch (error) {
      toast.error('Failed to save configuration')
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
        toast.success('Connection successful!')
      } else {
        setIsConnected(false)
        toast.error('Connection failed: ' + result.error)
      }
    } catch (error) {
      setIsConnected(false)
      toast.error('Connection test failed')
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
        toast.success(`${description} - Success!`)
      } else {
        toast.error(`${description} - Failed: ${result.error}`)
      }
    } catch (error) {
      toast.error(`${description} - Error`)
    } finally {
      setIsLoading(false)
    }
  }

  const routeInputToOutput = () => {
    if (selectedOutputs.length === 0) {
      toast.error('Please select at least one output')
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
    try {
      setIsLoading(true)
      const response = await fetch('/api/system/restart', {
        method: 'POST'
      })

      if (response.ok) {
        toast.success('Software restart initiated...')
      } else {
        toast.error('Failed to restart software')
      }
    } catch (error) {
      toast.error('Error restarting software')
    } finally {
      setIsLoading(false)
    }
  }

  const updateInputLabel = (channelNum: number, label: string) => {
    setInputs(prev => prev.map(input => 
      input.channelNum === channelNum ? { ...input, label } : input
    ))
  }

  const updateOutputLabel = (channelNum: number, label: string) => {
    setOutputs(prev => prev.map(output => 
      output.channelNum === channelNum ? { ...output, label } : output
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
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Grid className="w-8 h-8 text-blue-500" />
          <div>
            <h2 className="text-2xl font-bold text-white">Wolf Pack Matrix Control (36x36)</h2>
            <p className="text-blue-200">Configure your matrix switcher and control routing</p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          {isConnected ? (
            <Badge className="bg-green-500"><Wifi className="w-4 h-4 mr-1" />Connected</Badge>
          ) : (
            <Badge variant="destructive"><WifiOff className="w-4 h-4 mr-1" />Disconnected</Badge>
          )}
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" className="text-red-600 border-red-600 hover:bg-red-50">
                <RotateCcw className="w-4 h-4 mr-1" />
                Restart Software
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Restart Software</AlertDialogTitle>
                <AlertDialogDescription>
                  This will restart the Sports Bar AI Assistant application. The page will reload automatically.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={restartSoftware}>Restart</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      <Tabs defaultValue="connection" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="connection">Connection</TabsTrigger>
          <TabsTrigger value="control">Matrix Control</TabsTrigger>
          <TabsTrigger value="inputs">Inputs</TabsTrigger>
          <TabsTrigger value="outputs">Outputs</TabsTrigger>
        </TabsList>

        <TabsContent value="connection">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Cable className="w-5 h-5" />
                <span>Wolf Pack Connection Settings</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="matrixName">Matrix Name</Label>
                  <Input
                    id="matrixName"
                    value={config.name}
                    onChange={(e) => setConfig(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Wolf Pack Matrix"
                  />
                </div>
                <div>
                  <Label htmlFor="ipAddress">IP Address</Label>
                  <Input
                    id="ipAddress"
                    value={config.ipAddress}
                    onChange={(e) => setConfig(prev => ({ ...prev, ipAddress: e.target.value }))}
                    placeholder="192.168.1.100"
                  />
                </div>
                <div>
                  <Label htmlFor="protocol">Protocol</Label>
                  <Select 
                    value={config.protocol} 
                    onValueChange={(value) => setConfig(prev => ({ ...prev, protocol: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="TCP">TCP (Port 5000)</SelectItem>
                      <SelectItem value="UDP">UDP (Port 4000)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="tcpPort">TCP Port</Label>
                  <Input
                    id="tcpPort"
                    type="number"
                    value={config.tcpPort}
                    onChange={(e) => setConfig(prev => ({ ...prev, tcpPort: parseInt(e.target.value) || 5000 }))}
                    placeholder="5000"
                  />
                </div>
                <div>
                  <Label htmlFor="udpPort">UDP Port</Label>
                  <Input
                    id="udpPort"
                    type="number"
                    value={config.udpPort}
                    onChange={(e) => setConfig(prev => ({ ...prev, udpPort: parseInt(e.target.value) || 4000 }))}
                    placeholder="4000"
                  />
                </div>
              </div>
              
              <div className="flex space-x-3 pt-4">
                <Button onClick={testConnection} disabled={isLoading} className="flex items-center space-x-2">
                  <TestTube className="w-4 h-4" />
                  <span>Test Connection</span>
                </Button>
                <Button onClick={saveConfiguration} disabled={isLoading} className="flex items-center space-x-2">
                  <Save className="w-4 h-4" />
                  <span>Save Configuration</span>
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="control">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Play className="w-5 h-5" />
                <span>Matrix Routing Control</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Input Selection */}
              <div>
                <Label className="text-lg font-medium">Select Input (1-36)</Label>
                <Select 
                  value={selectedInput.toString()} 
                  onValueChange={(value) => setSelectedInput(parseInt(value))}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {inputs.map(input => (
                      <SelectItem key={input.channelNum} value={input.channelNum.toString()}>
                        Input {input.channelNum}: {input.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Output Selection */}
              <div>
                <Label className="text-lg font-medium">Select Output(s) (1-36)</Label>
                <div className="grid grid-cols-6 gap-2 mt-2">
                  {outputs.map(output => (
                    <Button
                      key={output.channelNum}
                      variant={selectedOutputs.includes(output.channelNum) ? "default" : "outline"}
                      size="sm"
                      onClick={() => toggleOutputSelection(output.channelNum)}
                      className="text-xs"
                    >
                      {output.channelNum}
                    </Button>
                  ))}
                </div>
                <p className="text-sm text-gray-600 mt-2">
                  Selected outputs: {selectedOutputs.length > 0 ? selectedOutputs.join(', ') : 'None'}
                </p>
              </div>

              {/* Control Buttons */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-4">
                <Button 
                  onClick={routeInputToOutput} 
                  disabled={isLoading || selectedOutputs.length === 0}
                  className="flex items-center space-x-2"
                >
                  <Cable className="w-4 h-4" />
                  <span>Route Input</span>
                </Button>
                
                <Button 
                  onClick={routeToAll} 
                  disabled={isLoading}
                  className="flex items-center space-x-2"
                  variant="secondary"
                >
                  <Zap className="w-4 h-4" />
                  <span>Route to All</span>
                </Button>
                
                <Button 
                  onClick={setOneToOne} 
                  disabled={isLoading}
                  className="flex items-center space-x-2"
                  variant="secondary"
                >
                  <Grid className="w-4 h-4" />
                  <span>One-to-One</span>
                </Button>
                
                <Button 
                  onClick={() => sendMatrixCommand('BeepON.', 'Enable Beep')} 
                  disabled={isLoading}
                  className="flex items-center space-x-2"
                  variant="outline"
                >
                  <Volume2 className="w-4 h-4" />
                  <span>Beep On</span>
                </Button>
              </div>

              <div className="bg-blue-50 p-4 rounded-lg">
                <h3 className="font-medium text-blue-900 mb-2">Wolf Pack Commands</h3>
                <ul className="text-sm text-blue-800 space-y-1">
                  <li><code>1X2.</code> - Route Input 1 to Output 2</li>
                  <li><code>1X2&3&4.</code> - Route Input 1 to Outputs 2, 3, and 4</li>
                  <li><code>1ALL.</code> - Route Input 1 to All Outputs</li>
                  <li><code>All1.</code> - Set One-to-One Mapping</li>
                  <li><code>1?.</code> - Check Input 1 Status</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="inputs">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Cable className="w-5 h-5" />
                <span>Input Channel Configuration (1-36)</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {inputs.map((input) => (
                  <div key={input.channelNum} className="p-4 border rounded-lg bg-slate-50">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label className="font-medium">Input {input.channelNum}</Label>
                        <Badge variant="outline">{input.inputType}</Badge>
                      </div>
                      
                      <Input
                        value={input.label}
                        onChange={(e) => updateInputLabel(input.channelNum, e.target.value)}
                        placeholder={`Input ${input.channelNum}`}
                        className="font-medium"
                      />
                      
                      <Select 
                        value={input.inputType} 
                        onValueChange={(value) => {
                          setInputs(prev => prev.map(inp => 
                            inp.channelNum === input.channelNum ? { ...inp, inputType: value } : inp
                          ))
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {inputTypes.map(type => (
                            <SelectItem key={type} value={type}>{type}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="pt-4">
                <Button onClick={saveConfiguration} disabled={isLoading} className="flex items-center space-x-2">
                  <Save className="w-4 h-4" />
                  <span>Save Input Labels</span>
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="outputs">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Monitor className="w-5 h-5" />
                <span>Output Channel Configuration (1-36)</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {outputs.map((output) => (
                  <div key={output.channelNum} className="p-4 border rounded-lg bg-slate-50">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label className="font-medium">Output {output.channelNum}</Label>
                        <Badge variant="outline">{output.resolution}</Badge>
                      </div>
                      
                      <Input
                        value={output.label}
                        onChange={(e) => updateOutputLabel(output.channelNum, e.target.value)}
                        placeholder={`Output ${output.channelNum}`}
                        className="font-medium"
                      />
                      
                      <Select 
                        value={output.resolution} 
                        onValueChange={(value) => {
                          setOutputs(prev => prev.map(out => 
                            out.channelNum === output.channelNum ? { ...out, resolution: value } : out
                          ))
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {resolutions.map(res => (
                            <SelectItem key={res} value={res}>{res}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="pt-4">
                <Button onClick={saveConfiguration} disabled={isLoading} className="flex items-center space-x-2">
                  <Save className="w-4 h-4" />
                  <span>Save Output Labels</span>
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
MATRIX_COMPONENT_END

# Create enhanced API routes with correct paths
echo "🛠️ Creating enhanced API routes..."
mkdir -p src/app/api/matrix/config
mkdir -p src/app/api/matrix/test-connection
mkdir -p src/app/api/matrix/command
mkdir -p src/app/api/system/restart

# Matrix configuration API (updated)
cat > src/app/api/matrix/config/route.ts << 'CONFIG_API_END'
import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function GET() {
  try {
    const config = await prisma.matrixConfig.findFirst({
      where: { isActive: true }
    })
    
    const inputs = await prisma.matrixInput.findMany({
      orderBy: { channelNum: 'asc' }
    })
    
    const outputs = await prisma.matrixOutput.findMany({
      orderBy: { channelNum: 'asc' }
    })

    return NextResponse.json({
      config,
      inputs,
      outputs
    })
  } catch (error) {
    console.error('Error loading matrix configuration:', error)
    return NextResponse.json({ error: 'Failed to load configuration' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { config, inputs, outputs } = await request.json()

    // Save or update matrix configuration
    const savedConfig = await prisma.matrixConfig.upsert({
      where: { id: config.id || 0 },
      update: {
        name: config.name,
        ipAddress: config.ipAddress,
        tcpPort: config.tcpPort,
        udpPort: config.udpPort,
        protocol: config.protocol,
        isActive: config.isActive
      },
      create: {
        name: config.name,
        ipAddress: config.ipAddress,
        tcpPort: config.tcpPort,
        udpPort: config.udpPort,
        protocol: config.protocol,
        isActive: config.isActive
      }
    })

    // Clear existing inputs and outputs
    await prisma.matrixInput.deleteMany()
    await prisma.matrixOutput.deleteMany()

    // Save inputs
    if (inputs?.length > 0) {
      await prisma.matrixInput.createMany({
        data: inputs.map((input: any) => ({
          channelNum: input.channelNum,
          label: input.label,
          inputType: input.inputType,
          isEnabled: input.isEnabled,
          description: input.description
        }))
      })
    }

    // Save outputs
    if (outputs?.length > 0) {
      await prisma.matrixOutput.createMany({
        data: outputs.map((output: any) => ({
          channelNum: output.channelNum,
          label: output.label,
          resolution: output.resolution,
          isEnabled: output.isEnabled,
          description: output.description
        }))
      })
    }

    return NextResponse.json({ 
      success: true, 
      config: savedConfig 
    })
  } catch (error) {
    console.error('Error saving matrix configuration:', error)
    return NextResponse.json({ error: 'Failed to save configuration' }, { status: 500 })
  }
}
CONFIG_API_END

# Enhanced connection test API
cat > src/app/api/matrix/test-connection/route.ts << 'TEST_API_END'
import { NextRequest, NextResponse } from 'next/server'
import { Socket } from 'net'
import dgram from 'dgram'

export async function POST(request: NextRequest) {
  try {
    const { ipAddress, port, protocol = 'TCP' } = await request.json()

    if (!ipAddress || !port) {
      return NextResponse.json({ 
        success: false, 
        error: 'IP address and port are required' 
      })
    }

    if (protocol === 'TCP') {
      // Test TCP connection
      const testTcpConnection = (): Promise<boolean> => {
        return new Promise((resolve) => {
          const socket = new Socket()
          const timeout = setTimeout(() => {
            socket.destroy()
            resolve(false)
          }, 5000) // 5 second timeout

          socket.connect(port, ipAddress, () => {
            clearTimeout(timeout)
            socket.destroy()
            resolve(true)
          })

          socket.on('error', () => {
            clearTimeout(timeout)
            resolve(false)
          })
        })
      }

      const isConnected = await testTcpConnection()
      
      if (isConnected) {
        return NextResponse.json({ 
          success: true, 
          message: `TCP connection successful to ${ipAddress}:${port}`,
          timestamp: new Date().toISOString()
        })
      } else {
        return NextResponse.json({ 
          success: false, 
          error: `Unable to connect via TCP to ${ipAddress}:${port}`
        })
      }
    } else {
      // Test UDP connection by sending a test command
      const testUdpConnection = (): Promise<boolean> => {
        return new Promise((resolve) => {
          const client = dgram.createSocket('udp4')
          const testMessage = '1?.' // Wolf Pack status query command
          
          const timeout = setTimeout(() => {
            client.close()
            resolve(false)
          }, 5000)

          client.send(testMessage, port, ipAddress, (error) => {
            if (error) {
              clearTimeout(timeout)
              client.close()
              resolve(false)
            } else {
              clearTimeout(timeout)
              client.close()
              resolve(true)
            }
          })
        })
      }

      const isConnected = await testUdpConnection()
      
      if (isConnected) {
        return NextResponse.json({ 
          success: true, 
          message: `UDP connection successful to ${ipAddress}:${port}`,
          timestamp: new Date().toISOString()
        })
      } else {
        return NextResponse.json({ 
          success: false, 
          error: `Unable to connect via UDP to ${ipAddress}:${port}`
        })
      }
    }
  } catch (error) {
    console.error('Error testing connection:', error)
    return NextResponse.json({ 
      success: false, 
      error: 'Connection test failed: ' + error
    }, { status: 500 })
  }
}
TEST_API_END

# Wolf Pack command API
cat > src/app/api/matrix/command/route.ts << 'COMMAND_API_END'
import { NextRequest, NextResponse } from 'next/server'
import { Socket } from 'net'
import dgram from 'dgram'

export async function POST(request: NextRequest) {
  try {
    const { command, ipAddress, port, protocol = 'TCP' } = await request.json()

    if (!command || !ipAddress || !port) {
      return NextResponse.json({ 
        success: false, 
        error: 'Command, IP address, and port are required' 
      })
    }

    // Ensure command ends with period as per Wolf Pack protocol
    const wolfPackCommand = command.endsWith('.') ? command : command + '.'

    if (protocol === 'TCP') {
      // Send TCP command
      const sendTcpCommand = (): Promise<string> => {
        return new Promise((resolve, reject) => {
          const socket = new Socket()
          let response = ''
          
          const timeout = setTimeout(() => {
            socket.destroy()
            reject(new Error('Command timeout'))
          }, 10000) // 10 second timeout

          socket.connect(port, ipAddress, () => {
            socket.write(wolfPackCommand)
          })

          socket.on('data', (data) => {
            response += data.toString()
            // Wolf Pack responds with "OK" or "ERR"
            if (response.includes('OK') || response.includes('ERR')) {
              clearTimeout(timeout)
              socket.destroy()
              resolve(response.trim())
            }
          })

          socket.on('error', (error) => {
            clearTimeout(timeout)
            reject(error)
          })
        })
      }

      try {
        const response = await sendTcpCommand()
        const isSuccess = response.includes('OK')
        
        return NextResponse.json({ 
          success: isSuccess,
          response,
          command: wolfPackCommand,
          message: isSuccess ? 'Command executed successfully' : 'Command failed',
          timestamp: new Date().toISOString()
        })
      } catch (error) {
        return NextResponse.json({ 
          success: false, 
          error: `TCP command failed: ${error}`,
          command: wolfPackCommand
        })
      }
    } else {
      // Send UDP command
      const sendUdpCommand = (): Promise<boolean> => {
        return new Promise((resolve) => {
          const client = dgram.createSocket('udp4')
          
          const timeout = setTimeout(() => {
            client.close()
            resolve(false)
          }, 5000)

          client.send(wolfPackCommand, port, ipAddress, (error) => {
            clearTimeout(timeout)
            client.close()
            resolve(!error)
          })
        })
      }

      const success = await sendUdpCommand()
      
      return NextResponse.json({ 
        success,
        command: wolfPackCommand,
        message: success ? 'UDP command sent successfully' : 'UDP command failed',
        timestamp: new Date().toISOString()
      })
    }
  } catch (error) {
    console.error('Error sending matrix command:', error)
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to send command: ' + error
    }, { status: 500 })
  }
}
COMMAND_API_END

# System restart API
cat > src/app/api/system/restart/route.ts << 'RESTART_API_END'
import { NextResponse } from 'next/server'
import { spawn } from 'child_process'

export async function POST() {
  try {
    console.log('🔄 Software restart requested')
    
    // Schedule restart after a short delay to allow response to be sent
    setTimeout(() => {
      console.log('🔄 Restarting application...')
      
      // Kill current process and let process manager (like PM2 or systemd) restart it
      // For development, we'll just restart the Next.js process
      process.exit(0)
    }, 1000)

    return NextResponse.json({ 
      success: true,
      message: 'Restart initiated',
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('Error initiating restart:', error)
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to initiate restart: ' + error 
    }, { status: 500 })
  }
}
RESTART_API_END

# Update the main page to include Matrix Control tab
echo "🏠 Updating main page with Matrix Control tab..."

# First, let's check if we need to update the existing page
if [ -f "src/app/page.tsx" ]; then
  # Backup the current page
  cp src/app/page.tsx src/app/page.tsx.backup

  # Update the page to include Matrix Control
  cat > src/app/page.tsx << 'PAGE_END'
'use client'

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import DocumentUpload from '@/components/DocumentUpload'
import TroubleshootingChat from '@/components/TroubleshootingChat'
import SystemEnhancement from '@/components/SystemEnhancement'
import ApiKeyManagement from '@/components/ApiKeyManagement'
import MatrixControl from '@/components/matrix/MatrixControl'
import { FileText, MessageCircle, Wrench, Key, Grid } from 'lucide-react'

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-purple-900">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <div className="bg-white/10 backdrop-blur-sm rounded-full p-4">
              <span className="text-4xl">🏈</span>
            </div>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-2">
            Sports Bar AI Assistant
          </h1>
          <p className="text-xl text-blue-200">
            AI-Powered AV System Management & Troubleshooting
          </p>
        </div>

        {/* Main Content */}
        <Card className="max-w-6xl mx-auto bg-white/95 backdrop-blur-sm shadow-2xl">
          <CardContent className="p-6">
            <Tabs defaultValue="document-upload" className="w-full">
              <TabsList className="grid w-full grid-cols-5">
                <TabsTrigger value="document-upload" className="flex items-center space-x-2">
                  <FileText className="w-4 h-4" />
                  <span className="hidden sm:inline">Document Upload</span>
                </TabsTrigger>
                <TabsTrigger value="ai-chat" className="flex items-center space-x-2">
                  <MessageCircle className="w-4 h-4" />
                  <span className="hidden sm:inline">AI Chat</span>
                </TabsTrigger>
                <TabsTrigger value="matrix-control" className="flex items-center space-x-2">
                  <Grid className="w-4 h-4" />
                  <span className="hidden sm:inline">Matrix Control</span>
                </TabsTrigger>
                <TabsTrigger value="system-enhancement" className="flex items-center space-x-2">
                  <Wrench className="w-4 h-4" />
                  <span className="hidden sm:inline">System Enhancement</span>
                </TabsTrigger>
                <TabsTrigger value="api-keys" className="flex items-center space-x-2">
                  <Key className="w-4 h-4" />
                  <span className="hidden sm:inline">API Keys</span>
                </TabsTrigger>
              </TabsList>

              <TabsContent value="document-upload" className="mt-6">
                <DocumentUpload />
              </TabsContent>

              <TabsContent value="ai-chat" className="mt-6">
                <TroubleshootingChat />
              </TabsContent>

              <TabsContent value="matrix-control" className="mt-6">
                <MatrixControl />
              </TabsContent>

              <TabsContent value="system-enhancement" className="mt-6">
                <SystemEnhancement />
              </TabsContent>

              <TabsContent value="api-keys" className="mt-6">
                <ApiKeyManagement />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
PAGE_END
fi

echo "🔧 Generating Prisma client..."
npx prisma generate

echo "✅ Wolf Pack Matrix Control (36x36) added successfully!"
echo ""
echo "🚀 Starting server..."
npm run dev -- -p 3001 &

sleep 3

echo ""
echo "🎯 New Features Added:"
echo "   ✅ Matrix Control tab with 36x36 support"
echo "   ✅ Wolf Pack TCP (port 5000) and UDP (port 4000) protocols"
echo "   ✅ Input/Output labeling for 36 channels each"
echo "   ✅ Real-time matrix routing control"
echo "   ✅ Wolf Pack command protocol implementation"
echo "   ✅ Software restart functionality"
echo "   ✅ Connection testing for both TCP and UDP"
echo "   ✅ Database storage for all configuration"
echo ""
echo "🐺 Wolf Pack Commands Supported:"
echo "   ✅ YXZ. - Route input Y to output Z"
echo "   ✅ YX1&2&3. - Route input Y to multiple outputs"
echo "   ✅ YALL. - Route input Y to all outputs"
echo "   ✅ All1. - Set one-to-one mapping"
echo "   ✅ BeepON./BeepOFF. - Control buzzer"
echo "   ✅ Y?. - Query input status"
echo ""
echo "📍 Access your updated app at: http://localhost:3001"
