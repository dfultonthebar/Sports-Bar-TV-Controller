/**
 * Test Script for Q&A Generation Fix
 * 
 * Tests the fixed Q&A generation with proper token limits and error handling
 */

import { generateQAsFromRepository, getQAGenerationStatus } from '../src/lib/services/qa-generator'
import path from 'path'

async function testQAGeneration() {
  console.log('='.repeat(60))
  console.log('Q&A Generation Fix Test')
  console.log('='.repeat(60))
  console.log()

  // Test with the problematic PDF file
  const testFile = path.join(process.cwd(), 'docs', 'AI_ASSISTANT_QUICK_START.pdf')
  
  console.log(`Testing Q&A generation on: ${testFile}`)
  console.log()

  try {
    const result = await generateQAsFromRepository({
      sourceType: 'documentation',
      sourcePaths: [testFile],
      maxQAsPerFile: 3,
    })

    console.log('✅ Q&A generation job started!')
    console.log(`   Job ID: ${result.jobId}`)
    console.log(`   Status: ${result.status}`)
    console.log()

    // Poll for completion
    console.log('Waiting for job to complete...')
    let attempts = 0
    const maxAttempts = 60 // 5 minutes max
    
    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 5000)) // Wait 5 seconds
      
      const status = await getQAGenerationStatus(result.jobId)
      
      if (!status) {
        console.log('❌ Job not found')
        break
      }

      console.log(`   Status: ${status.status} | Processed: ${status.processedFiles}/${status.totalFiles} | Generated: ${status.generatedQAs} Q&As`)
      
      if (status.status === 'completed') {
        console.log()
        console.log('✅ Q&A generation completed successfully!')
        console.log(`   Total files processed: ${status.processedFiles}`)
        console.log(`   Total Q&As generated: ${status.generatedQAs}`)
        break
      } else if (status.status === 'failed') {
        console.log()
        console.log('❌ Q&A generation failed!')
        console.log(`   Error: ${status.errorMessage}`)
        break
      }
      
      attempts++
    }

    if (attempts >= maxAttempts) {
      console.log()
      console.log('⚠️  Job timed out after 5 minutes')
    }

  } catch (error: any) {
    console.log('❌ Test failed with error:', error.message)
    console.error(error)
  }
}

// Run the test
testQAGeneration()
  .then(() => {
    console.log()
    console.log('Test completed')
    process.exit(0)
  })
  .catch((error) => {
    console.error('Test failed:', error)
    process.exit(1)
  })
