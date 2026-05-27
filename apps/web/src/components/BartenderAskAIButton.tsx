'use client'

/**
 * BartenderAskAIButton — v2.54.48 (Grok audit item E)
 *
 * Floating bottom-right "Ask AI" pill on the bartender remote. Tap to open
 * an inline chat modal that hits POST /api/chat (allow-listed for the
 * bartender port-3002 proxy in v2.54.47 + STAFF-auth-gated).
 *
 * The chat route's system prompt auto-detects bartender vs operator
 * register from the FIRST message phrasing (chat/route.ts:404-445), so
 * bartenders get the "silver box with the antennas" / "you can't break it"
 * voice without us having to flip a flag here.
 *
 * Minimal UX deliberate: single text input + scrollable answer area + close.
 * No tool-call surfacing, no source citations, no session persistence —
 * those live in the full AI Hub (/ai-hub) which is operator-only by design.
 */

import { useState, useRef, useEffect } from 'react'
import { MessageSquare, X, Loader2, Send } from 'lucide-react'

interface Msg {
  role: 'user' | 'assistant'
  content: string
}

const BARTENDER_QUICK_QUESTIONS = [
  "The wireless mic isn't working",
  'TV 3 has the wrong game on',
  'The music stopped in the patio',
  'How do I change the channel on TV 5?',
]

export function BartenderAskAIButton() {
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<Msg[]>([])
  const [loading, setLoading] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  // v2.54.52 (Grok #2): stable per-modal sessionId. Chat route persists
  // history to chatSessions table keyed on this ID, then replays it on
  // every subsequent request — so follow-up questions ("what if it's
  // yellow?" after "what does the banner mean?") have full prior
  // context without us shipping the message array client-side. Resets
  // when the operator closes + reopens the modal (fresh conversation).
  const sessionIdRef = useRef<string>('')

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, loading])

  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus()
    }
    if (open && !sessionIdRef.current) {
      sessionIdRef.current = crypto.randomUUID()
    }
  }, [open])

  function startFresh() {
    setMessages([])
    sessionIdRef.current = crypto.randomUUID()
  }

  async function send(text: string) {
    const q = text.trim()
    if (!q || loading) return
    setInput('')
    setMessages((m) => [...m, { role: 'user', content: q }])
    setLoading(true)

    // 5-min AbortController matches the chat route + nginx timeout
    const controller = new AbortController()
    const tid = setTimeout(() => controller.abort(), 300_000)
    try {
      // v2.54.52 BUG FIX: the v2.54.48 ship sent { messages: [...] }
      // but the chat route's ValidationSchemas.aiQuery requires
      // { message: string, sessionId?, ... }. Every Ask AI tap was
      // returning 400 "Either query or message must be provided".
      // sessionId threads history server-side via chatSessions table.
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: q,
          sessionId: sessionIdRef.current,
          stream: false,
          enableTools: false,
        }),
        signal: controller.signal,
      })
      if (!res.ok) {
        const errText = await res.text().catch(() => '')
        throw new Error(`Server returned ${res.status}${errText ? `: ${errText.slice(0, 100)}` : ''}`)
      }
      const data = await res.json()
      // Non-streaming chat route returns { response, sources, sessionId, ... }
      const answer =
        data?.response ||
        data?.message?.content ||
        data?.answer ||
        'No answer came back. Try rephrasing.'
      setMessages((m) => [...m, { role: 'assistant', content: answer }])
    } catch (err: any) {
      const msg =
        err?.name === 'AbortError'
          ? 'The AI took too long to respond. Try again or text the manager.'
          : `Couldn't reach the AI: ${err?.message || 'unknown error'}. Text the manager.`
      setMessages((m) => [...m, { role: 'assistant', content: msg }])
    } finally {
      clearTimeout(tid)
      setLoading(false)
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-5 py-3 bg-purple-600 hover:bg-purple-500 text-white font-medium rounded-full shadow-lg border border-purple-500 transition-colors min-h-[44px]"
        aria-label="Open AI help chat"
      >
        <MessageSquare className="h-5 w-5" />
        <span>Ask AI</span>
      </button>
    )
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-2 sm:p-4"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-full max-w-2xl h-[80vh] sm:h-[600px] bg-slate-900 border border-slate-700 rounded-lg shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-purple-400" />
            <h2 className="font-semibold text-white">Ask AI for help</h2>
          </div>
          <div className="flex items-center gap-1">
            {messages.length > 0 && (
              <button
                type="button"
                onClick={startFresh}
                disabled={loading}
                className="text-xs text-slate-400 hover:text-white px-3 py-2 min-h-[44px] disabled:opacity-50"
                aria-label="Start new conversation"
                title="Start new conversation (clears context)"
              >
                New chat
              </button>
            )}
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-slate-400 hover:text-white p-2 -m-2"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.length === 0 && !loading && (
            <div className="text-center text-slate-400 py-6">
              <p className="text-sm mb-1">Describe what you&apos;re seeing in plain English.</p>
              <p className="text-xs text-slate-500 mb-4">
                You can&apos;t break anything by asking. If the answer doesn&apos;t help, text the manager.
              </p>
              <p className="text-xs text-slate-400 mb-2 font-medium">Common questions:</p>
              <div className="grid grid-cols-1 gap-2 max-w-md mx-auto">
                {BARTENDER_QUICK_QUESTIONS.map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => send(q)}
                    className="text-left text-sm px-4 py-3 bg-slate-800 hover:bg-slate-700 rounded border border-slate-700 text-slate-200 transition-colors min-h-[44px]"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}
          {messages.map((m, i) => (
            <div
              key={i}
              className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] p-3 rounded-lg whitespace-pre-wrap text-sm ${
                  m.role === 'user'
                    ? 'bg-purple-600 text-white'
                    : 'bg-slate-800 text-slate-100 border border-slate-700'
                }`}
              >
                {m.content}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-slate-800 text-slate-300 p-3 rounded-lg border border-slate-700 flex items-center gap-2 text-sm">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Thinking… (usually 30-90 seconds)</span>
              </div>
            </div>
          )}
        </div>

        {/* Input */}
        <form
          onSubmit={(e) => {
            e.preventDefault()
            send(input)
          }}
          className="border-t border-slate-700 p-3 flex gap-2"
        >
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                send(input)
              }
            }}
            placeholder="What's the problem? (Enter to send)"
            rows={2}
            disabled={loading}
            className="flex-1 bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm text-white placeholder-slate-500 resize-none focus:outline-none focus:border-purple-500"
          />
          <button
            type="submit"
            disabled={!input.trim() || loading}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded font-medium transition-colors min-h-[44px] flex items-center justify-center"
            aria-label="Send"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
      </div>
    </div>
  )
}
