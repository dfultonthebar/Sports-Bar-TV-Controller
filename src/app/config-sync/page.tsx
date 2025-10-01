
'use client'

import React from 'react'
import GitHubConfigSync from '@/components/GitHubConfigSync'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/cards'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ArrowLeft, GitBranch } from 'lucide-react'
import Link from 'next/link'
import SportsBarLayout from '@/components/SportsBarLayout'
import SportsBarHeader from '@/components/SportsBarHeader'

export default function ConfigSyncPage() {
  return (
    <SportsBarLayout>
      <SportsBarHeader
        title="GitHub Configuration Sync"
        subtitle="Manage and sync your Sports Bar configurations"
        icon={<GitBranch className="w-8 h-8 text-blue-400" />}
        actions={
          <Badge variant="secondary" className="bg-green-900/50 text-green-200 border-green-800">
            Auto-Sync Enabled
          </Badge>
        }
      />
      
      <div className="max-w-6xl mx-auto p-6">
        {/* Instructions Card */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>🚀 Configuration Sync Overview</CardTitle>
            <CardDescription>
              Your Sports Bar AI Assistant configurations are automatically tracked and can be synced to GitHub
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <h4 className="font-semibold text-blue-900 mb-2">📊 Tracked Configurations</h4>
                <ul className="text-sm text-blue-800 space-y-1">
                  <li>• Matrix routing settings</li>
                  <li>• Audio zone configurations</li>
                  <li>• IR device mappings</li>
                  <li>• DirectTV device settings</li>
                  <li>• TV layout positions</li>
                </ul>
              </div>
              
              <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                <h4 className="font-semibold text-green-900 mb-2">⚡ Auto-Sync Features</h4>
                <ul className="text-sm text-green-800 space-y-1">
                  <li>• Real-time change detection</li>
                  <li>• Automatic commit generation</li>
                  <li>• Smart conflict resolution</li>
                  <li>• Rollback capabilities</li>
                  <li>• Version history tracking</li>
                </ul>
              </div>
              
              <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
                <h4 className="font-semibold text-purple-900 mb-2">🔄 Sync Benefits</h4>
                <ul className="text-sm text-purple-800 space-y-1">
                  <li>• Configuration backup</li>
                  <li>• Multi-location sync</li>
                  <li>• Change auditing</li>
                  <li>• Team collaboration</li>
                  <li>• Disaster recovery</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* GitHub Sync Component */}
        <GitHubConfigSync />

        {/* Current Configuration Summary */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>📋 Current Configuration Summary</CardTitle>
            <CardDescription>
              Overview of your current Sports Bar setup that's being tracked
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              <div className="bg-slate-50 p-4 rounded-lg">
                <div className="text-2xl font-bold text-slate-100">12</div>
                <div className="text-sm text-slate-400">TV Zones</div>
              </div>
              <div className="bg-slate-50 p-4 rounded-lg">
                <div className="text-2xl font-bold text-slate-100">4</div>
                <div className="text-sm text-slate-400">Matrix Inputs</div>
              </div>
              <div className="bg-slate-50 p-4 rounded-lg">
                <div className="text-2xl font-bold text-slate-100">6</div>
                <div className="text-sm text-slate-400">IR Devices</div>
              </div>
              <div className="bg-slate-50 p-4 rounded-lg">
                <div className="text-2xl font-bold text-slate-100">2</div>
                <div className="text-sm text-slate-400">Audio Zones</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </SportsBarLayout>
  )
}
