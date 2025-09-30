
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { apiKey } = await request.json()

    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: 'API key is required' },
        { status: 400 }
      )
    }

    // Test the connection with a simple GraphQL query
    const query = `
      query {
        me {
          ... on PublicAPIClient {
            accounts(first: 1) {
              edges {
                node {
                  id
                  businessName
                  locations(first: 10) {
                    edges {
                      node {
                        id
                        name
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    `

    const response = await fetch('https://api.soundtrackyourbrand.com/v2', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ query })
    })

    if (!response.ok) {
      const errorText = await response.text()
      return NextResponse.json({
        success: false,
        error: `API returned ${response.status}: ${errorText}`
      }, { status: response.status })
    }

    const data = await response.json()

    if (data.errors) {
      return NextResponse.json({
        success: false,
        error: data.errors[0]?.message || 'GraphQL query failed'
      }, { status: 400 })
    }

    // Extract account info
    const account = data.data?.me?.accounts?.edges?.[0]?.node
    const locations = account?.locations?.edges || []

    return NextResponse.json({
      success: true,
      accountInfo: {
        id: account?.id || 'unknown',
        businessName: account?.businessName || 'Unknown Account',
        locationCount: locations.length
      }
    })
  } catch (error: any) {
    console.error('Error testing Soundtrack connection:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Connection test failed' },
      { status: 500 }
    )
  }
}
