
'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from './ui/cards'
import { Button } from './ui/button'
import { Textarea } from './ui/textarea'
import { Input } from './ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import { Badge } from './ui/badge'
import { 
  Folder, 
  File, 
  Play, 
  Save, 
  Terminal, 
  FolderTree,
  Download,
  Upload,
  Trash2,
  Plus
} from 'lucide-react'

interface FileItem {
  name: string
  path: string
  type: 'file' | 'directory'
  size?: number
  modified?: string
  permissions?: string
}

interface ExecutionResult {
  success: boolean
  stdout: string
  stderr: string
  command?: string
  error?: string
}

export default function FileSystemManager() {
  const [currentDirectory, setCurrentDirectory] = useState('/home/ubuntu/Sports-Bar-TV-Controller')
  const [directoryItems, setDirectoryItems] = useState<FileItem[]>([])
  const [directoryTree, setDirectoryTree] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(false)
  
  // Script creation
  const [scriptName, setScriptName] = useState('')
  const [scriptContent, setScriptContent] = useState('')
  const [scriptType, setScriptType] = useState<'bash' | 'python' | 'javascript' | 'powershell' | 'config'>('bash')
  
  // Command execution
  const [command, setCommand] = useState('')
  const [executionResult, setExecutionResult] = useState<ExecutionResult | null>(null)
  
  // File operations
  const [newFileName, setNewFileName] = useState('')
  const [newFileContent, setNewFileContent] = useState('')
  const [selectedFile, setSelectedFile] = useState<string | null>(null)

  const loadDirectory = async (directory?: string) => {
    setIsLoading(true)
    try {
      const dir = directory || currentDirectory
      const response = await fetch(`/api/file-system/manage?directory=${encodeURIComponent(dir)}&action=list`)
      const data = await response.json()
      
      if (response.ok) {
        setDirectoryItems(data.items)
        setCurrentDirectory(data.directory)
      } else {
        console.error('Failed to load directory:', data.error)
      }
    } catch (error) {
      console.error('Error loading directory:', error)
    }
    setIsLoading(false)
  }

  const loadDirectoryTree = async () => {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/file-system/manage?directory=${encodeURIComponent(currentDirectory)}&action=tree`)
      const data = await response.json()
      
      if (response.ok) {
        setDirectoryTree(data)
      } else {
        console.error('Failed to load directory tree:', data.error)
      }
    } catch (error) {
      console.error('Error loading directory tree:', error)
    }
    setIsLoading(false)
  }

  const createScript = async () => {
    if (!scriptName || !scriptContent) return

    setIsLoading(true)
    try {
      const response = await fetch('/api/file-system/write-script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scriptName,
          content: scriptContent,
          scriptType,
          directory: 'scripts',
          makeExecutable: true
        }),
      })

      const data = await response.json()
      
      if (response.ok) {
        alert(`Script created successfully at: ${data.filePath}`)
        setScriptName('')
        setScriptContent('')
        loadDirectory() // Refresh directory listing
      } else {
        alert(`Error creating script: ${data.error}`)
      }
    } catch (error) {
      console.error('Error creating script:', error)
      alert('Failed to create script')
    }
    setIsLoading(false)
  }

  const executeCommand = async () => {
    if (!command) return

    setIsLoading(true)
    try {
      const response = await fetch('/api/file-system/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          command,
          workingDirectory: currentDirectory,
          timeout: 30000
        }),
      })

      const data = await response.json()
      setExecutionResult(data)
    } catch (error) {
      console.error('Error executing command:', error)
      setExecutionResult({
        success: false,
        stdout: '',
        stderr: '',
        error: 'Failed to execute command'
      })
    }
    setIsLoading(false)
  }

  const executeScript = async (scriptPath: string) => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/file-system/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scriptPath: scriptPath.replace(currentDirectory + '/', ''),
          workingDirectory: currentDirectory
        }),
      })

      const data = await response.json()
      setExecutionResult(data)
    } catch (error) {
      console.error('Error executing script:', error)
      setExecutionResult({
        success: false,
        stdout: '',
        stderr: '',
        error: 'Failed to execute script'
      })
    }
    setIsLoading(false)
  }

  const createFile = async () => {
    if (!newFileName) return

    setIsLoading(true)
    try {
      const response = await fetch('/api/file-system/manage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create-file',
          path: `${currentDirectory}/${newFileName}`,
          content: newFileContent
        }),
      })

      const data = await response.json()
      
      if (response.ok) {
        alert(`File created: ${newFileName}`)
        setNewFileName('')
        setNewFileContent('')
        loadDirectory()
      } else {
        alert(`Error creating file: ${data.error}`)
      }
    } catch (error) {
      console.error('Error creating file:', error)
    }
    setIsLoading(false)
  }

  const deleteItem = async (itemPath: string) => {
    if (!confirm(`Are you sure you want to delete ${itemPath}?`)) return

    setIsLoading(true)
    try {
      const response = await fetch('/api/file-system/manage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'delete',
          path: itemPath
        }),
      })

      const data = await response.json()
      
      if (response.ok) {
        alert(`Deleted: ${itemPath}`)
        loadDirectory()
      } else {
        alert(`Error deleting: ${data.error}`)
      }
    } catch (error) {
      console.error('Error deleting:', error)
    }
    setIsLoading(false)
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="text-xl font-semibold text-gray-900 mb-2">
          File System Manager
        </h3>
        <p className="text-gray-600">
          Create scripts, execute commands, and manage files on the server
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Script Creator */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Save className="w-5 h-5" />
              Script Creator
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Input
                placeholder="Script name"
                value={scriptName}
                onChange={(e) => setScriptName(e.target.value)}
              />
              <Select value={scriptType} onValueChange={(value: any) => setScriptType(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bash">Bash Script (.sh)</SelectItem>
                  <SelectItem value="python">Python (.py)</SelectItem>
                  <SelectItem value="javascript">JavaScript (.js)</SelectItem>
                  <SelectItem value="powershell">PowerShell (.ps1)</SelectItem>
                  <SelectItem value="config">Configuration (.conf)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <Textarea
              placeholder="Enter script content..."
              value={scriptContent}
              onChange={(e) => setScriptContent(e.target.value)}
              className="min-h-[200px] font-mono text-sm"
            />
            
            <Button
              onClick={createScript}
              disabled={isLoading || !scriptName || !scriptContent}
              className="w-full"
            >
              <Save className="w-4 h-4 mr-2" />
              Create Script
            </Button>
          </CardContent>
        </Card>

        {/* Command Executor */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Terminal className="w-5 h-5" />
              Command Executor
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Input
                placeholder="Enter command to execute..."
                value={command}
                onChange={(e) => setCommand(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && executeCommand()}
              />
              <div className="text-sm text-gray-600">
                Working Directory: <code>{currentDirectory}</code>
              </div>
            </div>
            
            <Button
              onClick={executeCommand}
              disabled={isLoading || !command}
              className="w-full"
            >
              <Play className="w-4 h-4 mr-2" />
              Execute Command
            </Button>

            {executionResult && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Badge variant={executionResult.success ? 'default' : 'destructive'}>
                    {executionResult.success ? 'Success' : 'Error'}
                  </Badge>
                </div>
                
                {executionResult.stdout && (
                  <div>
                    <div className="text-sm font-medium mb-1">Output:</div>
                    <pre className="bg-gray-100 p-2 rounded text-xs overflow-auto max-h-32">
                      {executionResult.stdout}
                    </pre>
                  </div>
                )}
                
                {executionResult.stderr && (
                  <div>
                    <div className="text-sm font-medium mb-1">Errors:</div>
                    <pre className="bg-red-50 p-2 rounded text-xs overflow-auto max-h-32 text-red-700">
                      {executionResult.stderr}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* File Browser */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Folder className="w-5 h-5" />
            File Browser
          </CardTitle>
          <div className="flex gap-2 mt-2">
            <Button variant="outline" size="sm" onClick={() => loadDirectory()}>
              <Folder className="w-4 h-4 mr-2" />
              Refresh
            </Button>
            <Button variant="outline" size="sm" onClick={loadDirectoryTree}>
              <FolderTree className="w-4 h-4 mr-2" />
              Tree View
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-sm bg-gray-100 p-2 rounded">
            Current Directory: <code>{currentDirectory}</code>
          </div>

          {/* Quick File Creator */}
          <div className="border rounded p-4 space-y-2">
            <div className="text-sm font-medium">Quick File Creator</div>
            <div className="flex gap-2">
              <Input
                placeholder="Filename"
                value={newFileName}
                onChange={(e) => setNewFileName(e.target.value)}
                className="flex-1"
              />
              <Button 
                size="sm" 
                onClick={createFile}
                disabled={!newFileName}
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            {newFileName && (
              <Textarea
                placeholder="File content (optional)"
                value={newFileContent}
                onChange={(e) => setNewFileContent(e.target.value)}
                className="text-sm"
                rows={3}
              />
            )}
          </div>

          {/* Directory Items */}
          {directoryItems.length > 0 && (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {directoryItems.map((item, index) => (
                <div
                  key={index}
                  className="flex items-center gap-2 p-2 border rounded hover:bg-gray-50"
                >
                  {item.type === 'directory' ? (
                    <Folder className="w-4 h-4 text-blue-500" />
                  ) : (
                    <File className="w-4 h-4 text-gray-500" />
                  )}
                  
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{item.name}</div>
                    <div className="text-xs text-gray-500">
                      {item.size && `${(item.size / 1024).toFixed(1)} KB`}
                      {item.modified && ` • Modified: ${new Date(item.modified).toLocaleString()}`}
                    </div>
                  </div>
                  
                  <div className="flex gap-1">
                    {item.type === 'directory' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => loadDirectory(item.path)}
                      >
                        Open
                      </Button>
                    )}
                    
                    {item.name.match(/\.(sh|py|js)$/) && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => executeScript(item.path)}
                      >
                        <Play className="w-3 h-3" />
                      </Button>
                    )}
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => deleteItem(item.path)}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {isLoading && (
            <div className="text-center py-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
