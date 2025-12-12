
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { enhancedLogger } from '@/lib/enhanced-logger'

export async function middleware(request: NextRequest) {
  const startTime = Date.now()
  
  // Generate a unique request ID
  const requestId = Math.random().toString(36).substring(2, 15)
  
  // Add request ID to headers for tracking
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-request-id', requestId)
  
  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  })

  // Log API calls
  if (request.nextUrl.pathname.startsWith('/api/')) {
    const duration = Date.now() - startTime
    const statusCode = response.status
    
    // Don't log the logging endpoints to avoid recursion
    if (!request.nextUrl.pathname.startsWith('/api/logs/')) {
      try {
        await enhancedLogger.logAPICall(
          request.nextUrl.pathname,
          request.method,
          statusCode,
          duration,
          {
            requestId,
            userAgent: request.headers.get('user-agent'),
            ip: request.ip || request.headers.get('x-forwarded-for'),
            query: Object.fromEntries(request.nextUrl.searchParams.entries())
          }
        )
      } catch (error) {
        console.error('Failed to log API call in middleware:', error)
      }
    }
  }
  
  return response
}

export const config = {
  matcher: [
    // Match all request paths except for the ones starting with:
    // - _next/static (static files)
    // - _next/image (image optimization files)
    // - favicon.ico (favicon file)
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
