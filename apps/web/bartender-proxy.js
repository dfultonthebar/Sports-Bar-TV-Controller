/**
 * Bartender Remote Proxy Server
 *
 * Runs on port 3002 and proxies to the main app on port 3001.
 * - Root "/" redirects to "/remote" (bartender remote)
 * - Blocks access to admin pages (device-config, matrix-control, system-admin, etc.)
 * - Allows all API routes (needed for remote functionality)
 * - Allows all static assets (_next, icons, etc.)
 */

const http = require('http')

const BACKEND_PORT = 3001
const PROXY_PORT = 3002
const BACKEND_HOST = '127.0.0.1'

// Admin routes that bartenders should NOT access
const BLOCKED_ROUTES = [
  '/device-config',
  '/matrix-control',
  '/system-admin',
  '/system-health',
  '/layout-editor',
  '/sports-guide-config',
  '/settings',
  '/login',
  '/test-upload',
  '/ai-diagnostics',
  '/ai-gameplan',
]

const server = http.createServer((req, res) => {
  const url = req.url || '/'
  const pathname = url.split('?')[0]

  // Redirect root to bartender remote
  if (pathname === '/' || pathname === '') {
    res.writeHead(302, { 'Location': '/remote' })
    res.end()
    return
  }

  // Block admin routes
  const isBlocked = BLOCKED_ROUTES.some(route => pathname.startsWith(route))
  if (isBlocked) {
    res.writeHead(302, { 'Location': '/remote' })
    res.end()
    return
  }

  // Proxy everything else to the main app
  const proxyReq = http.request({
    hostname: BACKEND_HOST,
    port: BACKEND_PORT,
    path: url,
    method: req.method,
    headers: {
      ...req.headers,
      host: `${BACKEND_HOST}:${BACKEND_PORT}`,
      'x-forwarded-port': String(PROXY_PORT),
    }
  }, (proxyRes) => {
    res.writeHead(proxyRes.statusCode || 200, proxyRes.headers)
    proxyRes.pipe(res, { end: true })
  })

  proxyReq.on('error', (err) => {
    console.error('[BARTENDER-PROXY] Proxy error:', err.message)
    res.writeHead(502, { 'Content-Type': 'text/plain' })
    res.end('Service temporarily unavailable')
  })

  req.pipe(proxyReq, { end: true })
})

server.listen(PROXY_PORT, '0.0.0.0', () => {
  console.log(`[BARTENDER-PROXY] Bartender remote proxy running on port ${PROXY_PORT}`)
  console.log(`[BARTENDER-PROXY] Proxying to main app on port ${BACKEND_PORT}`)
  console.log(`[BARTENDER-PROXY] Root redirects to /remote`)
  console.log(`[BARTENDER-PROXY] Admin routes blocked`)

  // PM2 ready signal
  if (process.send) {
    process.send('ready')
  }
})

server.on('error', (err) => {
  console.error('[BARTENDER-PROXY] Server error:', err.message)
  process.exit(1)
})
