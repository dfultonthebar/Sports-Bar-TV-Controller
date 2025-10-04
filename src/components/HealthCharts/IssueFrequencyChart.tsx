
'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/cards'
import { BarChart3 } from 'lucide-react'

export default function IssueFrequencyChart() {
  const [issueStats, setIssueStats] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetchIssueStats()
  }, [])

  const fetchIssueStats = async () => {
    try {
      const response = await fetch('/api/diagnostics/issue-stats')
      const data = await response.json()
      
      if (data.success) {
        setIssueStats(data.stats || [])
      }
    } catch (error) {
      console.error('Error fetching issue stats:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const maxCount = Math.max(...issueStats.map(s => s.count), 1)

  const getTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      crash: 'bg-red-500',
      performance: 'bg-yellow-500',
      resource: 'bg-orange-500',
      connectivity: 'bg-blue-500',
      dependency: 'bg-purple-500',
      security: 'bg-pink-500'
    }
    return colors[type] || 'bg-gray-500'
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <BarChart3 className="w-5 h-5 text-orange-400" />
          <span>Issue Frequency by Type</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-8 text-slate-400">Loading issue stats...</div>
        ) : issueStats.length === 0 ? (
          <div className="text-center py-8 text-slate-400">
            <BarChart3 className="w-12 h-12 mx-auto mb-2 text-green-500" />
            <p>No issues detected</p>
          </div>
        ) : (
          <div className="space-y-4">
            {issueStats.map((stat, idx) => (
              <div key={idx}>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-slate-300 capitalize">{stat.type}</span>
                  <span className="text-sm font-mono text-slate-100">{stat.count}</span>
                </div>
                <div className="h-8 bg-slate-700 rounded-lg overflow-hidden">
                  <div
                    className={`h-full ${getTypeColor(stat.type)} flex items-center justify-end px-3`}
                    style={{ width: `${(stat.count / maxCount) * 100}%` }}
                  >
                    <span className="text-xs font-semibold text-white">
                      {stat.count}
                    </span>
                  </div>
                </div>
              </div>
            ))}
            
            <div className="pt-4 border-t border-slate-700">
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-400">
                  {issueStats.reduce((sum, s) => sum + s.count, 0)}
                </div>
                <div className="text-xs text-slate-400">Total Issues (7 days)</div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
