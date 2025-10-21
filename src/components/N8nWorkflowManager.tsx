'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/cards'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Badge } from './ui/badge'
import {
  Workflow,
  Play,
  Pause,
  Trash2,
  Edit3,
  Plus,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Settings,
  Copy,
  Eye,
  Clock,
  Activity,
  Database,
  Zap
} from 'lucide-react'

interface N8nConnection {
  id?: string
  name: string
  url: string
  apiKey: string
  isActive: boolean
}

interface N8nWorkflow {
  id: string
  name: string
  active: boolean
  tags?: string[]
  createdAt: string
  updatedAt: string
  nodes?: number
}

export default function N8nWorkflowManager() {
  const [connections, setConnections] = useState<N8nConnection[]>([])
  const [selectedConnection, setSelectedConnection] = useState<N8nConnection | null>(null)
  const [workflows, setWorkflows] = useState<N8nWorkflow[]>([])
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null)
  const [showAddConnection, setShowAddConnection] = useState(false)
  const [newConnection, setNewConnection] = useState<N8nConnection>({
    name: '',
    url: '',
    apiKey: '',
    isActive: true
  })

  useEffect(() => {
    fetchConnections()
  }, [])

  useEffect(() => {
    if (selectedConnection) {
      fetchWorkflows(selectedConnection)
    }
  }, [selectedConnection])

  const showMessage = (text: string, type: 'success' | 'error' = 'success') => {
    setMessage({ text, type })
    setTimeout(() => setMessage(null), 5000)
  }

  const fetchConnections = async () => {
    try {
      const response = await fetch('/api/n8n/connections')
      if (response.ok) {
        const data = await response.json()
        setConnections(data.connections || [])
        if (data.connections?.length > 0) {
          setSelectedConnection(data.connections[0])
        }
      }
    } catch (error) {
      console.error('Error fetching n8n connections:', error)
      showMessage('Failed to fetch n8n connections', 'error')
    }
  }

  const fetchWorkflows = async (connection: N8nConnection) => {
    setLoading(true)
    try {
      const response = await fetch(`/api/n8n/workflows?connectionId=${connection.id}`)
      if (response.ok) {
        const data = await response.json()
        setWorkflows(data.workflows || [])
      } else {
        showMessage('Failed to fetch workflows', 'error')
      }
    } catch (error) {
      console.error('Error fetching workflows:', error)
      showMessage('Failed to fetch workflows', 'error')
    } finally {
      setLoading(false)
    }
  }

  const addConnection = async () => {
    try {
      const response = await fetch('/api/n8n/connections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newConnection)
      })

      if (response.ok) {
        const data = await response.json()
        await fetchConnections()
        setNewConnection({
          name: '',
          url: '',
          apiKey: '',
          isActive: true
        })
        setShowAddConnection(false)
        showMessage(`Connection "${data.connection.name}" added successfully`)
      } else {
        const error = await response.json()
        showMessage(error.error || 'Failed to add connection', 'error')
      }
    } catch (error) {
      console.error('Error adding connection:', error)
      showMessage('Failed to add connection', 'error')
    }
  }

  const deleteConnection = async (connectionId: string) => {
    if (!confirm('Are you sure you want to delete this connection?')) return

    try {
      const response = await fetch(`/api/n8n/connections?id=${connectionId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        await fetchConnections()
        if (selectedConnection?.id === connectionId) {
          setSelectedConnection(null)
        }
        showMessage('Connection deleted successfully')
      } else {
        const error = await response.json()
        showMessage(error.error || 'Failed to delete connection', 'error')
      }
    } catch (error) {
      console.error('Error deleting connection:', error)
      showMessage('Failed to delete connection', 'error')
    }
  }

  const testConnection = async (connection: N8nConnection) => {
    try {
      showMessage('Testing connection...', 'success')
      const response = await fetch('/api/n8n/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connectionId: connection.id })
      })

      const result = await response.json()
      if (result.success) {
        showMessage('✓ Connected to n8n successfully')
      } else {
        showMessage(result.error || 'Connection test failed', 'error')
      }
    } catch (error) {
      console.error('Error testing connection:', error)
      showMessage('Failed to test connection', 'error')
    }
  }

  const toggleWorkflow = async (workflowId: string, active: boolean) => {
    try {
      const response = await fetch('/api/n8n/workflows/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          connectionId: selectedConnection?.id,
          workflowId,
          active
        })
      })

      if (response.ok) {
        showMessage(`Workflow ${active ? 'activated' : 'deactivated'} successfully`)
        if (selectedConnection) {
          await fetchWorkflows(selectedConnection)
        }
      } else {
        const error = await response.json()
        showMessage(error.error || 'Failed to toggle workflow', 'error')
      }
    } catch (error) {
      console.error('Error toggling workflow:', error)
      showMessage('Failed to toggle workflow', 'error')
    }
  }

  const executeWorkflow = async (workflowId: string) => {
    try {
      showMessage('Executing workflow...', 'success')
      const response = await fetch('/api/n8n/workflows/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          connectionId: selectedConnection?.id,
          workflowId
        })
      })

      if (response.ok) {
        showMessage('✓ Workflow executed successfully')
      } else {
        const error = await response.json()
        showMessage(error.error || 'Failed to execute workflow', 'error')
      }
    } catch (error) {
      console.error('Error executing workflow:', error)
      showMessage('Failed to execute workflow', 'error')
    }
  }

  return (
    <div className="space-y-6">
      {/* Message Display */}
      {message && (
        <div className={`flex items-center gap-3 p-4 rounded-xl border-l-4 ${
          message.type === 'success' 
            ? 'bg-emerald-50 border-emerald-400 text-emerald-800' 
            : 'bg-red-50 border-red-400 text-red-800'
        }`}>
          {message.type === 'success' ? (
            <CheckCircle className="h-5 w-5 text-emerald-600" />
          ) : (
            <AlertCircle className="h-5 w-5 text-red-600" />
          )}
          <span className="font-medium">{message.text}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold text-slate-100 flex items-center gap-3">
            <div className="p-2 bg-purple-900/30 rounded-xl">
              <Workflow className="h-6 w-6 text-purple-400" />
            </div>
            n8n Workflow Automation
          </h2>
          <p className="text-gray-600">
            Connect and manage n8n workflows for data conversions and automation
          </p>
        </div>
        <Button
          onClick={() => setShowAddConnection(true)}
          className="bg-purple-400 hover:bg-purple-300 text-white"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Connection
        </Button>
      </div>

      {/* Add Connection Form */}
      {showAddConnection && (
        <Card className="border-2 border-purple-800/40 bg-purple-900/20">
          <CardHeader>
            <div className="flex justify-between items-start">
              <div className="space-y-1">
                <CardTitle className="text-purple-100 flex items-center gap-2">
                  <Plus className="h-5 w-5" />
                  Add n8n Connection
                </CardTitle>
                <CardDescription>
                  Configure connection to your n8n instance
                </CardDescription>
              </div>
              <Button
                onClick={() => {
                  setShowAddConnection(false)
                  setNewConnection({
                    name: '',
                    url: '',
                    apiKey: '',
                    isActive: true
                  })
                }}
                variant="ghost"
                size="sm"
                className="text-slate-400 hover:text-slate-200"
              >
                ✕
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-100">Connection Name *</label>
              <Input
                value={newConnection.name}
                onChange={(e) => setNewConnection({ ...newConnection, name: e.target.value })}
                placeholder="e.g., Main n8n Instance"
                className="border-slate-700 focus:border-purple-500"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-100">n8n URL *</label>
              <Input
                value={newConnection.url}
                onChange={(e) => setNewConnection({ ...newConnection, url: e.target.value })}
                placeholder="https://n8n.example.com"
                className="border-slate-700 focus:border-purple-500"
              />
              <p className="text-xs text-slate-400">URL of your n8n instance (include http:// or https://)</p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-100">API Key *</label>
              <Input
                type="password"
                value={newConnection.apiKey}
                onChange={(e) => setNewConnection({ ...newConnection, apiKey: e.target.value })}
                placeholder="n8n API key"
                className="border-slate-700 focus:border-purple-500"
              />
              <p className="text-xs text-slate-400">
                Generate an API key in n8n Settings → API
              </p>
            </div>
            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button
                onClick={() => {
                  setShowAddConnection(false)
                  setNewConnection({
                    name: '',
                    url: '',
                    apiKey: '',
                    isActive: true
                  })
                }}
                variant="outline"
              >
                Cancel
              </Button>
              <Button
                onClick={addConnection}
                disabled={!newConnection.name || !newConnection.url || !newConnection.apiKey}
                className="bg-purple-400 hover:bg-purple-300 text-white"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Connection
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Connections */}
      {connections.length === 0 ? (
        <Card className="border-2 border-dashed border-slate-700">
          <CardContent className="text-center py-12">
            <div className="mx-auto w-24 h-24 bg-slate-800 rounded-full flex items-center justify-center mb-4">
              <Workflow className="h-12 w-12 text-slate-500" />
            </div>
            <h3 className="text-xl font-semibold text-slate-100 mb-2">No n8n Connections</h3>
            <p className="text-gray-600 mb-6 max-w-sm mx-auto">
              Add an n8n connection to start managing workflows and automation
            </p>
            <Button
              onClick={() => setShowAddConnection(true)}
              className="bg-purple-400 hover:bg-purple-300"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Your First Connection
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Connections List */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Connections</CardTitle>
                <CardDescription>Manage your n8n instances</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {connections.map((conn) => (
                  <div
                    key={conn.id}
                    className={`p-3 rounded-lg cursor-pointer transition-all ${
                      selectedConnection?.id === conn.id
                        ? 'bg-purple-900/40 border-2 border-purple-400'
                        : 'bg-slate-800/50 border-2 border-slate-700 hover:border-slate-600'
                    }`}
                    onClick={() => setSelectedConnection(conn)}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <h4 className="font-semibold text-slate-100">{conn.name}</h4>
                        <p className="text-xs text-slate-400 truncate">{conn.url}</p>
                      </div>
                      <Badge variant={conn.isActive ? 'default' : 'secondary'} className={
                        conn.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-700 text-slate-200'
                      }>
                        {conn.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        onClick={(e) => {
                          e.stopPropagation()
                          testConnection(conn)
                        }}
                        variant="outline"
                        size="sm"
                        className="text-xs"
                      >
                        <Zap className="h-3 w-3 mr-1" />
                        Test
                      </Button>
                      <Button
                        onClick={(e) => {
                          e.stopPropagation()
                          deleteConnection(conn.id!)
                        }}
                        variant="outline"
                        size="sm"
                        className="text-xs text-red-400 hover:text-red-300"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* Workflows */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">Workflows</CardTitle>
                    <CardDescription>
                      {selectedConnection?.name} workflows
                    </CardDescription>
                  </div>
                  <Button
                    onClick={() => selectedConnection && fetchWorkflows(selectedConnection)}
                    variant="outline"
                    size="sm"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
                  </div>
                ) : workflows.length === 0 ? (
                  <div className="text-center py-12">
                    <Workflow className="h-12 w-12 text-slate-500 mx-auto mb-4" />
                    <p className="text-gray-600">No workflows found</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {workflows.map((workflow) => (
                      <div
                        key={workflow.id}
                        className="p-4 rounded-lg bg-slate-800/50 border border-slate-700"
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <h4 className="font-semibold text-slate-100 mb-1">{workflow.name}</h4>
                            <div className="flex items-center gap-2 text-xs text-slate-400">
                              <Clock className="h-3 w-3" />
                              Updated {new Date(workflow.updatedAt).toLocaleDateString()}
                              {workflow.nodes && (
                                <>
                                  <span>•</span>
                                  <Database className="h-3 w-3" />
                                  {workflow.nodes} nodes
                                </>
                              )}
                            </div>
                          </div>
                          <Badge variant={workflow.active ? 'default' : 'secondary'} className={
                            workflow.active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-700 text-slate-200'
                          }>
                            {workflow.active ? 'Active' : 'Inactive'}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            onClick={() => toggleWorkflow(workflow.id, !workflow.active)}
                            variant="outline"
                            size="sm"
                            className="text-xs"
                          >
                            {workflow.active ? (
                              <>
                                <Pause className="h-3 w-3 mr-1" />
                                Deactivate
                              </>
                            ) : (
                              <>
                                <Play className="h-3 w-3 mr-1" />
                                Activate
                              </>
                            )}
                          </Button>
                          <Button
                            onClick={() => executeWorkflow(workflow.id)}
                            variant="outline"
                            size="sm"
                            className="text-xs"
                          >
                            <Play className="h-3 w-3 mr-1" />
                            Execute
                          </Button>
                          <Button
                            onClick={() => window.open(`${selectedConnection?.url}/workflow/${workflow.id}`, '_blank')}
                            variant="outline"
                            size="sm"
                            className="text-xs"
                          >
                            <Eye className="h-3 w-3 mr-1" />
                            View
                          </Button>
                        </div>
                        {workflow.tags && workflow.tags.length > 0 && (
                          <div className="flex items-center gap-2 mt-3 flex-wrap">
                            {workflow.tags.map((tag, idx) => (
                              <Badge key={idx} variant="outline" className="text-xs">
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  )
}
