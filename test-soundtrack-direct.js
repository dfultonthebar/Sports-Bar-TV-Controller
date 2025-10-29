// Direct test of Soundtrack API
const apiToken = process.argv[2];

if (!apiToken) {
  console.log('Usage: node test-soundtrack-direct.js YOUR_API_TOKEN');
  process.exit(1);
}

async function testSoundtrack() {
  try {
    console.log('Testing Soundtrack API...');
    console.log('Token (first 10 chars):', apiToken.substring(0, 10) + '...');

    // Format auth header - check if already encoded
    let authHeader;
    try {
      const decoded = Buffer.from(apiToken, 'base64').toString('utf-8');
      if (decoded.includes(':')) {
        // Token is already base64 encoded in "username:password" format
        console.log('Token is pre-encoded (contains username:password)');
        authHeader = `Basic ${apiToken}`;
      } else {
        throw new Error('Not pre-encoded');
      }
    } catch (e) {
      // Token is plain, encode it as "token:" format
      console.log('Token is plain text, encoding as username:');
      const credentials = `${apiToken}:`;
      const base64Credentials = Buffer.from(credentials).toString('base64');
      authHeader = `Basic ${base64Credentials}`;
    }

    console.log('\nAuth header format:', authHeader.substring(0, 30) + '...');

    // Test connection with GraphQL query
    const query = `
      query {
        me {
          __typename
          ... on PublicAPIClient {
            accounts(first: 1) {
              edges {
                node {
                  id
                  businessName
                }
              }
            }
          }
        }
      }
    `;

    console.log('\nMaking API request...');
    const response = await fetch('https://api.soundtrackyourbrand.com/v2', {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({ query })
    });

    console.log('Response status:', response.status, response.statusText);
    console.log('Response headers:', Object.fromEntries(response.headers.entries()));

    const data = await response.json();
    console.log('\nResponse body:', JSON.stringify(data, null, 2));

    if (response.ok && data.data?.me) {
      console.log('\n✅ SUCCESS! Token is valid');
      console.log('Account type:', data.data.me.__typename);
      if (data.data.me.accounts) {
        console.log('Accounts found:', data.data.me.accounts.edges.length);
      }
    } else {
      console.log('\n❌ FAILED! Token invalid or error occurred');
    }

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error);
  }
}

testSoundtrack();
