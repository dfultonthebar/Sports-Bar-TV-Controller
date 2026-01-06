'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import SportsBarHeader from '@/components/SportsBarHeader'
import SportsBarLayout from '@/components/SportsBarLayout'
import SportsGuideConfig from '@/components/SportsGuideConfig'
import { 
  Settings, 
  ArrowLeft, 
  Save, 
  Tv, 
  MapPin, 
  Users, 
  Trophy,
  Plus,
  Trash2,
  Cable,
  Satellite,
  Smartphone,
  Monitor,
  Check,
  X,
  Key
} from 'lucide-react'
import Link from 'next/link'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

import { logger } from '@sports-bar/logger'
interface Provider {
  id?: string
  name: string
  type: 'cable' | 'satellite' | 'streaming' | 'iptv'
  channels: string[]
  packages: string[]
  inputIds?: string[]
}

interface HomeTeam {
  id?: string
  teamName: string
  league: string
  category: string
  sport: string
  location?: string
  conference?: string
  isPrimary: boolean
}

interface MatrixInput {
  id: string
  channelNumber: number
  label: string
  inputType: string
  isActive: boolean
}

interface Configuration {
  zipCode?: string
  city?: string
  state?: string
  timezone: string
  updateSchedule?: {
    enabled: boolean
    time: string
    frequency: 'daily' | 'weekly'
  }
}

const PROVIDER_TYPES = [
  { value: 'cable', label: 'Cable', icon: Cable },
  { value: 'satellite', label: 'Satellite', icon: Satellite },
  { value: 'streaming', label: 'Streaming', icon: Smartphone },
  { value: 'iptv', label: 'IPTV', icon: Monitor }
]

const SPORTS_LEAGUES = [
  { id: 'nfl', name: 'NFL', sport: 'Football', category: 'professional' },
  { id: 'nba', name: 'NBA', sport: 'Basketball', category: 'professional' },
  { id: 'mlb', name: 'MLB', sport: 'Baseball', category: 'professional' },
  { id: 'nhl', name: 'NHL', sport: 'Hockey', category: 'professional' },
  { id: 'mls', name: 'MLS', sport: 'Soccer', category: 'professional' },
  { id: 'ncaa-fb', name: 'NCAA Football', sport: 'Football', category: 'college' },
  { id: 'ncaa-bb', name: 'NCAA Basketball', sport: 'Basketball', category: 'college' },
  { id: 'nascar', name: 'NASCAR', sport: 'Racing', category: 'professional' },
  { id: 'f1', name: 'Formula 1', sport: 'Racing', category: 'international' },
  { id: 'pga', name: 'PGA Tour', sport: 'Golf', category: 'professional' }
]

const US_TIMEZONES = [
  { value: 'America/New_York', label: 'Eastern Time (ET)' },
  { value: 'America/Chicago', label: 'Central Time (CT)' },
  { value: 'America/Denver', label: 'Mountain Time (MT)' },
  { value: 'America/Phoenix', label: 'Mountain Time - Arizona (MT)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
  { value: 'America/Anchorage', label: 'Alaska Time (AKT)' },
  { value: 'Pacific/Honolulu', label: 'Hawaii Time (HT)' }
]

export default function SportsGuideConfigPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
  
  // Configuration state
  const [config, setConfig] = useState<Configuration>({
    timezone: 'America/New_York',
    updateSchedule: {
      enabled: true,
      time: '06:00',
      frequency: 'daily'
    }
  })
  
  const [providers, setProviders] = useState<Provider[]>([])
  const [homeTeams, setHomeTeams] = useState<HomeTeam[]>([])
  const [matrixInputs, setMatrixInputs] = useState<MatrixInput[]>([])
  
  // New item forms
  const [newProvider, setNewProvider] = useState<Provider>({
    name: '',
    type: 'cable',
    channels: [] as any[],
    packages: [] as any[],
    inputIds: [] as any[]
  })
  
  const [newTeam, setNewTeam] = useState<HomeTeam>({
    teamName: '',
    league: '',
    category: 'professional',
    sport: '',
    isPrimary: false
  })

  useEffect(() => {
    loadConfiguration()
  }, [])

  const loadConfiguration = async () => {
    try {
      setIsLoading(true)
      const response = await fetch('/api/sports-guide-config')
      const result = await response.json()
      
      if (result.success) {
        if (result.data.configuration) {
          setConfig(result.data.configuration)
        }
        setProviders(result.data.providers || [])
        setHomeTeams(result.data.homeTeams || [])
        setMatrixInputs(result.data.matrixInputs || [])
      }
    } catch (error) {
      logger.error('Error loading configuration:', error)
      setSaveMessage({ type: 'error', text: 'Failed to load configuration' })
    } finally {
      setIsLoading(false)
    }
  }

  const saveConfiguration = async () => {
    try {
      setIsSaving(true)
      setSaveMessage(null)
      
      const response = await fetch('/api/sports-guide-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...config,
          providers,
          homeTeams
        })
      })
      
      const result = await response.json()
      
      if (result.success) {
        setSaveMessage({ type: 'success', text: 'Configuration saved successfully!' })
        setTimeout(() => setSaveMessage(null), 3000)
      } else {
        setSaveMessage({ type: 'error', text: result.error || 'Failed to save configuration' })
      }
    } catch (error) {
      logger.error('Error saving configuration:', error)
      setSaveMessage({ type: 'error', text: 'Failed to save configuration' })
    } finally {
      setIsSaving(false)
    }
  }

  const addProvider = () => {
    if (newProvider.name.trim()) {
      setProviders([...providers, { ...newProvider }])
      setNewProvider({
        name: '',
        type: 'cable',
        channels: [] as any[],
        packages: [] as any[],
        inputIds: [] as any[]
      })
    }
  }

  const removeProvider = (index: number) => {
    setProviders(providers.filter((_, i) => i !== index))
  }

  const addTeam = () => {
    if (newTeam.teamName.trim() && newTeam.league.trim()) {
      setHomeTeams([...homeTeams, { ...newTeam }])
      setNewTeam({
        teamName: '',
        league: '',
        category: 'professional',
        sport: '',
        isPrimary: false
      })
    }
  }

  const removeTeam = (index: number) => {
    setHomeTeams(homeTeams.filter((_, i) => i !== index))
  }

  const getProviderIcon = (type: string) => {
    const providerType = PROVIDER_TYPES.find(pt => pt.value === type)
    const Icon = providerType?.icon || Tv
    return <Icon className="w-5 h-5" />
  }

  if (isLoading) {
    return (
      <SportsBarLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
            <p className="text-slate-300">Loading configuration...</p>
          </div>
        </div>
      </SportsBarLayout>
    )
  }

  return (
    <SportsBarLayout>
      <SportsBarHeader
        title="Sports Guide Configuration"
        subtitle="Configure API, providers, location, teams, and leagues"
        icon={<Settings className="w-6 h-6 text-white" />}
        actions={
          <Link href="/sports-guide" className="btn-secondary">
            <ArrowLeft className="w-4 h-4 mr-2" />
            <span>Back to Guide</span>
          </Link>
        }
      />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Save Message */}
        {saveMessage && (
          <div className={`mb-6 p-4 rounded-lg border ${
            saveMessage.type === 'success' 
              ? 'bg-green-900/30 border-green-500/50 text-green-200' 
              : 'bg-red-900/30 border-red-500/50 text-red-200'
          }`}>
            <div className="flex items-center space-x-2">
              {saveMessage.type === 'success' ? (
                <Check className="w-5 h-5" />
              ) : (
                <X className="w-5 h-5" />
              )}
              <span>{saveMessage.text}</span>
            </div>
          </div>
        )}

        {/* Save Button */}
        <div className="mb-6 flex justify-end">
          <button
            onClick={saveConfiguration}
            disabled={isSaving}
            className="inline-flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save className="w-5 h-5" />
            <span>{isSaving ? 'Saving...' : 'Save Configuration'}</span>
          </button>
        </div>

        <Tabs defaultValue="api" className="space-y-6">
          <TabsList className="grid w-full grid-cols-5 bg-sportsBar-800/50 p-1">
            <TabsTrigger value="api" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">
              <Key className="w-4 h-4 mr-2" />
              API
            </TabsTrigger>
            <TabsTrigger value="location" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">
              <MapPin className="w-4 h-4 mr-2" />
              Location
            </TabsTrigger>
            <TabsTrigger value="providers" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">
              <Tv className="w-4 h-4 mr-2" />
              Providers
            </TabsTrigger>
            <TabsTrigger value="teams" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">
              <Users className="w-4 h-4 mr-2" />
              Teams
            </TabsTrigger>
            <TabsTrigger value="leagues" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">
              <Trophy className="w-4 h-4 mr-2" />
              Leagues
            </TabsTrigger>
          </TabsList>

          {/* API Configuration Tab */}
          <TabsContent value="api" className="space-y-6">
            <SportsGuideConfig />
          </TabsContent>

          {/* Location Tab - Keep existing content */}
          <TabsContent value="location" className="space-y-6">
            {/* ... existing location tab content ... */}
          </TabsContent>

          {/* Other tabs remain the same */}
        </Tabs>
      </main>
    </SportsBarLayout>
  )
}
