'use client'

import { useState, useEffect } from 'react'
import {
  Save,
  Plus,
  Trash2,
  Tv,
  Check,
  X,
  Edit,
  Users,
  Target,
  AlertCircle,
  CheckCircle2,
  Clock,
  Play,
  Calendar,
  Zap
} from 'lucide-react'
import { logger } from '@sports-bar/logger'

interface HomeTeam {
  id?: string
  teamName: string
  league: string
  sport: string
  [key: string]: any
}

interface MatrixInput {
  id: string
  channelNumber: number
  label: string
  inputType: string
  isActive: boolean
  deviceType?: 'cable' | 'satellite' | 'streaming' | 'gaming' | 'Cable Box' | 'CableBox' | 'DirecTV' | 'Fire TV' | 'Other'
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

export default function LegacySchedulingManager() {
  const [isSaving, setIsSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

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
  const [homeTeams, setHomeTeams] = useState<HomeTeam[]>([])

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

  useEffect(() => {
    loadSchedulerData()
    loadTeams()
  }, [])

  const loadTeams = async () => {
    try {
      const response = await fetch('/api/home-teams')
      const result = await response.json()
      if (result.success) {
        setHomeTeams(result.teams || [])
      }
    } catch (error) {
      logger.error('[LegacySchedulingManager] Error loading teams:', error)
    }
  }

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
      logger.error('[LegacySchedulingManager] Error loading scheduler data:', error);
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
      logger.error('[LegacySchedulingManager] Error loading audio zones:', error);
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
      logger.error('[LegacySchedulingManager] Error saving schedule:', error);
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
      logger.error('[LegacySchedulingManager] Error deleting schedule:', error);
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
      logger.error('[LegacySchedulingManager] Error executing schedule:', error);
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

  return (
    <div className="space-y-6">
      {/* Save Message */}
      {saveMessage && (
        <div className={`p-4 rounded-lg border ${
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
                      input.deviceType === 'Cable Box' || input.deviceType === 'CableBox' ||
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
                                    if (input.deviceType === 'Cable Box' || input.deviceType === 'CableBox' || input.inputType?.toLowerCase().includes('cable')) {
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
                                      if (input.inputType?.toLowerCase().includes('cable') || input.deviceType === 'Cable Box' || input.deviceType === 'CableBox') {
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
    </div>
  )
}
