/**
 * Layout API - Backward Compatibility Redirect
 *
 * Redirects to /api/bartender/layout for backward compatibility.
 * The canonical endpoint is now /api/bartender/layout
 */

import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const url = new URL('/api/bartender/layout', request.url)
  const response = await fetch(url.toString(), {
    headers: request.headers,
  })
  const data = await response.json()
  return NextResponse.json(data)
}

export async function POST(request: NextRequest) {
  const url = new URL('/api/bartender/layout', request.url)
  const body = await request.text()
  const response = await fetch(url.toString(), {
    method: 'POST',
    headers: request.headers,
    body,
  })
  const data = await response.json()
  return NextResponse.json(data, { status: response.status })
}
