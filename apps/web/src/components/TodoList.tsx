
'use client'

import { useState, useEffect } from 'react'
import { CheckCircle, Circle, Clock, AlertCircle, Filter, Search, Plus } from 'lucide-react'

import { logger } from '@sports-bar/logger'
interface Todo {
  id: string
  title: string
  description?: string
  priority: string
  status: string
  category?: string
  tags?: string
  createdAt: string
  updatedAt: string
  completedAt?: string
  documents: any[]
}

interface TodoListProps {
  onSelectTodo: (todo: Todo) => void
  onNewTodo: () => void
  refreshTrigger?: number
}

const PRIORITY_COLORS = {
  LOW: 'text-blue-400',
  MEDIUM: 'text-yellow-400',
  HIGH: 'text-orange-400',
  CRITICAL: 'text-red-400'
}

const STATUS_ICONS = {
  PLANNED: Circle,
  IN_PROGRESS: Clock,
  TESTING: AlertCircle,
  COMPLETE: CheckCircle
}

const STATUS_COLORS = {
  PLANNED: 'text-slate-400',
  IN_PROGRESS: 'text-blue-400',
  TESTING: 'text-yellow-400',
  COMPLETE: 'text-green-400'
}

export default function TodoList({ onSelectTodo, onNewTodo, refreshTrigger }: TodoListProps) {
  const [todos, setTodos] = useState<Todo[]>([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [filterPriority, setFilterPriority] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    loadTodos()
  }, [refreshTrigger])

  const loadTodos = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (filterStatus !== 'all') params.append('status', filterStatus)
      if (filterPriority !== 'all') params.append('priority', filterPriority)

      const response = await fetch(`/api/todos?${params.toString()}`)
      const result = await response.json()

      if (result.success) {
        setTodos(result.data)
      }
    } catch (error) {
      logger.error('Error loading todos:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredTodos = todos.filter(todo => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      return (
        todo.title.toLowerCase().includes(query) ||
        todo.description?.toLowerCase().includes(query) ||
        todo.category?.toLowerCase().includes(query)
      )
    }
    return true
  })

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-slate-100">TODO List</h2>
        <button
          onClick={onNewTodo}
          className="inline-flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 transition-colors"
        >
          <Plus className="w-5 h-5" />
          <span>New TODO</span>
        </button>
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-200 mb-2">
              <Search className="w-4 h-4 inline mr-2" />
              Search
            </label>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search todos..."
              className="w-full px-4 py-2 bg-sportsBar-800 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-200 mb-2">
              <Filter className="w-4 h-4 inline mr-2" />
              Status
            </label>
            <select
              value={filterStatus}
              onChange={(e) => {
                setFilterStatus(e.target.value)
                loadTodos()
              }}
              className="w-full px-4 py-2 bg-sportsBar-800 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Status</option>
              <option value="PLANNED">Planned</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="TESTING">Testing</option>
              <option value="COMPLETE">Complete</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-200 mb-2">
              <Filter className="w-4 h-4 inline mr-2" />
              Priority
            </label>
            <select
              value={filterPriority}
              onChange={(e) => {
                setFilterPriority(e.target.value)
                loadTodos()
              }}
              className="w-full px-4 py-2 bg-sportsBar-800 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Priorities</option>
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="CRITICAL">Critical</option>
            </select>
          </div>
        </div>
      </div>

      {/* Todo List */}
      <div className="space-y-3">
        {loading ? (
          <div className="card p-8 text-center text-slate-400">
            Loading todos...
          </div>
        ) : filteredTodos.length === 0 ? (
          <div className="card p-8 text-center text-slate-400">
            No todos found. Create your first TODO!
          </div>
        ) : (
          filteredTodos.map((todo) => {
            const StatusIcon = STATUS_ICONS[todo.status as keyof typeof STATUS_ICONS]
            return (
              <div
                key={todo.id}
                onClick={() => onSelectTodo(todo)}
                className="card p-4 hover:bg-sportsBar-700/50 cursor-pointer transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-3 flex-1">
                    <StatusIcon className={`w-6 h-6 mt-1 ${STATUS_COLORS[todo.status as keyof typeof STATUS_COLORS]}`} />
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-slate-100">{todo.title}</h3>
                      {todo.description && (
                        <p className="text-sm text-slate-300 mt-1 line-clamp-2">{todo.description}</p>
                      )}
                      <div className="flex items-center space-x-4 mt-2">
                        <span className={`text-xs font-medium ${PRIORITY_COLORS[todo.priority as keyof typeof PRIORITY_COLORS]}`}>
                          {todo.priority}
                        </span>
                        <span className="text-xs text-slate-400">
                          {todo.status.replace('_', ' ')}
                        </span>
                        {todo.category && (
                          <span className="text-xs text-slate-400">
                            {todo.category}
                          </span>
                        )}
                        {todo.documents.length > 0 && (
                          <span className="text-xs text-blue-400">
                            {todo.documents.length} document{todo.documents.length !== 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="text-xs text-slate-400 ml-4">
                    {new Date(todo.createdAt).toLocaleDateString()}
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
