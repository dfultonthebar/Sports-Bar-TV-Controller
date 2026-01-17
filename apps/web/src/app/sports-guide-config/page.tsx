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
  Key,
  Edit,
  Star,
  TrendingUp,
  Target,
  AlertCircle,
  CheckCircle2,
  Clock,
  Play,
  Calendar,
  Zap
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
  isActive?: boolean
  priority?: number

  // Scheduler fields
  minTVsWhenActive?: number | null
  autoPromotePlayoffs?: boolean | null
  preferredZones?: string[] | null
  rivalTeams?: string[] | null
  schedulerNotes?: string | null

  // Branding
  logoUrl?: string | null
  primaryColor?: string | null
  secondaryColor?: string | null
}

interface MatrixInput {
  id: string
  channelNumber: number
  label: string
  inputType: string
  isActive: boolean
  deviceType?: 'cable' | 'satellite' | 'streaming' | 'gaming' | 'Cable Box' | 'DirecTV' | 'Fire TV' | 'Other'
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

interface Schedule {
  id: string;
  name: string;
  description: string | null;
  enabled: boolean;
  scheduleType: string;
  executionTime: string | null;
  daysOfWeek: string | null;
  powerOnTVs: boolean;
  powerOffTVs: boolean;
  selectedOutputs: string;
  setDefaultChannels: boolean;
  defaultChannelMap: string | null;
  autoFindGames: boolean;
  monitorHomeTeams: boolean;
  fillWithSports: boolean;
  homeTeamIds: string | null;
  preferredProviders: string | null;
  executionOrder: string;
  delayBetweenCommands: number;
  lastExecuted: string | null;
  nextExecution: string | null;
  executionCount: number;
}

interface MatrixOutput {
  id: string;
  channelNumber: number;
  label: string;
}

interface OutputScheduleInfo {
  dailyTurnOnOutputs: MatrixOutput[];
  dailyTurnOffOutputs: MatrixOutput[];
  availableOutputs: MatrixOutput[];
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

  // Scheduler state
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [outputs, setOutputs] = useState<MatrixOutput[]>([])
  const [inputs, setInputs] = useState<MatrixInput[]>([])
  const [outputScheduleInfo, setOutputScheduleInfo] = useState<OutputScheduleInfo | null>(null)
  const [showScheduleForm, setShowScheduleForm] = useState(false)
  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null)
  const [audioZones, setAudioZones] = useState<any[]>([])
  const [channelPresets, setChannelPresets] = useState<any[]>([])
  const [audioSourceNames, setAudioSourceNames] = useState<Map<number, string>>(new Map())
  const [currentProcessorIp, setCurrentProcessorIp] = useState<string | null>(null)

  // Schedule form state
  const [scheduleFormData, setScheduleFormData] = useState({
    name: '',
    description: '',
    enabled: true,
    scheduleType: 'daily',
    executionTime: '09:00',
    daysOfWeek: [] as string[],
    powerOnTVs: true,
    powerOffTVs: false,
    selectedOutputs: [] as string[],
    setDefaultChannels: false,
    defaultChannelMap: {} as any,
    inputDefaultChannels: {} as any,
    autoFindGames: false,
    monitorHomeTeams: false,
    fillWithSports: true,
    homeTeamIds: [] as string[],
    preferredProviders: ['cable', 'streaming', 'satellite'],
    executionOrder: 'outputs_first',
    delayBetweenCommands: 2000,
    audioSettings: {
      enabled: false,
      zones: [] as Array<{
        zoneId: string
        zoneName: string
        volume: number
        muted: boolean
        source: string
      }>
    }
  })

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

  // Team management state
  const [editingTeam, setEditingTeam] = useState<HomeTeam | null>(null)
  const [showTeamForm, setShowTeamForm] = useState(false)
  const [teamFormData, setTeamFormData] = useState<Partial<HomeTeam>>({
    teamName: '',
    league: '',
    category: 'professional',
    sport: '',
    isPrimary: false,
    isActive: true,
    priority: 50,
    minTVsWhenActive: 1,
    autoPromotePlayoffs: true,
    schedulerNotes: ''
  })
  const [deletingTeamId, setDeletingTeamId] = useState<string | null>(null)

  // ESPN API state
  const [espnLeagues, setEspnLeagues] = useState<any[]>([])
  const [espnTeams, setEspnTeams] = useState<any[]>([])
  const [espnDivisions, setEspnDivisions] = useState<any[]>([])
  const [loadingLeagues, setLoadingLeagues] = useState(false)
  const [loadingTeams, setLoadingTeams] = useState(false)
  const [loadingDivisions, setLoadingDivisions] = useState(false)

  useEffect(() => {
    loadConfiguration()
    loadESPNLeagues()
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
        setMatrixInputs(result.data.matrixInputs || [])
      }

      // Load teams from dedicated API
      await loadTeams()

      // Load scheduler data
      await loadSchedulerData()
    } catch (error) {
      logger.error('Error loading configuration:', error)
      setSaveMessage({ type: 'error', text: 'Failed to load configuration' })
    } finally {
      setIsLoading(false)
    }
  }

  const loadTeams = async () => {
    try {
      const response = await fetch('/api/home-teams')
      const result = await response.json()

      if (result.success) {
        setHomeTeams(result.teams || [])
      }
    } catch (error) {
      logger.error('Error loading teams:', error)
    }
  }

  const loadESPNLeagues = async () => {
    try {
      setLoadingLeagues(true)
      const response = await fetch('/api/espn/leagues')
      const data = await response.json()
      if (data.success) {
        setEspnLeagues(data.leagues || [])
      }
    } catch (error) {
      logger.error('Failed to load ESPN leagues:', error)
    } finally {
      setLoadingLeagues(false)
    }
  }

  const loadTeamsForLeague = async (sport: string, league: string) => {
    try {
      setLoadingTeams(true)
      setLoadingDivisions(true)
      const response = await fetch(`/api/espn/teams?sport=${sport}&league=${league}&withDivisions=true`)
      const data = await response.json()
      if (data.success) {
        setEspnTeams(data.teams || [])
        setEspnDivisions(data.divisions || [])

        // Auto-populate conference field if the API returned an autoConference value
        // This happens for conference-specific leagues like "Horizon League (Men's)"
        if (data.autoConference) {
          setTeamFormData(prev => ({
            ...prev,
            conference: data.autoConference
          }))
        }
      }
    } catch (error) {
      logger.error('Failed to load teams:', error)
      setEspnTeams([])
      setEspnDivisions([])
    } finally {
      setLoadingTeams(false)
      setLoadingDivisions(false)
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

  // New team management functions
  const openTeamForm = (team?: HomeTeam) => {
    if (team) {
      setEditingTeam(team)
      setTeamFormData({
        teamName: team.teamName,
        league: team.league,
        category: team.category,
        sport: team.sport,
        location: team.location || '',
        conference: team.conference || '',
        isPrimary: team.isPrimary,
        isActive: team.isActive ?? true,
        priority: team.priority ?? 50,
        minTVsWhenActive: team.minTVsWhenActive ?? 1,
        autoPromotePlayoffs: team.autoPromotePlayoffs ?? true,
        schedulerNotes: team.schedulerNotes || ''
      })
      // Load teams and divisions for the team's league if available
      if (team.sport && team.league) {
        loadTeamsForLeague(team.sport, team.league)
      }
    } else {
      setEditingTeam(null)
      setTeamFormData({
        teamName: '',
        league: '',
        category: 'professional',
        sport: '',
        isPrimary: false,
        isActive: true,
        priority: 50,
        minTVsWhenActive: 1,
        autoPromotePlayoffs: true,
        schedulerNotes: ''
      })
      setEspnTeams([])
      setEspnDivisions([])
    }
    setShowTeamForm(true)
  }

  const closeTeamForm = () => {
    setShowTeamForm(false)
    setEditingTeam(null)
    setTeamFormData({
      teamName: '',
      league: '',
      category: 'professional',
      sport: '',
      isPrimary: false,
      isActive: true,
      priority: 50,
      minTVsWhenActive: 1,
      autoPromotePlayoffs: true,
      schedulerNotes: ''
    })
    setEspnTeams([])
    setEspnDivisions([])
  }

  const saveTeam = async () => {
    try {
      setIsSaving(true)
      setSaveMessage(null)

      // Determine category based on league
      let category = 'professional'
      if (teamFormData.league?.toLowerCase().includes('ncaa') ||
          teamFormData.league?.toLowerCase().includes('college')) {
        category = 'college'
      }

      const teamData = {
        teamName: teamFormData.teamName,
        league: teamFormData.league,
        category: category,
        sport: teamFormData.sport,
        location: teamFormData.location || null,
        conference: teamFormData.conference || null,
        isPrimary: teamFormData.isPrimary || false,
        isActive: teamFormData.isActive ?? true,
        priority: teamFormData.priority ?? 50,
        minTVsWhenActive: teamFormData.minTVsWhenActive ?? 1,
        autoPromotePlayoffs: teamFormData.autoPromotePlayoffs ?? true,
        schedulerNotes: teamFormData.schedulerNotes || null
      }

      const url = editingTeam
        ? `/api/home-teams/${editingTeam.id}`
        : '/api/home-teams'
      const method = editingTeam ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(teamData)
      })

      const result = await response.json()

      if (result.success) {
        setSaveMessage({
          type: 'success',
          text: editingTeam ? 'Team updated successfully!' : 'Team created successfully!'
        })
        await loadTeams()
        closeTeamForm()
        setTimeout(() => setSaveMessage(null), 3000)
      } else {
        setSaveMessage({ type: 'error', text: result.error || 'Failed to save team' })
      }
    } catch (error) {
      logger.error('Error saving team:', error)
      setSaveMessage({ type: 'error', text: 'Failed to save team' })
    } finally {
      setIsSaving(false)
    }
  }

  const deleteTeam = async (teamId: string) => {
    try {
      setIsSaving(true)
      setSaveMessage(null)

      const response = await fetch(`/api/home-teams/${teamId}`, {
        method: 'DELETE'
      })

      const result = await response.json()

      if (result.success) {
        setSaveMessage({ type: 'success', text: 'Team deleted successfully!' })
        await loadTeams()
        setDeletingTeamId(null)
        setTimeout(() => setSaveMessage(null), 3000)
      } else {
        setSaveMessage({ type: 'error', text: result.error || 'Failed to delete team' })
      }
    } catch (error) {
      logger.error('Error deleting team:', error)
      setSaveMessage({ type: 'error', text: 'Failed to delete team' })
    } finally {
      setIsSaving(false)
    }
  }

  // Scheduler functions
  const loadSchedulerData = async () => {
    try {
      const [schedulesRes, outputsRes, inputsRes, scheduleInfoRes, presetsRes] = await Promise.all([
        fetch('/api/schedules'),
        fetch('/api/matrix/outputs'),
        fetch('/api/matrix/inputs'),
        fetch('/api/matrix/outputs-schedule'),
        fetch('/api/channel-presets')
      ]);

      const [schedulesData, outputsData, inputsData, scheduleInfoData, presetsData] = await Promise.all([
        schedulesRes.json(),
        outputsRes.json(),
        inputsRes.json(),
        scheduleInfoRes.json(),
        presetsRes.json()
      ]);

      setSchedules(schedulesData.schedules || []);

      // Filter to only active outputs and inputs
      const activeOutputs = (outputsData.outputs || []).filter((o: any) => o.isActive !== false);
      const activeInputs = (inputsData.inputs || []).filter((i: any) => i.isActive !== false);

      setOutputs(activeOutputs);
      setInputs(activeInputs);

      // Load channel presets
      if (presetsData.presets) {
        setChannelPresets(presetsData.presets);
      }

      if (scheduleInfoData.success) {
        setOutputScheduleInfo({
          dailyTurnOnOutputs: scheduleInfoData.dailyTurnOnOutputs || [],
          dailyTurnOffOutputs: scheduleInfoData.dailyTurnOffOutputs || [],
          availableOutputs: scheduleInfoData.availableOutputs || []
        });
      }
    } catch (error) {
      logger.error('Error loading scheduler data:', error);
    }
  };

  const loadAudioZones = async (shouldFetchSources = true): Promise<any[]> => {
    try {
      // Get list of audio processors from database
      const processorsRes = await fetch('/api/atlas-processors');
      const processorsData = await processorsRes.json();

      if (processorsData.success && processorsData.processors && processorsData.processors.length > 0) {
        const processor = processorsData.processors[0]; // Get first processor

        // Store processor IP for future reference
        setCurrentProcessorIp(processor.ipAddress);

        // Fetch source names if requested
        if (shouldFetchSources && processor.ipAddress) {
          try {
            const sourcesRes = await fetch(`/api/atlas/sources?processorIp=${processor.ipAddress}`);
            const sourcesData = await sourcesRes.json();

            if (sourcesData.success && sourcesData.sources) {
              const sourceMap = new Map<number, string>(
                sourcesData.sources.map((s: any) => [s.index as number, s.name as string])
              );
              setAudioSourceNames(sourceMap);
              logger.info('[AUDIO] Source names loaded:', { count: sourceMap.size, sources: Array.from(sourceMap.entries()) });
            }
          } catch (error) {
            logger.warn('[AUDIO] Failed to fetch source names:', error);
            // Continue with fallback labels
          }
        }

        // Fetch groups from the processor
        const groupsRes = await fetch(`/api/atlas/groups?processorIp=${processor.ipAddress}`);
        const groupsData = await groupsRes.json();

        if (groupsData.success && groupsData.groups) {
          // Map groups to zones
          const zones = groupsData.groups
            .filter((g: any) => g.isActive)  // Fixed: use isActive instead of active
            .map((g: any, index: number) => ({
              id: `zone-${index}`,
              name: g.name || `Zone ${index + 1}`,
              currentSource: g.source?.toString() || '1',
              currentGain: g.gain || 0,
              muted: g.muted || false
            }));
          setAudioZones(zones);
          logger.info('Audio zones loaded successfully:', { count: zones.length });
          return zones;  // Return the zones array
        } else {
          logger.warn('No audio groups found or groups API failed');
          setAudioZones([]);
          return [];
        }
      } else {
        logger.warn('No audio processors configured in database');
        setAudioZones([]);
        return [];
      }
    } catch (error) {
      logger.error('Error loading audio zones:', error);
      // Set empty array on error so UI doesn't break
      setAudioZones([]);
      return [];
    }
  };

  const handleCreateSchedule = () => {
    setEditingSchedule(null);
    setScheduleFormData({
      name: '',
      description: '',
      enabled: true,
      scheduleType: 'daily',
      executionTime: '09:00',
      daysOfWeek: [] as string[],
      powerOnTVs: true,
      powerOffTVs: false,
      selectedOutputs: [] as string[],
      setDefaultChannels: false,
      defaultChannelMap: {},
      inputDefaultChannels: {},
      autoFindGames: false,
      monitorHomeTeams: false,
      fillWithSports: true,
      homeTeamIds: [] as string[],
      preferredProviders: ['cable', 'streaming', 'satellite'],
      executionOrder: 'outputs_first',
      delayBetweenCommands: 2000,
      audioSettings: {
        enabled: false,
        zones: []
      }
    });
    setShowScheduleForm(true);
  };

  const handleEditSchedule = async (schedule: Schedule) => {
    setEditingSchedule(schedule);
    const audioSettings = (schedule as any).audioSettings ? JSON.parse((schedule as any).audioSettings) : { enabled: false, zones: [] };

    // If schedule has audio settings enabled, fetch source names
    if (audioSettings.enabled && audioSettings.zones?.length > 0) {
      await loadAudioZones(); // This will populate audioSourceNames
    }

    setScheduleFormData({
      name: schedule.name,
      description: schedule.description || '',
      enabled: schedule.enabled,
      scheduleType: schedule.scheduleType,
      executionTime: schedule.executionTime || '09:00',
      daysOfWeek: schedule.daysOfWeek ? JSON.parse(schedule.daysOfWeek) : [],
      powerOnTVs: schedule.powerOnTVs,
      powerOffTVs: schedule.powerOffTVs,
      selectedOutputs: JSON.parse(schedule.selectedOutputs || '[]'),
      setDefaultChannels: schedule.setDefaultChannels,
      defaultChannelMap: schedule.defaultChannelMap ? JSON.parse(schedule.defaultChannelMap) : {},
      inputDefaultChannels: (schedule as any).inputDefaultChannels ? JSON.parse((schedule as any).inputDefaultChannels) : {},
      autoFindGames: schedule.autoFindGames,
      monitorHomeTeams: schedule.monitorHomeTeams,
      fillWithSports: schedule.fillWithSports !== false, // Default true if not set
      homeTeamIds: schedule.homeTeamIds ? JSON.parse(schedule.homeTeamIds) : [],
      preferredProviders: schedule.preferredProviders ? JSON.parse(schedule.preferredProviders) : ['cable', 'streaming', 'satellite'],
      executionOrder: schedule.executionOrder || 'outputs_first',
      delayBetweenCommands: schedule.delayBetweenCommands || 2000,
      audioSettings: audioSettings
    });
    setShowScheduleForm(true);
  };

  const handleSaveSchedule = async () => {
    try {
      setIsSaving(true);
      const url = editingSchedule
        ? `/api/schedules/${editingSchedule.id}`
        : '/api/schedules';

      const method = editingSchedule ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(scheduleFormData)
      });

      if (response.ok) {
        setShowScheduleForm(false);
        await loadSchedulerData();
        setSaveMessage({ type: 'success', text: 'Schedule saved successfully!' });
        setTimeout(() => setSaveMessage(null), 3000);
      }
    } catch (error) {
      logger.error('Error saving schedule:', error);
      setSaveMessage({ type: 'error', text: 'Failed to save schedule' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteSchedule = async (id: string) => {
    if (!confirm('Are you sure you want to delete this schedule?')) return;

    try {
      const response = await fetch(`/api/schedules/${id}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        await loadSchedulerData();
        setSaveMessage({ type: 'success', text: 'Schedule deleted successfully!' });
        setTimeout(() => setSaveMessage(null), 3000);
      }
    } catch (error) {
      logger.error('Error deleting schedule:', error);
      setSaveMessage({ type: 'error', text: 'Failed to delete schedule' });
    }
  };

  const handleExecuteSchedule = async (id: string) => {
    try {
      const response = await fetch('/api/schedules/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scheduleId: id })
      });

      const data = await response.json();

      if (data.result?.success) {
        alert(`Schedule executed successfully!\n${data.result.message}`);
      } else {
        alert(`Schedule execution had issues:\n${data.result?.message || 'Unknown error'}`);
      }

      await loadSchedulerData();
    } catch (error) {
      logger.error('Error executing schedule:', error);
      alert('Failed to execute schedule');
    }
  };

  const toggleOutput = (outputId: string) => {
    setScheduleFormData(prev => ({
      ...prev,
      selectedOutputs: prev.selectedOutputs.includes(outputId)
        ? prev.selectedOutputs.filter(id => id !== outputId)
        : [...prev.selectedOutputs, outputId]
    }));
  };

  const toggleHomeTeamSchedule = (teamId: string) => {
    setScheduleFormData(prev => ({
      ...prev,
      homeTeamIds: prev.homeTeamIds.includes(teamId)
        ? prev.homeTeamIds.filter(id => id !== teamId)
        : [...prev.homeTeamIds, teamId]
    }));
  };

  const toggleDayOfWeek = (day: string) => {
    setScheduleFormData(prev => ({
      ...prev,
      daysOfWeek: prev.daysOfWeek.includes(day)
        ? prev.daysOfWeek.filter(d => d !== day)
        : [...prev.daysOfWeek, day]
    }));
  };

  const setDefaultChannel = (outputId: string, inputId: string, channel: string, presetName?: string) => {
    setScheduleFormData(prev => ({
      ...prev,
      defaultChannelMap: {
        ...prev.defaultChannelMap,
        [outputId]: { inputId, channel, presetName: presetName || null }
      }
    }));
  };

  const setInputDefaultChannel = (inputId: string, channel: string) => {
    setScheduleFormData(prev => ({
      ...prev,
      inputDefaultChannels: {
        ...prev.inputDefaultChannels,
        [inputId]: channel
      }
    }));
  };

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
      {/* Deprecation Banner */}
      <div className="bg-yellow-900/50 border border-yellow-600 rounded-lg p-4 mx-4 mt-4 mb-2 flex items-center gap-3">
        <AlertCircle className="w-6 h-6 text-yellow-400 flex-shrink-0" />
        <div className="flex-1">
          <p className="text-yellow-200 font-medium">This page is being replaced</p>
          <p className="text-yellow-400/80 text-sm">
            Use the new <Link href="/ai-gameplan" className="underline hover:text-yellow-300">AI Game Plan</Link> page for automatic game scheduling.
            Team priorities configured here will still be used.
          </p>
        </div>
        <Link href="/ai-gameplan" className="bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
          Go to AI Game Plan
        </Link>
      </div>

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
          <TabsList className="grid w-full grid-cols-6 bg-sportsBar-800/50 p-1">
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
            <TabsTrigger value="scheduling" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">
              <Clock className="w-4 h-4 mr-2" />
              Scheduling
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
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-xl font-bold text-slate-100">Team Management</h2>
                  <p className="text-sm text-slate-300 mt-1">
                    Configure home teams and scheduler settings
                  </p>
                </div>
                <button
                  onClick={() => openTeamForm()}
                  className="inline-flex items-center space-x-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Team</span>
                </button>
              </div>

              {/* Team Form Modal */}
              {showTeamForm && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                  <div className="bg-sportsBar-900 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-slate-700">
                    <div className="p-6 border-b border-slate-700 sticky top-0 bg-sportsBar-900 z-10">
                      <h3 className="text-xl font-bold text-white">
                        {editingTeam ? 'Edit Team' : 'Add New Team'}
                      </h3>
                    </div>

                    <div className="p-6 space-y-4">
                      {/* Basic Info */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-slate-200 mb-2">
                            Sport *
                          </label>
                          <select
                            value={teamFormData.sport || ''}
                            onChange={(e) => {
                              setTeamFormData({
                                ...teamFormData,
                                sport: e.target.value,
                                league: '', // Reset league when sport changes
                                conference: '' // Reset conference when sport changes
                              })
                              setEspnDivisions([]) // Clear divisions
                            }}
                            className="w-full px-4 py-2 bg-sportsBar-800 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                          >
                            <option value="">Select Sport</option>
                            <option value="football">Football</option>
                            <option value="basketball">Basketball</option>
                            <option value="baseball">Baseball</option>
                            <option value="hockey">Hockey</option>
                            <option value="soccer">Soccer</option>
                            <option value="volleyball">Volleyball</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-slate-200 mb-2">
                            League *
                          </label>
                          <select
                            value={teamFormData.league || ''}
                            onChange={(e) => {
                              const selectedLeague = espnLeagues.find(l => l.id === e.target.value)
                              setTeamFormData({
                                ...teamFormData,
                                league: e.target.value,
                                conference: '', // Reset conference when league changes
                                teamName: '', // Reset team name when league changes
                                location: '' // Reset location when league changes
                              })
                              // Load teams and divisions for the selected league
                              if (teamFormData.sport && e.target.value) {
                                loadTeamsForLeague(teamFormData.sport, e.target.value)
                              } else {
                                setEspnTeams([])
                                setEspnDivisions([])
                              }
                            }}
                            disabled={!teamFormData.sport || loadingLeagues}
                            className="w-full px-4 py-2 bg-sportsBar-800 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <option value="">
                              {loadingLeagues ? 'Loading leagues...' : teamFormData.sport ? 'Select League' : 'Select Sport First'}
                            </option>
                            {espnLeagues
                              .filter(league => league.sport.toLowerCase() === teamFormData.sport?.toLowerCase())
                              .map((league) => (
                                <option key={league.id} value={league.id}>
                                  {league.name} ({league.abbreviation})
                                </option>
                              ))}
                          </select>
                        </div>

                        <div className="md:col-span-2">
                          <label className="block text-sm font-medium text-slate-200 mb-2">
                            Select Team from {teamFormData.league || 'League'}
                          </label>
                          <select
                            value=""
                            onChange={(e) => {
                              const selectedTeam = espnTeams.find(t => t.id === e.target.value)
                              if (selectedTeam) {
                                setTeamFormData({
                                  ...teamFormData,
                                  teamName: selectedTeam.displayName,
                                  location: selectedTeam.location
                                })
                              }
                            }}
                            disabled={!teamFormData.league || loadingTeams || espnTeams.length === 0}
                            className="w-full px-4 py-2 bg-sportsBar-800 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <option value="">
                              {loadingTeams ? 'Loading teams...' : espnTeams.length === 0 ? 'Select League First' : 'Select a team (optional)'}
                            </option>
                            {espnTeams
                              .sort((a, b) => a.displayName.localeCompare(b.displayName))
                              .map((team) => (
                                <option key={team.id} value={team.id}>
                                  {team.displayName}
                                </option>
                              ))}
                          </select>
                          <p className="text-xs text-slate-400 mt-1">
                            Select a team to auto-fill name and location, or manually enter below
                          </p>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-slate-200 mb-2">
                            Team Name *
                          </label>
                          <input
                            type="text"
                            value={teamFormData.teamName || ''}
                            onChange={(e) => setTeamFormData({ ...teamFormData, teamName: e.target.value })}
                            placeholder="e.g., Dallas Cowboys"
                            className="w-full px-4 py-2 bg-sportsBar-800 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-slate-200 mb-2">
                            Location
                          </label>
                          <input
                            type="text"
                            value={teamFormData.location || ''}
                            onChange={(e) => setTeamFormData({ ...teamFormData, location: e.target.value })}
                            placeholder="e.g., Dallas"
                            className="w-full px-4 py-2 bg-sportsBar-800 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-slate-200 mb-2">
                            Conference/Division
                          </label>
                          <select
                            value={teamFormData.conference || ''}
                            onChange={(e) => setTeamFormData({ ...teamFormData, conference: e.target.value })}
                            disabled={!teamFormData.league || loadingDivisions}
                            className="w-full px-4 py-2 bg-sportsBar-800 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <option value="">
                              {loadingDivisions ? 'Loading divisions...' : espnDivisions.length > 0 ? 'Select Division (Optional)' : 'Select League First'}
                            </option>
                            {espnDivisions.map((division) => (
                              <option key={division.id} value={division.name}>
                                {division.name}
                              </option>
                            ))}
                          </select>
                          {!teamFormData.league && (
                            <p className="text-xs text-slate-500 mt-1">Select a league to see available divisions</p>
                          )}
                        </div>
                      </div>

                      {/* Scheduler Settings */}
                      <div className="pt-4 border-t border-slate-700">
                        <h4 className="text-md font-semibold text-slate-100 mb-3 flex items-center space-x-2">
                          <Target className="w-4 h-4" />
                          <span>Scheduler Settings</span>
                        </h4>

                        <div className="space-y-4">
                          <div>
                            <label className="block text-sm font-medium text-slate-200 mb-2">
                              Priority (0-100)
                            </label>
                            <div className="flex items-center space-x-3">
                              <input
                                type="range"
                                min="0"
                                max="100"
                                value={teamFormData.priority || 50}
                                onChange={(e) => setTeamFormData({ ...teamFormData, priority: parseInt(e.target.value) })}
                                className="flex-1"
                              />
                              <div className="w-16 px-3 py-2 bg-sportsBar-800 border border-slate-600 rounded-lg text-center text-white font-medium">
                                {teamFormData.priority || 50}
                              </div>
                            </div>
                            <p className="text-xs text-slate-400 mt-1">
                              Higher priority teams get preference when scheduling games
                            </p>
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-slate-200 mb-2">
                              Min TVs When Active
                            </label>
                            <input
                              type="number"
                              min="0"
                              max="20"
                              value={teamFormData.minTVsWhenActive || 1}
                              onChange={(e) => setTeamFormData({ ...teamFormData, minTVsWhenActive: parseInt(e.target.value) })}
                              className="w-full px-4 py-2 bg-sportsBar-800 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                            />
                            <p className="text-xs text-slate-400 mt-1">
                              Minimum number of TVs to show this team when they're playing
                            </p>
                          </div>

                          <div className="flex items-center space-x-3">
                            <input
                              type="checkbox"
                              id="autoPromotePlayoffs"
                              checked={teamFormData.autoPromotePlayoffs ?? true}
                              onChange={(e) => setTeamFormData({ ...teamFormData, autoPromotePlayoffs: e.target.checked })}
                              className="w-5 h-5 rounded border-slate-600 bg-sportsBar-800 text-purple-600 focus:ring-2 focus:ring-purple-500"
                            />
                            <label htmlFor="autoPromotePlayoffs" className="text-sm font-medium text-slate-200">
                              Auto promote playoff games
                            </label>
                          </div>
                        </div>
                      </div>

                      {/* Team Status */}
                      <div className="pt-4 border-t border-slate-700">
                        <h4 className="text-md font-semibold text-slate-100 mb-3 flex items-center space-x-2">
                          <TrendingUp className="w-4 h-4" />
                          <span>Team Status</span>
                        </h4>

                        <div className="space-y-3">
                          <div className="flex items-center space-x-3">
                            <input
                              type="checkbox"
                              id="isPrimary"
                              checked={teamFormData.isPrimary || false}
                              onChange={(e) => setTeamFormData({ ...teamFormData, isPrimary: e.target.checked })}
                              className="w-5 h-5 rounded border-slate-600 bg-sportsBar-800 text-yellow-600 focus:ring-2 focus:ring-yellow-500"
                            />
                            <label htmlFor="isPrimary" className="text-sm font-medium text-slate-200 flex items-center space-x-2">
                              <Star className="w-4 h-4 text-yellow-400" />
                              <span>Primary Team (highest priority)</span>
                            </label>
                          </div>

                          <div className="flex items-center space-x-3">
                            <input
                              type="checkbox"
                              id="isActive"
                              checked={teamFormData.isActive ?? true}
                              onChange={(e) => setTeamFormData({ ...teamFormData, isActive: e.target.checked })}
                              className="w-5 h-5 rounded border-slate-600 bg-sportsBar-800 text-green-600 focus:ring-2 focus:ring-green-500"
                            />
                            <label htmlFor="isActive" className="text-sm font-medium text-slate-200">
                              Active (include in scheduler)
                            </label>
                          </div>
                        </div>
                      </div>

                      {/* Scheduler Notes */}
                      <div className="pt-4 border-t border-slate-700">
                        <label className="block text-sm font-medium text-slate-200 mb-2">
                          Scheduler Notes
                        </label>
                        <textarea
                          value={teamFormData.schedulerNotes || ''}
                          onChange={(e) => setTeamFormData({ ...teamFormData, schedulerNotes: e.target.value })}
                          placeholder="Optional notes for the scheduler..."
                          rows={3}
                          className="w-full px-4 py-2 bg-sportsBar-800 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                        />
                      </div>
                    </div>

                    <div className="p-6 border-t border-slate-700 flex justify-end space-x-3">
                      <button
                        onClick={closeTeamForm}
                        className="px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={saveTeam}
                        disabled={!teamFormData.teamName?.trim() || !teamFormData.league || isSaving}
                        className="inline-flex items-center space-x-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Save className="w-4 h-4" />
                        <span>{isSaving ? 'Saving...' : editingTeam ? 'Update Team' : 'Create Team'}</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Teams List */}
              <div className="space-y-3">
                {homeTeams.length === 0 ? (
                  <div className="text-center py-12 text-slate-400">
                    <Users className="w-16 h-16 mx-auto mb-4 opacity-50" />
                    <p className="text-lg mb-2">No teams configured yet</p>
                    <p className="text-sm">Click "Add Team" to get started</p>
                  </div>
                ) : (
                  homeTeams.map((team) => (
                    <div
                      key={team.id}
                      className="bg-sportsBar-800/30 rounded-lg p-4 border border-slate-700 hover:border-purple-500/50 transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start space-x-3 flex-1">
                          <div className={`rounded-lg p-2 border ${
                            team.isPrimary
                              ? 'bg-yellow-600/20 border-yellow-500/30'
                              : 'bg-purple-600/20 border-purple-500/30'
                          }`}>
                            {team.isPrimary ? (
                              <Star className="w-5 h-5 text-yellow-400" />
                            ) : (
                              <Trophy className="w-5 h-5 text-purple-400" />
                            )}
                          </div>

                          <div className="flex-1">
                            <div className="flex items-center space-x-2 mb-1">
                              <span className="font-medium text-white text-lg">{team.teamName}</span>
                              {team.isPrimary && (
                                <span className="px-2 py-0.5 bg-yellow-500/20 text-yellow-300 text-xs font-bold rounded border border-yellow-500/30">
                                  PRIMARY
                                </span>
                              )}
                              {team.isActive === false && (
                                <span className="px-2 py-0.5 bg-slate-500/20 text-slate-300 text-xs font-bold rounded border border-slate-500/30">
                                  INACTIVE
                                </span>
                              )}
                            </div>

                            <div className="text-sm text-slate-400 mb-2">
                              {SPORTS_LEAGUES.find(l => l.id === team.league)?.name || team.league}
                              {team.location && ` • ${team.location}`}
                              {team.conference && ` • ${team.conference}`}
                            </div>

                            <div className="flex items-center space-x-4 text-xs text-slate-400">
                              <div className="flex items-center space-x-1">
                                <TrendingUp className="w-3 h-3" />
                                <span>Priority: {team.priority ?? 0}</span>
                              </div>
                              <div className="flex items-center space-x-1">
                                <Tv className="w-3 h-3" />
                                <span>Min TVs: {team.minTVsWhenActive ?? 1}</span>
                              </div>
                              {team.autoPromotePlayoffs && (
                                <div className="flex items-center space-x-1">
                                  <Trophy className="w-3 h-3" />
                                  <span>Auto-playoff</span>
                                </div>
                              )}
                            </div>

                            {team.schedulerNotes && (
                              <div className="mt-2 text-xs text-slate-400 bg-sportsBar-900/50 rounded p-2 border border-slate-700/50">
                                {team.schedulerNotes}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center space-x-2 ml-4">
                          <button
                            onClick={() => openTeamForm(team)}
                            className="p-2 text-blue-400 hover:text-blue-300 hover:bg-blue-900/20 rounded-lg transition-colors"
                            title="Edit team"
                          >
                            <Edit className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => setDeletingTeamId(team.id!)}
                            className="p-2 text-red-400 hover:text-red-300 hover:bg-red-900/20 rounded-lg transition-colors"
                            title="Delete team"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Delete Confirmation Modal */}
              {deletingTeamId && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                  <div className="bg-sportsBar-900 rounded-lg shadow-xl max-w-md w-full border border-red-500/50">
                    <div className="p-6">
                      <div className="flex items-center space-x-3 mb-4">
                        <div className="bg-red-600/20 rounded-lg p-2 border border-red-500/30">
                          <AlertCircle className="w-6 h-6 text-red-400" />
                        </div>
                        <h3 className="text-xl font-bold text-white">Delete Team?</h3>
                      </div>

                      <p className="text-slate-300 mb-6">
                        Are you sure you want to delete "
                        {homeTeams.find(t => t.id === deletingTeamId)?.teamName}
                        "? This action cannot be undone.
                      </p>

                      <div className="flex justify-end space-x-3">
                        <button
                          onClick={() => setDeletingTeamId(null)}
                          className="px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => deleteTeam(deletingTeamId)}
                          disabled={isSaving}
                          className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                        >
                          {isSaving ? 'Deleting...' : 'Delete'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </TabsContent>

          {/* Scheduling Tab */}
          <TabsContent value="scheduling" className="space-y-6">
            <div className="card p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-bold text-slate-100 flex items-center gap-3">
                    <Calendar className="w-6 h-6 text-blue-400" />
                    TV Schedule Manager
                  </h2>
                  <p className="text-sm text-slate-300 mt-2">
                    Automated TV control, channel scheduling, and game finder
                  </p>
                </div>
                <button
                  onClick={handleCreateSchedule}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-2 transition-colors"
                >
                  <Plus className="w-5 h-5" />
                  New Schedule
                </button>
              </div>

              {/* Schedule List */}
              {!showScheduleForm && (
                <div className="grid gap-4">
                  {schedules.length === 0 ? (
                    <div className="bg-sportsBar-800/50 border border-slate-700 rounded-lg p-8 text-center">
                      <Calendar className="w-16 h-16 text-slate-400 mx-auto mb-4" />
                      <p className="text-slate-400 text-lg mb-2">No schedules yet</p>
                      <p className="text-slate-500 text-sm mb-4">
                        Create your first schedule to automate TV control and game detection
                      </p>
                      <button
                        onClick={handleCreateSchedule}
                        className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg inline-flex items-center gap-2 transition-colors"
                      >
                        <Plus className="w-5 h-5" />
                        Create Schedule
                      </button>
                    </div>
                  ) : (
                    schedules.map(schedule => (
                      <div
                        key={schedule.id}
                        className={`bg-sportsBar-800/30 border rounded-lg p-6 ${
                          schedule.enabled ? 'border-slate-700' : 'border-slate-800 opacity-60'
                        }`}
                      >
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <h3 className="text-xl font-semibold text-slate-100">
                                {schedule.name}
                              </h3>
                              {schedule.enabled ? (
                                <span className="px-2 py-1 bg-emerald-900/50 text-emerald-400 text-xs rounded">
                                  Active
                                </span>
                              ) : (
                                <span className="px-2 py-1 bg-slate-700 text-slate-400 text-xs rounded">
                                  Disabled
                                </span>
                              )}
                            </div>
                            {schedule.description && (
                              <p className="text-slate-400 text-sm mb-3">{schedule.description}</p>
                            )}

                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                              <div className="flex items-center gap-2">
                                <Clock className="w-4 h-4 text-blue-400" />
                                <div>
                                  <p className="text-xs text-slate-500">Type</p>
                                  <p className="text-sm text-slate-300 capitalize">{schedule.scheduleType}</p>
                                </div>
                              </div>

                              <div className="flex items-center gap-2">
                                <Calendar className="w-4 h-4 text-emerald-400" />
                                <div>
                                  <p className="text-xs text-slate-500">Time</p>
                                  <p className="text-sm text-slate-300">{schedule.executionTime || 'N/A'}</p>
                                </div>
                              </div>

                              <div className="flex items-center gap-2">
                                <Tv className="w-4 h-4 text-amber-400" />
                                <div>
                                  <p className="text-xs text-slate-500">TVs</p>
                                  <p className="text-sm text-slate-300">
                                    {JSON.parse(schedule.selectedOutputs || '[]').length}
                                  </p>
                                </div>
                              </div>

                              <div className="flex items-center gap-2">
                                <Target className="w-4 h-4 text-purple-400" />
                                <div>
                                  <p className="text-xs text-slate-500">Auto Games</p>
                                  <p className="text-sm text-slate-300">
                                    {schedule.autoFindGames ? 'Yes' : 'No'}
                                  </p>
                                </div>
                              </div>
                            </div>

                            {schedule.nextExecution && (
                              <div className="mt-4 flex items-center gap-2 text-sm">
                                <Clock className="w-4 h-4 text-slate-500" />
                                <span className="text-slate-400">
                                  Next run: {new Date(schedule.nextExecution).toLocaleString()}
                                </span>
                              </div>
                            )}

                            {schedule.lastExecuted && (
                              <div className="mt-2 flex items-center gap-2 text-sm">
                                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                                <span className="text-slate-400">
                                  Last run: {new Date(schedule.lastExecuted).toLocaleString()}
                                  ({schedule.executionCount} times)
                                </span>
                              </div>
                            )}
                          </div>

                          <div className="flex items-center gap-2 ml-4">
                            <button
                              onClick={() => handleExecuteSchedule(schedule.id)}
                              className="p-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded transition-colors"
                              title="Run Now"
                            >
                              <Play className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleEditSchedule(schedule)}
                              className="p-2 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
                              title="Edit"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteSchedule(schedule.id)}
                              className="p-2 bg-red-600 hover:bg-red-700 text-white rounded transition-colors"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* Schedule Form */}
              {showScheduleForm && (
                <div className="bg-sportsBar-800/50 border border-slate-700 rounded-lg p-6">
                  <h2 className="text-2xl font-bold text-slate-100 mb-6">
                    {editingSchedule ? 'Edit Schedule' : 'New Schedule'}
                  </h2>

                  <div className="space-y-6">
                    {/* Basic Info */}
                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">
                          Schedule Name *
                        </label>
                        <input
                          type="text"
                          value={scheduleFormData.name}
                          onChange={(e) => setScheduleFormData({ ...scheduleFormData, name: e.target.value })}
                          className="w-full px-3 py-2 bg-sportsBar-800 border border-slate-600 rounded-md text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          placeholder="Morning TV Setup"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">
                          Description
                        </label>
                        <input
                          type="text"
                          value={scheduleFormData.description}
                          onChange={(e) => setScheduleFormData({ ...scheduleFormData, description: e.target.value })}
                          className="w-full px-3 py-2 bg-sportsBar-800 border border-slate-600 rounded-md text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          placeholder="Optional description"
                        />
                      </div>
                    </div>

                    {/* Schedule Type and Time */}
                    <div className="grid md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">
                          Schedule Type
                        </label>
                        <select
                          value={scheduleFormData.scheduleType}
                          onChange={(e) => setScheduleFormData({ ...scheduleFormData, scheduleType: e.target.value })}
                          className="w-full px-3 py-2 bg-sportsBar-800 border border-slate-600 rounded-md text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                          <option value="daily">Daily</option>
                          <option value="weekly">Weekly</option>
                          <option value="once">Once</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">
                          Execution Time
                        </label>
                        <input
                          type="time"
                          value={scheduleFormData.executionTime}
                          onChange={(e) => setScheduleFormData({ ...scheduleFormData, executionTime: e.target.value })}
                          className="w-full px-3 py-2 bg-sportsBar-800 border border-slate-600 rounded-md text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">
                          Enabled
                        </label>
                        <label className="flex items-center gap-2 px-4 py-2 bg-sportsBar-900 border border-slate-700 rounded-lg cursor-pointer">
                          <input
                            type="checkbox"
                            checked={scheduleFormData.enabled}
                            onChange={(e) => setScheduleFormData({ ...scheduleFormData, enabled: e.target.checked })}
                            className="w-4 h-4"
                          />
                          <span className="text-slate-300">Active</span>
                        </label>
                      </div>
                    </div>

                    {/* Days of Week (if weekly) */}
                    {scheduleFormData.scheduleType === 'weekly' && (
                      <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">
                          Days of Week
                        </label>
                        <div className="flex flex-wrap gap-2">
                          {['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map(day => (
                            <button
                              key={day}
                              onClick={() => toggleDayOfWeek(day)}
                              className={`px-4 py-2 rounded-lg capitalize transition-colors ${
                                scheduleFormData.daysOfWeek.includes(day)
                                  ? 'bg-blue-600 text-white'
                                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                              }`}
                            >
                              {day.substring(0, 3)}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* TV Power Control */}
                    <div className="border-t border-slate-700 pt-6">
                      <h3 className="text-lg font-semibold text-slate-100 mb-4 flex items-center gap-2">
                        <Tv className="w-5 h-5 text-blue-400" />
                        TV Power Control
                      </h3>
                      <div className="grid md:grid-cols-2 gap-4 mb-4">
                        <label className="flex items-center gap-2 px-4 py-3 bg-sportsBar-900 border border-slate-700 rounded-lg cursor-pointer">
                          <input
                            type="checkbox"
                            checked={scheduleFormData.powerOnTVs}
                            onChange={(e) => setScheduleFormData({ ...scheduleFormData, powerOnTVs: e.target.checked })}
                            className="w-4 h-4"
                          />
                          <span className="text-slate-300">Power On TVs</span>
                        </label>
                        <label className="flex items-center gap-2 px-4 py-3 bg-sportsBar-900 border border-slate-700 rounded-lg cursor-pointer">
                          <input
                            type="checkbox"
                            checked={scheduleFormData.powerOffTVs}
                            onChange={(e) => setScheduleFormData({ ...scheduleFormData, powerOffTVs: e.target.checked })}
                            className="w-4 h-4"
                          />
                          <span className="text-slate-300">Power Off TVs</span>
                        </label>
                      </div>

                      {/* Output Schedule Info */}
                      {outputScheduleInfo && (
                        <div className="mb-4 p-4 bg-sportsBar-900 rounded-lg border border-slate-700">
                          <h4 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
                            <Zap className="w-4 h-4 text-amber-400" />
                            Wolfpack Output Schedule Configuration
                          </h4>
                          <div className="grid md:grid-cols-3 gap-4 text-sm">
                            <div>
                              <p className="text-xs text-slate-500 mb-2">Configured for Daily Turn-On:</p>
                              {outputScheduleInfo.dailyTurnOnOutputs.length === 0 ? (
                                <p className="text-slate-400 italic">None configured</p>
                              ) : (
                                <div className="space-y-1">
                                  {outputScheduleInfo.dailyTurnOnOutputs.map(o => (
                                    <div key={o.id} className="text-emerald-400 text-xs">
                                      Ch {o.channelNumber}: {o.label}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                            <div>
                              <p className="text-xs text-slate-500 mb-2">Configured for Daily Turn-Off:</p>
                              {outputScheduleInfo.dailyTurnOffOutputs.length === 0 ? (
                                <p className="text-slate-400 italic">None configured</p>
                              ) : (
                                <div className="space-y-1">
                                  {outputScheduleInfo.dailyTurnOffOutputs.map(o => (
                                    <div key={o.id} className="text-blue-400 text-xs">
                                      Ch {o.channelNumber}: {o.label}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                            <div>
                              <p className="text-xs text-slate-500 mb-2">Available for Custom Schedules:</p>
                              {outputScheduleInfo.availableOutputs.length === 0 ? (
                                <p className="text-slate-400 italic">All configured</p>
                              ) : (
                                <p className="text-slate-400 text-xs">
                                  {outputScheduleInfo.availableOutputs.length} outputs available
                                </p>
                              )}
                            </div>
                          </div>
                          <p className="text-xs text-slate-500 mt-3 pt-3 border-t border-slate-800">
                            Tip: Configure daily turn-on/off in the Matrix Control page under the Outputs section
                          </p>
                        </div>
                      )}

                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        Select TV Outputs to Control
                        <span className="text-xs text-slate-500 ml-2">(Includes all outputs, not just daily-configured ones)</span>
                      </label>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 max-h-64 overflow-y-auto p-4 bg-sportsBar-900 rounded-lg">
                        {outputs.map(output => {
                          const isDailyTurnOn = outputScheduleInfo?.dailyTurnOnOutputs.some(o => o.id === output.id);
                          const isDailyTurnOff = outputScheduleInfo?.dailyTurnOffOutputs.some(o => o.id === output.id);

                          return (
                            <label
                              key={output.id}
                              className={`flex items-center gap-2 px-3 py-2 rounded border cursor-pointer transition-colors ${
                                scheduleFormData.selectedOutputs.includes(output.id)
                                  ? 'bg-blue-900/50 border-blue-600'
                                  : 'bg-sportsBar-800 border-slate-700 hover:border-slate-600'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={scheduleFormData.selectedOutputs.includes(output.id)}
                                onChange={() => toggleOutput(output.id)}
                                className="w-4 h-4"
                              />
                              <span className="text-sm text-slate-300 flex-1">
                                {output.channelNumber}: {output.label}
                              </span>
                              {isDailyTurnOn && <span className="text-xs" title="Daily Turn-On">☀️</span>}
                              {isDailyTurnOff && <span className="text-xs" title="Daily Turn-Off">🌙</span>}
                            </label>
                          );
                        })}
                      </div>
                    </div>

                    {/* Input Default Channels - Simplified Approach */}
                    <div className="border-t border-slate-700 pt-6">
                      <div className="mb-4">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-lg font-semibold text-slate-100">
                            Input Default Channels
                          </span>
                          <span className="text-xs bg-green-900/50 text-green-300 px-2 py-1 rounded">Simplified</span>
                        </div>
                        <p className="text-xs text-slate-400">
                          Set a default channel for each input source. All TVs using that input will automatically tune to this channel.
                        </p>
                      </div>

                      <div className="space-y-3 max-h-96 overflow-y-auto">
                        {inputs
                          .filter(input =>
                            input.deviceType === 'Cable Box' ||
                            input.deviceType === 'DirecTV' ||
                            input.inputType?.toLowerCase().includes('cable') ||
                            input.inputType?.toLowerCase().includes('directv') ||
                            input.inputType?.toLowerCase().includes('satellite')
                          )
                          .map(input => {
                            const currentChannel = scheduleFormData.inputDefaultChannels[input.id] || '';

                            return (
                              <div key={input.id} className="bg-sportsBar-900 border border-slate-700 rounded-lg p-4">
                                <p className="text-sm font-medium text-slate-300 mb-3">
                                  Input {input.channelNumber}: {input.label}
                                  <span className="text-xs text-slate-500 ml-2">({input.deviceType || input.inputType})</span>
                                </p>

                                <div className="grid grid-cols-2 gap-3">
                                  <div>
                                    <label className="block text-xs text-slate-500 mb-1">Channel Preset</label>
                                    <select
                                      value={channelPresets.find(p => p.channelNumber === currentChannel)?.id || ''}
                                      onChange={(e) => {
                                        if (e.target.value) {
                                          const preset = channelPresets.find(p => p.id === e.target.value);
                                          if (preset) {
                                            setInputDefaultChannel(input.id, preset.channelNumber);
                                          }
                                        } else {
                                          setInputDefaultChannel(input.id, '');
                                        }
                                      }}
                                      className="px-3 py-2 bg-sportsBar-800 border border-slate-700 rounded text-slate-100 text-sm w-full"
                                    >
                                      <option value="">Select Preset</option>
                                      {channelPresets
                                        .filter(p => {
                                          // Filter presets by input type - use deviceType from preset
                                          if (input.deviceType === 'Cable Box' || input.inputType?.toLowerCase().includes('cable')) {
                                            return p.deviceType === 'cable' || p.deviceType === 'both';
                                          }
                                          if (input.deviceType === 'DirecTV' || input.inputType?.toLowerCase().includes('directv') || input.inputType?.toLowerCase().includes('satellite')) {
                                            return p.deviceType === 'directv' || p.deviceType === 'satellite' || p.deviceType === 'both';
                                          }
                                          return true;
                                        })
                                        .map(preset => (
                                          <option key={preset.id} value={preset.id}>
                                            {preset.channelName || preset.name} ({preset.channelNumber})
                                          </option>
                                        ))}
                                    </select>
                                  </div>

                                  <div>
                                    <label className="block text-xs text-slate-500 mb-1">
                                      {(() => {
                                        const preset = channelPresets.find(p => p.channelNumber === currentChannel);
                                        return preset ? `Channel (${preset.channelName})` : 'Or Enter Channel';
                                      })()}
                                    </label>
                                    <input
                                      type="text"
                                      value={currentChannel}
                                      onChange={(e) => setInputDefaultChannel(input.id, e.target.value)}
                                      placeholder="e.g., 206"
                                      className="px-3 py-2 bg-sportsBar-800 border border-slate-700 rounded text-slate-100 text-sm w-full"
                                    />
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    </div>

                    {/* Default Channels - Per-Output Configuration */}
                    <div className="border-t border-slate-700 pt-6">
                      <label className="flex items-center gap-2 mb-4">
                        <input
                          type="checkbox"
                          checked={scheduleFormData.setDefaultChannels}
                          onChange={(e) => setScheduleFormData({ ...scheduleFormData, setDefaultChannels: e.target.checked })}
                          className="w-4 h-4"
                        />
                        <span className="text-lg font-semibold text-slate-100">
                          Set Default Channels (Advanced)
                        </span>
                      </label>

                      {scheduleFormData.setDefaultChannels && (
                        <div className="space-y-3 max-h-96 overflow-y-auto">
                          {scheduleFormData.selectedOutputs.map(outputId => {
                            const output = outputs.find(o => o.id === outputId);
                            if (!output) return null;

                            const mapping = scheduleFormData.defaultChannelMap[outputId] || {};

                            return (
                              <div key={outputId} className="bg-sportsBar-900 border border-slate-700 rounded-lg p-4">
                                <p className="text-sm font-medium text-slate-300 mb-2">
                                  {output.label} (Output {output.channelNumber})
                                </p>
                                <div className="space-y-3">
                                  <select
                                    value={mapping.inputId || ''}
                                    onChange={(e) => setDefaultChannel(outputId, e.target.value, mapping.channel || '')}
                                    className="px-3 py-2 bg-sportsBar-800 border border-slate-700 rounded text-slate-100 text-sm w-full"
                                  >
                                    <option value="">Select Input Source</option>
                                    {inputs.map(input => (
                                      <option key={input.id} value={input.id}>
                                        Input {input.channelNumber}: {input.label} ({input.inputType})
                                      </option>
                                    ))}
                                  </select>

                                  <div className="grid grid-cols-2 gap-3">
                                    <div>
                                      <label className="block text-xs text-slate-500 mb-1">Channel Preset</label>
                                      <select
                                        value={channelPresets.find(p => p.channelNumber === mapping.channel && p.channelName === mapping.presetName)?.id || ''}
                                        onChange={(e) => {
                                          if (e.target.value) {
                                            const preset = channelPresets.find(p => p.id === e.target.value);
                                            if (preset) {
                                              setDefaultChannel(outputId, mapping.inputId || '', preset.channelNumber, preset.channelName);
                                            }
                                          } else {
                                            setDefaultChannel(outputId, mapping.inputId || '', '');
                                          }
                                        }}
                                        className="px-3 py-2 bg-sportsBar-800 border border-slate-700 rounded text-slate-100 text-sm w-full"
                                      >
                                        <option value="">Select Preset</option>
                                        {channelPresets
                                          .filter(p => {
                                            const input = inputs.find(i => i.id === mapping.inputId);
                                            if (!input) return false;
                                            // Filter presets by input type - use deviceType from preset
                                            if (input.inputType?.toLowerCase().includes('cable') || input.deviceType === 'Cable Box') {
                                              return p.deviceType === 'cable' || p.deviceType === 'both';
                                            }
                                            if (input.inputType?.toLowerCase().includes('directv') || input.inputType?.toLowerCase().includes('satellite') || input.deviceType === 'DirecTV') {
                                              return p.deviceType === 'directv' || p.deviceType === 'satellite' || p.deviceType === 'both';
                                            }
                                            return true;
                                          })
                                          .map(preset => (
                                            <option key={preset.id} value={preset.id}>
                                              {preset.channelName} ({preset.channelNumber})
                                            </option>
                                          ))}
                                      </select>
                                    </div>

                                    <div>
                                      <label className="block text-xs text-slate-500 mb-1">
                                        {mapping.presetName ? `Channel (${mapping.presetName})` : 'Or Enter Channel'}
                                      </label>
                                      <input
                                        type="text"
                                        value={mapping.channel || ''}
                                        onChange={(e) => setDefaultChannel(outputId, mapping.inputId || '', e.target.value)}
                                        placeholder="e.g., 206"
                                        className="px-3 py-2 bg-sportsBar-800 border border-slate-700 rounded text-slate-100 text-sm w-full"
                                      />
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Smart Game Finder */}
                    <div className="border-t border-slate-700 pt-6">
                      <label className="flex items-center gap-2 mb-4">
                        <input
                          type="checkbox"
                          checked={scheduleFormData.autoFindGames}
                          onChange={(e) => setScheduleFormData({ ...scheduleFormData, autoFindGames: e.target.checked })}
                          className="w-4 h-4"
                        />
                        <span className="text-lg font-semibold text-slate-100 flex items-center gap-2">
                          <Target className="w-5 h-5 text-purple-400" />
                          Smart Game Finder
                        </span>
                      </label>

                      {scheduleFormData.autoFindGames && (
                        <div className="space-y-4">
                          <label className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={scheduleFormData.monitorHomeTeams}
                              onChange={(e) => setScheduleFormData({ ...scheduleFormData, monitorHomeTeams: e.target.checked })}
                              className="w-4 h-4"
                            />
                            <span className="text-slate-300">Monitor Home Teams</span>
                          </label>

                          <label className="flex items-center gap-2 pl-6">
                            <input
                              type="checkbox"
                              checked={scheduleFormData.fillWithSports}
                              onChange={(e) => setScheduleFormData({ ...scheduleFormData, fillWithSports: e.target.checked })}
                              className="w-4 h-4"
                            />
                            <div className="flex flex-col">
                              <span className="text-slate-300">Fill TVs with ANY live sports</span>
                              <span className="text-xs text-slate-500">Show other games when home teams aren't playing (defaults to ESPN if disabled)</span>
                            </div>
                          </label>

                          {scheduleFormData.monitorHomeTeams && (
                            <div>
                              <label className="block text-sm font-medium text-slate-300 mb-2">
                                Select Teams to Monitor
                              </label>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-64 overflow-y-auto p-4 bg-sportsBar-900 rounded-lg">
                                {homeTeams.map(team => (
                                  <label
                                    key={team.id}
                                    className={`flex items-center gap-2 px-3 py-2 rounded border cursor-pointer transition-colors ${
                                      scheduleFormData.homeTeamIds.includes(team.id!)
                                        ? 'bg-purple-900/50 border-purple-600'
                                        : 'bg-sportsBar-800 border-slate-700 hover:border-slate-600'
                                    }`}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={scheduleFormData.homeTeamIds.includes(team.id!)}
                                      onChange={() => toggleHomeTeamSchedule(team.id!)}
                                      className="w-4 h-4"
                                    />
                                    <div>
                                      <span className="text-sm text-slate-300 block">{team.teamName}</span>
                                      <span className="text-xs text-slate-500">{team.sport} • {team.league}</span>
                                    </div>
                                  </label>
                                ))}
                              </div>
                            </div>
                          )}

                          <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">
                              Provider Priority (games found in order)
                            </label>
                            <div className="flex gap-2">
                              {['cable', 'streaming', 'satellite'].map((provider, index) => (
                                <div key={provider} className="flex items-center gap-2 px-3 py-2 bg-sportsBar-900 border border-slate-700 rounded">
                                  <span className="text-xs text-slate-500">#{index + 1}</span>
                                  <span className="text-sm text-slate-300 capitalize">{provider}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Audio Settings */}
                    <div className="border-t border-slate-700 pt-6">
                      <label className="flex items-center gap-2 mb-4">
                        <input
                          type="checkbox"
                          checked={scheduleFormData.audioSettings?.enabled || false}
                          onChange={(e) => setScheduleFormData({
                            ...scheduleFormData,
                            audioSettings: {
                              ...(scheduleFormData.audioSettings || { enabled: false, zones: [] }),
                              enabled: e.target.checked
                            }
                          })}
                          className="w-4 h-4"
                        />
                        <span className="text-lg font-semibold text-slate-100 flex items-center gap-2">
                          🔊 Audio Zone Control
                        </span>
                      </label>

                      {scheduleFormData.audioSettings?.enabled && (
                        <div className="space-y-4">
                          <p className="text-sm text-slate-400">
                            Set audio volume and sources for each zone when this schedule runs
                          </p>
                          <button
                            type="button"
                            onClick={async () => {
                              // Load audio zones if not already loaded
                              let zones = audioZones;
                              if (zones.length === 0) {
                                zones = await loadAudioZones();
                              }

                              // Add a zone selector
                              if (zones.length > 0) {
                                // Find first zone not already added
                                const usedZoneIds = scheduleFormData.audioSettings?.zones?.map(z => z.zoneId) || [];
                                const availableZone = zones.find(z => !usedZoneIds.includes(z.id));

                                if (availableZone) {
                                  setScheduleFormData({
                                    ...scheduleFormData,
                                    audioSettings: {
                                      enabled: scheduleFormData.audioSettings?.enabled || true,
                                      zones: [...(scheduleFormData.audioSettings?.zones || []), {
                                        zoneId: availableZone.id,
                                        zoneName: availableZone.name,
                                        volume: 50,
                                        muted: false,
                                        source: availableZone.currentSource || '1'
                                      }]
                                    }
                                  });
                                } else {
                                  alert('All available zones have been added');
                                }
                              } else {
                                alert('No audio zones found. Please configure Atlas audio processor first.');
                              }
                            }}
                            disabled={scheduleFormData.audioSettings?.zones?.length >= audioZones.length && audioZones.length > 0}
                            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg text-sm transition-colors"
                          >
                            <Plus className="w-4 h-4 inline mr-1" />
                            Add Audio Zone
                          </button>

                          {(scheduleFormData.audioSettings?.zones || []).map((zone, index) => (
                            <div key={index} className="bg-sportsBar-900 border border-slate-700 rounded-lg p-4">
                              <div className="flex items-center justify-between mb-3">
                                <span className="font-medium text-slate-300">Zone {zone.zoneName || zone.zoneId}</span>
                                <button
                                  onClick={() => {
                                    setScheduleFormData({
                                      ...scheduleFormData,
                                      audioSettings: {
                                        ...(scheduleFormData.audioSettings || { enabled: false, zones: [] }),
                                        zones: (scheduleFormData.audioSettings?.zones || []).filter((_, i) => i !== index)
                                      }
                                    });
                                  }}
                                  className="text-red-400 hover:text-red-300 transition-colors"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>

                              <div className="grid md:grid-cols-2 gap-4">
                                {/* Volume Control */}
                                <div>
                                  <label className="block text-sm text-slate-400 mb-2">
                                    Volume: {zone.volume}%
                                  </label>
                                  <input
                                    type="range"
                                    min="0"
                                    max="100"
                                    value={zone.volume}
                                    onChange={(e) => {
                                      const newZones = [...(scheduleFormData.audioSettings?.zones || [])];
                                      newZones[index].volume = parseInt(e.target.value);
                                      setScheduleFormData({
                                        ...scheduleFormData,
                                        audioSettings: {
                                          ...(scheduleFormData.audioSettings || { enabled: false, zones: [] }),
                                          zones: newZones
                                        }
                                      });
                                    }}
                                    className="w-full"
                                  />
                                </div>

                                {/* Source Selection */}
                                <div>
                                  <label className="block text-sm text-slate-400 mb-2">
                                    Audio Source: {audioSourceNames.get(parseInt(zone.source)) || `Source ${parseInt(zone.source) + 1}`}
                                  </label>
                                  <select
                                    value={zone.source}
                                    onChange={(e) => {
                                      const newZones = [...(scheduleFormData.audioSettings?.zones || [])];
                                      newZones[index].source = e.target.value;
                                      setScheduleFormData({
                                        ...scheduleFormData,
                                        audioSettings: {
                                          ...(scheduleFormData.audioSettings || { enabled: false, zones: [] }),
                                          zones: newZones
                                        }
                                      });
                                    }}
                                    className="w-full px-3 py-2 bg-sportsBar-800 border border-slate-700 rounded text-slate-100 text-sm"
                                  >
                                    {Array.from({ length: 14 }, (_, i) => {
                                      const sourceIndex = i;
                                      const sourceName = audioSourceNames.get(sourceIndex) || `Source ${sourceIndex + 1}`;
                                      return (
                                        <option key={sourceIndex} value={sourceIndex.toString()}>
                                          {sourceName}
                                        </option>
                                      );
                                    })}
                                  </select>
                                </div>
                              </div>

                              {/* Mute Toggle */}
                              <label className={`flex items-center gap-2 mt-3 px-3 py-2 rounded transition-colors ${
                                zone.muted ? 'bg-slate-800/50 border border-slate-600' : ''
                              }`}>
                                <input
                                  type="checkbox"
                                  checked={zone.muted}
                                  onChange={(e) => {
                                    const newZones = [...(scheduleFormData.audioSettings?.zones || [])];
                                    newZones[index].muted = e.target.checked;
                                    setScheduleFormData({
                                      ...scheduleFormData,
                                      audioSettings: {
                                        ...(scheduleFormData.audioSettings || { enabled: false, zones: [] }),
                                        zones: newZones
                                      }
                                    });
                                  }}
                                  className="w-4 h-4"
                                />
                                <span className={`text-sm ${
                                  zone.muted ? 'text-slate-300 font-medium' : 'text-slate-400'
                                }`}>
                                  {zone.muted ? '🔇 Unmute this zone' : '🔊 Mute this zone'}
                                </span>
                              </label>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-3 pt-6 border-t border-slate-700">
                      <button
                        onClick={handleSaveSchedule}
                        disabled={!scheduleFormData.name || scheduleFormData.selectedOutputs.length === 0}
                        className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-lg transition-colors"
                      >
                        {editingSchedule ? 'Update Schedule' : 'Create Schedule'}
                      </button>
                      <button
                        onClick={() => setShowScheduleForm(false)}
                        className="px-6 py-3 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              )}
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
