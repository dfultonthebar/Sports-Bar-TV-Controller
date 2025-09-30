
'use client'

import { useState, useEffect } from 'react'
import { Button } from './ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/cards'
import { Badge } from './ui/badge'
import { 
  Download, 
  Upload, 
  RefreshCw, 
  GitBranch, 
  GitCommit, 
  AlertTriangle,
  CheckCircle,
  Clock,
  FileText
} from 'lucide-react'

interface GitStatus {
  branch: string
  ahead: number
  behind: number
  modified: string[]
  untracked: string[]
  staged: string[]
  isClean: boolean
  lastCommit: {
    hash: string
    message: string
    author: string
    date: string
  }
}

interface GitOperation {
  type: 'pull' | 'push' | 'status' | 'commit'
  status: 'idle' | 'loading' | 'success' | 'error'
  message?: string
}

export default function GitHubSync() {
  const [gitStatus, setGitStatus] = useState<GitStatus | null>(null)
  const [operation, setOperation] = useState<GitOperation>({ type: 'status', status: 'idle' })
  const [commitMessage, setCommitMessage] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetchGitStatus()
  }, [])

  const fetchGitStatus = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/git/status')
      const data = await response.json()
      if (data.success) {
        setGitStatus(data.status)
        setOperation({ type: 'status', status: 'success' })
      } else {
        setOperation({ type: 'status', status: 'error', message: data.error })
      }
    } catch (error) {
      setOperation({ type: 'status', status: 'error', message: 'Failed to fetch git status' })
    } finally {
      setLoading(false)
    }
  }

  const pullFromGitHub = async () => {
    setOperation({ type: 'pull', status: 'loading' })
    try {
      const response = await fetch('/api/git/pull', { method: 'POST' })
      const data = await response.json()
      
      if (data.success) {
        setOperation({ type: 'pull', status: 'success', message: data.message })
        await fetchGitStatus() // Refresh status after pull
      } else {
        setOperation({ type: 'pull', status: 'error', message: data.error })
      }
    } catch (error) {
      setOperation({ type: 'pull', status: 'error', message: 'Failed to pull from GitHub' })
    }
  }

  const commitAndPush = async () => {
    if (!commitMessage.trim()) {
      setOperation({ type: 'push', status: 'error', message: 'Please enter a commit message' })
      return
    }

    setOperation({ type: 'push', status: 'loading' })
    try {
      const response = await fetch('/api/git/commit-push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: commitMessage })
      })
      const data = await response.json()
      
      if (data.success) {
        setOperation({ type: 'push', status: 'success', message: data.message })
        setCommitMessage('')
        await fetchGitStatus() // Refresh status after push
      } else {
        setOperation({ type: 'push', status: 'error', message: data.error })
      }
    } catch (error) {
      setOperation({ type: 'push', status: 'error', message: 'Failed to commit and push to GitHub' })
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'loading': return <RefreshCw className="w-4 h-4 animate-spin" />
      case 'success': return <CheckCircle className="w-4 h-4 text-green-500" />
      case 'error': return <AlertTriangle className="w-4 h-4 text-red-500" />
      default: return null
    }
  }

  const getStatusColor = (hasChanges: boolean) => {
    return hasChanges ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">GitHub Synchronization</h2>
          <p className="text-gray-600">Manage your local repository sync with GitHub</p>
        </div>
        <Button 
          onClick={fetchGitStatus} 
          disabled={loading}
          variant="outline"
          className="flex items-center space-x-2"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </Button>
      </div>

      {/* Current Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <GitBranch className="w-5 h-5" />
            <span>Repository Status</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {gitStatus ? (
            <div className="space-y-4">
              {/* Branch Info */}
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Badge variant="secondary">{gitStatus.branch}</Badge>
                  <Badge className={getStatusColor(!gitStatus.isClean)}>
                    {gitStatus.isClean ? 'Clean' : 'Has Changes'}
                  </Badge>
                </div>
                <div className="flex items-center space-x-4 text-sm text-gray-600">
                  {gitStatus.ahead > 0 && (
                    <span className="flex items-center space-x-1">
                      <Upload className="w-3 h-3" />
                      <span>{gitStatus.ahead} ahead</span>
                    </span>
                  )}
                  {gitStatus.behind > 0 && (
                    <span className="flex items-center space-x-1">
                      <Download className="w-3 h-3" />
                      <span>{gitStatus.behind} behind</span>
                    </span>
                  )}
                </div>
              </div>

              {/* Last Commit */}
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="flex items-center space-x-2 mb-2">
                  <GitCommit className="w-4 h-4" />
                  <span className="font-medium">Last Commit</span>
                </div>
                <div className="text-sm space-y-1">
                  <p className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">
                    {gitStatus.lastCommit.hash.substring(0, 8)}
                  </p>
                  <p>{gitStatus.lastCommit.message}</p>
                  <p className="text-gray-500">
                    by {gitStatus.lastCommit.author} • {new Date(gitStatus.lastCommit.date).toLocaleString()}
                  </p>
                </div>
              </div>

              {/* File Changes */}
              {!gitStatus.isClean && (
                <div className="space-y-3">
                  {gitStatus.modified.length > 0 && (
                    <div>
                      <h4 className="font-medium text-orange-700 mb-2">Modified Files</h4>
                      <div className="space-y-1">
                        {gitStatus.modified.map((file, index) => (
                          <div key={index} className="flex items-center space-x-2 text-sm">
                            <FileText className="w-3 h-3 text-orange-500" />
                            <span className="font-mono">{file}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {gitStatus.untracked.length > 0 && (
                    <div>
                      <h4 className="font-medium text-blue-700 mb-2">Untracked Files</h4>
                      <div className="space-y-1">
                        {gitStatus.untracked.map((file, index) => (
                          <div key={index} className="flex items-center space-x-2 text-sm">
                            <FileText className="w-3 h-3 text-blue-500" />
                            <span className="font-mono">{file}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center space-x-2 text-gray-500">
              <Clock className="w-4 h-4" />
              <span>Loading repository status...</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Pull from GitHub */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Download className="w-5 h-5 text-green-600" />
              <span>Pull from GitHub</span>
            </CardTitle>
            <CardDescription>
              Download the latest changes from the GitHub repository
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button 
              onClick={pullFromGitHub}
              disabled={operation.type === 'pull' && operation.status === 'loading'}
              className="w-full"
              size="lg"
            >
              {operation.type === 'pull' && operation.status === 'loading' ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Pulling...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4 mr-2" />
                  Pull Latest
                </>
              )}
            </Button>
            
            {operation.type === 'pull' && operation.message && (
              <div className={`flex items-center space-x-2 p-3 rounded-lg ${
                operation.status === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
              }`}>
                {getStatusIcon(operation.status)}
                <span className="text-sm">{operation.message}</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Push to GitHub */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Upload className="w-5 h-5 text-blue-600" />
              <span>Push to GitHub</span>
            </CardTitle>
            <CardDescription>
              Upload your local changes to the GitHub repository
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label htmlFor="commit-message" className="block text-sm font-medium text-gray-700 mb-2">
                Commit Message
              </label>
              <textarea
                id="commit-message"
                value={commitMessage}
                onChange={(e) => setCommitMessage(e.target.value)}
                placeholder="Describe your changes..."
                className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                rows={3}
              />
            </div>
            
            <Button 
              onClick={commitAndPush}
              disabled={!commitMessage.trim() || (operation.type === 'push' && operation.status === 'loading') || gitStatus?.isClean}
              className="w-full"
              size="lg"
            >
              {operation.type === 'push' && operation.status === 'loading' ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Committing...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  Commit & Push
                </>
              )}
            </Button>
            
            {operation.type === 'push' && operation.message && (
              <div className={`flex items-center space-x-2 p-3 rounded-lg ${
                operation.status === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
              }`}>
                {getStatusIcon(operation.status)}
                <span className="text-sm">{operation.message}</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
