#!/usr/bin/env npx tsx

/**
 * Apply Authentication to API Endpoints
 *
 * This script analyzes all API endpoints and applies authentication middleware
 * based on the configured access levels in AUTH_CONFIG.
 *
 * Usage:
 *   npx tsx scripts/apply-authentication.ts [--dry-run] [--endpoint=path]
 *
 * Options:
 *   --dry-run      Show what would be changed without making changes
 *   --endpoint     Apply auth to a specific endpoint only
 */

import fs from 'fs'
import path from 'path'
import { glob } from 'glob'

const DRY_RUN = process.argv.includes('--dry-run')
const SPECIFIC_ENDPOINT = process.argv.find(arg => arg.startsWith('--endpoint='))?.split('=')[1]

interface EndpointInfo {
  filePath: string
  endpoint: string
  methods: string[]
  hasAuth: boolean
  hasRateLimit: boolean
  hasValidation: boolean
  hasConfirmation: boolean
  accessLevel: 'PUBLIC' | 'STAFF' | 'ADMIN' | 'WEBHOOK'
  needsAuth: boolean
  needsConfirmation: boolean
}

// Critical endpoints that require ADMIN access and confirmation
const ADMIN_WITH_CONFIRMATION = [
  '/api/system/reboot',
  '/api/system/restart',
  '/api/system/shutdown',
  '/api/git/commit-push',
  '/api/git/pull',
  '/api/git/reset',
  '/api/file-system/execute',
  '/api/file-system/write-script',
]

// Public endpoints (no auth required)
const PUBLIC_ENDPOINTS = [
  '/api/health',
  '/api/health-check',
  '/api/status',
  '/api/system/health',
  '/api/system/health-check',
  '/api/system/status',
  '/api/sports-guide',
  '/api/streaming/events',
  '/api/streaming/status',
  '/api/home-teams',
  '/api/selected-leagues',
  '/api/tv-provider',
  '/api/logs/preview',
  '/api/logs/stats',
  '/api/logs/analytics',
  '/api/auth/login', // Login endpoint itself
]

// Webhook endpoints (API key auth)
const WEBHOOK_ENDPOINTS = [
  '/api/webhooks',
  '/api/n8n',
  '/api/automation',
]

// Admin-only endpoints (no confirmation needed)
const ADMIN_ENDPOINTS = [
  '/api/auth/pins',
  '/api/auth/api-keys',
  '/api/auth/audit-log',
  '/api/config',
  '/api/git/status',
  '/api/git/log',
]

async function analyzeEndpoint(filePath: string): Promise<EndpointInfo> {
  const content = fs.readFileSync(filePath, 'utf-8')
  const relativePath = filePath.replace(process.cwd(), '')

  // Extract endpoint path from file path
  const endpoint = relativePath
    .replace('/src/app/api', '/api')
    .replace('/route.ts', '')

  // Find HTTP methods
  const methods: string[] = []
  if (content.includes('export async function GET')) methods.push('GET')
  if (content.includes('export async function POST')) methods.push('POST')
  if (content.includes('export async function PUT')) methods.push('PUT')
  if (content.includes('export async function PATCH')) methods.push('PATCH')
  if (content.includes('export async function DELETE')) methods.push('DELETE')

  // Check existing middleware
  const hasAuth = content.includes('requireAuth') || content.includes('checkAuth')
  const hasRateLimit = content.includes('withRateLimit') || content.includes('RateLimitConfigs')
  const hasValidation = content.includes('validateRequestBody') || content.includes('validateQueryParams')
  const hasConfirmation = content.includes('confirm') && content.includes('literal(true)')

  // Determine access level
  let accessLevel: 'PUBLIC' | 'STAFF' | 'ADMIN' | 'WEBHOOK' = 'STAFF' // Default
  let needsConfirmation = false

  if (PUBLIC_ENDPOINTS.some(pe => endpoint === pe || endpoint.startsWith(pe))) {
    accessLevel = 'PUBLIC'
  } else if (WEBHOOK_ENDPOINTS.some(we => endpoint.startsWith(we))) {
    accessLevel = 'WEBHOOK'
  } else if (ADMIN_WITH_CONFIRMATION.some(ae => endpoint === ae)) {
    accessLevel = 'ADMIN'
    needsConfirmation = true
  } else if (ADMIN_ENDPOINTS.some(ae => endpoint.startsWith(ae))) {
    accessLevel = 'ADMIN'
  } else if (endpoint.startsWith('/api/auth/')) {
    // Auth endpoints have special handling
    if (endpoint === '/api/auth/logout' || endpoint === '/api/auth/session') {
      accessLevel = 'STAFF' // Logout and session check require any auth
    }
  }

  const needsAuth = accessLevel !== 'PUBLIC' && !hasAuth

  return {
    filePath,
    endpoint,
    methods,
    hasAuth,
    hasRateLimit,
    hasValidation,
    hasConfirmation,
    accessLevel,
    needsAuth,
    needsConfirmation: needsConfirmation && !hasConfirmation,
  }
}

function generateAuthCode(info: EndpointInfo): string {
  const imports = []
  const authChecks = []

  // Import auth middleware if needed
  if (info.needsAuth && !info.hasAuth) {
    imports.push(`import { requireAuth } from '@/lib/auth/middleware'`)
  }

  // Generate auth check code for each method
  for (const method of info.methods) {
    const authCheck = []

    if (info.needsAuth) {
      if (info.accessLevel === 'WEBHOOK') {
        authCheck.push(`  // API key authentication
  const authResult = await requireAuth(request, 'STAFF', {
    allowApiKey: true,
    auditAction: '${method}_${info.endpoint.replace(/\//g, '_').toUpperCase()}',
    auditResource: '${info.endpoint.split('/').filter(Boolean)[1] || 'api'}',
  })
  if (!authResult.allowed) return authResult.response!
`)
      } else {
        authCheck.push(`  // Authentication check
  const authResult = await requireAuth(request, '${info.accessLevel}')
  if (!authResult.allowed) return authResult.response!
`)
      }
    }

    if (info.needsConfirmation && method === 'POST') {
      authCheck.push(`  // Confirmation required for destructive operation
  const body = await request.json()
  if (!body.confirm || body.confirm !== true) {
    return NextResponse.json({
      error: 'Confirmation required',
      message: 'This is a destructive operation. Send { confirm: true } to proceed.',
      requiresConfirmation: true,
    }, { status: 400 })
  }
`)
    }

    authChecks.push({
      method,
      code: authCheck.join('\n'),
    })
  }

  return JSON.stringify({ imports, authChecks }, null, 2)
}

function applyAuth(info: EndpointInfo): boolean {
  if (!info.needsAuth && !info.needsConfirmation) {
    return false // No changes needed
  }

  let content = fs.readFileSync(info.filePath, 'utf-8')
  let modified = false

  // Add import if needed
  if (info.needsAuth && !content.includes('requireAuth')) {
    const importStatement = `import { requireAuth } from '@/lib/auth/middleware'\n`

    // Find the last import statement
    const lastImportIndex = content.lastIndexOf('import ')
    if (lastImportIndex !== -1) {
      const nextNewline = content.indexOf('\n', lastImportIndex)
      content = content.slice(0, nextNewline + 1) + importStatement + content.slice(nextNewline + 1)
      modified = true
    }
  }

  // Apply auth to each method
  for (const method of info.methods) {
    const methodRegex = new RegExp(`export async function ${method}\\(request: NextRequest[^)]*\\) {`, 'g')
    const match = methodRegex.exec(content)

    if (match) {
      const insertPos = match.index + match[0].length
      let authCode = '\n'

      if (info.needsAuth) {
        if (info.accessLevel === 'WEBHOOK') {
          authCode += `  // API key authentication\n`
          authCode += `  const authResult = await requireAuth(request, 'STAFF', {\n`
          authCode += `    allowApiKey: true,\n`
          authCode += `    auditAction: '${method}_${info.endpoint.replace(/\//g, '_').toUpperCase()}',\n`
          authCode += `    auditResource: '${info.endpoint.split('/').filter(Boolean)[1] || 'api'}',\n`
          authCode += `  })\n`
          authCode += `  if (!authResult.allowed) return authResult.response!\n\n`
        } else {
          authCode += `  // Authentication check (${info.accessLevel} level required)\n`
          authCode += `  const authResult = await requireAuth(request, '${info.accessLevel}')\n`
          authCode += `  if (!authResult.allowed) return authResult.response!\n\n`
        }
      }

      content = content.slice(0, insertPos) + authCode + content.slice(insertPos)
      modified = true
    }
  }

  if (modified && !DRY_RUN) {
    fs.writeFileSync(info.filePath, content, 'utf-8')
  }

  return modified
}

async function main() {
  console.log('🔐 Analyzing API endpoints for authentication...\n')

  // Find all route files
  const routeFiles = await glob('src/app/api/**/route.ts', {
    cwd: process.cwd(),
    absolute: true,
  })

  console.log(`Found ${routeFiles.length} API endpoint files\n`)

  // Filter for specific endpoint if requested
  const filesToProcess = SPECIFIC_ENDPOINT
    ? routeFiles.filter(f => f.includes(SPECIFIC_ENDPOINT))
    : routeFiles

  if (SPECIFIC_ENDPOINT && filesToProcess.length === 0) {
    console.error(`❌ Endpoint not found: ${SPECIFIC_ENDPOINT}`)
    process.exit(1)
  }

  // Analyze all endpoints
  const endpoints: EndpointInfo[] = []
  for (const file of filesToProcess) {
    try {
      const info = await analyzeEndpoint(file)
      endpoints.push(info)
    } catch (error) {
      console.error(`Error analyzing ${file}:`, error)
    }
  }

  // Categorize endpoints
  const needsAuth = endpoints.filter(e => e.needsAuth)
  const needsConfirmation = endpoints.filter(e => e.needsConfirmation)
  const hasAuth = endpoints.filter(e => e.hasAuth)
  const publicEndpoints = endpoints.filter(e => e.accessLevel === 'PUBLIC')
  const staffEndpoints = endpoints.filter(e => e.accessLevel === 'STAFF')
  const adminEndpoints = endpoints.filter(e => e.accessLevel === 'ADMIN')
  const webhookEndpoints = endpoints.filter(e => e.accessLevel === 'WEBHOOK')

  // Print summary
  console.log('📊 Summary:')
  console.log(`  Total endpoints: ${endpoints.length}`)
  console.log(`  PUBLIC: ${publicEndpoints.length}`)
  console.log(`  STAFF: ${staffEndpoints.length}`)
  console.log(`  ADMIN: ${adminEndpoints.length}`)
  console.log(`  WEBHOOK: ${webhookEndpoints.length}`)
  console.log(`  Already protected: ${hasAuth.length}`)
  console.log(`  Need authentication: ${needsAuth.length}`)
  console.log(`  Need confirmation: ${needsConfirmation.length}\n`)

  if (DRY_RUN) {
    console.log('🔍 DRY RUN - No changes will be made\n')
  }

  // Apply authentication to endpoints that need it
  let appliedCount = 0
  for (const endpoint of needsAuth) {
    console.log(`${DRY_RUN ? '[DRY RUN] ' : ''}Applying ${endpoint.accessLevel} auth to: ${endpoint.endpoint}`)

    if (!DRY_RUN) {
      const success = applyAuth(endpoint)
      if (success) appliedCount++
    } else {
      appliedCount++
    }
  }

  console.log(`\n✅ ${DRY_RUN ? 'Would apply' : 'Applied'} authentication to ${appliedCount} endpoints`)

  // Show endpoints that still need confirmation
  if (needsConfirmation.length > 0) {
    console.log(`\n⚠️  ${needsConfirmation.length} endpoints still need confirmation prompts:`)
    for (const endpoint of needsConfirmation) {
      console.log(`  - ${endpoint.endpoint}`)
    }
  }
}

main().catch(console.error)
