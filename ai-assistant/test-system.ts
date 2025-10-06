
/**
 * Test script for AI Code Assistant
 * Run with: npx ts-node ai-assistant/test-system.ts
 */

import { ollamaService } from './services/ollamaService'
import { codeIndexer } from './core/indexer/codeIndexer'
import { riskAssessor } from './core/risk-engine/riskAssessor'
import { cleanupOperations } from './core/cleanup/cleanupOperations'
import { changeManager } from './services/changeManager'
import { safetySystem } from './core/safety/safetySystem'
import { CodeChange } from './config/types'

async function testSystem() {
  console.log('🚀 Testing AI Code Assistant System\n')
  
  // Test 1: Ollama Connection
  console.log('1️⃣ Testing Ollama Connection...')
  try {
    const isAvailable = await ollamaService.isAvailable()
    if (isAvailable) {
      console.log('✅ Ollama is available')
      const models = await ollamaService.listModels()
      console.log(`   Available models: ${models.join(', ')}`)
    } else {
      console.log('❌ Ollama is not available')
      console.log('   Please start Ollama: nohup ollama serve > /tmp/ollama.log 2>&1 &')
    }
  } catch (error) {
    console.log('❌ Error connecting to Ollama:', error)
  }
  
  // Test 2: Code Indexing
  console.log('\n2️⃣ Testing Code Indexing...')
  try {
    const index = await codeIndexer.indexCodebase('./src')
    console.log(`✅ Indexed ${index.size} files`)
    
    // Show sample
    const firstFile = Array.from(index.values())[0]
    if (firstFile) {
      console.log(`   Sample: ${firstFile.filePath}`)
      console.log(`   - Language: ${firstFile.language}`)
      console.log(`   - Imports: ${firstFile.imports.length}`)
      console.log(`   - Functions: ${firstFile.functions.length}`)
    }
  } catch (error) {
    console.log('❌ Error indexing code:', error)
  }
  
  // Test 3: Risk Assessment
  console.log('\n3️⃣ Testing Risk Assessment...')
  try {
    const testChange: CodeChange = {
      id: 'test-1',
      timestamp: new Date(),
      type: 'update',
      filePath: './src/test.ts',
      description: 'Add type annotation',
      riskScore: 0,
      status: 'pending',
      aiModel: 'test',
      reasoning: 'Testing risk assessment',
      diff: '- const x = []\n+ const x: string[] = []'
    }
    
    const assessment = riskAssessor.assessRisk(testChange)
    console.log('✅ Risk assessment completed')
    console.log(`   Score: ${assessment.score}/10`)
    console.log(`   Category: ${assessment.category}`)
    console.log(`   Recommendation: ${assessment.recommendation}`)
    console.log(`   Factors: ${assessment.factors.length}`)
  } catch (error) {
    console.log('❌ Error in risk assessment:', error)
  }
  
  // Test 4: Safety System
  console.log('\n4️⃣ Testing Safety System...')
  try {
    await safetySystem.initialize()
    console.log('✅ Safety system initialized')
    
    const backups = await safetySystem.listBackups()
    console.log(`   Existing backups: ${backups.length}`)
  } catch (error) {
    console.log('❌ Error in safety system:', error)
  }
  
  // Test 5: Change Manager
  console.log('\n5️⃣ Testing Change Manager...')
  try {
    await changeManager.initialize()
    console.log('✅ Change manager initialized')
    
    const stats = changeManager.getStatistics()
    console.log(`   Pending: ${stats.pending}`)
    console.log(`   Applied: ${stats.applied}`)
    console.log(`   Total: ${stats.total}`)
  } catch (error) {
    console.log('❌ Error in change manager:', error)
  }
  
  // Test 6: Cleanup Operations (sample file)
  console.log('\n6️⃣ Testing Cleanup Operations...')
  try {
    const operations = await cleanupOperations.scanForCleanup('./src/lib')
    console.log(`✅ Found ${operations.length} cleanup opportunities`)
    
    if (operations.length > 0) {
      console.log('   Sample operations:')
      operations.slice(0, 3).forEach(op => {
        console.log(`   - ${op.type}: ${op.description}`)
      })
    }
  } catch (error) {
    console.log('❌ Error in cleanup operations:', error)
  }
  
  // Test 7: AI Code Generation (if Ollama is available)
  console.log('\n7️⃣ Testing AI Code Generation...')
  try {
    const isAvailable = await ollamaService.isAvailable()
    if (isAvailable) {
      console.log('   Generating sample code...')
      const code = await ollamaService.generateCode(
        'Write a TypeScript function that adds two numbers and returns the result'
      )
      console.log('✅ AI code generation successful')
      console.log(`   Generated ${code.length} characters`)
    } else {
      console.log('⏭️  Skipped (Ollama not available)')
    }
  } catch (error) {
    console.log('❌ Error in AI generation:', error)
  }
  
  console.log('\n✨ System test complete!\n')
}

// Run tests
testSystem().catch(console.error)
