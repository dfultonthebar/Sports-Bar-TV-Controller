import { NextRequest, NextResponse } from 'next/server'
import { exec } from 'child_process'
import { promisify } from 'util'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'

import { logger } from '@/lib/logger'
import { z } from 'zod'
import { validateRequestBody, validateQueryParams, validatePathParams, ValidationSchemas, isValidationError, isValidationSuccess} from '@/lib/validation'
const execAsync = promisify(exec)

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


  // Input validation
  const bodyValidation = await validateRequestBody(req, z.record(z.unknown()))
  if (isValidationError(bodyValidation)) return bodyValidation.error
  const { data: body } = bodyValidation
  try {
    const { suite = 'all', safeMode = true } = body

    // Build test command
    let testPattern = ''
    switch (suite) {
      case 'api':
        testPattern = 'tests/integration/api.test.ts'
        break
      case 'database':
        testPattern = 'tests/integration/database.test.ts'
        break
      case 'matrix':
        testPattern = 'tests/integration/matrix.test.ts'
        break
      case 'hardware':
        if (safeMode) {
          return NextResponse.json({
            success: false,
            error: 'Hardware tests disabled in safe mode'
          }, { status: 400 })
        }
        testPattern = 'tests/integration/hardware.test.ts'
        break
      case 'firetv':
        if (safeMode) {
          return NextResponse.json({
            success: false,
            error: 'Fire TV tests disabled in safe mode'
          }, { status: 400 })
        }
        testPattern = 'tests/integration/firetv.test.ts'
        break
      case 'scenarios':
        testPattern = 'tests/scenarios/user-workflows.test.ts'
        break
      case 'all':
      default:
        if (safeMode) {
          // Skip hardware and Fire TV tests in safe mode
          testPattern = 'tests/integration/(api|database|matrix).test.ts'
        } else {
          testPattern = 'tests/integration/**/*.test.ts tests/scenarios/**/*.test.ts'
        }
        break
    }

    // Execute tests
    const testCommand = `npx jest --config=jest.config.integration.js --testPathPatterns="${testPattern}" --json --outputFile=/tmp/test-results.json`

    const startTime = Date.now()
    let stdout = ''
    let stderr = ''
    let exitCode = 0

    try {
      const { stdout: out, stderr: err } = await execAsync(testCommand, {
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
