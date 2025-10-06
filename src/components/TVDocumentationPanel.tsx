
/**
 * TV Documentation Panel Component
 * 
 * Displays TV documentation status and allows manual fetching
 */

'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/cards'

interface TVDocumentation {
  id: string
  manufacturer: string
  model: string
  manualPath?: string
  fetchStatus: 'pending' | 'fetching' | 'completed' | 'failed' | 'not_found'
  fetchError?: string
  qaGenerated: boolean
  qaPairsCount: number
  createdAt: Date
  updatedAt: Date
}

interface TVDocumentationData {
  documentation: TVDocumentation[]
  totalManuals: number
  totalQAPairs: number
  manuals: Array<{
    filename: string
    size: number
    sizeFormatted: string
  }>
}

export default function TVDocumentationPanel() {
  const [data, setData] = useState<TVDocumentationData | null>(null)
  const [loading, setLoading] = useState(true)
  const [fetchingManuals, setFetchingManuals] = useState<Set<string>>(new Set())

  useEffect(() => {
    loadDocumentation()
  }, [])

  const loadDocumentation = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/cec/tv-documentation')
      const result = await response.json()
      
      if (result.success) {
        setData(result)
      }
    } catch (error) {
      console.error('Error loading TV documentation:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchManual = async (manufacturer: string, model: string) => {
    const key = `${manufacturer}-${model}`
    setFetchingManuals(prev => new Set(prev).add(key))

    try {
      const response = await fetch('/api/cec/fetch-tv-manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ manufacturer, model })
      })

      const result = await response.json()

      if (result.success) {
        alert(`Successfully fetched manual for ${manufacturer} ${model}!\n\nQ&A Pairs Generated: ${result.qaPairsCount}`)
        loadDocumentation()
      } else {
        alert(`Failed to fetch manual: ${result.error}`)
      }
    } catch (error) {
      console.error('Error fetching manual:', error)
      alert('Error fetching manual. Please try again.')
    } finally {
      setFetchingManuals(prev => {
        const newSet = new Set(prev)
        newSet.delete(key)
        return newSet
      })
    }
  }

  const getStatusBadge = (status: string) => {
    const badges = {
      pending: { color: 'bg-yellow-100 text-yellow-800', text: 'Pending' },
      fetching: { color: 'bg-blue-100 text-blue-800', text: 'Fetching...' },
      completed: { color: 'bg-green-100 text-green-800', text: 'Completed' },
      failed: { color: 'bg-red-100 text-red-800', text: 'Failed' },
      not_found: { color: 'bg-gray-100 text-gray-800', text: 'Not Found' }
    }

    const badge = badges[status as keyof typeof badges] || badges.pending

    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${badge.color}`}>
        {badge.text}
      </span>
    )
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>TV Documentation</CardTitle>
          <CardDescription>Loading documentation status...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>TV Documentation</CardTitle>
          <CardDescription>Failed to load documentation</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>TV Documentation & AI Training</CardTitle>
        <CardDescription>
          Automatically fetched manuals and generated Q&A pairs for AI training
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Summary Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-blue-50 p-4 rounded-lg">
            <div className="text-2xl font-bold text-blue-600">{data.documentation.length}</div>
            <div className="text-sm text-gray-600">TV Models</div>
          </div>
          <div className="bg-green-50 p-4 rounded-lg">
            <div className="text-2xl font-bold text-green-600">{data.totalManuals}</div>
            <div className="text-sm text-gray-600">Manuals Downloaded</div>
          </div>
          <div className="bg-purple-50 p-4 rounded-lg">
            <div className="text-2xl font-bold text-purple-600">{data.totalQAPairs}</div>
            <div className="text-sm text-gray-600">Q&A Pairs Generated</div>
          </div>
        </div>

        {/* Documentation List */}
        <div className="space-y-3">
          <h3 className="font-semibold text-lg mb-3">Discovered TV Models</h3>
          
          {data.documentation.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No TV models discovered yet. Run CEC discovery to detect TVs.
            </div>
          ) : (
            data.documentation.map((doc) => {
              const key = `${doc.manufacturer}-${doc.model}`
              const isFetching = fetchingManuals.has(key)

              return (
                <div
                  key={doc.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50"
                >
                  <div className="flex-1">
                    <div className="font-medium">
                      {doc.manufacturer} {doc.model}
                    </div>
                    <div className="text-sm text-gray-500 mt-1">
                      {doc.manualPath ? (
                        <>
                          Manual: {doc.manualPath.split('/').pop()} • 
                          Q&A Pairs: {doc.qaPairsCount}
                        </>
                      ) : (
                        'No manual downloaded'
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {getStatusBadge(doc.fetchStatus)}
                    
                    {doc.fetchStatus !== 'completed' && (
                      <Button
                        size="sm"
                        onClick={() => fetchManual(doc.manufacturer, doc.model)}
                        disabled={isFetching}
                      >
                        {isFetching ? (
                          <>
                            <span className="animate-spin mr-2">⏳</span>
                            Fetching...
                          </>
                        ) : (
                          'Fetch Manual'
                        )}
                      </Button>
                    )}

                    {doc.fetchStatus === 'completed' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => fetchManual(doc.manufacturer, doc.model)}
                        disabled={isFetching}
                      >
                        Re-fetch
                      </Button>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Downloaded Manuals */}
        {data.manuals.length > 0 && (
          <div className="mt-6 pt-6 border-t">
            <h3 className="font-semibold text-lg mb-3">Downloaded Manuals</h3>
            <div className="space-y-2">
              {data.manuals.map((manual, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">📄</span>
                    <span className="text-sm font-medium">{manual.filename}</span>
                  </div>
                  <span className="text-sm text-gray-500">{manual.sizeFormatted}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Refresh Button */}
        <div className="mt-6 pt-6 border-t">
          <Button onClick={loadDocumentation} variant="outline" className="w-full">
            Refresh Documentation Status
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
