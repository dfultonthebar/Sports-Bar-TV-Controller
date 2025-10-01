
'use client'

import { useState, useEffect } from 'react'

interface SchedulerStatus {
  schedulerRunning: boolean
  nextUpdate: string
  lastUpdate: string
}

export default function ProgrammingScheduler() {
  const [status, setStatus] = useState<SchedulerStatus | null>(null)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    fetchStatus()
  }, [])

  const fetchStatus = async () => {
    try {
      const response = await fetch('/api/tv-programming/scheduler')
      if (response.ok) {
        const data = await response.json()
        setStatus(data)
      }
    } catch (error) {
      console.error('Error fetching scheduler status:', error)
    }
  }

  const handleAction = async (action: string) => {
    setLoading(true)
    setMessage('')
    
    try {
      const response = await fetch('/api/tv-programming/scheduler', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action })
      })
      
      if (response.ok) {
        const data = await response.json()
        setMessage(data.message)
        await fetchStatus() // Refresh status
      } else {
        const error = await response.json()
        setMessage(error.error || 'Operation failed')
      }
    } catch (error) {
      setMessage('Error: ' + (error as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-slate-100 flex items-center">
            🕐 Programming Scheduler
          </h3>
          <p className="text-sm text-slate-300">
            Automatically updates sports programming daily at 12:00 AM
          </p>
        </div>
      </div>

      {status && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="text-sm font-medium text-slate-200">Status</div>
            <div className={`text-lg font-semibold ${status.schedulerRunning ? 'text-green-600' : 'text-red-600'}`}>
              {status.schedulerRunning ? '🟢 Running' : '🔴 Stopped'}
            </div>
          </div>
          
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="text-sm font-medium text-slate-200">Next Update</div>
            <div className="text-lg font-semibold text-slate-100">{status.nextUpdate}</div>
          </div>
          
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="text-sm font-medium text-slate-200">Last Check</div>
            <div className="text-lg font-semibold text-slate-100">
              {new Date(status.lastUpdate).toLocaleTimeString()}
            </div>
          </div>
        </div>
      )}

      <div className="flex space-x-3 mb-4">
        <button
          onClick={() => handleAction('start')}
          disabled={loading}
          className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md disabled:opacity-50"
        >
          {loading ? '⏳ Starting...' : '▶️ Start Scheduler'}
        </button>
        
        <button
          onClick={() => handleAction('stop')}
          disabled={loading}
          className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md disabled:opacity-50"
        >
          {loading ? '⏳ Stopping...' : '⏸️ Stop Scheduler'}
        </button>
        
        <button
          onClick={() => handleAction('run_now')}
          disabled={loading}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md disabled:opacity-50"
        >
          {loading ? '⏳ Running...' : '🚀 Update Now'}
        </button>
      </div>

      {message && (
        <div className={`p-4 rounded-lg ${
          message.includes('Error') || message.includes('failed') 
            ? 'bg-red-50 text-red-800 border border-red-200' 
            : 'bg-green-50 text-green-800 border border-green-200'
        }`}>
          {message}
        </div>
      )}

      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <h4 className="font-medium text-blue-900 mb-2">📋 How It Works</h4>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• Automatically pulls sports programming data daily at midnight</li>
          <li>• Updates channel lineups for the next 7 days</li>
          <li>• Includes NFL games, MLB, NBA, NHL, and sports shows</li>
          <li>• Can be manually triggered for immediate updates</li>
        </ul>
      </div>
    </div>
  )
}
