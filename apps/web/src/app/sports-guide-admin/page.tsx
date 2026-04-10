/**
 * Sports Guide Admin — consolidated 8-tab admin page.
 *
 * This page is the new home for all Sports Guide / Scheduler admin functionality.
 * It thin-wraps existing extracted components so nothing changes behaviorally —
 * the underlying pages at /sports-guide, /sports-guide-config, /ai-gameplan,
 * and /scheduling continue to work during the Phase B/C transition period.
 *
 * See docs/SPORTS_GUIDE_ADMIN_CONSOLIDATION.md for the full plan.
 */

'use client'

import { useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Calendar,
  ListChecks,
  Trophy,
  Users,
  Radio,
  Cable,
  Settings,
  FileText,
} from 'lucide-react'

// Existing components used as-is
import SportsGuide from '@/components/SportsGuide'
import SportsGuideConfig from '@/components/SportsGuideConfig'
import ChannelPresetsPanel from '@/components/settings/ChannelPresetsPanel'
import { SchedulerLogsDashboard } from '@/components/SchedulerLogsDashboard'

// Phase B extracted components
import AIGamePlanDashboard from '@/components/admin/AIGamePlanDashboard'
import SmartSchedulingDashboard from '@/components/admin/SmartSchedulingDashboard'
import HomeTeamsManager from '@/components/admin/HomeTeamsManager'
import TVProvidersManager from '@/components/admin/TVProvidersManager'
import LocationConfigPanel from '@/components/admin/LocationConfigPanel'

export const dynamic = 'force-dynamic'

export default function SportsGuideAdminPage() {
  const [activeTab, setActiveTab] = useState('guide')

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-white mb-1">Sports Guide Admin</h1>
          <p className="text-sm text-slate-400">
            Single home for sports guide, scheduling, channels, and configuration.
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid grid-cols-4 md:grid-cols-8 gap-1 bg-slate-900 border border-slate-700 p-1 h-auto">
            <TabsTrigger
              value="guide"
              className="data-[state=active]:bg-blue-600 data-[state=active]:text-white"
            >
              <Calendar className="w-4 h-4 mr-1 md:mr-2" />
              <span className="hidden md:inline">Guide</span>
            </TabsTrigger>
            <TabsTrigger
              value="games"
              className="data-[state=active]:bg-blue-600 data-[state=active]:text-white"
            >
              <ListChecks className="w-4 h-4 mr-1 md:mr-2" />
              <span className="hidden md:inline">Games</span>
            </TabsTrigger>
            <TabsTrigger
              value="schedule"
              className="data-[state=active]:bg-blue-600 data-[state=active]:text-white"
            >
              <Trophy className="w-4 h-4 mr-1 md:mr-2" />
              <span className="hidden md:inline">Schedule</span>
            </TabsTrigger>
            <TabsTrigger
              value="home-teams"
              className="data-[state=active]:bg-blue-600 data-[state=active]:text-white"
            >
              <Users className="w-4 h-4 mr-1 md:mr-2" />
              <span className="hidden md:inline">Home Teams</span>
            </TabsTrigger>
            <TabsTrigger
              value="channels"
              className="data-[state=active]:bg-blue-600 data-[state=active]:text-white"
            >
              <Radio className="w-4 h-4 mr-1 md:mr-2" />
              <span className="hidden md:inline">Channels</span>
            </TabsTrigger>
            <TabsTrigger
              value="providers"
              className="data-[state=active]:bg-blue-600 data-[state=active]:text-white"
            >
              <Cable className="w-4 h-4 mr-1 md:mr-2" />
              <span className="hidden md:inline">Providers</span>
            </TabsTrigger>
            <TabsTrigger
              value="configuration"
              className="data-[state=active]:bg-blue-600 data-[state=active]:text-white"
            >
              <Settings className="w-4 h-4 mr-1 md:mr-2" />
              <span className="hidden md:inline">Config</span>
            </TabsTrigger>
            <TabsTrigger
              value="logs"
              className="data-[state=active]:bg-blue-600 data-[state=active]:text-white"
            >
              <FileText className="w-4 h-4 mr-1 md:mr-2" />
              <span className="hidden md:inline">Logs</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="guide" className="mt-6">
            <SportsGuide />
          </TabsContent>

          <TabsContent value="games" className="mt-6">
            <SmartSchedulingDashboard />
          </TabsContent>

          <TabsContent value="schedule" className="mt-6">
            <AIGamePlanDashboard />
          </TabsContent>

          <TabsContent value="home-teams" className="mt-6">
            <HomeTeamsManager />
          </TabsContent>

          <TabsContent value="channels" className="mt-6">
            <div className="space-y-6">
              <ChannelPresetsPanel />
              <div className="rounded-lg border border-slate-700 p-6 bg-slate-900/40">
                <h3 className="text-lg font-semibold text-white mb-2">Station Aliases &amp; Local Channel Overrides</h3>
                <p className="text-sm text-slate-400">
                  Station alias and local channel override management UI will be added in a follow-up pass.
                  For now, these are edited directly via SQL or the existing `station_aliases` and
                  `local_channel_overrides` DB tables. See{' '}
                  <code className="text-blue-400">docs/SCHEDULER_FIXES_APRIL_2026.md</code> section 5a for the
                  Wisconsin RSN alias convention that must not be violated.
                </p>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="providers" className="mt-6">
            <TVProvidersManager />
          </TabsContent>

          <TabsContent value="configuration" className="mt-6">
            <div className="space-y-6">
              <div className="rounded-lg border border-slate-700 p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Sports Guide API</h3>
                <SportsGuideConfig />
              </div>
              <LocationConfigPanel />
            </div>
          </TabsContent>

          <TabsContent value="logs" className="mt-6">
            <SchedulerLogsDashboard />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
