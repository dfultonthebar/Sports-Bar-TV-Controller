'use client'

import { useState, useEffect } from 'react'
import {
  Save,
  Plus,
  Trash2,
  Users,
  Trophy,
  Check,
  X,
  Edit,
  Star,
  TrendingUp,
  Target,
  AlertCircle,
  Tv
} from 'lucide-react'
import { logger } from '@sports-bar/logger'

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

export default function HomeTeamsManager() {
  const [isSaving, setIsSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

  const [homeTeams, setHomeTeams] = useState<HomeTeam[]>([])

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
    loadTeams()
    loadESPNLeagues()
  }, [])

  const loadTeams = async () => {
    try {
      const response = await fetch('/api/home-teams')
      const result = await response.json()

      if (result.success) {
        setHomeTeams(result.teams || [])
      }
    } catch (error) {
      logger.error('[HomeTeamsManager] Error loading teams:', error)
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
      logger.error('[HomeTeamsManager] Failed to load ESPN leagues:', error)
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
      logger.error('[HomeTeamsManager] Failed to load teams:', error)
      setEspnTeams([])
      setEspnDivisions([])
    } finally {
      setLoadingTeams(false)
      setLoadingDivisions(false)
    }
  }

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
      logger.error('[HomeTeamsManager] Error saving team:', error)
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
      logger.error('[HomeTeamsManager] Error deleting team:', error)
      setSaveMessage({ type: 'error', text: 'Failed to delete team' })
    } finally {
      setIsSaving(false)
    }
  }

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
    </div>
  )
}
