#!/usr/bin/env node

/**
 * Endpoint Analysis Script for Input Validation Rollout
 *
 * Analyzes all API endpoints and categorizes them by risk level
 * to determine validation priority.
 */

const fs = require('fs');
const path = require('path');

// Risk level definitions
const RISK_LEVELS = {
  CRITICAL: 'CRITICAL', // Must validate: Auth, hardware control, DB writes, system ops
  HIGH: 'HIGH',         // Should validate: Config changes, user data, external APIs
  MEDIUM: 'MEDIUM',     // Nice to validate: Read ops with params, search/filter
  LOW: 'LOW'           // Optional: Health checks, static data, simple GETs
};

// Patterns for risk assessment
const CRITICAL_PATTERNS = [
  /api-keys/,
  /command/,
  /execute/,
  /power/,
  /control/,
  /cec\//,
  /matrix\//,
  /directv.*send-command/,
  /firetv.*send-command/,
  /auth/,
  /credentials/,
  /upload/,
  /write-script/,
  /commit-push/,
  /reboot/,
  /restart/,
  /streaming.*launch/,
  /tune/,
  /route-matrix/,
  /switch-input/
];

const HIGH_PATTERNS = [
  /config/,
  /devices\/(?!.*\/(route|status|guide-data))/,
  /channel-presets/,
  /schedules/,
  /scheduled-commands/,
  /manage/,
  /ai-gain-control/,
  /input-gain/,
  /train/,
  /upload-documents/,
  /qa-upload/,
  /push-config/,
  /recall-scene/,
  /route-to-matrix/
];

const MEDIUM_PATTERNS = [
  /guide-data/,
  /search/,
  /query/,
  /logs\/(?!.*route)/,
  /analytics/,
  /stats/,
  /diagnostics/,
  /analyze/,
  /detect/,
  /discover/,
  /test-connection/,
  /test-providers/
];

const LOW_PATTERNS = [
  /health/,
  /status$/,
  /route$/,
  /\[id\]\/route/,
  /stats\/route/,
  /current-time/,
  /now-playing/
];

/**
 * Determine risk level based on endpoint path
 */
function determineRiskLevel(filePath) {
  const relativePath = filePath.replace('/home/ubuntu/Sports-Bar-TV-Controller/src/app/api/', '');

  // Check CRITICAL patterns
  for (const pattern of CRITICAL_PATTERNS) {
    if (pattern.test(relativePath)) {
      return RISK_LEVELS.CRITICAL;
    }
  }

  // Check HIGH patterns
  for (const pattern of HIGH_PATTERNS) {
    if (pattern.test(relativePath)) {
      return RISK_LEVELS.HIGH;
    }
  }

  // Check MEDIUM patterns
  for (const pattern of MEDIUM_PATTERNS) {
    if (pattern.test(relativePath)) {
      return RISK_LEVELS.MEDIUM;
    }
  }

  // Check LOW patterns
  for (const pattern of LOW_PATTERNS) {
    if (pattern.test(relativePath)) {
      return RISK_LEVELS.LOW;
    }
  }

  // Default to MEDIUM for uncertain cases
  return RISK_LEVELS.MEDIUM;
}

/**
 * Detect HTTP methods in a route file
 */
function detectHttpMethods(content) {
  const methods = [];

  // Match export async function GET/POST/PUT/DELETE/PATCH
  const methodRegex = /export\s+async\s+function\s+(GET|POST|PUT|DELETE|PATCH)\s*\(/g;
  let match;

  while ((match = methodRegex.exec(content)) !== null) {
    methods.push(match[1]);
  }

  return methods;
}

/**
 * Check if endpoint already has validation
 */
function hasValidation(content) {
  return content.includes('validateRequestBody') ||
         content.includes('validateQueryParams') ||
         content.includes('validatePathParams') ||
         content.includes('validateRequest');
}

/**
 * Detect what types of inputs the endpoint accepts
 */
function detectInputTypes(content, methods) {
  const inputs = {
    body: false,
    query: false,
    pathParams: false
  };

  // Check for body parsing (POST/PUT/PATCH typically have bodies)
  if (content.includes('await request.json()') ||
      content.includes('request.json') ||
      methods.some(m => ['POST', 'PUT', 'PATCH'].includes(m))) {
    inputs.body = true;
  }

  // Check for query params
  if (content.includes('searchParams') ||
      content.includes('request.url') ||
      content.includes('URLSearchParams')) {
    inputs.query = true;
  }

  // Check for path params
  if (content.includes('{ params }') || content.includes('params:')) {
    inputs.pathParams = true;
  }

  return inputs;
}

/**
 * Analyze a single endpoint file
 */
function analyzeEndpoint(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const relativePath = filePath.replace('/home/ubuntu/Sports-Bar-TV-Controller/src/app/api/', '');

  const methods = detectHttpMethods(content);
  const hasVal = hasValidation(content);
  const inputs = detectInputTypes(content, methods);
  const riskLevel = determineRiskLevel(filePath);

  return {
    path: relativePath,
    fullPath: filePath,
    methods,
    hasValidation: hasVal,
    inputs,
    riskLevel,
    priority: riskLevel === RISK_LEVELS.CRITICAL ? 1 :
              riskLevel === RISK_LEVELS.HIGH ? 2 :
              riskLevel === RISK_LEVELS.MEDIUM ? 3 : 4
  };
}

/**
 * Main analysis function
 */
function analyzeAllEndpoints() {
  const apiDir = '/home/ubuntu/Sports-Bar-TV-Controller/src/app/api';
  const routeFiles = [];

  // Recursively find all route.ts files
  function findRouteFiles(dir) {
    const files = fs.readdirSync(dir);

    for (const file of files) {
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        findRouteFiles(fullPath);
      } else if (file === 'route.ts') {
        routeFiles.push(fullPath);
      }
    }
  }

  findRouteFiles(apiDir);

  console.log(`Found ${routeFiles.length} route files\n`);

  // Analyze each endpoint
  const endpoints = routeFiles.map(analyzeEndpoint);

  // Sort by priority
  endpoints.sort((a, b) => a.priority - b.priority);

  // Generate statistics
  const stats = {
    total: endpoints.length,
    withValidation: endpoints.filter(e => e.hasValidation).length,
    withoutValidation: endpoints.filter(e => !e.hasValidation).length,
    byRisk: {
      CRITICAL: endpoints.filter(e => e.riskLevel === 'CRITICAL').length,
      HIGH: endpoints.filter(e => e.riskLevel === 'HIGH').length,
      MEDIUM: endpoints.filter(e => e.riskLevel === 'MEDIUM').length,
      LOW: endpoints.filter(e => e.riskLevel === 'LOW').length
    },
    byMethod: {
      GET: endpoints.filter(e => e.methods.includes('GET')).length,
      POST: endpoints.filter(e => e.methods.includes('POST')).length,
      PUT: endpoints.filter(e => e.methods.includes('PUT')).length,
      DELETE: endpoints.filter(e => e.methods.includes('DELETE')).length,
      PATCH: endpoints.filter(e => e.methods.includes('PATCH')).length
    }
  };

  // Print summary
  console.log('='.repeat(80));
  console.log('ENDPOINT ANALYSIS SUMMARY');
  console.log('='.repeat(80));
  console.log(`Total Endpoints: ${stats.total}`);
  console.log(`With Validation: ${stats.withValidation} (${(stats.withValidation/stats.total*100).toFixed(1)}%)`);
  console.log(`Without Validation: ${stats.withoutValidation} (${(stats.withoutValidation/stats.total*100).toFixed(1)}%)`);
  console.log('');
  console.log('By Risk Level:');
  console.log(`  CRITICAL: ${stats.byRisk.CRITICAL} (${(stats.byRisk.CRITICAL/stats.total*100).toFixed(1)}%)`);
  console.log(`  HIGH: ${stats.byRisk.HIGH} (${(stats.byRisk.HIGH/stats.total*100).toFixed(1)}%)`);
  console.log(`  MEDIUM: ${stats.byRisk.MEDIUM} (${(stats.byRisk.MEDIUM/stats.total*100).toFixed(1)}%)`);
  console.log(`  LOW: ${stats.byRisk.LOW} (${(stats.byRisk.LOW/stats.total*100).toFixed(1)}%)`);
  console.log('');
  console.log('By HTTP Method:');
  console.log(`  GET: ${stats.byMethod.GET}`);
  console.log(`  POST: ${stats.byMethod.POST}`);
  console.log(`  PUT: ${stats.byMethod.PUT}`);
  console.log(`  DELETE: ${stats.byMethod.DELETE}`);
  console.log(`  PATCH: ${stats.byMethod.PATCH}`);
  console.log('='.repeat(80));
  console.log('');

  // Save detailed results
  const outputPath = '/home/ubuntu/Sports-Bar-TV-Controller/endpoint-validation-analysis.json';
  fs.writeFileSync(outputPath, JSON.stringify({ stats, endpoints }, null, 2));
  console.log(`Detailed analysis saved to: ${outputPath}`);

  // Print endpoints without validation by risk level
  console.log('\n' + '='.repeat(80));
  console.log('ENDPOINTS WITHOUT VALIDATION (By Priority)');
  console.log('='.repeat(80));

  ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].forEach(riskLevel => {
    const filtered = endpoints.filter(e =>
      e.riskLevel === riskLevel && !e.hasValidation
    );

    if (filtered.length > 0) {
      console.log(`\n${riskLevel} (${filtered.length} endpoints):`);
      console.log('-'.repeat(80));
      filtered.forEach(e => {
        const inputsDesc = [
          e.inputs.body ? 'body' : '',
          e.inputs.query ? 'query' : '',
          e.inputs.pathParams ? 'params' : ''
        ].filter(Boolean).join(', ');

        console.log(`  ${e.path}`);
        console.log(`    Methods: ${e.methods.join(', ')}`);
        console.log(`    Inputs: ${inputsDesc || 'none detected'}`);
        console.log('');
      });
    }
  });

  return { stats, endpoints };
}

// Run the analysis
analyzeAllEndpoints();
