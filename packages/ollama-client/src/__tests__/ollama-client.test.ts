import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'

/** Tiny mock Ollama server. */
function startMock(label: string): Promise<{ url: string; server: http.Server; close: () => Promise<void> }> {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      if (req.url === '/api/tags') {
        res.writeHead(200, { 'content-type': 'application/json' })
        res.end(JSON.stringify({ models: [] }))
        return
      }
      if (req.url === '/api/generate') {
        res.writeHead(200, { 'content-type': 'application/json' })
        res.end(JSON.stringify({ response: label, eval_count: 1, done_reason: 'stop' }))
        return
      }
      res.writeHead(404)
      res.end()
    })
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address() as any
      resolve({
        url: `http://127.0.0.1:${addr.port}`,
        server,
        close: () => new Promise<void>((r) => server.close(() => r())),
      })
    })
  })
}

let remote: Awaited<ReturnType<typeof startMock>>
let local: Awaited<ReturnType<typeof startMock>>
let mod: typeof import('../index')

before(async () => {
  remote = await startMock('REMOTE')
  local = await startMock('LOCAL')
  process.env.OLLAMA_REMOTE_BASE = remote.url
  process.env.OLLAMA_BASE_URL = local.url
  process.env.OLLAMA_REMOTE_CONNECT_TIMEOUT_MS = '1500'
  mod = await import('../index')
  await mod.probeRemote() // deterministic: latch the breaker open
})

after(async () => {
  await local.close()
  try {
    await remote.close()
  } catch {
    /* may already be closed by a test */
  }
})

test('local-only policy always resolves to local', () => {
  assert.equal(mod.resolveOllamaBase('local-only'), local.url)
})

test('remote-first resolves to remote when the breaker is open', () => {
  assert.equal(mod.resolveOllamaBase('remote-first'), remote.url)
})

test('isConnectionError detects fast connection failures, not generic errors', () => {
  const refused: any = new Error('x')
  refused.cause = { code: 'ECONNREFUSED' }
  assert.equal(mod.isConnectionError(refused), true)
  assert.equal(mod.isConnectionError(new Error('plain slow response')), false)
})

test('ollamaGenerate hits the remote when up', async () => {
  const r = await mod.ollamaGenerate({ model: 'm', prompt: 'hi' }, { policy: 'remote-first' })
  assert.equal(r.response, 'REMOTE')
})

test('ollamaGenerate falls back to local on a connection error', async () => {
  await remote.close() // remote dies after the breaker was latched open
  const r = await mod.ollamaGenerate({ model: 'm', prompt: 'hi' }, { policy: 'remote-first' })
  assert.equal(r.response, 'LOCAL')
})
