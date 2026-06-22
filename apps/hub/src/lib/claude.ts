/**
 * "Ask Claude" path for the hub dashboard chat (SBCC Hub Phase C, item (a)).
 *
 * The default maintenance chat (`askFleet` in ./ai.ts) answers from the hub's
 * own time-series DB via the small shared local model on CT 212 — fast, free,
 * good for "what's the fleet doing right now". This path instead delegates the
 * question to the Claude Code CLI in READ-ONLY plan mode, for deep code /
 * diagnostic questions the local model can't reason about. It is grounded with
 * the SAME live fleet snapshot so Claude starts from current reality.
 *
 * Mirrors the proven runClaude() bridge in packages/mcp/src/server.ts:
 *  - question passed as an argv element (no shell) → not injectable
 *  - never-expiring ANTHROPIC_API_KEY from env or the hub .env → unattended
 *  - --permission-mode plan → no edits/commits/mutating bash
 *
 * DEPLOY PREREQUISITES on the hub box (CT 211) — without these the route
 * returns a clear "not available" message instead of crashing:
 *   - `claude` CLI installed (path via CLAUDE_BIN, default /home/ubuntu/.local/bin/claude)
 *   - ANTHROPIC_API_KEY in process env or {HUB_REPO_ROOT}/.env
 *   - (optional but recommended) the repo cloned at HUB_REPO_ROOT so Claude has
 *     codebase context; without it Claude still answers, just without repo files.
 *
 * Env:
 *   CLAUDE_BIN              default /home/ubuntu/.local/bin/claude
 *   HUB_CLAUDE_TIMEOUT_MS   default 300000 (deep plan-mode reads regularly exceed 180s)
 *   HUB_REPO_ROOT           cwd for the claude spawn + .env lookup (default process.cwd())
 *   MCP_CLAUDE_USE_OAUTH    'true' → use subscription OAuth instead of the metered API key
 */
import { spawn } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { buildFleetContext, type ChatMsg } from './ai'

const CLAUDE_BIN = process.env.CLAUDE_BIN || '/home/ubuntu/.local/bin/claude'
const CLAUDE_TIMEOUT_MS = Number(process.env.HUB_CLAUDE_TIMEOUT_MS) || 300_000
const REPO_ROOT = process.env.HUB_REPO_ROOT || process.env.REPO_ROOT || process.cwd()

/** Read a single var out of the repo .env (best-effort). */
function readRepoEnv(name: string): string | undefined {
  try {
    const txt = readFileSync(`${REPO_ROOT}/.env`, 'utf8')
    const m = txt.match(new RegExp(`^${name}=(.*)$`, 'm'))
    return m ? m[1].trim().replace(/^["']|["']$/g, '') : undefined
  } catch {
    return undefined
  }
}

const CLAUDE_API_KEY =
  process.env.MCP_CLAUDE_USE_OAUTH === 'true'
    ? undefined
    : process.env.ANTHROPIC_API_KEY || readRepoEnv('ANTHROPIC_API_KEY')

const PREAMBLE = `You are answering an operator's maintenance question for the SBCC multi-location
sports-bar TV control system, from the central fleet hub. A live FLEET STATUS snapshot is below.
Use it as ground truth for current fleet state; use your codebase access for "how/why" questions.
Be concise and practical — the operator is technical but busy. Never invent location names, device
counts, or errors. This is READ-ONLY: describe and diagnose, do not attempt edits or commands.`

/** Render the chat transcript into a single prompt for `claude -p`. */
function composePrompt(messages: ChatMsg[]): string {
  const transcript = messages
    .map((m) => `${m.role === 'assistant' ? 'Assistant' : 'Operator'}: ${m.content}`)
    .join('\n\n')
  return `${PREAMBLE}\n\n=== FLEET STATUS (live) ===\n${buildFleetContext()}\n\n=== CONVERSATION ===\n${transcript}`
}

/**
 * Run Claude Code headlessly in READ-ONLY plan mode. Resolves to the answer text;
 * never throws (returns a friendly message on missing CLI / timeout / failure).
 */
export function askClaude(messages: ChatMsg[]): Promise<string> {
  const prompt = composePrompt(messages)
  return new Promise((resolve) => {
    let child: ReturnType<typeof spawn>
    try {
      const childEnv: NodeJS.ProcessEnv = {
        ...process.env,
        PATH: `/home/ubuntu/.local/bin:${process.env.PATH || ''}`,
      }
      if (CLAUDE_API_KEY) {
        childEnv.ANTHROPIC_API_KEY = CLAUDE_API_KEY
      } else {
        // OAuth mode: drop any inherited key so the subscription OAuth is used.
        delete childEnv.ANTHROPIC_API_KEY
      }
      child = spawn(CLAUDE_BIN, ['-p', prompt, '--permission-mode', 'plan'], {
        cwd: REPO_ROOT,
        env: childEnv,
      })
    } catch (e) {
      return resolve(
        `Claude is not available on the hub: ${(e as Error).message}. ` +
          `Ensure the claude CLI is installed (CLAUDE_BIN=${CLAUDE_BIN}).`,
      )
    }
    let out = ''
    let err = ''
    const timer = setTimeout(() => {
      child.kill('SIGKILL')
      resolve(`Claude timed out after ${CLAUDE_TIMEOUT_MS / 1000}s. Try a narrower question.`)
    }, CLAUDE_TIMEOUT_MS)
    child.stdout?.on('data', (d) => {
      out += d.toString()
    })
    child.stderr?.on('data', (d) => {
      err += d.toString()
    })
    child.on('error', (e) => {
      clearTimeout(timer)
      resolve(
        `Could not run Claude on the hub: ${e.message}. ` +
          `Check that ${CLAUDE_BIN} exists and ANTHROPIC_API_KEY is set.`,
      )
    })
    child.on('close', () => {
      clearTimeout(timer)
      resolve((out.trim() || err.trim() || '(no output)').slice(0, 6000))
    })
  })
}
