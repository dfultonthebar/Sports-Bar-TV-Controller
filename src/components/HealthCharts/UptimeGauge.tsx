
'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/cards'
import { TrendingUp } from 'lucide-react'

interface UptimeGaugeProps {
  uptime: number
}

export default function UptimeGauge({ uptime }: UptimeGaugeProps) {
  const getUptimeColor = (uptime: number) => {
    if (uptime >= 99) return 'text-green-500'
    if (uptime >= 95) return 'text-yellow-500'
    return 'text-red-500'
  }

  const getUptimeGradient = (uptime: number) => {
    if (uptime >= 99) return 'from-green-500 to-emerald-500'
    if (uptime >= 95) return 'from-yellow-500 to-orange-500'
    return 'from-red-500 to-pink-500'
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <TrendingUp className="w-5 h-5 text-green-400" />
          <span>System Uptime</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Uptime Percentage */}
          <div className="flex justify-center">
            <div className="relative w-48 h-48">
              <svg className="w-full h-full transform -rotate-90">
                <circle
                  cx="96"
                  cy="96"
                  r="88"
                  stroke="currentColor"
                  strokeWidth="16"
                  fill="none"
                  className="text-slate-700"
                />
                <circle
                  cx="96"
                  cy="96"
                  r="88"
                  stroke="url(#uptimeGradient)"
                  strokeWidth="16"
                  fill="none"
                  strokeDasharray={`${2 * Math.PI * 88}`}
                  strokeDashoffset={`${2 * Math.PI * 88 * (1 - uptime / 100)}`}
                  strokeLinecap="round"
                />
                <defs>
                  <linearGradient id="uptimeGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" className={`${getUptimeGradient(uptime).split(' ')[0].replace('from-', 'text-')}`} stopColor="currentColor" />
                    <stop offset="100%" className={`${getUptimeGradient(uptime).split(' ')[1].replace('to-', 'text-')}`} stopColor="currentColor" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <div className={`text-4xl font-bold ${getUptimeColor(uptime)}`}>
                    {uptime.toFixed(2)}%
                  </div>
                  <div className="text-sm text-slate-400 mt-1">Uptime</div>
                </div>
              </div>
            </div>
          </div>

          {/* Uptime Status */}
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center p-3 bg-slate-800/50 rounded-lg">
              <div className="text-lg font-bold text-green-400">
                {uptime >= 99 ? 'Excellent' : uptime >= 95 ? 'Good' : 'Needs Attention'}
              </div>
              <div className="text-xs text-slate-400">Status</div>
            </div>
            <div className="text-center p-3 bg-slate-800/50 rounded-lg">
              <div className="text-lg font-bold text-blue-400">7 Days</div>
              <div className="text-xs text-slate-400">Period</div>
            </div>
          </div>

          {/* Downtime Calculation */}
          <div className="text-center p-3 bg-slate-800/30 rounded-lg">
            <div className="text-sm text-slate-300">
              Downtime: <span className="font-mono font-bold text-red-400">
                {((100 - uptime) * 1.68).toFixed(1)} hours
              </span>
            </div>
            <div className="text-xs text-slate-400 mt-1">in the last 7 days</div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
