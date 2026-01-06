
/**
 * Change History Component
 */

'use client'

import React from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/cards'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { CheckCircle, XCircle, Clock, ExternalLink } from 'lucide-react'

interface CodeChange {
  id: string
  timestamp: Date
  type: string
  filePath: string
  description: string
  riskScore: number
  status: string
  prUrl?: string
  aiModel: string
}

interface ChangeHistoryProps {
  changes: CodeChange[]
}

export function ChangeHistory({ changes }: ChangeHistoryProps) {
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'applied':
        return <Badge variant="default"><CheckCircle className="h-3 w-3 mr-1" />Applied</Badge>
      case 'rejected':
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Rejected</Badge>
      case 'pending':
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Pending</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }
  
  if (changes.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Change History</CardTitle>
          <CardDescription>No changes in history yet</CardDescription>
        </CardHeader>
      </Card>
    )
  }
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>Change History</CardTitle>
        <CardDescription>All AI-assisted code changes</CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[600px] pr-4">
          <div className="space-y-3">
            {changes.map((change) => (
              <div
                key={change.id}
                className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
              >
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">{change.description}</p>
                    {getStatusBadge(change.status)}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    <code>{change.filePath}</code>
                  </p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{new Date(change.timestamp).toLocaleString()}</span>
                    <span>•</span>
                    <span>Risk: {change.riskScore}/10</span>
                    <span>•</span>
                    <span>{change.aiModel}</span>
                  </div>
                  {change.prUrl && (
                    <a
                      href={change.prUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                    >
                      View PR <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}
