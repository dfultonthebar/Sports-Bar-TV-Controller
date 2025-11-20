import { vi, afterEach } from 'vitest'

// Mock environment variables (bypass readonly check)
if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = 'test'
}
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = ':memory:'
}
if (!process.env.ANTHROPIC_API_KEY) {
  process.env.ANTHROPIC_API_KEY = 'test-key'
}
if (!process.env.NEXTAUTH_SECRET) {
  process.env.NEXTAUTH_SECRET = 'test-secret'
}
if (!process.env.NEXTAUTH_URL) {
  process.env.NEXTAUTH_URL = 'http://localhost:3000'
}

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
    system: {
      startup: vi.fn(),
      shutdown: vi.fn(),
      error: vi.fn(),
    },
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
