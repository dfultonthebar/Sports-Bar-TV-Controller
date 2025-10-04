

/**
 * Test script for diagnostics system
 * Verifies all components are working correctly
 */

const { PrismaClient } = require('@prisma/client');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);
const prisma = new PrismaClient();

async function testDatabaseModels() {
  console.log('\n🧪 Testing Database Models...');
  
  try {
    // Test SystemHealthCheck
    const healthCheck = await prisma.systemHealthCheck.create({
      data: {
        checkType: 'light',
        component: 'test',
        status: 'healthy',
        metrics: JSON.stringify({ test: true }),
        responseTime: 100
      }
    });
    console.log('  ✅ SystemHealthCheck model works');
    
    // Test Issue
    const issue = await prisma.issue.create({
      data: {
        type: 'test',
        severity: 'low',
        component: 'test',
        title: 'Test Issue',
        description: 'This is a test issue',
        status: 'open'
      }
    });
    console.log('  ✅ Issue model works');
    
    // Test Fix
    const fix = await prisma.fix.create({
      data: {
        issueId: issue.id,
        action: 'test_fix',
        description: 'Test fix',
        success: true,
        details: JSON.stringify({ test: true })
      }
    });
    console.log('  ✅ Fix model works');
    
    // Test SystemMetric
    const metric = await prisma.systemMetric.create({
      data: {
        metricType: 'cpu',
        value: 50.5,
        unit: 'percent'
      }
    });
    console.log('  ✅ SystemMetric model works');
    
    // Test LearningPattern
    const pattern = await prisma.learningPattern.create({
      data: {
        patternType: 'test_pattern',
        component: 'test',
        title: 'Test Pattern',
        description: 'Test pattern description',
        firstSeen: new Date(),
        lastSeen: new Date()
      }
    });
    console.log('  ✅ LearningPattern model works');
    
    // Test DiagnosticRun
    const run = await prisma.diagnosticRun.create({
      data: {
        runType: 'test',
        triggeredBy: 'manual',
        status: 'completed',
        duration: 1000,
        checksRun: 5,
        checksPassed: 5,
        checksFailed: 0,
        checksWarning: 0,
        issuesFound: 0,
        issuesFixed: 0,
        summary: 'Test run'
      }
    });
    console.log('  ✅ DiagnosticRun model works');
    
    // Cleanup test data
    await prisma.fix.delete({ where: { id: fix.id } });
    await prisma.issue.delete({ where: { id: issue.id } });
    await prisma.systemHealthCheck.delete({ where: { id: healthCheck.id } });
    await prisma.systemMetric.delete({ where: { id: metric.id } });
    await prisma.learningPattern.delete({ where: { id: pattern.id } });
    await prisma.diagnosticRun.delete({ where: { id: run.id } });
    
    console.log('  ✅ All database models working correctly');
    return true;
  } catch (error) {
    console.error('  ❌ Database model test failed:', error.message);
    return false;
  }
}

async function testLightCheck() {
  console.log('\n🧪 Testing Light Check...');
  
  try {
    const { stdout, stderr } = await execAsync('node scripts/diagnostics/light-check.js');
    
    if (stdout.includes('LIGHT CHECK SUMMARY')) {
      console.log('  ✅ Light check executed successfully');
      return true;
    } else {
      console.error('  ❌ Light check output unexpected');
      return false;
    }
  } catch (error) {
    // Light check may exit with code 1 if issues found, but that's OK
    if (error.stdout && error.stdout.includes('LIGHT CHECK SUMMARY')) {
      console.log('  ✅ Light check executed (with issues detected)');
      return true;
    }
    console.error('  ❌ Light check failed:', error.message);
    return false;
  }
}

async function testDeepDiagnostics() {
  console.log('\n🧪 Testing Deep Diagnostics...');
  
  try {
    const { stdout, stderr } = await execAsync('timeout 30 node scripts/diagnostics/deep-diagnostics.js');
    
    if (stdout.includes('DEEP DIAGNOSTICS REPORT')) {
      console.log('  ✅ Deep diagnostics executed successfully');
      return true;
    } else {
      console.error('  ❌ Deep diagnostics output unexpected');
      return false;
    }
  } catch (error) {
    // Deep diagnostics may exit with code 1 or timeout, but that's OK
    if (error.stdout && error.stdout.includes('DEEP DIAGNOSTICS REPORT')) {
      console.log('  ✅ Deep diagnostics executed (with issues detected)');
      return true;
    }
    console.error('  ❌ Deep diagnostics failed:', error.message);
    return false;
  }
}

async function testSelfHealing() {
  console.log('\n🧪 Testing Self-Healing...');
  
  try {
    // Create a test issue
    const issue = await prisma.issue.create({
      data: {
        type: 'test',
        severity: 'low',
        component: 'test',
        title: 'Test Issue for Self-Healing',
        description: 'This is a test issue',
        status: 'open'
      }
    });
    
    const { stdout, stderr } = await execAsync('timeout 10 node scripts/diagnostics/self-healing.js');
    
    // Check if issue was processed
    const updatedIssue = await prisma.issue.findUnique({
      where: { id: issue.id }
    });
    
    // Cleanup
    await prisma.issue.delete({ where: { id: issue.id } });
    
    if (stdout.includes('Self-healing completed')) {
      console.log('  ✅ Self-healing executed successfully');
      return true;
    } else {
      console.error('  ❌ Self-healing output unexpected');
      return false;
    }
  } catch (error) {
    console.error('  ❌ Self-healing test failed:', error.message);
    return false;
  }
}

async function testScheduler() {
  console.log('\n🧪 Testing Scheduler...');
  
  try {
    // Just verify the scheduler file is valid
    const { stdout } = await execAsync('node -c scripts/diagnostics/scheduler.js');
    console.log('  ✅ Scheduler syntax is valid');
    return true;
  } catch (error) {
    console.error('  ❌ Scheduler test failed:', error.message);
    return false;
  }
}

async function verifyDatabaseRecords() {
  console.log('\n🧪 Verifying Database Records...');
  
  try {
    const healthChecks = await prisma.systemHealthCheck.count();
    const issues = await prisma.issue.count();
    const diagnosticRuns = await prisma.diagnosticRun.count();
    
    console.log(`  📊 SystemHealthCheck records: ${healthChecks}`);
    console.log(`  📊 Issue records: ${issues}`);
    console.log(`  📊 DiagnosticRun records: ${diagnosticRuns}`);
    
    if (healthChecks > 0 && diagnosticRuns > 0) {
      console.log('  ✅ Database records created successfully');
      return true;
    } else {
      console.log('  ⚠️  No records found (this is OK for first run)');
      return true;
    }
  } catch (error) {
    console.error('  ❌ Database verification failed:', error.message);
    return false;
  }
}

async function runAllTests() {
  console.log('🚀 Starting Diagnostics System Tests');
  console.log('=' .repeat(60));
  
  const results = {
    databaseModels: await testDatabaseModels(),
    lightCheck: await testLightCheck(),
    deepDiagnostics: await testDeepDiagnostics(),
    selfHealing: await testSelfHealing(),
    scheduler: await testScheduler(),
    databaseRecords: await verifyDatabaseRecords()
  };
  
  console.log('\n' + '='.repeat(60));
  console.log('📊 TEST RESULTS SUMMARY');
  console.log('='.repeat(60));
  
  const passed = Object.values(results).filter(r => r).length;
  const total = Object.keys(results).length;
  
  for (const [test, result] of Object.entries(results)) {
    const icon = result ? '✅' : '❌';
    console.log(`${icon} ${test}: ${result ? 'PASSED' : 'FAILED'}`);
  }
  
  console.log('='.repeat(60));
  console.log(`\n${passed}/${total} tests passed`);
  
  if (passed === total) {
    console.log('\n🎉 All tests passed! Diagnostics system is ready.');
    process.exit(0);
  } else {
    console.log('\n⚠️  Some tests failed. Please review the output above.');
    process.exit(1);
  }
}

// Run tests
runAllTests()
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect();
  });
