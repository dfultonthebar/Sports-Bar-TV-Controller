import { vi } from 'vitest'

// Mock environment variables (bypass readonly check)
Object.defineProperty(process.env, 'NODE_ENV', { value: 'test', writable: true })
Object.defineProperty(process.env, 'DATABASE_URL', { value: ':memory:', writable: true })
Object.defineProperty(process.env, 'ANTHROPIC_API_KEY', { value: 'test-key', writable: true })
Object.defineProperty(process.env, 'NEXTAUTH_SECRET', { value: 'test-secret', writable: true })
Object.defineProperty(process.env, 'NEXTAUTH_URL', { value: 'http://localhost:3000', writable: true })

// Mock Next.js environment
vi.mock('next/headers', () => ({
  headers: vi.fn(() => new Map()),
  cookies: vi.fn(() => ({
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
  })),
}))

// Mock logger to prevent console spam during tests
vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}))

// Global test utilities
globalThis.testUtils = {
  // Reset all mocks between tests
  resetMocks: () => {
    vi.clearAllMocks()
  },
}

// Auto-reset mocks after each test
afterEach(() => {
  vi.clearAllMocks()
})
