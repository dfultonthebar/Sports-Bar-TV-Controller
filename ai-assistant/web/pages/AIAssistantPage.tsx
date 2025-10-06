
/**
 * AI Assistant Main Page
 */

'use client'

import React, { useState, useEffect } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { AIAssistantDashboard } from '../components/Dashboard'
import { PendingChanges } from '../components/PendingChanges'
import { ChangeHistory } from '../components/ChangeHistory'

export default function AIAssistantPage() {
  const [statistics, setStatistics] = useState({
    pending: 0,
    applied: 0,
    total: 0,
    approved: 0,
    rejected: 0
  })
  
  const [pendingChanges, setPendingChanges] = useState([])
  const [changeHistory, setChangeHistory] = useState([])
  
  useEffect(() => {
    loadData()
    const interval = setInterval(loadData, 5000) // Refresh every 5 seconds
    return () => clearInterval(interval)
  }, [])
  
  const loadData = async () => {
    try {
      // Load statistics
      const statsRes = await fetch('/api/ai-assistant/statistics')
      const statsData = await statsRes.json()
      setStatistics(statsData.statistics)
      
      // Load pending changes
      const pendingRes = await fetch('/api/ai-assistant/changes?type=pending')
      const pendingData = await pendingRes.json()
      setPendingChanges(pendingData.changes)
      
      // Load history
      const historyRes = await fetch('/api/ai-assistant/changes?type=history')
      const historyData = await historyRes.json()
      setChangeHistory(historyData.changes)
    } catch (error) {
      console.error('Failed to load data:', error)
    }
  }
  
  const handleApprove = async (id: string) => {
    try {
      await fetch('/api/ai-assistant/changes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve', changeId: id })
      })
      loadData()
    } catch (error) {
      console.error('Failed to approve change:', error)
    }
  }
  
  const handleReject = async (id: string) => {
    try {
      await fetch('/api/ai-assistant/changes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reject', changeId: id })
      })
      loadData()
    } catch (error) {
      console.error('Failed to reject change:', error)
    }
  }
  
  return (
    <div className="container mx-auto py-8">
      <Tabs defaultValue="dashboard" className="space-y-6">
        <TabsList>
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="pending">
            Pending Changes {pendingChanges.length > 0 && `(${pendingChanges.length})`}
          </TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>
        
        <TabsContent value="dashboard">
          <AIAssistantDashboard statistics={statistics} />
        </TabsContent>
        
        <TabsContent value="pending">
          <PendingChanges
            changes={pendingChanges}
            onApprove={handleApprove}
            onReject={handleReject}
          />
        </TabsContent>
        
        <TabsContent value="history">
          <ChangeHistory changes={changeHistory} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
