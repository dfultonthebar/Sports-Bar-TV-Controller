
/**
 * OPTIMIZED Chat API Route with Streaming Support
 * Implements Server-Sent Events (SSE) for real-time streaming responses
 */

import { NextRequest, NextResponse } from 'next/server'
import { documentSearch } from '@/lib/enhanced-document-search'
import { retrieveContext } from '@/lib/rag-server/query-engine'
import { operationLogger } from '@/lib/operation-logger'
import { findUnique, update, upsert } from '@/lib/db-helpers'
import { schema } from '@/db'
import { eq } from 'drizzle-orm'
import { logger } from '@sports-bar/logger'
import { z } from 'zod'
import { validateRequestBody, validateQueryParams, validatePathParams, ValidationSchemas, isValidationError, isValidationSuccess} from '@/lib/validation'
import {
  executeTool,
  getAvailableTools,
  createDefaultContext,
  ToolDefinition,
} from '@/lib/ai-tools'
import { HARDWARE_CONFIG } from '@/lib/hardware-config'

interface ChatMessage {
  role: 'user' | 'assistant' | 'system' | 'tool'
  content: string
  toolCalls?: ToolCall[]
  toolResults?: ToolResult[]
}

interface ToolCall {
  id: string
  name: string
  parameters: Record<string, any>
}

interface ToolResult {
  id: string
  name: string
  result: any
  success: boolean
  error?: string
}

interface AIResponse {
  content: string
  error?: string
}

// Local Ollama configuration
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || HARDWARE_CONFIG.ollama.baseUrl
// v2.46.3: defaulted to llama3.1:8b — iGPU-accelerated via IPEX-LLM
// (~14 tok/s, same as pattern-digest). phi3:mini ground worse against
// RAG snippets per fact-checker grilling 2026-05-18. Override via
// OLLAMA_MODEL env if you want the faster/dumber phi3:mini.
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3.1:8b'

// Option B unification (v2.46.3): the AI Hub /api/chat reads from the
// RAG vector store (3000+ chunks: CLAUDE.md, docs/, packages/*/README.md,
// .claude/locations/*.md, memory files, vendor protocol specs) instead
// of the older enhanced-document-search. AI Hub chat is now grounded
// in the same SME corpus the pattern-digest uses.
//
// Adapter preserves the DocumentSearchResult shape so downstream
// context-formatting (line ~180 + ~441) is unchanged. Falls back to
// enhanced-document-search if RAG is empty (fresh location install
// before scan-system-docs.ts has run) so chat keeps working.
async function searchDocsViaRag(
  query: string,
  topK: number,
): Promise<Array<{ id: string; originalName: string; content: string; relevanceScore: number; matchedTerms: string[] }>> {
  try {
    const result = await retrieveContext(query, topK)
    if (!result.chunks || result.chunks.length === 0) {
      return documentSearch.searchDocuments(query, topK)
    }
    const terms = query
      .toLowerCase()
      .split(/\s+/)
      .filter((t) => t.length > 3)
      .slice(0, 5)
    return result.chunks.map((c, i) => ({
      id: `rag-${i}`,
      originalName: c.source ?? `chunk_${i}`,
      content: c.content,
      relevanceScore: c.score ?? 0,
      matchedTerms: terms,
    }))
  } catch (err) {
    logger.warn(`[AI-HUB-CHAT] RAG retrieval failed, falling back: ${(err as Error)?.message ?? err}`)
    return documentSearch.searchDocuments(query, topK)
  }
}

export async function POST(request: NextRequest) {
  // Input validation
  const bodyValidation = await validateRequestBody(request, ValidationSchemas.aiQuery)
  if (isValidationError(bodyValidation)) return bodyValidation.error


  logger.info('[CHAT API] POST request received')
  try {
    logger.info('[CHAT API] Parsing request body...')
    const { data } = bodyValidation
    const { message, query, sessionId, enableTools = true, stream = true } = data
    const userMessage = message || query
    logger.info('[CHAT API] Request parsed:', { data: { message: userMessage?.substring(0, 50), sessionId, enableTools, stream } })

    if (!userMessage) {
      logger.info('[CHAT API] No message provided')
      return NextResponse.json({ error: 'Message or query is required' }, { status: 400 })
    }

    // OPTIMIZED: Return streaming response if requested
    if (stream) {
      logger.info('[CHAT API] Handling streaming chat...')
      return handleStreamingChat(userMessage, sessionId, enableTools)
    }

    // Fallback to non-streaming for compatibility
    logger.info('[CHAT API] Handling non-streaming chat...')
    return handleNonStreamingChat(userMessage, sessionId, enableTools)
  } catch (error) {
    logger.error('[CHAT API] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * OPTIMIZED: Handle streaming chat with Server-Sent Events
 */
async function handleStreamingChat(
  message: string,
  sessionId: string | undefined,
  enableTools: boolean
) {
  logger.info('[HANDLE_STREAMING] Creating encoder and stream')
  const encoder = new TextEncoder()

  // Create a TransformStream for streaming
  const stream = new TransformStream()
  const writer = stream.writable.getWriter()

  logger.info('[HANDLE_STREAMING] Starting processStreamingChat in background')
  // Start processing in background
  processStreamingChat(message, sessionId, enableTools, writer, encoder)
    .catch(error => {
      logger.error('[HANDLE_STREAMING] Streaming chat error:', error)
      try {
        writer.write(encoder.encode(`data: ${JSON.stringify({ 
          type: 'error', 
          error: error.message 
        })}\n\n`))
      } catch (writeError) {
        logger.error('[HANDLE_STREAMING] Failed to write error to stream:', writeError)
      }
    })
    .finally(() => {
      logger.info('[HANDLE_STREAMING] Closing writer')
      try {
        writer.close()
      } catch (closeError) {
        logger.error('[HANDLE_STREAMING] Failed to close writer:', closeError)
      }
    })

  logger.info('[HANDLE_STREAMING] Returning streaming response')
  // Return streaming response with proper headers
  return new Response(stream.readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}

/**
 * Process streaming chat and write chunks to the stream
 */
async function processStreamingChat(
  message: string,
  sessionId: string | undefined,
  enableTools: boolean,
  writer: WritableStreamDefaultWriter,
  encoder: TextEncoder
) {
  logger.info('[STREAMING] Starting processStreamingChat')
  // Helper to send SSE message
  const sendSSE = async (data: any) => {
    try {
      await writer.write(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
    } catch (error) {
      logger.error('[STREAMING] Failed to write to stream:', error)
      throw error
    }
  }

  try {
    // Enhanced document search with better relevance scoring
    logger.info('[STREAMING] Sending status: Searching documentation...')
    await sendSSE({ type: 'status', message: 'Searching documentation...' })
    logger.info('[STREAMING] Calling documentSearch.searchDocuments...')
    const relevantDocs = await searchDocsViaRag(message, 8)
    logger.info('[STREAMING] Document search completed', { data: { found: relevantDocs.length } })

    // v2.49.0: emit source citations so the UI can render "answer based
    // on docs X/Y/Z" — closes UX-audit BROKEN-#3 (no source attribution).
    // Shape per doc: filename, relevance score, first 200 chars excerpt.
    if (relevantDocs.length > 0) {
      await sendSSE({
        type: 'sources',
        sources: relevantDocs.map((d) => ({
          name: d.originalName,
          score: d.relevanceScore,
          excerpt: d.content.substring(0, 200),
        })),
      })
    }

    // Get recent operation logs for context
    logger.info('[STREAMING] Getting recent operations...')
    const recentOperations = await operationLogger.getRecentOperations(24)
    logger.info('[STREAMING] Recent operations retrieved:', { data: recentOperations.length })
    logger.info('[STREAMING] Getting operation summary...')
    const operationSummary = await operationLogger.getOperationSummary(24)
    logger.info('[STREAMING] Operation summary retrieved')

    // Build enhanced context
    let context = ''

    if (relevantDocs.length > 0) {
      context += `\n\n=== RELEVANT DOCUMENTATION ===\n`
      relevantDocs.forEach((doc, index) => {
        context += `\nDocument ${index + 1}: ${doc.originalName} (Relevance: ${doc.relevanceScore})\n`
        context += `Matched terms: ${doc.matchedTerms.join(', ')}\n`
        // v2.49.0: tightened from 1000 → 600 chars per chunk. Chat-route
        // audit flagged context-budget risk: 8 chunks × 1000 + persona +
        // tools + chat-history was approaching llama3.1:8b's 8K context
        // window. 600 × 8 = 4.8KB keeps comfortable headroom.
        context += `Content excerpt: ${doc.content.substring(0, 600)}...\n`
        context += `---\n`
      })
    }

    // v2.49.0: broadened — chat-route audit flagged the old regex
    // (`status|error|problem|issue|trouble|working|broken|log|recent|activity`)
    // missed queries like "what happened last night?" or "why is the
    // kitchen zone quiet?". Now include 24h activity context for ANY
    // non-trivially-short query (≥6 chars), since the operator is
    // usually asking about the system. Tradeoff: ~400 bytes per request
    // on RAG-only queries that don't need it — acceptable.
    const isOperationalQuery = message.trim().length >= 6
    if (isOperationalQuery && (recentOperations.length > 0 || operationSummary.errorCount > 0)) {
      context += `\n\n=== RECENT SYSTEM ACTIVITY ===\n`
      context += `Operations in last 24h: ${operationSummary.totalOperations}\n`
      context += `Success rate: ${operationSummary.successRate.toFixed(1)}%\n`
      context += `Error count: ${operationSummary.errorCount}\n`
      
      if (operationSummary.mostCommonOperations.length > 0) {
        context += `Most common operations:\n`
        operationSummary.mostCommonOperations.slice(0, 3).forEach(op => {
          context += `  - ${op.type}: ${op.count} times\n`
        })
      }
      
      if (operationSummary.patterns.length > 0) {
        context += `Usage patterns:\n`
        operationSummary.patterns.slice(0, 3).forEach(pattern => {
          context += `  - ${pattern.pattern}: ${pattern.count} occurrences\n`
        })
      }
      
      if (recentOperations.length > 0) {
        context += `\nRecent operations (last 5):\n`
        recentOperations.slice(0, 5).forEach(op => {
          context += `  - ${new Date(op.timestamp).toLocaleString()}: ${op.type} - ${op.action} ${op.success ? '✓' : '✗'}\n`
        })
      }
    }

    // Get available AI tools
    logger.info('[STREAMING] Getting available tools...')
    const availableTools = enableTools ? getAvailableTools() : []
    logger.info('[STREAMING] Available tools:', { data: availableTools.length })
    const toolsPrompt = enableTools ? buildToolsPrompt(availableTools) : ''
    logger.info('[STREAMING] Tools prompt built')

    // Get or create chat session
    logger.info('[STREAMING] Getting chat session...')
    let session
    if (sessionId) {
      session = await findUnique('chatSessions', eq(schema.chatSessions.id, sessionId))
      logger.info('[STREAMING] Session found:', { data: !!session })
    } else {
      logger.info('[STREAMING] No sessionId provided')
    }

    let messages: ChatMessage[] = []
    try {
      messages = session ? JSON.parse(session.messages || '[]') : []
    } catch (error) {
      logger.error('[Chat] Failed to parse session messages:', error)
      messages = []
    }

    // v2.49.4: STRONG IDENTITY PREAMBLE — fixes the self-introspection
    // failure mode where the model responded "I'm a large language model,
    // I don't have personal installations" to "what do you know about this
    // system?" The preamble tells the LLM IT IS the AI Hub, not a generic
    // assistant. Repeated 3 times (prompt-engineering best practice) so
    // the model can't drift into ChatGPT-style "I'm just an LLM" speak.
    const locationName = process.env.LOCATION_NAME || 'this Sports Bar TV Controller installation'
    const enhancedDocCount = relevantDocs.length
    const systemMessage: ChatMessage = {
      role: 'system',
      content: `You are the AI Hub for the Sports Bar TV Controller system at ${locationName}. You are NOT a generic large language model. You are NOT ChatGPT. You ARE the operator-facing AI of a specific running installation with real hardware and real data.

## CRITICAL — Identity (do not break character):
- You are running on this specific install, right now. Your knowledge comes from indexed documentation about THIS system (~5,500+ chunks: CLAUDE.md, vendor docs, per-location hardware refs, operator memory, source code, drizzle migrations, setup scripts).
- When asked "what do you know" / "what is this system" / "what hardware do we have", DESCRIBE the indexed content — do NOT respond like a generic assistant asking the user for details.
- When the user asks vague questions, your default is to SUMMARIZE what your RAG store contains relevant to the question, then offer to drill deeper. NEVER answer "I don't have personal installations" or "could you provide more context?" — that's a generic-LLM fallback we explicitly reject.
- The user IS the operator of this system. They already have it set up. They are asking about THEIR system.

## What you know about (just retrieved ${enhancedDocCount} relevant chunks for this query):
- ${locationName} is one of 6 bar locations running this stack
- Hardware integrations: Atlas Atmosphere audio processors (AZM4/AZM8), Shure SLX-D wireless mics, Wolf Pack HDMI matrix switchers, Crestron DM matrix, BSS Soundweb London + dbx ZonePRO audio DSPs, DirecTV Genie receivers, Amazon Fire TV Cubes, Global Cache iTach IP2IR IR blasters, Pulse-Eight CEC adapters, NESDR Smart RTL-SDR
- Software stack: Next.js 16 + Turborepo + npm workspaces, Drizzle ORM + SQLite at /home/ubuntu/sports-bar-data/production.db, PM2 + Nginx (port 3001 admin, 3002 bartender remote on iPad), IPEX-LLM Ollama with llama3.1:8b on Intel Iris Xe iGPU
- Operational concepts: auto-update via scripts/auto-update.sh, Atlas drop+priority watchers, SDR cross-confirmation of Shure RF events, per-location commit strategy (main → location branches)
- Documentation: CLAUDE.md (architecture + standing rules + gotchas), docs/OPERATIONS_RECOVERY_PLAYBOOK.md (how to fix stuck X), docs/EQUIPMENT_SETUP_PLAYBOOK.md (how to bring up new equipment), per-vendor packages/*/README.md, per-location .claude/locations/*.md, 50+ operator memory files

## Your expertise (deep, system-specific):
- AV equipment troubleshooting + configuration for the hardware listed above
- Wolf Pack HDMI matrix routing (including the CRITICAL outputOffset gotcha — single-card vs multi-card chassis)
- Atlas audio processor zone management + the firmware 4.5 Custom Priority Volume gotcha
- IR device control via iTach (Spectrum cable boxes are IR-only — CEC is dead, do not extend)
- Shure SLX-D RF coordination + 3-detector cross-confirmation pipeline (Shure narrow + SDR wide + Atlas mic-level)
- Network troubleshooting + system diagnostics for this multi-location fleet
- Daily operations + auto-update + per-location bootstrap

## Your capabilities:
- Search and quote from indexed documentation with citation
- Walk the operator through step-by-step recovery + setup procedures
- Cite specific source files (CLAUDE.md §N, docs/X.md, packages/Y/README.md, .claude/locations/Z.md) for every claim
- Identify when a question is outside what your docs cover, and say so explicitly

${toolsPrompt}

## Tool Usage:
When you need to access files, execute code, or perform system operations, use the available tools by responding in this format:

TOOL_CALL: tool_name
{
  "parameter": "value"
}

Available tools: ${availableTools.map(t => t.name).join(', ')}

## Response Guidelines:
- Be concise but thorough
- Provide step-by-step instructions when appropriate
- Reference specific documentation when available
- Suggest preventive measures
- Use tools when they can provide better information
- Always explain what you're doing when using tools

${context}

## CRITICAL — Grounding rules (v2.49.0 — placed AT END for LLM recency):
When the RELEVANT DOCUMENTATION section above contains a specific name,
port, property, IP, file path, version, command flag, or wire-protocol
token that answers the question, **QUOTE IT VERBATIM from the
documentation**. Do not paraphrase or substitute with a generic term
you remember from training data — our docs are authoritative on every
detail of this system. If the docs disagree with what you remember,
the docs win.

### Anti-inversion rule (CRITICAL — fact-checker 2026-05-18 fail mode):
Our docs frequently use the pattern "**X (NOT Y)**" to call out a
specific value AND warn against the wrong one. When you see that
pattern, the correct answer is **X**, not Y. Example from the Shure
docs:

  > Wire-protocol property names per Shure's spec — **TX_MODEL (NOT TX_TYPE)**

The answer to "what's the transmitter model property name?" is
**TX_MODEL**. Do NOT answer TX_TYPE — that's the explicitly-wrong value
the docs are warning against. Same pattern applies to GROUP_CHANNEL
(NOT GROUP_CHAN), audio gain offset (+18 NOT raw dB), etc.

### Product-line anti-confusion rule (CRITICAL — 2026-05-18 operator failure):
Shure makes BOTH **SLX** (analog, discontinued) and **SLX-D** (digital,
current). The two have DIFFERENT scan + sync procedures despite the
similar name. **Our system uses SLX-D.** When a user asks "how do I
scan with my Shure SLX" or "my Shure SLX wireless mic", they mean
**SLX-D** — that's all we own. Don't fall back to training-data SLX
(analog) procedures (TX-side encoder, "Menu" on the handheld, Sync
button on receiver matching TX). The actual SLX-D procedure lives in
docs/runbooks/SHURE_FREQUENCY_SCAN.md + packages/shure-slxd/README.md:

  > SLX-D scans run on the RECEIVER's front panel (Utilities → Group Scan),
  > NOT on the transmitter. After the receiver picks a clean frequency, you
  > IR-sync the handheld TX to it (battery compartment IR window held ~6
  > inches from receiver IR sensor + press Sync). Network-side scan does
  > NOT exist over TCP 2202 in firmware 1.4.7.0 — front panel or bust.

Same product-line trap applies to other Shure lines (QLX-D, ULX-D, AD,
Axient). When in doubt that the docs cover the user's specific product,
say so explicitly — don't substitute training-data knowledge of a
similar-named product.

### Table extraction rule (CRITICAL — Q3 fail mode):
Our docs often use markdown tables for per-location reference data.
Example from CLAUDE.md §4:

  > | Location | Model | Layout | outputOffset | audioOutputCount | Notes |
  > | Lucky's 1313 | Wolf Pack WP-36X36 | Single-card | 0 (enforced) | 0 | ... |

When the user asks "what's Lucky's 1313 outputOffset?", READ THE ROW
FROM THE TABLE and answer "**0**" (or "**0 (enforced)**"). Do NOT say
"the table is not explicit" or "I couldn't find the value" — the value
IS in the row. Tables are first-class data: extract the cell that
matches the user's question, even if the answer is a single number.

The same applies to per-location hardware tables in .claude/locations/*.md,
per-version manual-steps tables in docs/VERSION_SETUP_GUIDE.md, and
status tables in docs/FLEET_STATUS.md. Always extract; never hedge.

### Extraction rule:
If the documentation explicitly contains the detail being asked but
appears partial or unclear, EXTRACT what's there and note the gap —
don't refuse outright. The operator wants the best answer the docs
support, not a refusal because the answer isn't a perfect verbatim
match.

Only respond with "I don't see that in the indexed documentation" when
you have genuinely checked all RELEVANT DOCUMENTATION snippets and
NONE address the question. Do not refuse on uncertainty — extract from
what's there.`,
    }

    // Add user message
    messages.push({
      role: 'user',
      content: message,
    })

    // OPTIMIZED: Stream response from Ollama
    logger.info('[STREAMING] Sending status: Generating response...')
    await sendSSE({ type: 'status', message: 'Generating response...' })
    
    logger.info('[STREAMING] Calling Ollama API at:', { data: OLLAMA_BASE_URL })
    logger.info('[STREAMING] Using model:', { data: OLLAMA_MODEL })
    logger.info('[STREAMING] Message count:', { data: [systemMessage, ...messages].length })
    
    const response = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        messages: [systemMessage, ...messages],
        stream: true, // Enable streaming from Ollama
        options: {
          temperature: 0.3, // v2.46.3: lowered from 0.7 for RAG fidelity
          top_p: 0.9,
        },
      }),
    })

    logger.info('[STREAMING] Ollama response status:', { data: response.status })
    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.status}`)
    }

    // Stream the response
    logger.info('[STREAMING] Getting response reader...')
    const reader = response.body?.getReader()
    if (!reader) {
      throw new Error('No response body')
    }

    logger.info('[STREAMING] Starting to read stream...')
    let fullResponse = ''
    const decoder = new TextDecoder()

    while (true) {
      const { done, value } = await reader.read()
      if (done) {
        logger.info('[STREAMING] Stream reading complete')
        break
      }

      const chunk = decoder.decode(value)
      const lines = chunk.split('\n').filter(line => line.trim())

      for (const line of lines) {
        try {
          const data = JSON.parse(line)
          
          if (data.message?.content) {
            const content = data.message.content
            fullResponse += content
            
            // Send content chunk to client
            await sendSSE({ 
              type: 'content', 
              content,
              done: false 
            })
          }

          if (data.done) {
            break
          }
        } catch (e) {
          // Skip invalid JSON lines
        }
      }
    }

    // v2.49.1: capture tool results so we can include them when
    // persisting the assistant message — chat-route audit BUG #1
    // (multi-turn sessions used to lose the tool-call/result history).
    let persistedToolResults: ToolResult[] = []

    // Check for tool calls in the response
    if (enableTools && fullResponse.includes('TOOL_CALL:')) {
      await sendSSE({ type: 'status', message: 'Executing tools...' })
      const toolResults = await handleToolCalls(fullResponse)
      persistedToolResults = toolResults

      if (toolResults.length > 0) {
        // Send tool results
        await sendSSE({
          type: 'tool_results',
          results: toolResults
        })

        // Get follow-up response with tool results
        const followUpResponse = await getFollowUpResponse(
          systemMessage,
          messages,
          fullResponse,
          toolResults
        )

        await sendSSE({
          type: 'content',
          content: followUpResponse,
          done: true
        })

        fullResponse += '\n\n' + followUpResponse
      }
    }

    // Save conversation — v2.49.1: persist tool results too so reloaded
    // sessions have full context (previously only the text was saved,
    // making multi-turn debugging blind to prior tool outputs).
    const assistantMsg: ChatMessage = { role: 'assistant', content: fullResponse }
    if (persistedToolResults.length > 0) {
      assistantMsg.toolResults = persistedToolResults
    }
    messages.push(assistantMsg)

    if (sessionId) {
      // v2.49.6: was update() — silently no-op'd when the sessionId row
      // didn't exist yet, so 0 chat sessions ever persisted despite the
      // UI sending UUIDs. upsert() correctly creates on first message.
      const nowIso = new Date().toISOString()
      const titleGuess = (messages.find((m: ChatMessage) => m.role === 'user')?.content || 'New chat').slice(0, 80)
      await upsert(
        'chatSessions',
        eq(schema.chatSessions.id, sessionId),
        {
          id: sessionId,
          title: titleGuess,
          messages: JSON.stringify(messages),
          createdAt: nowIso,
          updatedAt: nowIso,
        },
        {
          messages: JSON.stringify(messages),
          updatedAt: nowIso,
        },
      )
    }

    // Send completion
    await sendSSE({
      type: 'done',
      sessionId: sessionId || 'new'
    })

  } catch (error) {
    logger.error('Streaming error:', error)
    await sendSSE({ 
      type: 'error', 
      error: error instanceof Error ? error.message : 'Unknown error' 
    })
  }
}

/**
 * Handle non-streaming chat (fallback)
 */
async function handleNonStreamingChat(
  message: string,
  sessionId: string | undefined,
  enableTools: boolean
): Promise<NextResponse> {
  // v2.46.3: topK 5→8 — see fact-checker re-grill 2026-05-18
  const relevantDocs = await searchDocsViaRag(message, 8)
  
  // Get recent operation logs
  const recentOperations = await operationLogger.getRecentOperations(24)
  const operationSummary = await operationLogger.getOperationSummary(24)
  
  // Build context (same as streaming version)
  let context = ''
  
  if (relevantDocs.length > 0) {
    context += `\n\n=== RELEVANT DOCUMENTATION ===\n`
    relevantDocs.forEach((doc, index) => {
      context += `\nDocument ${index + 1}: ${doc.originalName} (Relevance: ${doc.relevanceScore})\n`
      // v2.49.0: 600-char chunks (was 1000) — context-budget safety
      context += `Content: ${doc.content.substring(0, 600)}...\n`
    })
  }

  const availableTools = enableTools ? getAvailableTools() : []
  const toolsPrompt = enableTools ? buildToolsPrompt(availableTools) : ''

  let session
  if (sessionId) {
    session = await findUnique('chatSessions', eq(schema.chatSessions.id, sessionId))
  }

  let messages: ChatMessage[] = []
  try {
    messages = session ? JSON.parse(session.messages || '[]') : []
  } catch (error) {
    logger.error('[Chat] Failed to parse session messages (non-streaming):', error)
    messages = []
  }

  const systemMessage: ChatMessage = {
    role: 'system',
    content: `You are a Sports Bar AI Assistant with access to documentation and tools.

${toolsPrompt}
${context}

## CRITICAL — Grounding rules (v2.49.0 — placed AT END for LLM recency):
When the RELEVANT DOCUMENTATION section above contains a specific name,
port, property, IP, file path, version, command flag, or wire-protocol
token that answers the question, **QUOTE IT VERBATIM from the
documentation**. Do not paraphrase or substitute with a generic term
you remember from training data — our docs are authoritative.

If the documentation contains the detail but appears partial, EXTRACT
what's there and note the gap — don't refuse outright.

Only respond with "I don't see that in the indexed documentation" when
NONE of the snippets address the question. Do not refuse on uncertainty.`,
  }

  messages.push({ role: 'user', content: message })

  // Call Ollama without streaming
  const response = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      messages: [systemMessage, ...messages],
      stream: false,
      options: {
        temperature: 0.3, // v2.46.3: match streaming-path fidelity setting
        top_p: 0.9,
      },
    }),
  })

  if (!response.ok) {
    throw new Error(`Ollama API error: ${response.status}`)
  }

  const data = await response.json()
  let aiResponse = data.message?.content || ''

  // Handle tool calls (v2.49.1: capture results for session persistence)
  let nsPersistedToolResults: ToolResult[] = []
  if (enableTools && aiResponse.includes('TOOL_CALL:')) {
    const toolResults = await handleToolCalls(aiResponse)
    nsPersistedToolResults = toolResults

    if (toolResults.length > 0) {
      const followUp = await getFollowUpResponse(
        systemMessage,
        messages,
        aiResponse,
        toolResults
      )
      aiResponse += '\n\n' + followUp
    }
  }

  const nsAssistantMsg: ChatMessage = { role: 'assistant', content: aiResponse }
  if (nsPersistedToolResults.length > 0) {
    nsAssistantMsg.toolResults = nsPersistedToolResults
  }
  messages.push(nsAssistantMsg)

  if (sessionId) {
    // v2.49.6: upsert (was update — silently no-op'd for new sessionIds)
    const nowIso = new Date().toISOString()
    const titleGuess = (messages.find((m: ChatMessage) => m.role === 'user')?.content || 'New chat').slice(0, 80)
    await upsert(
      'chatSessions',
      eq(schema.chatSessions.id, sessionId),
      {
        id: sessionId,
        title: titleGuess,
        messages: JSON.stringify(messages),
        createdAt: nowIso,
        updatedAt: nowIso,
      },
      {
        messages: JSON.stringify(messages),
        updatedAt: nowIso,
      },
    )
  }

  return NextResponse.json({
    response: aiResponse,
    sessionId: sessionId || 'new',
    // v2.49.0: source citations so the UI can render "answer based on
    // docs X/Y/Z" — closes UX-audit BROKEN-#3 (no source attribution).
    sources: relevantDocs.map((d) => ({
      name: d.originalName,
      score: d.relevanceScore,
      excerpt: d.content.substring(0, 200),
    })),
    model: OLLAMA_MODEL, // v2.49.0: surface model for UI badge + better error messages
  })
}

/**
 * Build tools prompt for system message
 */
function buildToolsPrompt(tools: ToolDefinition[]): string {
  if (tools.length === 0) return ''

  let prompt = '\n\n## Available Tools:\n'
  
  tools.forEach(tool => {
    prompt += `\n### ${tool.name}\n`
    prompt += `${tool.description}\n`
    prompt += `Security Level: ${tool.securityLevel}\n`
    
    if (tool.parameters.length > 0) {
      prompt += 'Parameters:\n'
      tool.parameters.forEach(param => {
        prompt += `  - ${param.name} (${param.type})${param.required ? ' [required]' : ''}: ${param.description}\n`
      })
    }
  })

  return prompt
}

/**
 * Handle tool calls from AI response
 */
async function handleToolCalls(response: string): Promise<ToolResult[]> {
  const toolCallPattern = /TOOL_CALL:\s*(\w+)\s*\{([^}]+)\}/g
  const results: ToolResult[] = []
  let match

  while ((match = toolCallPattern.exec(response)) !== null) {
    const toolName = match[1]
    const paramsStr = match[2]

    try {
      const params = JSON.parse(`{${paramsStr}}`)
      const context = createDefaultContext()
      
      const result = await executeTool(toolName, params, context)
      
      results.push({
        id: `tool_${Date.now()}_${Math.random()}`,
        name: toolName,
        result: result.output,
        success: result.success,
        error: result.error,
      })
    } catch (error) {
      results.push({
        id: `tool_${Date.now()}_${Math.random()}`,
        name: toolName,
        result: null,
        success: false,
        error: error instanceof Error ? error.message : 'Tool execution failed',
      })
    }
  }

  return results
}

/**
 * Get follow-up response after tool execution
 */
async function getFollowUpResponse(
  systemMessage: ChatMessage,
  messages: ChatMessage[],
  initialResponse: string,
  toolResults: ToolResult[]
): Promise<string> {
  const toolResultsText = toolResults
    .map(r => `Tool: ${r.name}\nSuccess: ${r.success}\nResult: ${JSON.stringify(r.result, null, 2)}`)
    .join('\n\n')

  const followUpMessages = [
    systemMessage,
    ...messages,
    { role: 'assistant' as const, content: initialResponse },
    { 
      role: 'tool' as const, 
      content: `Tool execution results:\n\n${toolResultsText}\n\nPlease provide a summary of these results.` 
    },
  ]

  const response = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      messages: followUpMessages,
      stream: false,
    }),
  })

  if (!response.ok) {
    throw new Error('Failed to get follow-up response')
  }

  const data = await response.json()
  return data.message?.content || 'Tool execution completed.'
}
