import { NextRequest, NextResponse } from 'next/server'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'

import { logger } from '@sports-bar/logger'
import { z } from 'zod'
import { validateRequestBody, validateQueryParams, validatePathParams, ValidationSchemas, isValidationError, isValidationSuccess} from '@/lib/validation'

const execFileAsync = promisify(execFile)

// Whitelist of allowed test patterns to prevent command injection
const ALLOWED_TEST_PATTERNS: Record<string, string> = {
  'api': 'tests/integration/api.test.ts',
  'database': 'tests/integration/database.test.ts',
  'matrix': 'tests/integration/matrix.test.ts',
  'hardware': 'tests/integration/hardware.test.ts',
  'firetv': 'tests/integration/firetv.test.ts',
  'scenarios': 'tests/scenarios/user-workflows.test.ts',
  'all-safe': 'tests/integration/(api|database|matrix).test.ts',
  'all': 'tests/integration/**/*.test.ts'
}

/**
 * POST /api/tests/run
 * Execute integration tests with optional filtering
 *
 * Body:
 * {
 *   suite?: 'api' | 'database' | 'matrix' | 'hardware' | 'firetv' | 'scenarios' | 'all'
 *   safeMode?: boolean  // Skip hardware tests
 * }
 */
export async function POST(req: NextRequest) {
  const rateLimit = await withRateLimit(req, RateLimitConfigs.TESTING)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }


  // Input validation with strict schema
  const bodyValidation = await validateRequestBody(req, z.object({
    suite: z.enum(['api', 'database', 'matrix', 'hardware', 'firetv', 'scenarios', 'all-safe', 'all']).optional().default('all'),
    safeMode: z.boolean().optional().default(true)
  }))
  if (isValidationError(bodyValidation)) return bodyValidation.error
  try {
    const { suite, safeMode } = bodyValidation.data

    // Check safe mode restrictions for hardware tests
    if (safeMode && (suite === 'hardware' || suite === 'firetv')) {
      return NextResponse.json({
        success: false,
        error: `${suite === 'hardware' ? 'Hardware' : 'Fire TV'} tests disabled in safe mode`
      }, { status: 400 })
    }

    // Determine test pattern from whitelist (safe - no user input in pattern)
    let patternKey = suite
    if (suite === 'all' && safeMode) {
      patternKey = 'all-safe'
    }

    const testPattern = ALLOWED_TEST_PATTERNS[patternKey]
    if (!testPattern) {
      return NextResponse.json({
        success: false,
        error: `Invalid test suite: ${suite}`
      }, { status: 400 })
    }

    // Execute tests safely using execFile with argument array
    const startTime = Date.now()
    let stdout = ''
    let stderr = ''
    let exitCode = 0

    try {
      const { stdout: out, stderr: err } = await execFileAsync('npx', [
        'jest',
        '--config=jest.config.integration.js',
        `--testPathPattern=${testPattern}`,
        '--json',
        '--outputFile=/tmp/test-results.json'
      ], {
        cwd: '/home/ubuntu/Sports-Bar-TV-Controller',
        timeout: 120000, // 2 minute timeout
        env: {
          ...process.env,
          NODE_ENV: 'test'
        }
      })
      stdout = out
      stderr = err
    } catch (error: any) {
      exitCode = error.code || 1
      stdout = error.stdout || ''
      stderr = error.stderr || ''
    }

    const duration = Date.now() - startTime

    // Try to read JSON results
    let testResults = null
    try {
      const fs = require('fs')
      const resultsPath = '/tmp/test-results.json'
      if (fs.existsSync(resultsPath)) {
        const resultsContent = fs.readFileSync(resultsPath, 'utf-8')
        testResults = JSON.parse(resultsContent)
      }
    } catch (error) {
      logger.error('Error reading test results:', error)
    }

    // Parse results
    const success = exitCode === 0
    const results = {
      success,
      suite,
      safeMode,
      duration,
      exitCode,
      testResults,
      stdout: stdout.substring(0, 5000), // Limit output size
      stderr: stderr.substring(0, 1000)
    }

    return NextResponse.json(results, { status: success ? 200 : 500 })

  } catch (error: any) {
    logger.error('Error executing tests:', error)
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}

/**
 * GET /api/tests/run
 * Get available test suites
 */
export async function GET(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.TESTING)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  return NextResponse.json({
    suites: [
      { id: 'api', name: 'API Tests', description: 'Test all API endpoints', safe: true },
      { id: 'database', name: 'Database Tests', description: 'Test database connectivity and operations', safe: true },
      { id: 'matrix', name: 'Matrix Tests', description: 'Test Wolf Pack matrix configuration', safe: true },
      { id: 'hardware', name: 'Hardware Tests', description: 'Test hardware device connectivity', safe: false },
      { id: 'firetv', name: 'Fire TV Tests', description: 'Test Fire TV ADB integration', safe: false },
      { id: 'scenarios', name: 'User Scenarios', description: 'Test complete user workflows', safe: true },
      { id: 'all', name: 'All Tests', description: 'Run all available tests', safe: false }
    ]
  })
}
