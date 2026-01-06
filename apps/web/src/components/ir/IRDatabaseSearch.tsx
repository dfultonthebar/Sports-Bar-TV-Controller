
'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/cards'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { logger } from '@sports-bar/logger'
import { 
  ArrowLeft,
  Search, 
  Download,
  CheckCircle2,
  AlertCircle,
  Loader2
} from 'lucide-react'

interface IRDevice {
  id: string
  name: string
  brand: string
  deviceType: string
}

interface IRDatabaseSearchProps {
  device: IRDevice
  onClose: () => void
}

interface Brand {
  Name: string
}

interface Type {
  Brand?: string
  Type?: string
  Name?: string
}

interface Model {
  ID: string
  Brand: string
  Type: string
  Name: string
  Notes: string
}

interface Function {
  SetID: string
  Function: string
}

export function IRDatabaseSearch({ device, onClose }: IRDatabaseSearchProps) {
  const [step, setStep] = useState(1) // 1: Credentials, 2: Search, 3: Functions
  const [loading, setLoading] = useState(false)
  
  // Credentials
  const [hasCredentials, setHasCredentials] = useState(false)
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [credentials, setCredentials] = useState({ email: '', password: '' })
  
  // Search
  const [brands, setBrands] = useState<Brand[]>([])
  const [types, setTypes] = useState<Type[]>([])
  const [models, setModels] = useState<Model[]>([])
  const [selectedBrand, setSelectedBrand] = useState(device.brand || '')
  const [selectedType, setSelectedType] = useState(device.deviceType || '')
  const [selectedModel, setSelectedModel] = useState<Model | null>(null)
  const [brandSearch, setBrandSearch] = useState('')
  const [modelSearch, setModelSearch] = useState('')
  
  // Functions
  const [functions, setFunctions] = useState<Function[]>([])
  const [selectedFunctions, setSelectedFunctions] = useState<Set<string>>(new Set())
  const [downloading, setDownloading] = useState(false)
  const [downloadResult, setDownloadResult] = useState<any>(null)

  useEffect(() => {
    checkCredentials()
  }, [])

  const checkCredentials = async () => {
    try {
      const response = await fetch('/api/ir/credentials')
      const data = await response.json()
      
      if (data.success) {
        setHasCredentials(data.hasCredentials)
        setIsLoggedIn(data.isLoggedIn)
        
        if (data.isLoggedIn) {
          setStep(2)
          await loadBrands()
        }
      }
    } catch (error) {
      logger.error('Error checking credentials:', error)
    }
  }

  const saveCredentials = async () => {
    if (!credentials.email || !credentials.password) {
      alert('Please enter both email and password')
      return
    }

    setLoading(true)
    try {
      const response = await fetch('/api/ir/credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials)
      })
      
      const data = await response.json()
      
      if (data.success) {
        setIsLoggedIn(true)
        setStep(2)
        await loadBrands()
      } else {
        alert('Login failed: ' + data.error)
      }
    } catch (error) {
      logger.error('Error saving credentials:', error)
      alert('Error saving credentials')
    } finally {
      setLoading(false)
    }
  }

  const loadBrands = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/ir/database/brands')
      const data = await response.json()
      
      if (data.success) {
        setBrands(data.brands)
      }
    } catch (error) {
      logger.error('Error loading brands:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadTypes = async (brand: string) => {
    setLoading(true)
    try {
      const response = await fetch(`/api/ir/database/types?brand=${encodeURIComponent(brand)}`)
      const data = await response.json()
      
      if (data.success) {
        setTypes(data.types)
      }
    } catch (error) {
      logger.error('Error loading types:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadModels = async (brand: string, type: string) => {
    setLoading(true)
    try {
      const response = await fetch(
        `/api/ir/database/models?brand=${encodeURIComponent(brand)}&type=${encodeURIComponent(type)}`
      )
      const data = await response.json()
      
      if (data.success) {
        setModels(data.models)
      }
    } catch (error) {
      logger.error('Error loading models:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadFunctions = async (codesetId: string) => {
    setLoading(true)
    try {
      const response = await fetch(`/api/ir/database/functions?codesetId=${codesetId}`)
      const data = await response.json()
      
      if (data.success) {
        setFunctions(data.functions)
        setStep(3)
      }
    } catch (error) {
      logger.error('Error loading functions:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleBrandSelect = (brand: string) => {
    setSelectedBrand(brand)
    setSelectedType('')
    setModels([])
    setSelectedModel(null)
    loadTypes(brand)
  }

  const handleTypeSelect = (type: string) => {
    setSelectedType(type)
    setModels([])
    setSelectedModel(null)
    loadModels(selectedBrand, type)
  }

  const handleModelSelect = (model: Model) => {
    setSelectedModel(model)
    loadFunctions(model.ID)
  }

  const toggleFunction = (functionName: string) => {
    const newSelected = new Set(selectedFunctions)
    if (newSelected.has(functionName)) {
      newSelected.delete(functionName)
    } else {
      newSelected.add(functionName)
    }
    setSelectedFunctions(newSelected)
  }

  const selectAllFunctions = () => {
    setSelectedFunctions(new Set(functions.map(f => f.Function)))
  }

  const deselectAllFunctions = () => {
    setSelectedFunctions(new Set())
  }

  const downloadCodes = async () => {
    if (selectedFunctions.size === 0) {
      alert('Please select at least one function')
      return
    }

    if (!selectedModel) {
      alert('No model selected')
      return
    }

    setDownloading(true)
    setDownloadResult(null)

    try {
      const functionsToDownload = Array.from(selectedFunctions).map(functionName => ({
        functionName,
        category: categorizeFunctionName(functionName)
      }))

      const response = await fetch('/api/ir/database/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId: device.id,
          codesetId: selectedModel.ID,
          functions: functionsToDownload
        })
      })
      
      const data = await response.json()
      
      if (data.success) {
        setDownloadResult(data)
        setTimeout(() => {
          onClose()
        }, 3000)
      } else {
        alert('Download failed: ' + data.error)
      }
    } catch (error) {
      logger.error('Error downloading codes:', error)
      alert('Error downloading codes')
    } finally {
      setDownloading(false)
    }
  }

  const categorizeFunctionName = (name: string): string => {
    const upper = name.toUpperCase()
    if (upper.includes('POWER') || upper.includes('ON') || upper.includes('OFF')) return 'Power'
    if (upper.includes('VOLUME') || upper.includes('VOL') || upper.includes('MUTE')) return 'Volume'
    if (upper.includes('CHANNEL') || upper.includes('CH ') || upper.includes('DIGIT')) return 'Channel'
    if (upper.includes('MENU') || upper.includes('GUIDE') || upper.includes('INFO')) return 'Menu'
    if (upper.includes('CURSOR') || upper.includes('UP') || upper.includes('DOWN') || 
        upper.includes('LEFT') || upper.includes('RIGHT') || upper.includes('OK') || upper.includes('ENTER')) return 'Navigation'
    return 'Other'
  }

  const filteredBrands = brands.filter(b => 
    b.Name.toLowerCase().includes(brandSearch.toLowerCase())
  )

  const filteredModels = models.filter(m => 
    m.Name.toLowerCase().includes(modelSearch.toLowerCase())
  )

  // Step 1: Credentials
  if (step === 1) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={onClose} size="sm">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <div>
            <h2 className="text-2xl font-bold text-slate-100">IR Database Login</h2>
            <p className="text-slate-400 mt-1">
              Enter your Global Cache IR Database credentials
            </p>
          </div>
        </div>

        <Card className="border-slate-700 bg-slate-800/50">
          <CardHeader>
            <CardTitle className="text-slate-100">Global Cache Account</CardTitle>
            <CardDescription>
              You need a Global Cache account to download IR codes. 
              Create one at <a href="https://irdb.globalcache.com" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">irdb.globalcache.com</a>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="email" className="text-slate-300">Email</Label>
              <Input
                id="email"
                type="email"
                value={credentials.email}
                onChange={(e) => setCredentials({ ...credentials, email: e.target.value })}
                placeholder="your@email.com"
                className="bg-slate-700 border-slate-600 text-slate-100"
              />
            </div>
            <div>
              <Label htmlFor="password" className="text-slate-300">Password</Label>
              <Input
                id="password"
                type="password"
                value={credentials.password}
                onChange={(e) => setCredentials({ ...credentials, password: e.target.value })}
                placeholder="••••••••"
                className="bg-slate-700 border-slate-600 text-slate-100"
              />
            </div>
            <Button 
              onClick={saveCredentials} 
              disabled={loading}
              className="w-full"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Logging in...
                </>
              ) : (
                'Login & Continue'
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Step 2: Search
  if (step === 2) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={onClose} size="sm">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <div>
            <h2 className="text-2xl font-bold text-slate-100">IR Database Search</h2>
            <p className="text-slate-400 mt-1">
              Searching for: <span className="text-slate-200 font-medium">{device.name}</span>
            </p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-6">
          {/* Brands */}
          <Card className="border-slate-700 bg-slate-800/50">
            <CardHeader>
              <CardTitle className="text-slate-100 text-lg">1. Select Brand</CardTitle>
              <Input
                placeholder="Search brands..."
                value={brandSearch}
                onChange={(e) => setBrandSearch(e.target.value)}
                className="mt-2 bg-slate-700 border-slate-600 text-slate-100"
              />
            </CardHeader>
            <CardContent className="max-h-96 overflow-y-auto">
              {loading && !brands.length ? (
                <div className="text-center text-slate-400 py-4">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                  Loading...
                </div>
              ) : (
                <div className="space-y-1">
                  {filteredBrands.map((brand) => (
                    <Button
                      key={brand.Name}
                      variant={selectedBrand === brand.Name ? 'default' : 'outline'}
                      className="w-full justify-start"
                      onClick={() => handleBrandSelect(brand.Name)}
                    >
                      {brand.Name}
                    </Button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Types */}
          <Card className="border-slate-700 bg-slate-800/50">
            <CardHeader>
              <CardTitle className="text-slate-100 text-lg">2. Select Type</CardTitle>
            </CardHeader>
            <CardContent className="max-h-96 overflow-y-auto">
              {!selectedBrand ? (
                <div className="text-center text-slate-400 py-8">
                  Select a brand first
                </div>
              ) : loading ? (
                <div className="text-center text-slate-400 py-4">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                  Loading...
                </div>
              ) : (
                <div className="space-y-1">
                  {types.map((type, idx) => (
                    <Button
                      key={idx}
                      variant={selectedType === type.Type ? 'default' : 'outline'}
                      className="w-full justify-start"
                      onClick={() => handleTypeSelect(type.Type || '')}
                    >
                      {type.Type}
                    </Button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Models */}
          <Card className="border-slate-700 bg-slate-800/50">
            <CardHeader>
              <CardTitle className="text-slate-100 text-lg">3. Select Model</CardTitle>
              {models.length > 0 && (
                <Input
                  placeholder="Search models..."
                  value={modelSearch}
                  onChange={(e) => setModelSearch(e.target.value)}
                  className="mt-2 bg-slate-700 border-slate-600 text-slate-100"
                />
              )}
            </CardHeader>
            <CardContent className="max-h-96 overflow-y-auto">
              {!selectedType ? (
                <div className="text-center text-slate-400 py-8">
                  Select a type first
                </div>
              ) : loading ? (
                <div className="text-center text-slate-400 py-4">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                  Loading...
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredModels.map((model) => (
                    <Button
                      key={model.ID}
                      variant="outline"
                      className="w-full justify-start h-auto py-2 px-3"
                      onClick={() => handleModelSelect(model)}
                    >
                      <div className="text-left">
                        <div className="font-medium">{model.Name}</div>
                        {model.Notes && (
                          <div className="text-xs text-slate-400 mt-1">{model.Notes}</div>
                        )}
                      </div>
                    </Button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  // Step 3: Functions
  if (step === 3) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={() => setStep(2)} size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            <div>
              <h2 className="text-2xl font-bold text-slate-100">Select Functions</h2>
              <p className="text-slate-400 mt-1">
                Model: <span className="text-slate-200 font-medium">{selectedModel?.Name}</span>
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={selectAllFunctions}>
              Select All
            </Button>
            <Button variant="outline" size="sm" onClick={deselectAllFunctions}>
              Deselect All
            </Button>
          </div>
        </div>

        {downloadResult ? (
          <Card className="border-green-500/20 bg-green-500/10">
            <CardContent className="py-6">
              <div className="flex items-center justify-center gap-3 text-green-400">
                <CheckCircle2 className="w-8 h-8" />
                <div>
                  <div className="text-lg font-semibold">Download Complete!</div>
                  <div className="text-sm text-green-400/80">
                    {downloadResult.downloadedCount} commands downloaded successfully
                  </div>
                  {downloadResult.errors?.length > 0 && (
                    <div className="text-sm text-yellow-400 mt-1">
                      {downloadResult.errors.length} failed
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-slate-700 bg-slate-800/50">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-slate-100">
                    Available Functions ({functions.length})
                  </CardTitle>
                  <CardDescription>
                    {selectedFunctions.size} selected
                  </CardDescription>
                </div>
                <Button
                  onClick={downloadCodes}
                  disabled={downloading || selectedFunctions.size === 0}
                  className="flex items-center gap-2"
                >
                  {downloading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Downloading...
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4" />
                      Download ({selectedFunctions.size})
                    </>
                  )}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="max-h-[600px] overflow-y-auto">
              <div className="grid grid-cols-3 gap-3">
                {functions.map((func) => {
                  const isSelected = selectedFunctions.has(func.Function)
                  const category = categorizeFunctionName(func.Function)
                  
                  return (
                    <div
                      key={func.Function}
                      className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                        isSelected
                          ? 'border-blue-500 bg-blue-500/10'
                          : 'border-slate-600 bg-slate-700/30 hover:border-slate-500'
                      }`}
                      onClick={() => toggleFunction(func.Function)}
                    >
                      <div className="flex items-start gap-2">
                        <Checkbox
                          checked={isSelected}
                          className="mt-0.5"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-slate-200 truncate">
                            {func.Function}
                          </div>
                          <Badge
                            variant="outline"
                            className="mt-1 text-xs bg-slate-800/50"
                          >
                            {category}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    )
  }

  return null
}
