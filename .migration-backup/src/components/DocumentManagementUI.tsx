'use client'

import { useState, useEffect } from 'react'
import {
  FileText,
  Trash2,
  Edit2,
  Eye,
  Download,
  Filter,
  Search,
  Tag,
  Calendar,
  FileType,
  AlertCircle,
  CheckCircle,
  Loader2,
  X,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/cards'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

import { logger } from '@/lib/logger'
interface TrainingDocument {
  id: string
  title: string
  fileName: string
  filePath: string
  fileType: string
  fileSize: number
  category: string | null
  tags: string[]
  description: string | null
  viewCount: number
  lastViewed: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export default function DocumentManagementUI() {
  const [documents, setDocuments] = useState<TrainingDocument[]>([])
  const [filteredDocuments, setFilteredDocuments] = useState<TrainingDocument[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('')
  const [editingDoc, setEditingDoc] = useState<TrainingDocument | null>(null)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    loadDocuments()
  }, [])

  useEffect(() => {
    filterDocuments()
  }, [searchTerm, selectedCategory, documents])

  const loadDocuments = async () => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/ai/documents?active=true')
      const data = await response.json()

      if (data.success) {
        setDocuments(data.documents)
      } else {
        showMessage('error', 'Failed to load documents')
      }
    } catch (error) {
      logger.error('Error loading documents:', error)
      showMessage('error', 'Error loading documents')
    } finally {
      setIsLoading(false)
    }
  }

  const filterDocuments = () => {
    let filtered = [...documents]

    if (searchTerm) {
      filtered = filtered.filter(
        (doc) =>
          doc.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
          doc.fileName.toLowerCase().includes(searchTerm.toLowerCase()) ||
          doc.description?.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    if (selectedCategory) {
      filtered = filtered.filter((doc) => doc.category === selectedCategory)
    }

    setFilteredDocuments(filtered)
  }

  const handleDelete = async (id: string, permanent: boolean = false) => {
    if (
      !confirm(
        permanent
          ? 'Are you sure you want to permanently delete this document? This cannot be undone.'
          : 'Are you sure you want to deactivate this document?'
      )
    ) {
      return
    }

    try {
      const response = await fetch(`/api/ai/documents?id=${id}&permanent=${permanent}`, {
        method: 'DELETE',
      })

      const data = await response.json()

      if (data.success) {
        showMessage('success', data.message)
        loadDocuments()
      } else {
        showMessage('error', data.error || 'Failed to delete document')
      }
    } catch (error) {
      logger.error('Error deleting document:', error)
      showMessage('error', 'Error deleting document')
    }
  }

  const handleEdit = (doc: TrainingDocument) => {
    setEditingDoc(doc)
    setIsEditModalOpen(true)
  }

  const handleSaveEdit = async () => {
    if (!editingDoc) return

    try {
      const response = await fetch('/api/ai/documents', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingDoc),
      })

      const data = await response.json()

      if (data.success) {
        showMessage('success', 'Document updated successfully')
        setIsEditModalOpen(false)
        setEditingDoc(null)
        loadDocuments()
      } else {
        showMessage('error', data.error || 'Failed to update document')
      }
    } catch (error) {
      logger.error('Error updating document:', error)
      showMessage('error', 'Error updating document')
    }
  }

  const handleView = async (doc: TrainingDocument) => {
    // Track view
    try {
      await fetch('/api/ai/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: doc.id, action: 'view' }),
      })

      // Open document preview (you can implement a modal or viewer)
      showMessage('success', `Viewing: ${doc.title}`)
    } catch (error) {
      logger.error('Error tracking view:', error)
    }
  }

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text })
    setTimeout(() => setMessage(null), 5000)
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB'
  }

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const categories = Array.from(new Set(documents.map((d) => d.category).filter(Boolean)))

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Training Documents</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Manage AI training documents and knowledge base
          </p>
        </div>
        <Badge variant="outline" className="text-lg">
          {documents.length} Documents
        </Badge>
      </div>

      {/* Message */}
      {message && (
        <div
          className={`p-4 rounded-lg flex items-center gap-2 ${
            message.type === 'success'
              ? 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200'
              : 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200'
          }`}
        >
          {message.type === 'success' ? (
            <CheckCircle className="h-5 w-5" />
          ) : (
            <AlertCircle className="h-5 w-5" />
          )}
          <span>{message.text}</span>
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="search">Search</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  id="search"
                  placeholder="Search by title, filename, or description..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="category">Category</Label>
              <select
                id="category"
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800"
              >
                <option value="">All Categories</option>
                {categories.map((cat) => (
                  <option key={cat} value={cat || ''}>
                    {cat || 'Uncategorized'}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Documents List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      ) : filteredDocuments.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="h-12 w-12 mx-auto mb-4 text-gray-400" />
            <p className="text-gray-600 dark:text-gray-400">No documents found</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredDocuments.map((doc) => (
            <Card key={doc.id} className="hover:shadow-lg transition-shadow">
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <FileText className="h-5 w-5 text-blue-600" />
                      <h3 className="text-lg font-semibold">{doc.title}</h3>
                      {doc.category && (
                        <Badge variant="secondary">{doc.category}</Badge>
                      )}
                    </div>

                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                      {doc.description || 'No description'}
                    </p>

                    <div className="flex flex-wrap gap-4 text-sm text-gray-500">
                      <div className="flex items-center gap-1">
                        <FileType className="h-4 w-4" />
                        <span>{doc.fileName}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        <span>{formatDate(doc.createdAt)}</span>
                      </div>
                      <div>
                        <span>{formatFileSize(doc.fileSize)}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Eye className="h-4 w-4" />
                        <span>{doc.viewCount} views</span>
                      </div>
                    </div>

                    {doc.tags && doc.tags.length > 0 && (
                      <div className="flex items-center gap-2 mt-3">
                        <Tag className="h-4 w-4 text-gray-400" />
                        <div className="flex flex-wrap gap-1">
                          {doc.tags.map((tag) => (
                            <Badge key={tag} variant="outline" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2 ml-4">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleView(doc)}
                      title="View"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEdit(doc)}
                      title="Edit"
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(doc.id, false)}
                      className="text-red-600 hover:text-red-700"
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Edit Modal */}
      {isEditModalOpen && editingDoc && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Edit Document</CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setIsEditModalOpen(false)
                    setEditingDoc(null)
                  }}
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="edit-title">Title</Label>
                <Input
                  id="edit-title"
                  value={editingDoc.title}
                  onChange={(e) =>
                    setEditingDoc({ ...editingDoc, title: e.target.value })
                  }
                />
              </div>

              <div>
                <Label htmlFor="edit-category">Category</Label>
                <Input
                  id="edit-category"
                  value={editingDoc.category || ''}
                  onChange={(e) =>
                    setEditingDoc({ ...editingDoc, category: e.target.value })
                  }
                  placeholder="e.g., Hardware, Configuration, Troubleshooting"
                />
              </div>

              <div>
                <Label htmlFor="edit-description">Description</Label>
                <Textarea
                  id="edit-description"
                  value={editingDoc.description || ''}
                  onChange={(e) =>
                    setEditingDoc({ ...editingDoc, description: e.target.value })
                  }
                  rows={3}
                  placeholder="Add a description for this document"
                />
              </div>

              <div>
                <Label htmlFor="edit-tags">Tags (comma-separated)</Label>
                <Input
                  id="edit-tags"
                  value={editingDoc.tags?.join(', ') || ''}
                  onChange={(e) =>
                    setEditingDoc({
                      ...editingDoc,
                      tags: e.target.value.split(',').map((t) => t.trim()).filter(Boolean),
                    })
                  }
                  placeholder="e.g., setup, troubleshooting, advanced"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <Button onClick={handleSaveEdit} className="flex-1">
                  Save Changes
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsEditModalOpen(false)
                    setEditingDoc(null)
                  }}
                  className="flex-1"
                >
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
