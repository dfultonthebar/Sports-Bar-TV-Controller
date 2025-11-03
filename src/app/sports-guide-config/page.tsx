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

import { logger } from '@/lib/logger'
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
        subtitle="Configure providers, location, teams, and leagues"
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

        <Tabs defaultValue="location" className="space-y-6">
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
n          {/* API Configuration Tab */}
          <TabsContent value="api" className="space-y-6">
            <SportsGuideConfig />
          </TabsContent>

          {/* Location Tab */}
          <TabsContent value="location" className="space-y-6">
            <div className="card p-6">
              <h2 className="text-xl font-bold text-slate-100 mb-4">Location & Timezone</h2>
              <p className="text-sm text-slate-300 mb-6">
                Set your location for accurate local programming and game times
              </p>

              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-200 mb-2">
                      ZIP Code
                    </label>
                    <input
                      type="text"
                      value={config.zipCode || ''}
                      onChange={(e) => setConfig({ ...config, zipCode: e.target.value })}
                      placeholder="12345"
                      className="w-full px-4 py-2 bg-sportsBar-800 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-200 mb-2">
                      City
                    </label>
                    <input
                      type="text"
                      value={config.city || ''}
                      onChange={(e) => setConfig({ ...config, city: e.target.value })}
                      placeholder="City"
                      className="w-full px-4 py-2 bg-sportsBar-800 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-200 mb-2">
                      State
                    </label>
                    <input
                      type="text"
                      value={config.state || ''}
                      onChange={(e) => setConfig({ ...config, state: e.target.value })}
                      placeholder="State"
                      className="w-full px-4 py-2 bg-sportsBar-800 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-200 mb-2">
                    Timezone
                  </label>
                  <select
                    value={config.timezone}
                    onChange={(e) => setConfig({ ...config, timezone: e.target.value })}
                    className="w-full px-4 py-2 bg-sportsBar-800 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {US_TIMEZONES.map((tz) => (
                      <option key={tz.value} value={tz.value}>
                        {tz.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="pt-4 border-t border-slate-700">
                  <h3 className="text-lg font-medium text-slate-100 mb-4">Update Schedule</h3>
                  
                  <div className="space-y-4">
                    <div className="flex items-center space-x-3">
                      <input
                        type="checkbox"
                        id="updateEnabled"
                        checked={config.updateSchedule?.enabled || false}
                        onChange={(e) => setConfig({
                          ...config,
                          updateSchedule: {
                            ...config.updateSchedule!,
                            enabled: e.target.checked
                          }
                        })}
                        className="w-5 h-5 rounded border-slate-600 bg-sportsBar-800 text-blue-600 focus:ring-2 focus:ring-blue-500"
                      />
                      <label htmlFor="updateEnabled" className="text-sm font-medium text-slate-200">
                        Enable automatic guide updates
                      </label>
                    </div>

                    {config.updateSchedule?.enabled && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 ml-8">
                        <div>
                          <label className="block text-sm font-medium text-slate-200 mb-2">
                            Update Time
                          </label>
                          <input
                            type="time"
                            value={config.updateSchedule?.time || '06:00'}
                            onChange={(e) => setConfig({
                              ...config,
                              updateSchedule: {
                                ...config.updateSchedule!,
                                time: e.target.value
                              }
                            })}
                            className="w-full px-4 py-2 bg-sportsBar-800 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-slate-200 mb-2">
                            Frequency
                          </label>
                          <select
                            value={config.updateSchedule?.frequency || 'daily'}
                            onChange={(e) => setConfig({
                              ...config,
                              updateSchedule: {
                                ...config.updateSchedule!,
                                frequency: e.target.value as 'daily' | 'weekly'
                              }
                            })}
                            className="w-full px-4 py-2 bg-sportsBar-800 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="daily">Daily</option>
                            <option value="weekly">Weekly</option>
                          </select>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Providers Tab */}
          <TabsContent value="providers" className="space-y-6">
            <div className="card p-6">
              <h2 className="text-xl font-bold text-slate-100 mb-4">TV Providers</h2>
              <p className="text-sm text-slate-300 mb-6">
                Configure your cable, satellite, and streaming providers
              </p>

              {/* Add Provider Form */}
              <div className="bg-sportsBar-800/50 rounded-lg p-4 mb-6 border border-slate-700">
                <h3 className="text-lg font-medium text-slate-100 mb-4">Add New Provider</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-200 mb-2">
                      Provider Name
                    </label>
                    <input
                      type="text"
                      value={newProvider.name}
                      onChange={(e) => setNewProvider({ ...newProvider, name: e.target.value })}
                      placeholder="e.g., Comcast, DirecTV, YouTube TV"
                      className="w-full px-4 py-2 bg-sportsBar-800 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-200 mb-2">
                      Provider Type
                    </label>
                    <select
                      value={newProvider.type}
                      onChange={(e) => setNewProvider({ ...newProvider, type: e.target.value as any })}
                      className="w-full px-4 py-2 bg-sportsBar-800 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {PROVIDER_TYPES.map((type) => (
                        <option key={type.value} value={type.value}>
                          {type.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <button
                  onClick={addProvider}
                  className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Provider</span>
                </button>
              </div>

              {/* Providers List */}
              <div className="space-y-3">
                {providers.length === 0 ? (
                  <div className="text-center py-8 text-slate-400">
                    <Tv className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>No providers configured yet</p>
                  </div>
                ) : (
                  providers.map((provider, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between bg-sportsBar-800/30 rounded-lg p-4 border border-slate-700"
                    >
                      <div className="flex items-center space-x-3">
                        <div className="bg-blue-600/20 rounded-lg p-2 border border-blue-500/30">
                          {getProviderIcon(provider.type)}
                        </div>
                        <div>
                          <div className="font-medium text-white">{provider.name}</div>
                          <div className="text-sm text-slate-400 capitalize">{provider.type}</div>
                        </div>
                      </div>
                      
                      <button
                        onClick={() => removeProvider(index)}
                        className="p-2 text-red-400 hover:text-red-300 hover:bg-red-900/20 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </TabsContent>

          {/* Teams Tab */}
          <TabsContent value="teams" className="space-y-6">
            <div className="card p-6">
              <h2 className="text-xl font-bold text-slate-100 mb-4">Favorite Teams</h2>
              <p className="text-sm text-slate-300 mb-6">
                Select your home teams to prioritize their games in the guide
              </p>

              {/* Add Team Form */}
              <div className="bg-sportsBar-800/50 rounded-lg p-4 mb-6 border border-slate-700">
                <h3 className="text-lg font-medium text-slate-100 mb-4">Add Favorite Team</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-200 mb-2">
                      Team Name
                    </label>
                    <input
                      type="text"
                      value={newTeam.teamName}
                      onChange={(e) => setNewTeam({ ...newTeam, teamName: e.target.value })}
                      placeholder="e.g., Dallas Cowboys, Lakers"
                      className="w-full px-4 py-2 bg-sportsBar-800 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-200 mb-2">
                      League
                    </label>
                    <select
                      value={newTeam.league}
                      onChange={(e) => {
                        const league = SPORTS_LEAGUES.find(l => l.id === e.target.value)
                        setNewTeam({ 
                          ...newTeam, 
                          league: e.target.value,
                          sport: league?.sport || '',
                          category: league?.category || 'professional'
                        })
                      }}
                      className="w-full px-4 py-2 bg-sportsBar-800 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select League</option>
                      {SPORTS_LEAGUES.map((league) => (
                        <option key={league.id} value={league.id}>
                          {league.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-200 mb-2">
                      Location (Optional)
                    </label>
                    <input
                      type="text"
                      value={newTeam.location || ''}
                      onChange={(e) => setNewTeam({ ...newTeam, location: e.target.value })}
                      placeholder="e.g., Dallas, Los Angeles"
                      className="w-full px-4 py-2 bg-sportsBar-800 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div className="flex items-center space-x-3 pt-6">
                    <input
                      type="checkbox"
                      id="isPrimary"
                      checked={newTeam.isPrimary}
                      onChange={(e) => setNewTeam({ ...newTeam, isPrimary: e.target.checked })}
                      className="w-5 h-5 rounded border-slate-600 bg-sportsBar-800 text-blue-600 focus:ring-2 focus:ring-blue-500"
                    />
                    <label htmlFor="isPrimary" className="text-sm font-medium text-slate-200">
                      Primary Team (Show first)
                    </label>
                  </div>
                </div>

                <button
                  onClick={addTeam}
                  disabled={!newTeam.teamName.trim() || !newTeam.league}
                  className="inline-flex items-center space-x-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Team</span>
                </button>
              </div>

              {/* Teams List */}
              <div className="space-y-3">
                {homeTeams.length === 0 ? (
                  <div className="text-center py-8 text-slate-400">
                    <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>No favorite teams added yet</p>
                  </div>
                ) : (
                  homeTeams.map((team, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between bg-sportsBar-800/30 rounded-lg p-4 border border-slate-700"
                    >
                      <div className="flex items-center space-x-3">
                        <div className="bg-purple-600/20 rounded-lg p-2 border border-purple-500/30">
                          <Trophy className="w-5 h-5 text-purple-400" />
                        </div>
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="font-medium text-white">{team.teamName}</span>
                            {team.isPrimary && (
                              <span className="px-2 py-0.5 bg-yellow-500/20 text-yellow-300 text-xs font-bold rounded border border-yellow-500/30">
                                PRIMARY
                              </span>
                            )}
                          </div>
                          <div className="text-sm text-slate-400">
                            {SPORTS_LEAGUES.find(l => l.id === team.league)?.name || team.league}
                            {team.location && ` • ${team.location}`}
                          </div>
                        </div>
                      </div>
                      
                      <button
                        onClick={() => removeTeam(index)}
                        className="p-2 text-red-400 hover:text-red-300 hover:bg-red-900/20 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </TabsContent>

          {/* Leagues Tab */}
          <TabsContent value="leagues" className="space-y-6">
            <div className="card p-6">
              <h2 className="text-xl font-bold text-slate-100 mb-4">Sports Leagues</h2>
              <p className="text-sm text-slate-300 mb-6">
                Available sports leagues are managed in the main Sports Guide. Use the guide to select which leagues to track.
              </p>

              <div className="bg-blue-900/30 rounded-lg p-6 border border-blue-500/30">
                <div className="flex items-start space-x-3">
                  <Trophy className="w-6 h-6 text-blue-300 mt-0.5" />
                  <div>
                    <h3 className="font-medium text-blue-200 mb-2">Available Leagues</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                      {SPORTS_LEAGUES.map((league) => (
                        <div
                          key={league.id}
                          className="bg-sportsBar-800/30 rounded-lg p-3 border border-slate-700"
                        >
                          <div className="font-medium text-white">{league.name}</div>
                          <div className="text-sm text-slate-400">{league.sport} • {league.category}</div>
                        </div>
                      ))}
                    </div>
                    <p className="text-sm text-blue-200">
                      To select which leagues to track, go to the Sports Guide and use the league selector.
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-6">
                <Link
                  href="/sports-guide"
                  className="inline-flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 transition-colors font-medium"
                >
                  <ArrowLeft className="w-5 h-5" />
                  <span>Go to Sports Guide</span>
                </Link>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </SportsBarLayout>
  )
}
