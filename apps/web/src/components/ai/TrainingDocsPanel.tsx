'use client'

import { useEffect, useState } from 'react'

interface TrainingDoc {
  id: string
  title: string
  category?: string | null
  tags?: string | null
  description?: string | null
  fileSize?: number | null
  viewCount?: number
  processedAt?: string | null
  updatedAt?: string | null
}

/**
 * Training Documents — operator-managed knowledge the local AI is trained on.
 * Anything added here is indexed into the RAG vector store, so the chatbot answers from it
 * alongside the built-in system docs. (Re-wired v2.82.x.)
 */
export default function TrainingDocsPanel() {
  const [docs, setDocs] = useState<TrainingDoc[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [category, setCategory] = useState('')
  const [tags, setTags] = useState('')

  const load = async () => {
    setLoading(true)
    try {
      const r = await fetch('/api/training-docs')
      const j = await r.json()
      setDocs(j.success ? j.data : [])
    } catch {
      setMsg({ kind: 'err', text: 'Failed to load documents' })
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load() }, [])

  const add = async () => {
    if (!title.trim() || !content.trim()) {
      setMsg({ kind: 'err', text: 'Title and content are required' }); return
    }
    setSaving(true); setMsg(null)
    try {
      const body = {
        title: title.trim(),
        content: content.trim(),
        category: category.trim() || undefined,
        tags: tags.trim() ? tags.split(',').map(t => t.trim()).filter(Boolean) : undefined,
      }
      const r = await fetch('/api/training-docs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const j = await r.json()
      if (j.success) {
        setMsg({ kind: 'ok', text: `Added "${body.title}" — ${j.data?.chunksIndexed ?? 0} chunks indexed into the chatbot's knowledge.` })
        setTitle(''); setContent(''); setCategory(''); setTags('')
        load()
      } else {
        setMsg({ kind: 'err', text: j.error || 'Failed to add' })
      }
    } catch {
      setMsg({ kind: 'err', text: 'Failed to add document' })
    } finally {
      setSaving(false)
    }
  }

  const del = async (id: string, t: string) => {
    if (!confirm(`Remove "${t}" from the chatbot's knowledge?`)) return
    try {
      await fetch(`/api/training-docs?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
      load()
    } catch {
      setMsg({ kind: 'err', text: 'Failed to delete' })
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-white">Knowledge Base / Training Documents</h3>
        <p className="text-sm text-gray-400">
          Add system knowledge here — procedures, vendor notes, FAQs. Everything is indexed into the
          AI&apos;s RAG store so the chatbot can answer from it. (Built-in docs &amp; how-to&apos;s are already included automatically.)
        </p>
      </div>

      {msg && (
        <div className={`rounded-md px-3 py-2 text-sm ${msg.kind === 'ok' ? 'bg-green-900/40 text-green-300' : 'bg-red-900/40 text-red-300'}`}>
          {msg.text}
        </div>
      )}

      {/* Add form */}
      <div className="rounded-lg border border-sportsBar-700 bg-sportsBar-800/50 p-4 space-y-3">
        <h4 className="font-medium text-white">Add knowledge</h4>
        <input className="w-full rounded-md bg-sportsBar-900 border border-sportsBar-700 px-3 py-2 text-sm text-white"
          placeholder="Title (e.g. 'How to reset the Atlas processor')" value={title} onChange={e => setTitle(e.target.value)} />
        <textarea className="w-full rounded-md bg-sportsBar-900 border border-sportsBar-700 px-3 py-2 text-sm text-white min-h-[140px]"
          placeholder="Content / knowledge the chatbot should know…" value={content} onChange={e => setContent(e.target.value)} />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <input className="rounded-md bg-sportsBar-900 border border-sportsBar-700 px-3 py-2 text-sm text-white"
            placeholder="Category (optional, e.g. 'audio')" value={category} onChange={e => setCategory(e.target.value)} />
          <input className="rounded-md bg-sportsBar-900 border border-sportsBar-700 px-3 py-2 text-sm text-white"
            placeholder="Tags, comma-separated (optional)" value={tags} onChange={e => setTags(e.target.value)} />
        </div>
        <button onClick={add} disabled={saving}
          className="rounded-md bg-blue-600 hover:bg-blue-500 disabled:opacity-50 px-4 py-2 text-sm font-medium text-white">
          {saving ? 'Indexing…' : 'Add to knowledge base'}
        </button>
      </div>

      {/* List */}
      <div className="rounded-lg border border-sportsBar-700 bg-sportsBar-800/50 p-4">
        <h4 className="font-medium text-white mb-3">Indexed documents ({docs.length})</h4>
        {loading ? (
          <p className="text-sm text-gray-400">Loading…</p>
        ) : docs.length === 0 ? (
          <p className="text-sm text-gray-400">No operator-added documents yet. Add knowledge above — the chatbot already knows the built-in system docs.</p>
        ) : (
          <ul className="divide-y divide-sportsBar-700">
            {docs.map(d => (
              <li key={d.id} className="flex items-center justify-between py-2">
                <div className="min-w-0">
                  <div className="text-sm text-white truncate">{d.title}</div>
                  <div className="text-xs text-gray-400">
                    {d.category ? `${d.category} · ` : ''}{d.processedAt ? 'indexed' : 'not indexed'}{d.tags ? ` · ${d.tags}` : ''}
                  </div>
                </div>
                <button onClick={() => del(d.id, d.title)} className="ml-3 shrink-0 rounded-md bg-red-900/50 hover:bg-red-800 px-3 py-1 text-xs text-red-200">
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
