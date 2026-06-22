'use client'

import { useEffect, useRef, useState } from 'react'

type Msg = { role: 'user' | 'assistant'; content: string }

const SUGGESTIONS = [
  'Which locations have offline devices?',
  'Any errors in the last 24h?',
  'Which box has the highest CPU or memory?',
]

type Mode = 'fleet' | 'claude'

export default function ChatPage() {
  const [messages, setMessages] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mode, setMode] = useState<Mode>('fleet')
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, busy])

  async function ask(text: string) {
    const q = text.trim()
    if (!q || busy) return
    setError(null)
    const next: Msg[] = [...messages, { role: 'user', content: q }]
    setMessages(next)
    setInput('')
    setBusy(true)
    try {
      const endpoint = mode === 'claude' ? '/api/chat/claude' : '/api/chat'
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ messages: next }),
      })
      const j = await res.json()
      if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`)
      setMessages((m) => [...m, { role: 'assistant', content: j.answer }])
    } catch (e: any) {
      setError(e?.message || 'request failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main
      style={{
        maxWidth: 820,
        margin: '0 auto',
        padding: 24,
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        boxSizing: 'border-box',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <h1 style={{ fontSize: 22, margin: '0 0 2px' }}>Maintenance Chat</h1>
        <a href="/" style={{ color: '#38bdf8', fontSize: 13 }}>
          ← Fleet
        </a>
      </div>
      <p style={{ color: '#94a3b8', marginTop: 0, fontSize: 13 }}>
        Grounded in live fleet health + the error feed.{' '}
        {mode === 'fleet'
          ? 'Fast shared local model on the hub.'
          : 'Claude Code (read-only) — deeper code/diagnostic answers, slower.'}
      </p>

      {/* Mode toggle: fast local fleet model vs. deep Claude path (Phase C item a) */}
      <div style={{ display: 'flex', gap: 6, margin: '0 0 10px' }}>
        {([
          ['fleet', 'Fleet model', 'Fast · answers from hub data'],
          ['claude', 'Claude (deep)', 'Slower · reads the codebase'],
        ] as const).map(([m, label, title]) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            disabled={busy}
            title={title}
            style={{
              padding: '5px 12px',
              borderRadius: 999,
              border: `1px solid ${mode === m ? '#2563eb' : '#1e293b'}`,
              background: mode === m ? '#1d4ed8' : '#0b1220',
              color: mode === m ? 'white' : '#94a3b8',
              fontSize: 12,
              fontWeight: 600,
              cursor: busy ? 'default' : 'pointer',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          border: '1px solid #1e293b',
          borderRadius: 8,
          padding: 14,
          background: '#0f172a',
        }}
      >
        {messages.length === 0 && (
          <div style={{ color: '#64748b', fontSize: 14 }}>
            Ask about fleet health, the error feed, or a specific location.
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => ask(s)}
                  style={{
                    padding: '6px 10px',
                    borderRadius: 999,
                    border: '1px solid #1e293b',
                    background: '#0b1220',
                    color: '#cbd5e1',
                    fontSize: 12,
                    cursor: 'pointer',
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} style={{ margin: '12px 0' }}>
            <div
              style={{
                fontSize: 11,
                color: m.role === 'user' ? '#38bdf8' : '#22c55e',
                marginBottom: 3,
              }}
            >
              {m.role === 'user' ? 'You' : 'Assistant'}
            </div>
            <div style={{ whiteSpace: 'pre-wrap', fontSize: 14, color: '#e2e8f0', lineHeight: 1.55 }}>
              {m.content}
            </div>
          </div>
        ))}
        {busy && (
          <div style={{ color: '#64748b', fontSize: 13, marginTop: 8 }}>
            {mode === 'claude' ? 'asking Claude… (deep reads can take a minute or two)' : 'thinking…'}
          </div>
        )}
        {error && (
          <div style={{ color: '#ef4444', fontSize: 13, marginTop: 8 }}>error: {error}</div>
        )}
        <div ref={endRef} />
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              ask(input)
            }
          }}
          placeholder="Ask about the fleet… (Enter to send, Shift+Enter for newline)"
          rows={2}
          style={{
            flex: 1,
            resize: 'none',
            padding: 10,
            borderRadius: 8,
            border: '1px solid #1e293b',
            background: '#0b1220',
            color: '#e2e8f0',
            fontSize: 14,
            fontFamily: 'inherit',
          }}
        />
        <button
          onClick={() => ask(input)}
          disabled={busy}
          style={{
            padding: '0 18px',
            borderRadius: 8,
            border: 'none',
            background: busy ? '#334155' : '#2563eb',
            color: 'white',
            fontWeight: 600,
            cursor: busy ? 'default' : 'pointer',
          }}
        >
          Send
        </button>
      </div>
    </main>
  )
}
