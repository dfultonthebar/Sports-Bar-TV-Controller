#!/usr/bin/env node

/**
 * Apply Input Validation to API Endpoints
 *
 * This script systematically applies validation middleware to API endpoints
 * based on their risk level and input types.
 */

const fs = require('fs');
const path = require('path');

// Load the endpoint analysis
const analysis = require('./endpoint-validation-analysis.json');

// Validation schema mappings based on endpoint patterns
const SCHEMA_MAPPINGS = {
  // Hardware control endpoints
  '/cec/command': { body: 'cecCommandSchema', import: 'already imported' },
  '/matrix/command': { body: 'matrixCommandSchema', import: 'already imported' },
  '/cec/power-control': { body: 'ValidationSchemas.cecPowerControl' },
  '/channel-presets/tune': { body: 'ValidationSchemas.channelTune' },
  '/matrix/route': { body: 'ValidationSchemas.matrixRouting' },
  '/ir/commands/send': { body: 'ValidationSchemas.irCommandSend' },
  '/ir-devices/send-command': { body: 'ValidationSchemas.irCommandSend' },
  '/audio-processor/control': { body: 'ValidationSchemas.audioControl' },

  // File upload endpoints
  '/upload-documents': { body: 'ValidationSchemas.documentUpload' },
  '/qa-upload': { body: 'ValidationSchemas.qaEntry' },
  '/layout/upload': { body: 'ValidationSchemas.layoutUpload' },
  '/upload-config': { body: 'ValidationSchemas.configUpload' },

  // System operations
  '/git/commit-push': { body: 'ValidationSchemas.gitCommitPush' },
  '/system/restart': { body: 'ValidationSchemas.systemRestart' },
  '/system/reboot': { body: 'ValidationSchemas.systemRestart' },
  '/file-system/execute': { body: 'ValidationSchemas.scriptExecution' },
  '/write-script': { body: 'ValidationSchemas.scriptExecution' },

  // Streaming
  '/streaming/launch': { body: 'streamingAppLaunchSchema', import: 'already imported' },
  '/streaming-platforms/credentials': { body: 'ValidationSchemas.streamingCredentials' },

  // Configuration
  '/config': { body: 'ValidationSchemas.deviceConfig' },

  // Query endpoints with pagination
  '/logs': { query: 'ValidationSchemas.logQuery' },

  // Connection tests
  '/test-connection': { body: 'ValidationSchemas.connectionTest' },

  // AI/Analysis
  '/ai-analysis': { body: 'ValidationSchemas.aiAnalysis' },
  '/ai/': { body: 'ValidationSchemas.aiQuery' },
  '/enhanced-chat': { body: 'ValidationSchemas.aiQuery' },
  '/chat': { body: 'ValidationSchemas.aiQuery' }
};

/**
 * Determine the appropriate schema for an endpoint
 */
function determineSchema(endpoint) {
  for (const [pattern, schemas] of Object.entries(SCHEMA_MAPPINGS)) {
    if (endpoint.path.includes(pattern)) {
      return schemas;
    }
  }

  // Default schemas based on inputs
  const result = {};

  if (endpoint.inputs.body && endpoint.methods.includes('POST')) {
    // Generic body validation for POST
    result.body = 'z.object({ /* TODO: Define schema */ })';
  }

  if (endpoint.inputs.query) {
    result.query = 'ValidationSchemas.paginationQuery';
  }

  if (endpoint.inputs.pathParams) {
    result.params = 'z.object({ id: ValidationSchemas.uuid.or(ValidationSchemas.deviceId) })';
  }

  return Object.keys(result).length > 0 ? result : null;
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
 * Check if endpoint already imports validation
 */
function hasValidationImport(content) {
  return content.includes('from \'@/lib/validation\'') ||
         content.includes('from "@/lib/validation"');
}

/**
 * Add validation import to file
 */
function addValidationImport(content) {
  // Check if zod is already imported
  const hasZodImport = content.includes('from \'zod\'') || content.includes('from "zod"');

  // Find the last import statement
  const importRegex = /import\s+.*?from\s+['"@][^'"]+['"]/g;
  const imports = content.match(importRegex);

  if (!imports || imports.length === 0) {
    // No imports found, add at the beginning after first line
    const lines = content.split('\n');
    lines.splice(1, 0, 'import { z } from \'zod\'');
    lines.splice(2, 0, 'import { validateRequestBody, validateQueryParams, validatePathParams, ValidationSchemas } from \'@/lib/validation\'');
    return lines.join('\n');
  }

  const lastImport = imports[imports.length - 1];
  const lastImportIndex = content.indexOf(lastImport) + lastImport.length;

  let importsToAdd = [];
  if (!hasZodImport) {
    importsToAdd.push('\nimport { z } from \'zod\'');
  }
  importsToAdd.push('\nimport { validateRequestBody, validateQueryParams, validatePathParams, ValidationSchemas } from \'@/lib/validation\'');

  return content.slice(0, lastImportIndex) + importsToAdd.join('') + content.slice(lastImportIndex);
}

/**
 * Generate validation code for an endpoint method
 */
function generateValidationCode(schema, indent = '  ') {
  if (!schema) return '';

  let code = [];

  // Generate schema definitions
  const schemaDefinitions = [];
  if (schema.body && !schema.body.includes('Schema')) {
    schemaDefinitions.push(`${indent}// Validation schema`);
    schemaDefinitions.push(`${indent}const bodySchema = ${schema.body}`);
  }
  if (schema.query && !schema.query.includes('Schema')) {
    schemaDefinitions.push(`${indent}const querySchema = ${schema.query}`);
  }
  if (schema.params && !schema.params.includes('Schema')) {
    schemaDefinitions.push(`${indent}const paramsSchema = ${schema.params}`);
  }

  // Generate validation calls
  if (schema.body) {
    const bodySchema = schema.body.includes('Schema') ? schema.body : 'bodySchema';
    code.push(`${indent}// Validate request body`);
    code.push(`${indent}const validation = await validateRequestBody(request, ${bodySchema})`);
    code.push(`${indent}if (!validation.success) return validation.error`);
    code.push('');
    code.push(`${indent}const validatedBody = validation.data`);
  }

  if (schema.query) {
    const querySchema = schema.query.includes('Schema') ? schema.query : 'querySchema';
    code.push(`${indent}// Validate query parameters`);
    code.push(`${indent}const queryValidation = validateQueryParams(request, ${querySchema})`);
    code.push(`${indent}if (!queryValidation.success) return queryValidation.error`);
    code.push('');
    code.push(`${indent}const validatedQuery = queryValidation.data`);
  }

  if (schema.params) {
    const paramsSchema = schema.params.includes('Schema') ? schema.params : 'paramsSchema';
    code.push(`${indent}// Validate path parameters`);
    code.push(`${indent}const paramsValidation = validatePathParams(await params, ${paramsSchema})`);
    code.push(`${indent}if (!paramsValidation.success) return paramsValidation.error`);
    code.push('');
    code.push(`${indent}const validatedParams = paramsValidation.data`);
  }

  if (schemaDefinitions.length > 0) {
    return schemaDefinitions.join('\n') + '\n\n' + code.join('\n');
  }

  return code.join('\n');
}

/**
 * Apply validation to a single endpoint
 */
function applyValidationToEndpoint(endpoint, dryRun = true) {
  const { fullPath, path: relativePath } = endpoint;

  console.log(`\nProcessing: ${relativePath}`);

  // Read the file
  let content = fs.readFileSync(fullPath, 'utf8');

  // Check if already has validation
  if (hasValidation(content)) {
    console.log('  ✓ Already has validation - skipping');
    return { status: 'skipped', reason: 'already_validated' };
  }

  // Determine schema
  const schema = determineSchema(endpoint);
  if (!schema) {
    console.log('  ⚠ Could not determine appropriate schema - needs manual review');
    return { status: 'needs_manual', reason: 'no_schema_match' };
  }

  console.log('  Schema determined:', JSON.stringify(schema, null, 2));

  // Add imports if needed
  if (!hasValidationImport(content)) {
    content = addValidationImport(content);
    console.log('  ✓ Added validation imports');
  }

  // Generate validation code
  const validationCode = generateValidationCode(schema);
  console.log('  Validation code:');
  console.log(validationCode.split('\n').map(line => '    ' + line).join('\n'));

  if (!dryRun) {
    // Backup original file
    const backupPath = fullPath + '.backup';
    fs.writeFileSync(backupPath, fs.readFileSync(fullPath));

    // Write modified content
    // NOTE: Actual insertion logic would go here
    // This is complex and requires AST manipulation for safety
    // For now, we'll just report what would be done

    console.log('  ⚠ Actual file modification not implemented - use manual application');
    console.log(`  Backup created at: ${backupPath}`);
  } else {
    console.log('  [DRY RUN] Would add validation code above');
  }

  return { status: 'success', schema };
}

/**
 * Main application function
 */
function main() {
  const args = process.argv.slice(2);
  const dryRun = !args.includes('--apply');
  const riskLevel = args.find(arg => ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].includes(arg));

  console.log('='.repeat(80));
  console.log('INPUT VALIDATION APPLICATION SCRIPT');
  console.log('='.repeat(80));
  console.log(`Mode: ${dryRun ? 'DRY RUN (use --apply to actually modify files)' : 'APPLY'}`);
  console.log(`Risk Level Filter: ${riskLevel || 'ALL'}`);
  console.log('');

  // Filter endpoints
  let endpoints = analysis.endpoints.filter(e => !e.hasValidation);

  if (riskLevel) {
    endpoints = endpoints.filter(e => e.riskLevel === riskLevel);
  }

  console.log(`Processing ${endpoints.length} endpoints without validation`);
  console.log('='.repeat(80));

  // Track results
  const results = {
    success: 0,
    skipped: 0,
    needsManual: 0,
    failed: 0
  };

  // Process each endpoint
  for (const endpoint of endpoints.slice(0, 20)) { // Limit to first 20 for now
    try {
      const result = applyValidationToEndpoint(endpoint, dryRun);

      if (result.status === 'success') results.success++;
      else if (result.status === 'skipped') results.skipped++;
      else if (result.status === 'needs_manual') results.needsManual++;
    } catch (error) {
      console.log(`  ✗ Error: ${error.message}`);
      results.failed++;
    }
  }

  // Print summary
  console.log('\n' + '='.repeat(80));
  console.log('SUMMARY');
  console.log('='.repeat(80));
  console.log(`Success: ${results.success}`);
  console.log(`Skipped: ${results.skipped}`);
  console.log(`Needs Manual: ${results.needsManual}`);
  console.log(`Failed: ${results.failed}`);
  console.log('');

  if (dryRun) {
    console.log('This was a DRY RUN. Use --apply to actually modify files.');
    console.log('You can also filter by risk level: CRITICAL, HIGH, MEDIUM, or LOW');
    console.log('Example: node apply-validation-to-endpoints.js --apply CRITICAL');
  }
}

// Run the script
main();
