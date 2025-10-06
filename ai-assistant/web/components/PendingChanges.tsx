
/**
 * Pending Changes Component
 */

'use client'

import React from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { CheckCircle, XCircle, AlertTriangle, FileCode, Clock } from 'lucide-react'

interface CodeChange {
  id: string
  timestamp: Date
  type: 'create' | 'update' | 'delete' | 'refactor'
  filePath: string
  description: string
  riskScore: number
  status: string
  diff?: string
  aiModel: string
  reasoning: string
}

interface PendingChangesProps {
  changes: CodeChange[]
  onApprove: (id: string) => void
  onReject: (id: string) => void
}

export function PendingChanges({ changes, onApprove, onReject }: PendingChangesProps) {
  const getRiskBadge = (score: number) => {
    if (score === 10) return <Badge variant="default">Safe</Badge>
    if (score >= 7) return <Badge variant="secondary">Medium Risk</Badge>
    return <Badge variant="destructive">High Risk</Badge>
  }
  
  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'create': return '➕'
      case 'update': return '✏️'
      case 'delete': return '🗑️'
      case 'refactor': return '🔄'
      default: return '📝'
    }
  }
  
  if (changes.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Pending Changes</CardTitle>
          <CardDescription>No pending changes at the moment</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center py-8">
          <CheckCircle className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">All changes have been reviewed</p>
        </CardContent>
      </Card>
    )
  }
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>Pending Changes ({changes.length})</CardTitle>
        <CardDescription>Review and approve AI-suggested changes</CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[600px] pr-4">
          <div className="space-y-4">
            {changes.map((change) => (
              <Card key={change.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-2xl">{getTypeIcon(change.type)}</span>
                        <CardTitle className="text-lg">{change.description}</CardTitle>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <FileCode className="h-4 w-4" />
                        <code className="text-xs">{change.filePath}</code>
                      </div>
                    </div>
                    <div className="flex flex-col gap-2 items-end">
                      {getRiskBadge(change.riskScore)}
                      <Badge variant="outline" className="text-xs">
                        {change.aiModel}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <h4 className="text-sm font-semibold mb-1">Reasoning</h4>
                    <p className="text-sm text-muted-foreground">{change.reasoning}</p>
                  </div>
                  
                  {change.diff && (
                    <div>
                      <h4 className="text-sm font-semibold mb-1">Changes</h4>
                      <pre className="text-xs bg-muted p-3 rounded-md overflow-x-auto">
                        {change.diff}
                      </pre>
                    </div>
                  )}
                  
                  <div className="flex items-center gap-2 pt-2">
                    <Button
                      size="sm"
                      onClick={() => onApprove(change.id)}
                      className="flex-1"
                    >
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => onReject(change.id)}
                      className="flex-1"
                    >
                      <XCircle className="h-4 w-4 mr-2" />
                      Reject
                    </Button>
                  </div>
                  
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {new Date(change.timestamp).toLocaleString()}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}
