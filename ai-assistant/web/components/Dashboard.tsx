
/**
 * AI Assistant Dashboard Component
 */

'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/cards'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Brain, CheckCircle, XCircle, Clock, AlertTriangle, TrendingUp } from 'lucide-react'

interface DashboardProps {
  statistics: {
    pending: number
    applied: number
    total: number
    approved: number
    rejected: number
  }
}

export function AIAssistantDashboard({ statistics }: DashboardProps) {
  const [isOnline, setIsOnline] = useState(false)
  
  useEffect(() => {
    // Check if Ollama is available
    fetch('/api/ai-assistant/status')
      .then(res => res.json())
      .then(data => setIsOnline(data.online))
      .catch(() => setIsOnline(false))
  }, [])
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Brain className="h-8 w-8" />
            AI Code Assistant
          </h1>
          <p className="text-muted-foreground mt-1">
            Local AI-powered code analysis and improvements
          </p>
        </div>
        <Badge variant={isOnline ? 'default' : 'destructive'}>
          {isOnline ? 'Online' : 'Offline'}
        </Badge>
      </div>
      
      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Changes</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statistics.pending}</div>
            <p className="text-xs text-muted-foreground">
              Awaiting review
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Applied Changes</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statistics.applied}</div>
            <p className="text-xs text-muted-foreground">
              Successfully applied
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Changes</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statistics.total}</div>
            <p className="text-xs text-muted-foreground">
              All time
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Rejected</CardTitle>
            <XCircle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statistics.rejected}</div>
            <p className="text-xs text-muted-foreground">
              Not applied
            </p>
          </CardContent>
        </Card>
      </div>
      
      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>Common AI assistant operations</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button variant="outline">
            Scan for Cleanup
          </Button>
          <Button variant="outline">
            Analyze Codebase
          </Button>
          <Button variant="outline">
            Fix Lint Errors
          </Button>
          <Button variant="outline">
            Add Documentation
          </Button>
          <Button variant="outline">
            Remove Unused Imports
          </Button>
        </CardContent>
      </Card>
      
      {/* System Status */}
      <Card>
        <CardHeader>
          <CardTitle>System Status</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm">Ollama Service</span>
            <Badge variant={isOnline ? 'default' : 'destructive'}>
              {isOnline ? 'Running' : 'Stopped'}
            </Badge>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm">Model</span>
            <Badge variant="outline">deepseek-coder:6.7b</Badge>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm">Auto-backup</span>
            <Badge variant="default">Enabled</Badge>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm">PR Creation</span>
            <Badge variant="default">Enabled</Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
