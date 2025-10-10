
'use client'

import { useState, useEffect } from 'react'
import { 
  Edit, 
  Trash2, 
  CheckCircle, 
  Upload, 
  Download, 
  X,
  FileText,
  AlertCircle
} from 'lucide-react'

interface TodoDetailsProps {
  todoId: string
  onEdit: () => void
  onDelete: () => void
  onClose: () => void
  refreshTrigger?: number
}

export default function TodoDetails({ todoId, onEdit, onDelete, onClose, refreshTrigger }: TodoDetailsProps) {
  const [todo, setTodo] = useState<any>(null)
  const [documents, setDocuments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [showCompleteDialog, setShowCompleteDialog] = useState(false)
  const [completeForm, setCompleteForm] = useState({
    productionTested: false,
    mergedToMain: false
  })

  useEffect(() => {
    loadTodo()
    loadDocuments()
  }, [todoId, refreshTrigger])

  const loadTodo = async () => {
    try {
      const response = await fetch(`/api/todos/${todoId}`)
      const result = await response.json()
      if (result.success) {
        setTodo(result.data)
      }
    } catch (error) {
      console.error('Error loading todo:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadDocuments = async () => {
    try {
      const response = await fetch(`/api/todos/${todoId}/documents`)
      const result = await response.json()
      if (result.success) {
        setDocuments(result.data)
      }
    } catch (error) {
      console.error('Error loading documents:', error)
    }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      setUploading(true)
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch(`/api/todos/${todoId}/documents`, {
        method: 'POST',
        body: formData
      })

      const result = await response.json()
      if (result.success) {
        loadDocuments()
      }
    } catch (error) {
      console.error('Error uploading file:', error)
    } finally {
      setUploading(false)
    }
  }

  const handleComplete = async () => {
    if (!completeForm.productionTested || !completeForm.mergedToMain) {
      alert('Please confirm both requirements before marking as complete')
      return
    }

    try {
      const response = await fetch(`/api/todos/${todoId}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(completeForm)
      })

      const result = await response.json()
      if (result.success) {
        setShowCompleteDialog(false)
        loadTodo()
      } else {
        alert(result.error)
      }
    } catch (error) {
      console.error('Error completing todo:', error)
      alert('Failed to mark as complete')
    }
  }

  if (loading) {
    return (
      <div className="card p-8 text-center text-slate-400">
        Loading...
      </div>
    )
  }

  if (!todo) {
    return (
      <div className="card p-8 text-center text-slate-400">
        Todo not found
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h2 className="text-2xl font-bold text-slate-100">{todo.title}</h2>
          <div className="flex items-center space-x-4 mt-2">
            <span className={`px-3 py-1 rounded-full text-xs font-medium ${
              todo.priority === 'CRITICAL' ? 'bg-red-500/20 text-red-400' :
              todo.priority === 'HIGH' ? 'bg-orange-500/20 text-orange-400' :
              todo.priority === 'MEDIUM' ? 'bg-yellow-500/20 text-yellow-400' :
              'bg-blue-500/20 text-blue-400'
            }`}>
              {todo.priority}
            </span>
            <span className={`px-3 py-1 rounded-full text-xs font-medium ${
              todo.status === 'COMPLETE' ? 'bg-green-500/20 text-green-400' :
              todo.status === 'TESTING' ? 'bg-yellow-500/20 text-yellow-400' :
              todo.status === 'IN_PROGRESS' ? 'bg-blue-500/20 text-blue-400' :
              'bg-slate-500/20 text-slate-400'
            }`}>
              {todo.status.replace('_', ' ')}
            </span>
            {todo.category && (
              <span className="text-sm text-slate-400">{todo.category}</span>
            )}
          </div>
        </div>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-slate-200"
        >
          <X className="w-6 h-6" />
        </button>
      </div>

      {/* Description */}
      {todo.description && (
        <div className="card p-4">
          <h3 className="text-lg font-semibold text-slate-100 mb-2">Description</h3>
          <p className="text-slate-300 whitespace-pre-wrap">{todo.description}</p>
        </div>
      )}

      {/* Documents */}
      <div className="card p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-slate-100">Documents</h3>
          <label className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors cursor-pointer">
            <Upload className="w-4 h-4" />
            <span>{uploading ? 'Uploading...' : 'Upload'}</span>
            <input
              type="file"
              onChange={handleFileUpload}
              className="hidden"
              disabled={uploading}
            />
          </label>
        </div>

        {documents.length === 0 ? (
          <p className="text-slate-400 text-center py-4">No documents uploaded</p>
        ) : (
          <div className="space-y-2">
            {documents.map((doc) => (
              <div
                key={doc.id}
                className="flex items-center justify-between p-3 bg-sportsBar-800 rounded-lg"
              >
                <div className="flex items-center space-x-3">
                  <FileText className="w-5 h-5 text-blue-400" />
                  <div>
                    <p className="text-sm font-medium text-slate-200">{doc.filename}</p>
                    <p className="text-xs text-slate-400">
                      {new Date(doc.uploadedAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <a
                  href={doc.filepath}
                  download
                  className="text-blue-400 hover:text-blue-300"
                >
                  <Download className="w-5 h-5" />
                </a>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between pt-4 border-t border-slate-700">
        <div className="flex items-center space-x-3">
          <button
            onClick={onEdit}
            className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Edit className="w-4 h-4" />
            <span>Edit</span>
          </button>
          <button
            onClick={onDelete}
            className="inline-flex items-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            <span>Delete</span>
          </button>
        </div>

        {todo.status !== 'COMPLETE' && (
          <button
            onClick={() => setShowCompleteDialog(true)}
            className="inline-flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            <CheckCircle className="w-4 h-4" />
            <span>Mark Complete</span>
          </button>
        )}
      </div>

      {/* Complete Dialog */}
      {showCompleteDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="card p-6 max-w-md w-full mx-4">
            <div className="flex items-start space-x-3 mb-4">
              <AlertCircle className="w-6 h-6 text-yellow-400 flex-shrink-0 mt-1" />
              <div>
                <h3 className="text-lg font-bold text-slate-100 mb-2">
                  Confirm Completion
                </h3>
                <p className="text-sm text-slate-300 mb-4">
                  Please confirm that the following requirements have been met:
                </p>
              </div>
            </div>

            <div className="space-y-3 mb-6">
              <label className="flex items-start space-x-3">
                <input
                  type="checkbox"
                  checked={completeForm.productionTested}
                  onChange={(e) => setCompleteForm({ ...completeForm, productionTested: e.target.checked })}
                  className="mt-1 w-5 h-5 rounded border-slate-600 bg-sportsBar-800 text-blue-600 focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-sm text-slate-200">
                  Feature has been tested and is functioning on the production server
                </span>
              </label>

              <label className="flex items-start space-x-3">
                <input
                  type="checkbox"
                  checked={completeForm.mergedToMain}
                  onChange={(e) => setCompleteForm({ ...completeForm, mergedToMain: e.target.checked })}
                  className="mt-1 w-5 h-5 rounded border-slate-600 bg-sportsBar-800 text-blue-600 focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-sm text-slate-200">
                  Changes have been merged to the main branch
                </span>
              </label>
            </div>

            <div className="flex items-center justify-end space-x-3">
              <button
                onClick={() => setShowCompleteDialog(false)}
                className="px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleComplete}
                disabled={!completeForm.productionTested || !completeForm.mergedToMain}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Confirm Complete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
