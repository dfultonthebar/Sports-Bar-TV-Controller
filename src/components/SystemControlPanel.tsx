'use client'

import { useState } from 'react'
import { RefreshCw, Power, AlertTriangle, Loader2 } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/cards'
import { Badge } from '@/components/ui/badge'

interface ConfirmDialogProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  description: string
  confirmText: string
  type: 'restart' | 'reboot'
}

function ConfirmDialog({ isOpen, onClose, onConfirm, title, description, confirmText, type }: ConfirmDialogProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-sportsBar-800 border border-sportsBar-600 rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
        <div className="flex items-start space-x-3 mb-4">
          <div className={`p-2 rounded-lg ${type === 'reboot' ? 'bg-red-500/20' : 'bg-yellow-500/20'}`}>
            <AlertTriangle className={`w-6 h-6 ${type === 'reboot' ? 'text-red-400' : 'text-yellow-400'}`} />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-slate-100">{title}</h3>
            <p className="text-sm text-slate-300 mt-1">{description}</p>
          </div>
        </div>

        <div className={`p-3 rounded-lg mb-4 ${type === 'reboot' ? 'bg-red-500/10 border border-red-500/20' : 'bg-yellow-500/10 border border-yellow-500/20'}`}>
          <p className={`text-sm ${type === 'reboot' ? 'text-red-300' : 'text-yellow-300'}`}>
            {type === 'reboot' 
              ? '⚠️ The entire server will be rebooted. Expected downtime: 1-2 minutes.'
              : '⚠️ The application will restart. Expected downtime: 10-30 seconds.'}
          </p>
        </div>

        <div className="flex items-center justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-sportsBar-700 hover:bg-sportsBar-600 text-slate-200 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-2 rounded-lg transition-colors text-white ${
              type === 'reboot' 
                ? 'bg-red-600 hover:bg-red-700' 
                : 'bg-yellow-600 hover:bg-yellow-700'
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function SystemControlPanel() {
  const [isRestartDialogOpen, setIsRestartDialogOpen] = useState(false)
  const [isRebootDialogOpen, setIsRebootDialogOpen] = useState(false)
  const [isRestarting, setIsRestarting] = useState(false)
  const [isRebooting, setIsRebooting] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const handleRestart = async () => {
    setIsRestartDialogOpen(false)
    setIsRestarting(true)
    setMessage(null)

    try {
      const response = await fetch('/api/system/restart', {
        method: 'POST',
      })

      const data = await response.json()

      if (response.ok) {
        setMessage({ 
          type: 'success', 
          text: 'Application restart initiated. The page will reload automatically...' 
        })
        
        // Wait a bit then reload the page
        setTimeout(() => {
          window.location.reload()
        }, 3000)
      } else {
        setMessage({ 
          type: 'error', 
          text: data.error || 'Failed to restart application' 
        })
        setIsRestarting(false)
      }
    } catch (error) {
      setMessage({ 
        type: 'error', 
        text: 'Failed to restart application: ' + error 
      })
      setIsRestarting(false)
    }
  }

  const handleReboot = async () => {
    setIsRebootDialogOpen(false)
    setIsRebooting(true)
    setMessage(null)

    try {
      const response = await fetch('/api/system/reboot', {
        method: 'POST',
      })

      const data = await response.json()

      if (response.ok) {
        setMessage({ 
          type: 'success', 
          text: 'System reboot initiated. Server will be unavailable for 1-2 minutes...' 
        })
        
        // Keep the loading state - user will need to manually refresh after reboot
      } else {
        setMessage({ 
          type: 'error', 
          text: data.error || 'Failed to reboot system. ' + (data.note || '') 
        })
        setIsRebooting(false)
      }
    } catch (error) {
      setMessage({ 
        type: 'error', 
        text: 'Failed to reboot system: ' + error 
      })
      setIsRebooting(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Power className="w-5 h-5 text-blue-600" />
            System Power Controls
          </CardTitle>
          <CardDescription>
            Restart the application or reboot the entire server
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Message Display */}
      {message && (
        <div className={`card ${message.type === 'success' ? 'border-green-500/50' : 'border-red-500/50'}`}>
          <div className="p-4">
            <div className="flex items-start space-x-3">
              {message.type === 'success' ? (
                <div className="p-1 rounded-full bg-green-500/20">
                  <RefreshCw className="h-4 w-4 text-green-400" />
                </div>
              ) : (
                <div className="p-1 rounded-full bg-red-500/20">
                  <AlertTriangle className="h-4 w-4 text-red-400" />
                </div>
              )}
              <p className={`text-sm ${message.type === 'success' ? 'text-green-300' : 'text-red-300'}`}>
                {message.text}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Control Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Restart Application Card */}
        <Card className="border-yellow-500/20 hover:border-yellow-500/40 transition-colors">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-3 rounded-lg bg-yellow-500/20">
                  <RefreshCw className="w-6 h-6 text-yellow-400" />
                </div>
                <div>
                  <CardTitle className="text-lg">Restart Application</CardTitle>
                  <Badge variant="outline" className="mt-1 text-yellow-400 border-yellow-400/30">
                    Software Only
                  </Badge>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm text-slate-300 space-y-2">
              <p>Restarts the Node.js/Next.js application server without affecting the operating system.</p>
              <div className="bg-sportsBar-700/50 rounded-lg p-3 space-y-1">
                <p className="text-xs text-slate-400">• Downtime: 10-30 seconds</p>
                <p className="text-xs text-slate-400">• Use for: Code updates, configuration changes</p>
                <p className="text-xs text-slate-400">• Safe for: Regular maintenance</p>
              </div>
            </div>
            <button
              onClick={() => setIsRestartDialogOpen(true)}
              disabled={isRestarting || isRebooting}
              className="w-full btn-primary flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isRestarting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Restarting...</span>
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4" />
                  <span>Restart Application</span>
                </>
              )}
            </button>
          </CardContent>
        </Card>

        {/* Reboot Server Card */}
        <Card className="border-red-500/20 hover:border-red-500/40 transition-colors">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-3 rounded-lg bg-red-500/20">
                  <Power className="w-6 h-6 text-red-400" />
                </div>
                <div>
                  <CardTitle className="text-lg">Reboot Server</CardTitle>
                  <Badge variant="outline" className="mt-1 text-red-400 border-red-400/30">
                    Full System
                  </Badge>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm text-slate-300 space-y-2">
              <p>Reboots the entire operating system, including all services and applications.</p>
              <div className="bg-sportsBar-700/50 rounded-lg p-3 space-y-1">
                <p className="text-xs text-slate-400">• Downtime: 1-2 minutes</p>
                <p className="text-xs text-slate-400">• Use for: System updates, hardware issues</p>
                <p className="text-xs text-slate-400">• Requires: Sudo permissions</p>
              </div>
            </div>
            <button
              onClick={() => setIsRebootDialogOpen(true)}
              disabled={isRestarting || isRebooting}
              className="w-full bg-red-600 hover:bg-red-700 text-white rounded-lg py-2 px-4 transition-colors flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isRebooting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Rebooting...</span>
                </>
              ) : (
                <>
                  <Power className="w-4 h-4" />
                  <span>Reboot Server</span>
                </>
              )}
            </button>
          </CardContent>
        </Card>
      </div>

      {/* Information Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Important Notes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm text-slate-300">
            <div className="flex items-start space-x-2">
              <div className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-2" />
              <p>
                <strong className="text-slate-200">Restart Application:</strong> Only restarts the Node.js process. 
                The process manager (PM2, systemd, or Docker) will automatically restart the application.
              </p>
            </div>
            <div className="flex items-start space-x-2">
              <div className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-2" />
              <p>
                <strong className="text-slate-200">Reboot Server:</strong> Requires sudo permissions. 
                Add to /etc/sudoers: <code className="bg-sportsBar-900/50 px-2 py-0.5 rounded text-xs">username ALL=(ALL) NOPASSWD: /sbin/reboot</code>
              </p>
            </div>
            <div className="flex items-start space-x-2">
              <div className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-2" />
              <p>
                <strong className="text-slate-200">Safety:</strong> Both operations require confirmation. 
                Active connections will be terminated during restart/reboot.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Confirmation Dialogs */}
      <ConfirmDialog
        isOpen={isRestartDialogOpen}
        onClose={() => setIsRestartDialogOpen(false)}
        onConfirm={handleRestart}
        title="Restart Application?"
        description="This will restart the Node.js/Next.js server. All active connections will be temporarily interrupted."
        confirmText="Restart Now"
        type="restart"
      />

      <ConfirmDialog
        isOpen={isRebootDialogOpen}
        onClose={() => setIsRebootDialogOpen(false)}
        onConfirm={handleReboot}
        title="Reboot Server?"
        description="This will reboot the entire operating system. All services will be restarted and the server will be unavailable for 1-2 minutes."
        confirmText="Reboot Now"
        type="reboot"
      />
    </div>
  )
}
