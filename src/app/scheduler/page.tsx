
'use client';

import { useState, useEffect } from 'react';
import { Plus, Play, Edit, Trash2, Clock, Tv, Calendar, AlertCircle, CheckCircle2, Target, Zap } from 'lucide-react';

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

interface MatrixInput {
  id: string;
  channelNumber: number;
  label: string;
  deviceType: string;
}

interface HomeTeam {
  id: string;
  teamName: string;
  league: string;
  sport: string;
}

interface OutputScheduleInfo {
  dailyTurnOnOutputs: MatrixOutput[];
  dailyTurnOffOutputs: MatrixOutput[];
  availableOutputs: MatrixOutput[];
}

export default function SchedulerPage() {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [outputs, setOutputs] = useState<MatrixOutput[]>([]);
  const [inputs, setInputs] = useState<MatrixInput[]>([]);
  const [homeTeams, setHomeTeams] = useState<HomeTeam[]>([]);
  const [outputScheduleInfo, setOutputScheduleInfo] = useState<OutputScheduleInfo | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null);
  const [loading, setLoading] = useState(true);

  // Form state
  const [formData, setFormData] = useState({
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
    autoFindGames: false,
    monitorHomeTeams: false,
    homeTeamIds: [] as string[],
    preferredProviders: ['cable', 'streaming', 'satellite'],
    executionOrder: 'outputs_first',
    delayBetweenCommands: 2000
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [schedulesRes, outputsRes, inputsRes, teamsRes, scheduleInfoRes] = await Promise.all([
        fetch('/api/schedules'),
        fetch('/api/matrix/outputs'),
        fetch('/api/matrix/inputs'),
        fetch('/api/home-teams'),
        fetch('/api/matrix/outputs-schedule')
      ]);

      const [schedulesData, outputsData, inputsData, teamsData, scheduleInfoData] = await Promise.all([
        schedulesRes.json(),
        outputsRes.json(),
        inputsRes.json(),
        teamsRes.json(),
        scheduleInfoRes.json()
      ]);

      setSchedules(schedulesData.schedules || []);
      setOutputs(outputsData.outputs || []);
      setInputs(inputsData.inputs || []);
      setHomeTeams(teamsData.teams || []);
      
      if (scheduleInfoData.success) {
        setOutputScheduleInfo({
          dailyTurnOnOutputs: scheduleInfoData.dailyTurnOnOutputs || [],
          dailyTurnOffOutputs: scheduleInfoData.dailyTurnOffOutputs || [],
          availableOutputs: scheduleInfoData.availableOutputs || []
        });
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSchedule = () => {
    setEditingSchedule(null);
    setFormData({
      name: '',
      description: '',
      enabled: true,
      scheduleType: 'daily',
      executionTime: '09:00',
      daysOfWeek: [],
      powerOnTVs: true,
      powerOffTVs: false,
      selectedOutputs: [],
      setDefaultChannels: false,
      defaultChannelMap: {},
      autoFindGames: false,
      monitorHomeTeams: false,
      homeTeamIds: [],
      preferredProviders: ['cable', 'streaming', 'satellite'],
      executionOrder: 'outputs_first',
      delayBetweenCommands: 2000
    });
    setShowForm(true);
  };

  const handleEditSchedule = (schedule: Schedule) => {
    setEditingSchedule(schedule);
    setFormData({
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
      autoFindGames: schedule.autoFindGames,
      monitorHomeTeams: schedule.monitorHomeTeams,
      homeTeamIds: schedule.homeTeamIds ? JSON.parse(schedule.homeTeamIds) : [],
      preferredProviders: schedule.preferredProviders ? JSON.parse(schedule.preferredProviders) : ['cable', 'streaming', 'satellite'],
      executionOrder: schedule.executionOrder || 'outputs_first',
      delayBetweenCommands: schedule.delayBetweenCommands || 2000
    });
    setShowForm(true);
  };

  const handleSaveSchedule = async () => {
    try {
      const url = editingSchedule 
        ? `/api/schedules/${editingSchedule.id}`
        : '/api/schedules';
      
      const method = editingSchedule ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        setShowForm(false);
        loadData();
      }
    } catch (error) {
      console.error('Error saving schedule:', error);
    }
  };

  const handleDeleteSchedule = async (id: string) => {
    if (!confirm('Are you sure you want to delete this schedule?')) return;

    try {
      const response = await fetch(`/api/schedules/${id}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        loadData();
      }
    } catch (error) {
      console.error('Error deleting schedule:', error);
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
      
      loadData();
    } catch (error) {
      console.error('Error executing schedule:', error);
      alert('Failed to execute schedule');
    }
  };

  const toggleOutput = (outputId: string) => {
    setFormData(prev => ({
      ...prev,
      selectedOutputs: prev.selectedOutputs.includes(outputId)
        ? prev.selectedOutputs.filter(id => id !== outputId)
        : [...prev.selectedOutputs, outputId]
    }));
  };

  const toggleHomeTeam = (teamId: string) => {
    setFormData(prev => ({
      ...prev,
      homeTeamIds: prev.homeTeamIds.includes(teamId)
        ? prev.homeTeamIds.filter(id => id !== teamId)
        : [...prev.homeTeamIds, teamId]
    }));
  };

  const toggleDayOfWeek = (day: string) => {
    setFormData(prev => ({
      ...prev,
      daysOfWeek: prev.daysOfWeek.includes(day)
        ? prev.daysOfWeek.filter(d => d !== day)
        : [...prev.daysOfWeek, day]
    }));
  };

  const setDefaultChannel = (outputId: string, inputId: string, channel: string) => {
    setFormData(prev => ({
      ...prev,
      defaultChannelMap: {
        ...prev.defaultChannelMap,
        [outputId]: { inputId, channel }
      }
    }));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 p-6 flex items-center justify-center">
        <div className="text-slate-400">Loading scheduler...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-100 flex items-center gap-3">
              <Calendar className="w-8 h-8 text-blue-400" />
              TV Schedule Manager
            </h1>
            <p className="text-slate-400 mt-2">
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
        {!showForm && (
          <div className="grid gap-4">
            {schedules.length === 0 ? (
              <div className="bg-slate-800 border border-slate-700 rounded-lg p-8 text-center">
                <Calendar className="w-16 h-16 text-slate-600 mx-auto mb-4" />
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
                  className={`bg-slate-800 border rounded-lg p-6 ${
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
        {showForm && (
          <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
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
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500"
                    placeholder="Morning TV Setup"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Description
                  </label>
                  <input
                    type="text"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500"
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
                    value={formData.scheduleType}
                    onChange={(e) => setFormData({ ...formData, scheduleType: e.target.value })}
                    className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500"
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
                    value={formData.executionTime}
                    onChange={(e) => setFormData({ ...formData, executionTime: e.target.value })}
                    className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Enabled
                  </label>
                  <label className="flex items-center gap-2 px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.enabled}
                      onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
                      className="w-4 h-4"
                    />
                    <span className="text-slate-300">Active</span>
                  </label>
                </div>
              </div>

              {/* Days of Week (if weekly) */}
              {formData.scheduleType === 'weekly' && (
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
                          formData.daysOfWeek.includes(day)
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
                  <label className="flex items-center gap-2 px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.powerOnTVs}
                      onChange={(e) => setFormData({ ...formData, powerOnTVs: e.target.checked })}
                      className="w-4 h-4"
                    />
                    <span className="text-slate-300">Power On TVs</span>
                  </label>
                  <label className="flex items-center gap-2 px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.powerOffTVs}
                      onChange={(e) => setFormData({ ...formData, powerOffTVs: e.target.checked })}
                      className="w-4 h-4"
                    />
                    <span className="text-slate-300">Power Off TVs</span>
                  </label>
                </div>

                {/* Output Schedule Info */}
                {outputScheduleInfo && (
                  <div className="mb-4 p-4 bg-slate-950 rounded-lg border border-slate-700">
                    <h4 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
                      <Zap className="w-4 h-4 text-amber-400" />
                      Wolfpack Output Schedule Configuration
                    </h4>
                    <div className="grid md:grid-cols-3 gap-4 text-sm">
                      <div>
                        <p className="text-xs text-slate-500 mb-2">☀️ Configured for Daily Turn-On:</p>
                        {outputScheduleInfo.dailyTurnOnOutputs.length === 0 ? (
                          <p className="text-slate-600 italic">None configured</p>
                        ) : (
                          <div className="space-y-1">
                            {outputScheduleInfo.dailyTurnOnOutputs.map(o => (
                              <div key={o.id} className="text-emerald-400 text-xs">
                                • Ch {o.channelNumber}: {o.label}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 mb-2">🌙 Configured for Daily Turn-Off:</p>
                        {outputScheduleInfo.dailyTurnOffOutputs.length === 0 ? (
                          <p className="text-slate-600 italic">None configured</p>
                        ) : (
                          <div className="space-y-1">
                            {outputScheduleInfo.dailyTurnOffOutputs.map(o => (
                              <div key={o.id} className="text-blue-400 text-xs">
                                • Ch {o.channelNumber}: {o.label}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 mb-2">📺 Available for Custom Schedules:</p>
                        {outputScheduleInfo.availableOutputs.length === 0 ? (
                          <p className="text-slate-600 italic">All configured</p>
                        ) : (
                          <p className="text-slate-400 text-xs">
                            {outputScheduleInfo.availableOutputs.length} outputs available
                          </p>
                        )}
                      </div>
                    </div>
                    <p className="text-xs text-slate-500 mt-3 pt-3 border-t border-slate-800">
                      💡 Tip: Configure daily turn-on/off in the <strong>Matrix Control</strong> page under the Outputs section
                    </p>
                  </div>
                )}

                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Select TV Outputs to Control
                  <span className="text-xs text-slate-500 ml-2">(Includes all outputs, not just daily-configured ones)</span>
                </label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 max-h-64 overflow-y-auto p-4 bg-slate-900 rounded-lg">
                  {outputs.map(output => {
                    const isDailyTurnOn = outputScheduleInfo?.dailyTurnOnOutputs.some(o => o.id === output.id);
                    const isDailyTurnOff = outputScheduleInfo?.dailyTurnOffOutputs.some(o => o.id === output.id);
                    
                    return (
                      <label
                        key={output.id}
                        className={`flex items-center gap-2 px-3 py-2 rounded border cursor-pointer transition-colors ${
                          formData.selectedOutputs.includes(output.id)
                            ? 'bg-blue-900/50 border-blue-600'
                            : 'bg-slate-800 border-slate-700 hover:border-slate-600'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={formData.selectedOutputs.includes(output.id)}
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

              {/* Default Channels */}
              <div className="border-t border-slate-700 pt-6">
                <label className="flex items-center gap-2 mb-4">
                  <input
                    type="checkbox"
                    checked={formData.setDefaultChannels}
                    onChange={(e) => setFormData({ ...formData, setDefaultChannels: e.target.checked })}
                    className="w-4 h-4"
                  />
                  <span className="text-lg font-semibold text-slate-100">
                    Set Default Channels
                  </span>
                </label>

                {formData.setDefaultChannels && (
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {formData.selectedOutputs.map(outputId => {
                      const output = outputs.find(o => o.id === outputId);
                      if (!output) return null;

                      const mapping = formData.defaultChannelMap[outputId] || {};

                      return (
                        <div key={outputId} className="bg-slate-900 border border-slate-700 rounded-lg p-4">
                          <p className="text-sm font-medium text-slate-300 mb-2">
                            {output.label} (Output {output.channelNumber})
                          </p>
                          <div className="grid md:grid-cols-2 gap-3">
                            <select
                              value={mapping.inputId || ''}
                              onChange={(e) => setDefaultChannel(outputId, e.target.value, mapping.channel || '')}
                              className="px-3 py-2 bg-slate-800 border border-slate-700 rounded text-slate-100 text-sm"
                            >
                              <option value="">Select Input Source</option>
                              {inputs.map(input => (
                                <option key={input.id} value={input.id}>
                                  Input {input.channelNumber}: {input.label} ({input.deviceType})
                                </option>
                              ))}
                            </select>
                            <input
                              type="text"
                              value={mapping.channel || ''}
                              onChange={(e) => setDefaultChannel(outputId, mapping.inputId || '', e.target.value)}
                              placeholder="Channel (e.g., 206, optional)"
                              className="px-3 py-2 bg-slate-800 border border-slate-700 rounded text-slate-100 text-sm"
                            />
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
                    checked={formData.autoFindGames}
                    onChange={(e) => setFormData({ ...formData, autoFindGames: e.target.checked })}
                    className="w-4 h-4"
                  />
                  <span className="text-lg font-semibold text-slate-100 flex items-center gap-2">
                    <Target className="w-5 h-5 text-purple-400" />
                    Smart Game Finder
                  </span>
                </label>

                {formData.autoFindGames && (
                  <div className="space-y-4">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={formData.monitorHomeTeams}
                        onChange={(e) => setFormData({ ...formData, monitorHomeTeams: e.target.checked })}
                        className="w-4 h-4"
                      />
                      <span className="text-slate-300">Monitor Home Teams</span>
                    </label>

                    {formData.monitorHomeTeams && (
                      <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">
                          Select Teams to Monitor
                        </label>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-64 overflow-y-auto p-4 bg-slate-900 rounded-lg">
                          {homeTeams.map(team => (
                            <label
                              key={team.id}
                              className={`flex items-center gap-2 px-3 py-2 rounded border cursor-pointer transition-colors ${
                                formData.homeTeamIds.includes(team.id)
                                  ? 'bg-purple-900/50 border-purple-600'
                                  : 'bg-slate-800 border-slate-700 hover:border-slate-600'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={formData.homeTeamIds.includes(team.id)}
                                onChange={() => toggleHomeTeam(team.id)}
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
                          <div key={provider} className="flex items-center gap-2 px-3 py-2 bg-slate-900 border border-slate-700 rounded">
                            <span className="text-xs text-slate-500">#{index + 1}</span>
                            <span className="text-sm text-slate-300 capitalize">{provider}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-3 pt-6 border-t border-slate-700">
                <button
                  onClick={handleSaveSchedule}
                  disabled={!formData.name || formData.selectedOutputs.length === 0}
                  className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-lg transition-colors"
                >
                  {editingSchedule ? 'Update Schedule' : 'Create Schedule'}
                </button>
                <button
                  onClick={() => setShowForm(false)}
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
  );
}
