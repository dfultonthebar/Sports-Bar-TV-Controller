'use client'

import { useEffect, useRef, useState } from 'react'
import { Activity, CheckCircle, Loader2, XCircle } from 'lucide-react'

export default function AutoUpdateLivePage() {
  const [lines, setLines] = useState<string[]>([])
  const [status, setStatus] = useState<'connecting' | 'streaming' | 'done' | 'error'>('connecting')
  const [filename, setFilename] = useState<string | null>(null)
  const [doneReason, setDoneReason] = useState<string | null>(null)
  const preRef = useRef<HTMLPreElement | null>(null)
  const esRef = useRef<EventSource | null>(null)

  useEffect(() => {
    const es = new EventSource('/api/auto-update/live')
    esRef.current = es

    es.addEventListener('meta', (e: MessageEvent) => {
      try { setFilename(JSON.parse(e.data).filename) } catch {}
    })
    es.addEventListener('chunk', (e: MessageEvent) => {
      try {
        const text = JSON.parse(e.data).text as string
        setLines(prev => [...prev, text])
        setStatus('streaming')
      } catch {}
    })
    es.addEventListener('done', (e: MessageEvent) => {
      try { setDoneReason(JSON.parse(e.data).reason) } catch {}
      setStatus('done')
      es.close()
    })
    es.addEventListener('error', (e: MessageEvent) => {
      setStatus('error')
      es.close()
    })
    es.onerror = () => { setStatus('error'); es.close() }

    return () => { es.close() }
  }, [])

  useEffect(() => {
    if (preRef.current) preRef.current.scrollTop = preRef.current.scrollHeight
  }, [lines])

  const fullText = lines.join('')

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 py-8">
      <div className="max-w-6xl mx-auto px-4">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <Activity className="h-6 w-6 text-sky-400" />
              Live Auto-Update
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              Streaming the latest <code className="bg-slate-800 px-1 rounded">auto-update-*.log</code>
              {filename && <span> — <code className="bg-slate-800 px-1 rounded">{filename}</code></span>}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {status === 'connecting' && <><Loader2 className="h-4 w-4 animate-spin text-sky-400" /><span className="text-xs text-slate-400">connecting…</span></>}
            {status === 'streaming' && <><Activity className="h-4 w-4 text-emerald-400 animate-pulse" /><span className="text-xs text-emerald-300">live</span></>}
            {status === 'done' && <><CheckCircle className="h-4 w-4 text-emerald-400" /><span className="text-xs text-emerald-300">done{doneReason ? ` (${doneReason})` : ''}</span></>}
            {status === 'error' && <><XCircle className="h-4 w-4 text-red-400" /><span className="text-xs text-red-300">error</span></>}
            <a href="/auto-update" className="ml-4 text-xs text-slate-400 hover:text-sky-300">← Back to history</a>
          </div>
        </div>

        <pre
          ref={preRef}
          className="font-mono text-xs text-slate-300 bg-slate-900 border border-slate-700 rounded-lg p-4 overflow-auto max-h-[75vh] whitespace-pre-wrap"
        >
          {fullText || '(no content yet…)'}
        </pre>
      </div>
    </div>
  )
}
