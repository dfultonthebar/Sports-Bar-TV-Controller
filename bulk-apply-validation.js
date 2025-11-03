#!/usr/bin/env node

/**
 * Bulk Apply Input Validation to API Endpoints
 *
 * This script reads each endpoint file, analyzes it, and adds appropriate
 * validation based on the endpoint's purpose and inputs.
 */

const fs = require('fs');
const path = require('path');

// Load the endpoint analysis
const analysis = require('./endpoint-validation-analysis.json');

/**
 * Schema mapping based on endpoint patterns and content analysis
 */
const ENDPOINT_PATTERNS = [
  // System operations (highest risk)
  { pattern: /system\/(restart|reboot)/, schema: { body: 'z.object({ confirm: z.literal(true) })' } },
  { pattern: /git\/commit-push/, schema: { body: 'ValidationSchemas.gitCommitPush' } },
  { pattern: /file-system\/execute/, schema: { body: 'ValidationSchemas.scriptExecution' } },
  { pattern: /file-system\/write-script/, schema: { body: 'ValidationSchemas.scriptExecution' } },

  // Authentication & credentials
  { pattern: /streaming-platforms\/(auth|credentials)/, schema: { body: 'ValidationSchemas.streamingCredentials' } },

  // Hardware control
  { pattern: /cec\/power-control/, schema: { body: 'ValidationSchemas.cecPowerControl' } },
  { pattern: /channel.*tune/, schema: { body: 'ValidationSchemas.channelTune' } },
  { pattern: /matrix\/route(?!s)/, schema: { body: 'ValidationSchemas.matrixRouting' } },
  { pattern: /audio-processor\/control/, schema: { body: 'ValidationSchemas.audioControl' } },

  // File uploads
  { pattern: /upload-documents/, schema: { body: 'ValidationSchemas.documentUpload' } },
  { pattern: /qa-upload/, schema: { body: 'ValidationSchemas.qaEntry' } },
  { pattern: /layout\/upload/, schema: { body: 'ValidationSchemas.layoutUpload' } },
  { pattern: /upload-config/, schema: { body: 'ValidationSchemas.configUpload' } },

  // Connection tests
  { pattern: /test-connection/, schema: { body: 'ValidationSchemas.connectionTest' } },

  // Logs with query params
  { pattern: /\/logs\//, schema: { query: 'ValidationSchemas.logQuery' } },

  // Generic AI/Chat endpoints
  { pattern: /(enhanced-)?chat|ai\/query/, schema: { body: 'ValidationSchemas.aiQuery' } },
];

/**
 * Detect the schema needed based on file content and path
 */
function detectSchema(endpoint, content) {
  // Check predefined patterns
  for (const { pattern, schema } of ENDPOINT_PATTERNS) {
    if (pattern.test(endpoint.path)) {
      return schema;
    }
  }

  // Content-based detection
  const result = {};

  // Check for specific validation needs in the content
  if (content.includes('request.json()') || endpoint.inputs.body) {
    if (endpoint.methods.includes('POST') || endpoint.methods.includes('PUT') || endpoint.methods.includes('PATCH')) {
      result.body = 'z.record(z.unknown())'; // Generic fallback
    }
  }

  if (content.includes('searchParams') || endpoint.inputs.query) {
    result.query = 'z.record(z.string()).optional()'; // Generic query params
  }

  if (endpoint.inputs.pathParams) {
    // Try to detect ID type from content
    if (content.includes('uuid')) {
      result.params = 'z.object({ id: ValidationSchemas.uuid })';
    } else {
      result.params = 'z.object({ id: z.string().min(1) })';
    }
  }

  return Object.keys(result).length > 0 ? result : null;
}

/**
 * Add validation to a specific HTTP method in the file
 */
function addValidationToMethod(content, methodName, schema) {
  // Find the method definition
  const methodRegex = new RegExp(`export\\s+async\\s+function\\s+${methodName}\\s*\\([^)]*\\)\\s*\\{`, 'g');
  const match = methodRegex.exec(content);

  if (!match) {
    return content; // Method not found
  }

  const methodStart = match.index + match[0].length;

  // Generate validation code
  let validationCode = '\n';

  if (schema.body) {
    validationCode += `  // Input validation\n`;
    validationCode += `  const bodyValidation = await validateRequestBody(request, ${schema.body})\n`;
    validationCode += `  if (!bodyValidation.success) return bodyValidation.error\n\n`;
  }

  if (schema.query) {
    validationCode += `  // Query parameter validation\n`;
    validationCode += `  const queryValidation = validateQueryParams(request, ${schema.query})\n`;
    validationCode += `  if (!queryValidation.success) return queryValidation.error\n\n`;
  }

  if (schema.params) {
    validationCode += `  // Path parameter validation\n`;
    validationCode += `  const resolvedParams = await params\n`;
    validationCode += `  const paramsValidation = validatePathParams(resolvedParams, ${schema.params})\n`;
    validationCode += `  if (!paramsValidation.success) return paramsValidation.error\n\n`;
  }

  // Insert validation code after method opening brace
  // Skip over any existing rate limiting check
  let insertPoint = methodStart;
  const rateLimitPattern = /const\s+rate(?:Limit|LimitCheck)\s*=\s*await\s+withRateLimit[^}]*\}/;
  const rateLimitMatch = content.slice(methodStart, methodStart + 500).match(rateLimitPattern);

  if (rateLimitMatch) {
    insertPoint = methodStart + rateLimitMatch.index + rateLimitMatch[0].length + 1;
    // Add newline after rate limiting
    validationCode = '\n' + validationCode;
  }

  return content.slice(0, insertPoint) + validationCode + content.slice(insertPoint);
}

/**
 * Add imports to the file if not present
 */
function ensureImports(content) {
  const hasValidationImport = content.includes('from \'@/lib/validation\'') || content.includes('from "@/lib/validation"');
  const hasZodImport = content.includes('from \'zod\'') || content.includes('from "zod"');

  if (hasValidationImport && hasZodImport) {
    return content; // Already has imports
  }

  // Find the last import
  const lines = content.split('\n');
  let lastImportIndex = -1;

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim().startsWith('import ')) {
      lastImportIndex = i;
    }
  }

  const importsToAdd = [];
  if (!hasZodImport) {
    importsToAdd.push('import { z } from \'zod\'');
  }
  if (!hasValidationImport) {
    importsToAdd.push('import { validateRequestBody, validateQueryParams, validatePathParams, ValidationSchemas } from \'@/lib/validation\'');
  }

  if (lastImportIndex >= 0) {
    lines.splice(lastImportIndex + 1, 0, ...importsToAdd);
  } else {
    // No imports found, add after first line
    lines.splice(1, 0, ...importsToAdd);
  }

  return lines.join('\n');
}

/**
 * Process a single endpoint file
 */
function processEndpoint(endpoint) {
  const { fullPath, path: relativePath, methods } = endpoint;

  // Read file
  let content = fs.readFileSync(fullPath, 'utf8');

  // Check if already has validation
  if (content.includes('validateRequestBody') ||
      content.includes('validateQueryParams') ||
      content.includes('validatePathParams')) {
    return { status: 'skipped', reason: 'already_validated' };
  }

  // Detect schema needed
  const schema = detectSchema(endpoint, content);
  if (!schema) {
    return { status: 'skipped', reason: 'no_schema_needed' };
  }

  // Backup original
  const backupPath = fullPath + '.backup';
  if (!fs.existsSync(backupPath)) {
    fs.writeFileSync(backupPath, content);
  }

  // Add imports
  content = ensureImports(content);

  // Add validation to each method that needs it
  const methodsNeedingValidation = methods.filter(m => {
    if (m === 'GET' && !schema.query && !schema.params) return false;
    if (m === 'DELETE' && !schema.params) return false;
    return true;
  });

  for (const method of methodsNeedingValidation) {
    content = addValidationToMethod(content, method, schema);
  }

  // Write back
  fs.writeFileSync(fullPath, content);

  return { status: 'success', schema, methods: methodsNeedingValidation };
}

/**
 * Main function
 */
function main() {
  const args = process.argv.slice(2);
  const riskLevel = args.find(arg => ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].includes(arg));
  const limit = parseInt(args.find(arg => arg.startsWith('--limit='))?.split('=')[1]) || Infinity;

  console.log('='.repeat(80));
  console.log('BULK VALIDATION APPLICATION');
  console.log('='.repeat(80));
  console.log(`Risk Level: ${riskLevel || 'ALL'}`);
  console.log(`Limit: ${limit === Infinity ? 'None' : limit}`);
  console.log('');

  // Filter endpoints
  let endpoints = analysis.endpoints.filter(e => !e.hasValidation);

  if (riskLevel) {
    endpoints = endpoints.filter(e => e.riskLevel === riskLevel);
  }

  endpoints = endpoints.slice(0, limit);

  console.log(`Processing ${endpoints.length} endpoints\n`);

  const results = {
    success: 0,
    skipped: 0,
    failed: 0
  };

  for (const endpoint of endpoints) {
    try {
      process.stdout.write(`Processing ${endpoint.path}... `);
      const result = processEndpoint(endpoint);

      if (result.status === 'success') {
        console.log('✓ Success');
        results.success++;
      } else {
        console.log(`⊘ Skipped (${result.reason})`);
        results.skipped++;
      }
    } catch (error) {
      console.log(`✗ Failed: ${error.message}`);
      results.failed++;
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('RESULTS');
  console.log('='.repeat(80));
  console.log(`Success: ${results.success}`);
  console.log(`Skipped: ${results.skipped}`);
  console.log(`Failed: ${results.failed}`);
  console.log(`\nTotal with validation: ${analysis.stats.withValidation + results.success}/${analysis.stats.total}`);
  console.log(`Coverage: ${((analysis.stats.withValidation + results.success) / analysis.stats.total * 100).toFixed(1)}%`);
}

main();
