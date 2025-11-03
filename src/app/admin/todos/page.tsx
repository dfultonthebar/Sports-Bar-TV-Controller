
'use client'

import { useState } from 'react'
import SportsBarHeader from '@/components/SportsBarHeader'
import SportsBarLayout from '@/components/SportsBarLayout'
import TodoList from '@/components/TodoList'
import TodoForm from '@/components/TodoForm'
import TodoDetails from '@/components/TodoDetails'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'

import { logger } from '@/lib/logger'
type View = 'list' | 'form' | 'details'

export default function TodosPage() {
  const [view, setView] = useState<View>('list')
  const [selectedTodo, setSelectedTodo] = useState<any>(null)
  const [refreshTrigger, setRefreshTrigger] = useState(0)

  const handleSelectTodo = (todo: any) => {
    setSelectedTodo(todo)
    setView('details')
  }

  const handleNewTodo = () => {
    setSelectedTodo(null)
    setView('form')
  }

  const handleEdit = () => {
    setView('form')
  }

  const handleSave = () => {
    setView('list')
    setSelectedTodo(null)
    setRefreshTrigger(prev => prev + 1)
  }

  const handleCancel = () => {
    setView('list')
    setSelectedTodo(null)
  }

  const handleDelete = async () => {
    if (!selectedTodo) return

    if (confirm('Are you sure you want to delete this TODO?')) {
      try {
        const response = await fetch(`/api/todos/${selectedTodo.id}`, {
          method: 'DELETE'
        })

        const result = await response.json()
        if (result.success) {
          setView('list')
          setSelectedTodo(null)
          setRefreshTrigger(prev => prev + 1)
        }
      } catch (error) {
        logger.error('Error deleting todo:', error)
        alert('Failed to delete TODO')
      }
    }
  }

  const handleClose = () => {
    setView('list')
    setSelectedTodo(null)
  }

  return (
    <SportsBarLayout>
      <div className="min-h-screen bg-gradient-to-br from-sportsBar-900 via-sportsBar-800 to-sportsBar-900">
        <SportsBarHeader />
        
        <main className="container mx-auto px-4 py-8">
          {/* Back Button */}
          <div className="mb-6">
            <Link
              href="/admin"
              className="inline-flex items-center space-x-2 text-slate-300 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              <span>Back to Admin</span>
            </Link>
          </div>

          {/* Content */}
          <div className="max-w-6xl mx-auto">
            {view === 'list' && (
              <TodoList
                onSelectTodo={handleSelectTodo}
                onNewTodo={handleNewTodo}
                refreshTrigger={refreshTrigger}
              />
            )}

            {view === 'form' && (
              <div className="card p-6">
                <TodoForm
                  todo={selectedTodo}
                  onSave={handleSave}
                  onCancel={handleCancel}
                />
              </div>
            )}

            {view === 'details' && selectedTodo && (
              <TodoDetails
                todoId={selectedTodo.id}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onClose={handleClose}
                refreshTrigger={refreshTrigger}
              />
            )}
          </div>
        </main>
      </div>
    </SportsBarLayout>
  )
}
