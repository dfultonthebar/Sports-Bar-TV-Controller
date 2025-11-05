# Sports Bar Quality Standards Skill

**Version:** 1.0.0
**Category:** Code Quality & Best Practices
**Tags:** typescript, testing, standards, quality

---

## Purpose

Enforce consistent code quality standards across the Sports Bar TV Controller codebase including:
- TypeScript strict mode compliance
- Test-Driven Development (TDD)
- Comprehensive error handling
- Structured logging
- Domain-specific patterns for TV control, matrix switching, CEC, and AI integration

---

## Core Standards

### 1. TypeScript Strict Mode

**Requirements:**
- `strict: true` in tsconfig.json
- No `any` types (use `unknown` and type guards)
- Explicit return types on functions
- No implicit `this`
- Strict null checks

**Example:**
```typescript
// ❌ BAD
function processTV(tv) {
  return tv.name
}

// ✅ GOOD
function processTV(tv: MatrixOutput): string {
  if (!tv || !tv.name) {
    throw new Error('Invalid TV object')
  }
  return tv.name
}
```

---

### 2. Test-Driven Development (TDD)

**Requirements:**
- Minimum 80% code coverage
- Unit tests for all business logic
- Integration tests for API endpoints
- Mocked external dependencies (hardware, APIs)

**Test Structure:**
```typescript
describe('TVController', () => {
  describe('powerOn', () => {
    it('should power on TV via CEC when supported', async () => {
      // Arrange
      const mockCEC = vi.fn().mockResolvedValue({ success: true })
      const controller = new TVController({ cecClient: mockCEC })

      // Act
      const result = await controller.powerOn('tv-1')

      // Assert
      expect(result.success).toBe(true)
      expect(mockCEC).toHaveBeenCalledWith('tv-1', 'POWER_ON')
    })

    it('should fallback to IR when CEC fails', async () => {
      // Arrange
      const mockCEC = vi.fn().mockRejectedValue(new Error('CEC failed'))
      const mockIR = vi.fn().mockResolvedValue({ success: true })
      const controller = new TVController({
        cecClient: mockCEC,
        irClient: mockIR
      })

      // Act
      const result = await controller.powerOn('tv-1')

      // Assert
      expect(result.success).toBe(true)
      expect(mockIR).toHaveBeenCalled()
    })
  })
})
```

---

### 3. Error Handling Patterns

**Requirements:**
- Custom error classes for different error types
- Always log errors before throwing/returning
- Return structured error responses in APIs
- Include error codes and context

**Error Classes:**
```typescript
export class TVControlError extends Error {
  constructor(
    message: string,
    public readonly tvId: string,
    public readonly code: string,
    public readonly context?: Record<string, unknown>
  ) {
    super(message)
    this.name = 'TVControlError'
  }
}

export class MatrixError extends Error {
  constructor(
    message: string,
    public readonly input: number,
    public readonly output: number,
    public readonly code: string
  ) {
    super(message)
    this.name = 'MatrixError'
  }
}

export class CECError extends Error {
  constructor(
    message: string,
    public readonly device: string,
    public readonly command: string,
    public readonly code: string
  ) {
    super(message)
    this.name = 'CECError'
  }
}
```

**API Error Response:**
```typescript
// ❌ BAD
return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })

// ✅ GOOD
return NextResponse.json({
  success: false,
  error: {
    code: 'TV_POWER_FAILED',
    message: 'Failed to power on TV',
    details: {
      tvId: 'tv-1',
      attemptedMethods: ['CEC', 'IR'],
      lastError: error.message
    }
  }
}, { status: 500 })
```

---

### 4. Structured Logging

**Requirements:**
- Use centralized logger (no console.log)
- Include context in all log messages
- Log levels: error, warn, info, debug
- Include timestamps and request IDs

**Logging Pattern:**
```typescript
import { logger } from '@/lib/logger'

// ❌ BAD
console.log('TV powered on')

// ✅ GOOD
logger.info('[TV Control] Power state changed', {
  tvId: 'tv-1',
  newState: 'on',
  method: 'CEC',
  duration: 250,
  userId: session.userId
})

// Error logging
try {
  await powerOnTV('tv-1')
} catch (error) {
  logger.error('[TV Control] Failed to power on TV', {
    tvId: 'tv-1',
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
    context: { method: 'CEC', retries: 3 }
  })
  throw error
}
```

---

### 5. Domain-Specific Patterns

#### TV Detection Pattern
```typescript
interface TVDetectionResult {
  zones: TVZone[]
  detectionsCount: number
  confidence: number
  imageWidth: number
  imageHeight: number
  errors: string[]
}

async function detectTVZones(imagePath: string): Promise<TVDetectionResult> {
  logger.info('[TV Detection] Starting AI detection', { imagePath })

  try {
    const result = await aiVisionAnalyze(imagePath)

    logger.info('[TV Detection] Detection complete', {
      zonesFound: result.zones.length,
      avgConfidence: calculateAvgConfidence(result.zones)
    })

    return result
  } catch (error) {
    logger.error('[TV Detection] AI detection failed', { error })
    return {
      zones: [],
      detectionsCount: 0,
      confidence: 0,
      imageWidth: 0,
      imageHeight: 0,
      errors: [error instanceof Error ? error.message : 'Unknown error']
    }
  }
}
```

#### Matrix Control Pattern
```typescript
interface MatrixRouteRequest {
  input: number
  output: number
  priority?: 'high' | 'normal'
}

interface MatrixRouteResult {
  success: boolean
  input: number
  output: number
  latency: number
  error?: string
}

async function routeMatrix(request: MatrixRouteRequest): Promise<MatrixRouteResult> {
  const startTime = Date.now()

  logger.info('[Matrix] Routing request', {
    input: request.input,
    output: request.output,
    priority: request.priority || 'normal'
  })

  try {
    // Validate inputs
    if (request.input < 1 || request.input > 36) {
      throw new MatrixError('Invalid input channel', request.input, request.output, 'INVALID_INPUT')
    }

    if (request.output < 1 || request.output > 36) {
      throw new MatrixError('Invalid output channel', request.input, request.output, 'INVALID_OUTPUT')
    }

    // Execute routing
    await matrixClient.route(request.input, request.output)

    const latency = Date.now() - startTime

    logger.info('[Matrix] Routing successful', {
      input: request.input,
      output: request.output,
      latency
    })

    return {
      success: true,
      input: request.input,
      output: request.output,
      latency
    }
  } catch (error) {
    logger.error('[Matrix] Routing failed', {
      input: request.input,
      output: request.output,
      error: error instanceof Error ? error.message : String(error)
    })

    return {
      success: false,
      input: request.input,
      output: request.output,
      latency: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}
```

#### CEC Control Pattern
```typescript
interface CECCommand {
  device: string
  command: 'POWER_ON' | 'POWER_OFF' | 'STANDBY' | 'ACTIVE_SOURCE' | 'INPUT_SELECT'
  params?: Record<string, unknown>
  timeout?: number
}

interface CECResult {
  success: boolean
  device: string
  command: string
  response?: string
  error?: string
  duration: number
}

async function sendCECCommand(cmd: CECCommand): Promise<CECResult> {
  const startTime = Date.now()

  logger.info('[CEC] Sending command', {
    device: cmd.device,
    command: cmd.command,
    params: cmd.params
  })

  try {
    const response = await cecClient.send({
      device: cmd.device,
      command: cmd.command,
      params: cmd.params,
      timeout: cmd.timeout || 5000
    })

    const duration = Date.now() - startTime

    logger.info('[CEC] Command successful', {
      device: cmd.device,
      command: cmd.command,
      response,
      duration
    })

    return {
      success: true,
      device: cmd.device,
      command: cmd.command,
      response,
      duration
    }
  } catch (error) {
    const duration = Date.now() - startTime

    logger.error('[CEC] Command failed', {
      device: cmd.device,
      command: cmd.command,
      error: error instanceof Error ? error.message : String(error),
      duration
    })

    throw new CECError(
      'CEC command failed',
      cmd.device,
      cmd.command,
      'CEC_COMMAND_FAILED'
    )
  }
}
```

#### AI Integration Pattern
```typescript
interface AIAnalysisRequest {
  prompt: string
  image?: string
  context?: Record<string, unknown>
  maxTokens?: number
}

interface AIAnalysisResult {
  success: boolean
  response: string
  tokensUsed: number
  model: string
  latency: number
  error?: string
}

async function analyzeWithAI(request: AIAnalysisRequest): Promise<AIAnalysisResult> {
  const startTime = Date.now()

  logger.info('[AI] Starting analysis', {
    promptLength: request.prompt.length,
    hasImage: !!request.image,
    context: request.context
  })

  try {
    const response = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: request.maxTokens || 4096,
      messages: [{
        role: 'user',
        content: request.prompt
      }]
    })

    const latency = Date.now() - startTime

    logger.info('[AI] Analysis complete', {
      tokensUsed: response.usage.input_tokens + response.usage.output_tokens,
      latency
    })

    return {
      success: true,
      response: response.content[0].text,
      tokensUsed: response.usage.input_tokens + response.usage.output_tokens,
      model: response.model,
      latency
    }
  } catch (error) {
    const latency = Date.now() - startTime

    logger.error('[AI] Analysis failed', {
      error: error instanceof Error ? error.message : String(error),
      latency
    })

    return {
      success: false,
      response: '',
      tokensUsed: 0,
      model: 'claude-3-5-sonnet-20241022',
      latency,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}
```

---

### 6. Input Validation Pattern

**Requirements:**
- Use Zod for runtime validation
- Validate all API inputs
- Validate all external data sources
- Return descriptive validation errors

**Pattern:**
```typescript
import { z } from 'zod'

// Define schemas
const MatrixRouteSchema = z.object({
  input: z.number().int().min(1).max(36),
  output: z.number().int().min(1).max(36),
  priority: z.enum(['high', 'normal']).optional().default('normal')
})

// Validate in API
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validated = MatrixRouteSchema.parse(body)

    // Use validated data
    const result = await routeMatrix(validated)
    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.warn('[API] Validation failed', { errors: error.errors })
      return NextResponse.json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request data',
          details: error.errors
        }
      }, { status: 400 })
    }

    throw error
  }
}
```

---

## Quality Gates

### Pre-Commit Checks
- ✅ TypeScript compilation passes
- ✅ ESLint passes (no warnings)
- ✅ Prettier formatting applied
- ✅ Tests pass
- ✅ Coverage ≥ 80%

### Pre-Push Checks
- ✅ All pre-commit checks
- ✅ Integration tests pass
- ✅ Build succeeds
- ✅ No security vulnerabilities (high/critical)

---

## Commands

```bash
# Run all quality checks
npm run quality-check

# Individual checks
npm run type-check     # TypeScript compilation
npm run lint           # ESLint
npm run lint:fix       # ESLint with auto-fix
npm run format         # Prettier format
npm run format:check   # Check formatting
npm run test           # Run tests
npm run test:coverage  # Tests with coverage report
```

---

## Tooling Configuration

### ESLint (.eslintrc.json)
```json
{
  "extends": [
    "next/core-web-vitals",
    "plugin:@typescript-eslint/recommended",
    "plugin:@typescript-eslint/recommended-requiring-type-checking",
    "prettier"
  ],
  "rules": {
    "@typescript-eslint/no-explicit-any": "error",
    "@typescript-eslint/explicit-function-return-type": "warn",
    "@typescript-eslint/no-unused-vars": ["error", { "argsIgnorePattern": "^_" }],
    "no-console": ["warn", { "allow": ["warn", "error"] }]
  }
}
```

### Prettier (.prettierrc)
```json
{
  "semi": false,
  "singleQuote": true,
  "tabWidth": 2,
  "trailingComma": "es5",
  "printWidth": 100
}
```

### Vitest (vitest.config.ts)
```typescript
import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      lines: 80,
      functions: 80,
      branches: 80,
      statements: 80
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  }
})
```

---

## When to Apply This Skill

Claude Code should apply these standards when:
- Creating new TypeScript files
- Writing API endpoints
- Implementing TV/matrix/CEC control logic
- Adding AI integration features
- Writing tests
- Handling errors
- Adding logging
- Reviewing existing code for quality improvements

---

## Exception Handling

Some exceptions to strict rules:
- **Type assertions:** Allowed when interfacing with untyped libraries
- **console.log:** Allowed in development-only scripts
- **Coverage:** Can drop below 80% for UI components with complex interactions
- **any types:** Allowed when typing third-party libraries without types

Always document exceptions with comments explaining why.

---

## Maintenance

This skill should be updated when:
- New domain-specific patterns emerge
- Testing strategies evolve
- Team coding standards change
- New tools are adopted

**Last Updated:** 2025-11-05
**Version:** 1.0.0
