'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Power, PowerOff, RefreshCw, Loader2, X } from 'lucide-react'
import { toast } from 'react-hot-toast'
import { logger } from '@/lib/logger'

interface BulkOperationResult {
  total: number
  successful: number
  failed: number
  devices: Array<{
    id: string
    name: string
    status: 'success' | 'failed' | 'error'
    error?: string
    type: string
  }>
}

interface ConfirmDialogProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  description: string
  operation: 'on' | 'off' | 'cycle'
}

function ConfirmDialog({ isOpen, onClose, onConfirm, title, description, operation }: ConfirmDialogProps) {
  if (!isOpen) return null

  const colors = {
    on: { bg: 'bg-green-500/20', border: 'border-green-500/20', text: 'text-green-300', button: 'bg-green-600 hover:bg-green-700' },
    off: { bg: 'bg-red-500/20', border: 'border-red-500/20', text: 'text-red-300', button: 'bg-red-600 hover:bg-red-700' },
    cycle: { bg: 'bg-yellow-500/20', border: 'border-yellow-500/20', text: 'text-yellow-300', button: 'bg-yellow-600 hover:bg-yellow-700' },
  }

  const color = colors[operation]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700 rounded-lg shadow-xl max-w-2xl w-full mx-4 p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-start space-x-3">
            <div className={`p-2 rounded-lg ${color.bg}`}>
              {operation === 'on' && <Power className={`w-6 h-6 ${color.text}`} />}
              {operation === 'off' && <PowerOff className={`w-6 h-6 ${color.text}`} />}
              {operation === 'cycle' && <RefreshCw className={`w-6 h-6 ${color.text}`} />}
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-slate-100">{title}</h3>
              <p className="text-sm text-slate-300 mt-1">{description}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className={`p-3 rounded-lg mb-4 ${color.bg} border ${color.border}`}>
          <p className={`text-sm ${color.text}`}>
            {operation === 'on' && '⚡ This will power on all online Fire TV devices.'}
            {operation === 'off' && '⚠️ This will power off all online Fire TV devices.'}
            {operation === 'cycle' && '🔄 This will restart all online Fire TV devices.'}
          </p>
        </div>

        <div className="flex items-center justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-2 rounded-lg transition-colors text-white ${color.button}`}
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  )
}

export function BulkOperations() {
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<BulkOperationResult | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const [pendingOperation, setPendingOperation] = useState<'on' | 'off' | 'cycle' | null>(null)

  async function executeBulkOperation(operation: 'on' | 'off' | 'cycle') {
    setDialogOpen(false)
    setLoading(true)
    setResults(null)
    setShowResults(false)

    try {
      logger.info(`[BULK OPERATIONS] Starting ${operation} operation`)

      const response = await fetch('/api/bulk-operations/power', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operation,
          deviceTypes: ['all'],
          delay: 500,
        }),
      })

      const data = await response.json()

      if (data.success) {
        setResults(data.data)
        setShowResults(true)

        if (data.data.failed === 0) {
          toast.success(`✅ Successfully ${operation === 'on' ? 'powered on' : operation === 'off' ? 'powered off' : 'restarted'} ${data.data.successful} devices`)
        } else {
          toast.error(`⚠️ ${data.data.successful} succeeded, ${data.data.failed} failed`)
        }

        logger.info(`[BULK OPERATIONS] Operation completed: ${data.data.successful}/${data.data.total} successful`)
      } else {
        toast.error(`Failed: ${data.error}`)
        logger.error('[BULK OPERATIONS] Operation failed:', data.error)
      }
    } catch (error: any) {
      toast.error(`Error: ${error.message}`)
      logger.error('[BULK OPERATIONS] Error executing operation:', error)
    } finally {
      setLoading(false)
    }
  }

  function handleOperationClick(operation: 'on' | 'off' | 'cycle') {
    setPendingOperation(operation)
    setDialogOpen(true)
  }

  function handleConfirm() {
    if (pendingOperation) {
      executeBulkOperation(pendingOperation)
      setPendingOperation(null)
    }
  }

  const dialogTitles = {
    on: 'Power On All Devices',
    off: 'Power Off All Devices',
    cycle: 'Restart All Devices',
  }

  const dialogDescriptions = {
    on: 'Are you sure you want to power on all online devices?',
    off: 'Are you sure you want to power off all online devices? This will turn off all TVs and streaming devices.',
    cycle: 'Are you sure you want to restart all online devices? This may cause brief interruptions.',
  }

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Button
          onClick={() => handleOperationClick('on')}
          disabled={loading}
          variant="outline"
          className="bg-green-600/20 hover:bg-green-600/30 border-green-500/30 text-green-300"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Power className="w-4 h-4 mr-2" />
          )}
          Power On All
        </Button>

        <Button
          onClick={() => handleOperationClick('off')}
          disabled={loading}
          variant="outline"
          className="bg-red-600/20 hover:bg-red-600/30 border-red-500/30 text-red-300"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <PowerOff className="w-4 h-4 mr-2" />
          )}
          Power Off All
        </Button>

        <Button
          onClick={() => handleOperationClick('cycle')}
          disabled={loading}
          variant="outline"
          className="bg-yellow-600/20 hover:bg-yellow-600/30 border-yellow-500/30 text-yellow-300"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4 mr-2" />
          )}
          Restart All
        </Button>
      </div>

      {/* Results Modal */}
      {showResults && results && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-lg shadow-xl max-w-2xl w-full mx-4 p-6 max-h-[80vh] overflow-y-auto">
            <div className="flex items-start justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-100">Bulk Operation Results</h3>
              <button
                onClick={() => setShowResults(false)}
                className="text-slate-400 hover:text-slate-200 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="p-4 bg-slate-800 rounded-lg text-center">
                <div className="text-2xl font-bold text-slate-200">{results.total}</div>
                <div className="text-sm text-slate-400">Total</div>
              </div>
              <div className="p-4 bg-green-500/10 border border-green-500/20 text-green-500 rounded-lg text-center">
                <div className="text-2xl font-bold">{results.successful}</div>
                <div className="text-sm">Successful</div>
              </div>
              <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-500 rounded-lg text-center">
                <div className="text-2xl font-bold">{results.failed}</div>
                <div className="text-sm">Failed</div>
              </div>
            </div>

            {results.failed > 0 && (
              <div className="space-y-2">
                <h4 className="font-semibold text-slate-200">Failed Devices:</h4>
                <div className="max-h-60 overflow-y-auto space-y-1">
                  {results.devices
                    .filter(d => d.status !== 'success')
                    .map(device => (
                      <div key={device.id} className="text-sm p-3 bg-slate-800 rounded border border-red-500/20">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-200 font-medium">{device.name}</span>
                          <span className="text-xs text-slate-400">{device.type}</span>
                        </div>
                        <div className="text-red-400 text-xs mt-1">{device.error || 'Failed'}</div>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {results.successful > 0 && results.failed === 0 && (
              <div className="text-center text-green-400">
                <p className="text-lg font-semibold">All devices updated successfully!</p>
              </div>
            )}

            <div className="mt-6 flex justify-end">
              <Button
                onClick={() => setShowResults(false)}
                variant="outline"
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Dialog */}
      {pendingOperation && (
        <ConfirmDialog
          isOpen={dialogOpen}
          onClose={() => {
            setDialogOpen(false)
            setPendingOperation(null)
          }}
          onConfirm={handleConfirm}
          title={dialogTitles[pendingOperation]}
          description={dialogDescriptions[pendingOperation]}
          operation={pendingOperation}
        />
      )}
    </>
  )
}
