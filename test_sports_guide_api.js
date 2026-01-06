// Test the Sports Guide API
const fetch = require('node-fetch');

const apiKey = '12548RK0000000d2bb701f55b82bfa192e680985919';
const userId = '258351';
const baseUrl = 'https://guide.thedailyrail.com/api/v1';

async function testApi() {
  try {
    const url = `${baseUrl}/guide/${userId}`;
    console.log(`Making request to: ${url}`);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'apikey': apiKey,
      },
    });
    
    console.log(`Response status: ${response.status}`);
    console.log(`Response headers:`, response.headers.raw());
    
    if (response.ok) {
      const data = await response.json();
      console.log('API Response successful!');
      console.log(`Listing groups: ${data.listing_groups?.length || 0}`);
      
      // Show first listing group if available
      if (data.listing_groups && data.listing_groups.length > 0) {
        console.log('\nFirst listing group:');
        console.log(`  Title: ${data.listing_groups[0].group_title}`);
        console.log(`  Listings: ${data.listing_groups[0].listings?.length || 0}`);
      }
    } else {
      const errorText = await response.text();
      console.error('API Error:', errorText);
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testApi();
