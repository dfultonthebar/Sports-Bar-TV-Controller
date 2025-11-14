'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import SportsBarHeader from '@/components/SportsBarHeader';
import SportsBarLayout from '@/components/SportsBarLayout';
import {
  Users,
  Plus,
  Edit,
  Trash2,
  Save,
  X,
  Star,
  TrendingUp,
  Tv,
  MapPin,
  Target,
  AlertCircle,
  CheckCircle2,
  ArrowLeft
} from 'lucide-react';
import Link from 'next/link';
import { logger } from '@/lib/logger';

interface HomeTeam {
  id: string;
  teamName: string;
  league: string;
  category: string;
  sport: string;
  location?: string | null;
  conference?: string | null;
  isPrimary: boolean;
  isActive: boolean;
  priority: number;

  // Scheduler fields
  minTVsWhenActive?: number | null;
  autoPromotePlayoffs?: boolean | null;
  preferredZones?: string[] | null;
  rivalTeams?: string[] | null;
  schedulerNotes?: string | null;

  // Fuzzy matching fields
  aliases?: string[] | null;
  cityAbbreviations?: string[] | null;
  teamAbbreviations?: string[] | null;
  commonVariations?: string[] | null;
  matchingStrategy?: string | null;
  minMatchConfidence?: number | null;

  // Branding
  logoUrl?: string | null;
  primaryColor?: string | null;
  secondaryColor?: string | null;

  createdAt: string;
  updatedAt: string;
}

const SPORTS = ['Football', 'Basketball', 'Baseball', 'Hockey', 'Soccer', 'Racing', 'Golf', 'Other'];
const CATEGORIES = ['professional', 'college', 'international', 'other'];
const MATCHING_STRATEGIES = ['exact', 'fuzzy', 'alias', 'learned'];

export default function TeamManagementPage() {
  const router = useRouter();
  const [teams, setTeams] = useState<HomeTeam[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingTeam, setEditingTeam] = useState<HomeTeam | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Form state
  const [formData, setFormData] = useState<Partial<HomeTeam>>({
    teamName: '',
    league: '',
    category: 'professional',
    sport: 'Football',
    location: '',
    conference: '',
    isPrimary: false,
    isActive: true,
    priority: 50,
    minTVsWhenActive: 1,
    autoPromotePlayoffs: true,
    preferredZones: [],
    rivalTeams: [],
    schedulerNotes: '',
    aliases: [],
    cityAbbreviations: [],
    teamAbbreviations: [],
    commonVariations: [],
    matchingStrategy: 'fuzzy',
    minMatchConfidence: 0.7,
    logoUrl: '',
    primaryColor: '',
    secondaryColor: '',
  });

  useEffect(() => {
    loadTeams();
  }, []);

  const loadTeams = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/home-teams');
      const data = await response.json();

      if (data.success) {
        setTeams(data.teams || []);
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to load teams' });
      }
    } catch (error: any) {
      logger.error('Failed to load teams:', error);
      setMessage({ type: 'error', text: 'Failed to load teams' });
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingTeam(null);
    setFormData({
      teamName: '',
      league: '',
      category: 'professional',
      sport: 'Football',
      location: '',
      conference: '',
      isPrimary: false,
      isActive: true,
      priority: 50,
      minTVsWhenActive: 1,
      autoPromotePlayoffs: true,
      preferredZones: [],
      rivalTeams: [],
      schedulerNotes: '',
      aliases: [],
      cityAbbreviations: [],
      teamAbbreviations: [],
      commonVariations: [],
      matchingStrategy: 'fuzzy',
      minMatchConfidence: 0.7,
      logoUrl: '',
      primaryColor: '',
      secondaryColor: '',
    });
    setShowForm(true);
  };

  const handleEdit = (team: HomeTeam) => {
    setEditingTeam(team);
    setFormData(team);
    setShowForm(true);
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setMessage(null);

      const url = editingTeam
        ? `/api/home-teams/${editingTeam.id}`
        : '/api/home-teams';

      const method = editingTeam ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (data.success) {
        setMessage({
          type: 'success',
          text: editingTeam ? 'Team updated successfully' : 'Team created successfully'
        });
        setShowForm(false);
        setEditingTeam(null);
        await loadTeams();
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to save team' });
      }
    } catch (error: any) {
      logger.error('Failed to save team:', error);
      setMessage({ type: 'error', text: 'Failed to save team' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (team: HomeTeam) => {
    if (!confirm(`Are you sure you want to delete ${team.teamName}?`)) {
      return;
    }

    try {
      setSaving(true);
      setMessage(null);

      const response = await fetch(`/api/home-teams/${team.id}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (data.success) {
        setMessage({ type: 'success', text: 'Team deleted successfully' });
        await loadTeams();
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to delete team' });
      }
    } catch (error: any) {
      logger.error('Failed to delete team:', error);
      setMessage({ type: 'error', text: 'Failed to delete team' });
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingTeam(null);
    setFormData({});
  };

  const updateFormField = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const addArrayItem = (field: keyof HomeTeam, value: string) => {
    if (!value.trim()) return;
    const currentArray = (formData[field] as string[]) || [];
    updateFormField(field, [...currentArray, value.trim()]);
  };

  const removeArrayItem = (field: keyof HomeTeam, index: number) => {
    const currentArray = (formData[field] as string[]) || [];
    updateFormField(field, currentArray.filter((_, i) => i !== index));
  };

  if (loading) {
    return (
      <SportsBarLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
            <p className="text-slate-300">Loading teams...</p>
          </div>
        </div>
      </SportsBarLayout>
    );
  }

  return (
    <SportsBarLayout>
      <SportsBarHeader
        title="Team Management"
        subtitle="Manage home teams for scheduling and game tracking"
        icon={<Users className="w-6 h-6 text-white" />}
        actions={
          <div className="flex items-center space-x-3">
            <Link href="/scheduler" className="btn-secondary">
              <ArrowLeft className="w-4 h-4 mr-2" />
              <span>Back to Scheduler</span>
            </Link>
            {!showForm && (
              <button onClick={handleCreate} className="btn-primary">
                <Plus className="w-4 h-4 mr-2" />
                <span>Add Team</span>
              </button>
            )}
          </div>
        }
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Message */}
        {message && (
          <div
            className={`mb-6 p-4 rounded-lg border ${
              message.type === 'success'
                ? 'bg-green-900/30 border-green-500/50 text-green-200'
                : 'bg-red-900/30 border-red-500/50 text-red-200'
            }`}
          >
            <div className="flex items-center space-x-2">
              {message.type === 'success' ? (
                <CheckCircle2 className="w-5 h-5" />
              ) : (
                <AlertCircle className="w-5 h-5" />
              )}
              <span>{message.text}</span>
            </div>
          </div>
        )}

        {/* Form */}
        {showForm && (
          <div className="card mb-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-white">
                {editingTeam ? 'Edit Team' : 'Add New Team'}
              </h2>
              <button onClick={handleCancel} className="btn-secondary">
                <X className="w-4 h-4 mr-2" />
                <span>Cancel</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Basic Info */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Team Name *
                </label>
                <input
                  type="text"
                  value={formData.teamName || ''}
                  onChange={(e) => updateFormField('teamName', e.target.value)}
                  className="input-field"
                  placeholder="Green Bay Packers"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  League *
                </label>
                <input
                  type="text"
                  value={formData.league || ''}
                  onChange={(e) => updateFormField('league', e.target.value)}
                  className="input-field"
                  placeholder="NFL"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Sport *
                </label>
                <select
                  value={formData.sport || 'Football'}
                  onChange={(e) => updateFormField('sport', e.target.value)}
                  className="input-field"
                >
                  {SPORTS.map(sport => (
                    <option key={sport} value={sport}>{sport}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Category *
                </label>
                <select
                  value={formData.category || 'professional'}
                  onChange={(e) => updateFormField('category', e.target.value)}
                  className="input-field"
                >
                  {CATEGORIES.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Location
                </label>
                <input
                  type="text"
                  value={formData.location || ''}
                  onChange={(e) => updateFormField('location', e.target.value)}
                  className="input-field"
                  placeholder="Green Bay, WI"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Conference
                </label>
                <input
                  type="text"
                  value={formData.conference || ''}
                  onChange={(e) => updateFormField('conference', e.target.value)}
                  className="input-field"
                  placeholder="NFC North"
                />
              </div>

              {/* Scheduler Settings */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Priority (0-100)
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={formData.priority || 50}
                  onChange={(e) => updateFormField('priority', parseInt(e.target.value))}
                  className="input-field"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Min TVs When Playing
                </label>
                <input
                  type="number"
                  min="0"
                  max="20"
                  value={formData.minTVsWhenActive || 1}
                  onChange={(e) => updateFormField('minTVsWhenActive', parseInt(e.target.value))}
                  className="input-field"
                />
              </div>

              {/* Checkboxes */}
              <div className="flex items-center space-x-4">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.isPrimary || false}
                    onChange={(e) => updateFormField('isPrimary', e.target.checked)}
                    className="w-4 h-4 text-blue-600 bg-slate-700 border-slate-600 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm text-slate-300">Primary Team</span>
                  <Star className="w-4 h-4 text-yellow-500" />
                </label>

                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.isActive !== false}
                    onChange={(e) => updateFormField('isActive', e.target.checked)}
                    className="w-4 h-4 text-blue-600 bg-slate-700 border-slate-600 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm text-slate-300">Active</span>
                </label>

                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.autoPromotePlayoffs !== false}
                    onChange={(e) => updateFormField('autoPromotePlayoffs', e.target.checked)}
                    className="w-4 h-4 text-blue-600 bg-slate-700 border-slate-600 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm text-slate-300">Auto Promote Playoffs</span>
                </label>
              </div>

              {/* Scheduler Notes */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Scheduler Notes
                </label>
                <textarea
                  value={formData.schedulerNotes || ''}
                  onChange={(e) => updateFormField('schedulerNotes', e.target.value)}
                  className="input-field"
                  rows={2}
                  placeholder="Special scheduling instructions for this team..."
                />
              </div>
            </div>

            {/* Save Button */}
            <div className="mt-6 flex justify-end">
              <button
                onClick={handleSave}
                disabled={saving || !formData.teamName || !formData.league || !formData.sport}
                className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save className="w-4 h-4 mr-2" />
                <span>{saving ? 'Saving...' : editingTeam ? 'Update Team' : 'Create Team'}</span>
              </button>
            </div>
          </div>
        )}

        {/* Teams List */}
        {!showForm && (
          <div className="card">
            <h2 className="text-2xl font-bold text-white mb-6">
              Teams ({teams.length})
            </h2>

            {teams.length === 0 ? (
              <div className="text-center py-12">
                <Users className="w-16 h-16 text-slate-500 mx-auto mb-4" />
                <p className="text-slate-400 mb-4">No teams configured yet</p>
                <button onClick={handleCreate} className="btn-primary">
                  <Plus className="w-4 h-4 mr-2" />
                  <span>Add Your First Team</span>
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {teams.map((team) => (
                  <div
                    key={team.id}
                    className="bg-sportsBar-700/30 rounded-lg p-4 border border-sportsBar-600/50 hover:border-blue-500/50 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <h3 className="text-xl font-bold text-white">
                            {team.teamName}
                          </h3>
                          {team.isPrimary && (
                            <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />
                          )}
                          {!team.isActive && (
                            <span className="px-2 py-1 bg-red-900/30 text-red-300 text-xs rounded">
                              Inactive
                            </span>
                          )}
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                          <div>
                            <span className="text-slate-400">League:</span>
                            <span className="ml-2 text-slate-200">{team.league}</span>
                          </div>
                          <div>
                            <span className="text-slate-400">Sport:</span>
                            <span className="ml-2 text-slate-200">{team.sport}</span>
                          </div>
                          <div>
                            <span className="text-slate-400">Category:</span>
                            <span className="ml-2 text-slate-200">{team.category}</span>
                          </div>
                          <div className="flex items-center">
                            <TrendingUp className="w-4 h-4 text-blue-400 mr-1" />
                            <span className="text-slate-400">Priority:</span>
                            <span className="ml-2 text-slate-200 font-semibold">{team.priority}</span>
                          </div>
                        </div>

                        {team.location && (
                          <div className="mt-2 flex items-center text-sm text-slate-400">
                            <MapPin className="w-4 h-4 mr-1" />
                            <span>{team.location}</span>
                            {team.conference && <span className="ml-3">• {team.conference}</span>}
                          </div>
                        )}

                        {team.minTVsWhenActive && team.minTVsWhenActive > 0 && (
                          <div className="mt-2 flex items-center text-sm text-slate-400">
                            <Tv className="w-4 h-4 mr-1" />
                            <span>Min {team.minTVsWhenActive} TV{team.minTVsWhenActive > 1 ? 's' : ''} when playing</span>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center space-x-2 ml-4">
                        <button
                          onClick={() => handleEdit(team)}
                          className="p-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                          title="Edit team"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(team)}
                          className="p-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
                          title="Delete team"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </SportsBarLayout>
  );
}
