import { vi } from 'vitest'

// Mock environment variables
process.env.NODE_ENV = 'test'
process.env.DATABASE_URL = ':memory:'
process.env.ANTHROPIC_API_KEY = 'test-key'
process.env.NEXTAUTH_SECRET = 'test-secret'
process.env.NEXTAUTH_URL = 'http://localhost:3000'

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
