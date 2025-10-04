
'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/cards'
import { TrendingUp } from 'lucide-react'

export default function HealthMetricsChart() {
  const [metrics, setMetrics] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetchMetrics()
  }, [])

  const fetchMetrics = async () => {
    try {
      const response = await fetch('/api/diagnostics/metrics?hours=24')
      const data = await response.json()
      
      if (data.success) {
        setMetrics(data.metrics || [])
      }
    } catch (error) {
      console.error('Error fetching metrics:', error)
    } finally {
      setIsLoading(false)
    }
  }

  // Group metrics by type
  const cpuMetrics = metrics.filter(m => m.metricType === 'cpu')
  const memoryMetrics = metrics.filter(m => m.metricType === 'memory')
  const diskMetrics = metrics.filter(m => m.metricType === 'disk')

  const getAverage = (arr: any[]) => {
    if (arr.length === 0) return 0
    return arr.reduce((sum, m) => sum + m.value, 0) / arr.length
  }

  const getMax = (arr: any[]) => {
    if (arr.length === 0) return 0
    return Math.max(...arr.map(m => m.value))
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <TrendingUp className="w-5 h-5 text-blue-400" />
          <span>System Metrics (24h)</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-8 text-slate-400">Loading metrics...</div>
        ) : (
          <div className="space-y-6">
            {/* CPU Usage */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-slate-300">CPU Usage</span>
                <span className="text-sm font-mono text-slate-100">
                  Avg: {getAverage(cpuMetrics).toFixed(1)}% | Max: {getMax(cpuMetrics).toFixed(1)}%
                </span>
              </div>
              <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-500 to-cyan-500"
                  style={{ width: `${getAverage(cpuMetrics)}%` }}
                />
              </div>
            </div>

            {/* Memory Usage */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-slate-300">Memory Usage</span>
                <span className="text-sm font-mono text-slate-100">
                  Avg: {getAverage(memoryMetrics).toFixed(1)}% | Max: {getMax(memoryMetrics).toFixed(1)}%
                </span>
              </div>
              <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-purple-500 to-pink-500"
                  style={{ width: `${getAverage(memoryMetrics)}%` }}
                />
              </div>
            </div>

            {/* Disk Usage */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-slate-300">Disk Usage</span>
                <span className="text-sm font-mono text-slate-100">
                  Avg: {getAverage(diskMetrics).toFixed(1)}% | Max: {getMax(diskMetrics).toFixed(1)}%
                </span>
              </div>
              <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-green-500 to-emerald-500"
                  style={{ width: `${getAverage(diskMetrics)}%` }}
                />
              </div>
            </div>

            {/* Data Points */}
            <div className="grid grid-cols-3 gap-4 pt-4 border-t border-slate-700">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-400">{cpuMetrics.length}</div>
                <div className="text-xs text-slate-400">CPU Samples</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-400">{memoryMetrics.length}</div>
                <div className="text-xs text-slate-400">Memory Samples</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-400">{diskMetrics.length}</div>
                <div className="text-xs text-slate-400">Disk Samples</div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
