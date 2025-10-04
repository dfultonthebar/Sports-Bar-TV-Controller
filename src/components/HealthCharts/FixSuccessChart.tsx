
'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/cards'
import { PieChart } from 'lucide-react'

export default function FixSuccessChart() {
  const [fixStats, setFixStats] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetchFixStats()
  }, [])

  const fetchFixStats = async () => {
    try {
      const response = await fetch('/api/diagnostics/fix-stats')
      const data = await response.json()
      
      if (data.success) {
        setFixStats(data.stats)
      }
    } catch (error) {
      console.error('Error fetching fix stats:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const successRate = fixStats 
    ? ((fixStats.successful / fixStats.total) * 100).toFixed(1)
    : 0

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <PieChart className="w-5 h-5 text-green-400" />
          <span>Fix Success Rate</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-8 text-slate-400">Loading fix stats...</div>
        ) : !fixStats || fixStats.total === 0 ? (
          <div className="text-center py-8 text-slate-400">
            <PieChart className="w-12 h-12 mx-auto mb-2" />
            <p>No fixes applied yet</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Success Rate Circle */}
            <div className="flex justify-center">
              <div className="relative w-40 h-40">
                <svg className="w-full h-full transform -rotate-90">
                  <circle
                    cx="80"
                    cy="80"
                    r="70"
                    stroke="currentColor"
                    strokeWidth="12"
                    fill="none"
                    className="text-slate-700"
                  />
                  <circle
                    cx="80"
                    cy="80"
                    r="70"
                    stroke="currentColor"
                    strokeWidth="12"
                    fill="none"
                    strokeDasharray={`${2 * Math.PI * 70}`}
                    strokeDashoffset={`${2 * Math.PI * 70 * (1 - parseFloat(successRate || "0") / 100)}`}
                    className="text-green-500"
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-green-400">{successRate}%</div>
                    <div className="text-xs text-slate-400">Success</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-3 bg-slate-800/50 rounded-lg">
                <div className="text-2xl font-bold text-green-400">{fixStats.successful}</div>
                <div className="text-xs text-slate-400">Successful</div>
              </div>
              <div className="text-center p-3 bg-slate-800/50 rounded-lg">
                <div className="text-2xl font-bold text-red-400">{fixStats.failed}</div>
                <div className="text-xs text-slate-400">Failed</div>
              </div>
              <div className="text-center p-3 bg-slate-800/50 rounded-lg">
                <div className="text-2xl font-bold text-blue-400">{fixStats.total}</div>
                <div className="text-xs text-slate-400">Total</div>
              </div>
            </div>

            {/* Average Duration */}
            {fixStats.avgDuration && (
              <div className="text-center p-3 bg-slate-800/30 rounded-lg">
                <div className="text-lg font-bold text-purple-400">
                  {fixStats.avgDuration.toFixed(0)}ms
                </div>
                <div className="text-xs text-slate-400">Average Fix Duration</div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
