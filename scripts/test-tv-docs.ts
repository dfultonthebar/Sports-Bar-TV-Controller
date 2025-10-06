
/**
 * Test Script for TV Documentation System
 * 
 * Tests the automatic TV documentation retrieval system
 */

import { fetchTVManual, getAllTVDocumentation } from '../src/lib/tvDocs'

async function testTVDocumentationSystem() {
  console.log('='.repeat(60))
  console.log('TV Documentation System Test')
  console.log('='.repeat(60))
  console.log()

  // Test 1: Fetch manual for a sample TV
  console.log('Test 1: Fetching manual for Samsung UN55TU8000...')
  try {
    const result = await fetchTVManual({
      manufacturer: 'Samsung',
      model: 'UN55TU8000',
      forceRefetch: false
    })

    if (result.success) {
      console.log('✅ Manual fetch successful!')
      console.log(`   Manual Path: ${result.manualPath}`)
      console.log(`   Documentation URL: ${result.documentationPath}`)
      console.log(`   Q&A Generated: ${result.qaGenerated}`)
      console.log(`   Q&A Pairs Count: ${result.qaPairsCount}`)
    } else {
      console.log('❌ Manual fetch failed!')
      console.log(`   Error: ${result.error}`)
      if (result.searchResults && result.searchResults.length > 0) {
        console.log(`   Found ${result.searchResults.length} potential sources`)
      }
    }
  } catch (error: any) {
    console.log('❌ Test failed with error:', error.message)
  }
  console.log()

  // Test 2: Get all documentation
  console.log('Test 2: Getting all TV documentation...')
  try {
    const documentation = await getAllTVDocumentation()
    console.log(`✅ Found ${documentation.length} TV models`)
    
    for (const doc of documentation) {
      console.log(`   - ${doc.manufacturer} ${doc.model}`)
      console.log(`     Status: ${doc.fetchStatus}`)
      console.log(`     Q&A Pairs: ${doc.qaPairsCount}`)
      console.log(`     Manual: ${doc.manualPath ? 'Downloaded' : 'Not downloaded'}`)
    }
  } catch (error: any) {
    console.log('❌ Test failed with error:', error.message)
  }
  console.log()

  // Test 3: Test with another TV model
  console.log('Test 3: Fetching manual for LG OLED55C1PUB...')
  try {
    const result = await fetchTVManual({
      manufacturer: 'LG',
      model: 'OLED55C1PUB',
      forceRefetch: false
    })

    if (result.success) {
      console.log('✅ Manual fetch successful!')
      console.log(`   Q&A Pairs Count: ${result.qaPairsCount}`)
    } else {
      console.log('⚠️  Manual fetch failed (expected for test):', result.error)
    }
  } catch (error: any) {
    console.log('⚠️  Test failed with error (expected):', error.message)
  }
  console.log()

  console.log('='.repeat(60))
  console.log('Test Complete')
  console.log('='.repeat(60))
}

// Run tests
testTVDocumentationSystem()
  .then(() => {
    console.log('\n✅ All tests completed')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n❌ Test suite failed:', error)
    process.exit(1)
  })
