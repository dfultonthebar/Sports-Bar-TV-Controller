#!/usr/bin/env node

/**
 * Endpoint Discovery and Categorization Script
 * Analyzes all API endpoints and categorizes them for rate limiting
 */

const fs = require('fs');
const path = require('path');

// All API endpoints from discovery
const endpoints = [
  'ai/analyze-layout', 'ai-assistant/analyze-logs', 'ai-assistant/index-codebase', 'ai-assistant/logs',
  'ai-assistant/search-code', 'ai/device-optimization', 'ai/documents', 'ai/enhanced-chat',
  'ai/generate-qa', 'ai-hub/qa-training/stats', 'ai/knowledge-query', 'ai/knowledge-stats',
  'ai/log-analysis', 'ai-providers/status', 'ai-providers/test', 'ai/qa-entries',
  'ai/qa-generate', 'ai/qa-upload', 'ai/rebuild-knowledge-base', 'ai/run-diagnostics',
  'ai-system/status', 'ai/tool-chat', 'ai/train', 'ai/upload-documents', 'ai/vision-analyze-layout',
  'api-keys', 'api-keys/[id]', 'atlas/ai-analysis', 'atlas/configuration', 'atlas/download-config',
  'atlas/groups', 'atlas/input-meters', 'atlas/meter-monitoring', 'atlas/output-meters',
  'atlas/query-hardware', 'atlas/recall-scene', 'atlas/route-matrix-to-zone', 'atlas/sources',
  'atlas/upload-config', 'audio-processor', 'audio-processor/control', 'audio-processor/[id]/adjustment-history',
  'audio-processor/[id]/ai-gain-control', 'audio-processor/[id]/ai-monitoring', 'audio-processor/[id]/input-gain',
  'audio-processor/[id]/zones-status', 'audio-processor/input-levels', 'audio-processor/inputs',
  'audio-processor/matrix-routing', 'audio-processor/meter-status', 'audio-processor/outputs',
  'audio-processor/test-connection', 'audio-processor/zones', 'backup', 'bartender/layout',
  'bartender/layout/backup', 'bartender/layout/detect', 'bartender/layout/upload', 'bartender/upload-layout',
  'cache/stats', 'cec/cable-box', 'cec/cable-box/command', 'cec/cable-box/discover',
  'cec/cable-box/logs', 'cec/cable-box/run-setup', 'cec/cable-box/stats', 'cec/cable-box/test',
  'cec/cable-box/tune', 'cec/command', 'cec/config', 'cec/devices', 'cec/discovery',
  'cec/enhanced-control', 'cec/fetch-tv-manual', 'cec/initialize', 'cec/monitor', 'cec/power-control',
  'cec/scan', 'cec/status', 'cec/tv-documentation', 'channel-guide', 'channel-presets',
  'channel-presets/by-device', 'channel-presets/[id]', 'channel-presets/reorder', 'channel-presets/statistics',
  'channel-presets/tune', 'channel-presets/update-usage', 'chat', 'circuit-breaker/status',
  'config/track-change', 'cron/init', 'design-feature', 'devices/ai-analysis', 'devices/execute-fix',
  'devices/intelligent-diagnostics', 'devices/smart-optimizer', 'devices/smart-optimizer/implement',
  'devices/smart-optimizer/toggle', 'device-subscriptions', 'device-subscriptions/poll', 'diagnostics/bartender-remote',
  'diagnostics/device-mapping', 'directv-devices', 'directv-devices/ai-insights', 'directv-devices/diagnose',
  'directv-devices/guide-data', 'directv-devices/resolve-alert', 'directv-devices/send-command',
  'directv-devices/smart-channel-change', 'directv-devices/test-connection', 'directv-logs', 'documents/[id]',
  'documents/reprocess', 'enhanced-chat', 'file-system/execute', 'file-system/manage', 'file-system/write-script',
  'firetv-devices', 'firetv-devices/connection-status', 'firetv-devices/guide-data', 'firetv-devices/send-command',
  'firetv-devices/test-connection', 'generate-script', 'git/commit-push', 'github/auto-config-sync',
  'github/push-config', 'git/pull', 'git/status', 'globalcache/devices', 'globalcache/devices/[id]',
  'globalcache/devices/[id]/test', 'globalcache/learn', 'globalcache/ports/[id]', 'health',
  'home-teams', 'ir/commands', 'ir/commands/[id]', 'ir/commands/send', 'ir/credentials',
  'ir/database/brands', 'ir/database/download', 'ir/database/functions', 'ir/database/models',
  'ir/database/types', 'ir-devices', 'ir/devices', 'ir/devices/[id]', 'ir/devices/[id]/commands',
  'ir/devices/[id]/load-template', 'ir-devices/model-codes', 'ir-devices/search-codes', 'ir-devices/send-command',
  'ir-devices/send-ip-command', 'ir-devices/start-learning', 'ir-devices/stop-learning', 'ir-devices/test-connection',
  'ir/learn', 'ir/templates', 'keys', 'leagues', 'logs/ai-analysis', 'logs/analytics',
  'logs/channel-guide-tracking', 'logs/config-change', 'logs/config-tracking', 'logs/device-interaction',
  'logs/error', 'logs/export', 'logs/operations', 'logs/performance', 'logs/preview',
  'logs/recent', 'logs/stats', 'logs/user-action', 'matrix/command', 'matrix-config',
  'matrix/config', 'matrix/config/cec-input', 'matrix/connection-manager', 'matrix-display',
  'matrix/initialize-connection', 'matrix/outputs-schedule', 'matrix/route', 'matrix/routes',
  'matrix/switch-input-enhanced', 'matrix/test-connection', 'matrix/video-input-selection', 'n8n/webhook',
  'scheduled-commands', 'scheduler/manage', 'scheduler/status', 'schedules', 'schedules/execute',
  'schedules/[id]', 'schedules/logs', 'security/logs', 'selected-leagues', 'soundtrack/account',
  'soundtrack/cache', 'soundtrack/config', 'soundtrack/diagnose', 'soundtrack/now-playing', 'soundtrack/players',
  'soundtrack/stations', 'soundtrack/test', 'sports-guide', 'sports-guide/channels', 'sports-guide-config',
  'sports-guide/current-time', 'sports-guide/ollama/query', 'sports-guide/scheduled', 'sports-guide/status',
  'sports-guide/test-providers', 'sports-guide/update-key', 'sports-guide/verify-key', 'sports/sync',
  'sports/upcoming', 'startup', 'streaming/apps/detect', 'streaming/events', 'streaming/launch',
  'streaming-platforms/auth', 'streaming-platforms/credentials', 'streaming-platforms/status', 'streaming/status',
  'streaming/subscribed-apps', 'system/health', 'system/health-check', 'system/reboot', 'system/restart',
  'system/status', 'test-env', 'tests/logs', 'tests/run', 'tests/wolfpack/connection',
  'tests/wolfpack/switching', 'todos', 'todos/[id]', 'todos/[id]/complete', 'todos/[id]/documents',
  'tv-brands', 'tv-brands/detect', 'tv-guide/gracenote', 'tv-guide/spectrum-business', 'tv-guide/unified',
  'tv-programming', 'tv-programming/scheduler', 'unified-guide', 'unified-tv-control', 'upload',
  'uploads/layouts/[filename]', 'web-search', 'wolfpack/ai-analysis', 'wolfpack/current-routings',
  'wolfpack/inputs', 'wolfpack/route-to-matrix'
];

// Categorization rules
const categories = {
  'AI_OPERATIONS': {
    patterns: ['ai/', 'ai-', 'ollama', 'vision', 'qa-', 'knowledge'],
    config: 'AI',
    priority: 3,
    maxRequests: 5,
    windowMs: 60000,
    description: 'AI/ML operations including OCR, detection, Q&A, knowledge base'
  },
  'HARDWARE_CONTROL': {
    patterns: ['cec/', 'matrix/', 'wolfpack/', 'audio-processor/', 'atlas/', 'globalcache/'],
    config: 'HARDWARE',
    priority: 2,
    maxRequests: 60,
    windowMs: 60000,
    description: 'Hardware control (CEC, matrix, FireTV, audio processor, atlas)'
  },
  'DEVICE_MANAGEMENT': {
    patterns: ['directv-devices', 'firetv-devices', 'ir-devices', 'ir/', 'devices/', 'streaming-platforms/'],
    config: 'HARDWARE',
    priority: 2,
    maxRequests: 60,
    windowMs: 60000,
    description: 'Device management and control endpoints'
  },
  'SPORTS_DATA': {
    patterns: ['sports-guide', 'sports/', 'channel-guide', 'tv-guide/', 'tv-programming', 'unified-guide', 'channel-presets'],
    config: 'SPORTS_DATA',
    priority: 3,
    maxRequests: 30,
    windowMs: 60000,
    description: 'Sports data and TV guide APIs'
  },
  'AUTHENTICATION': {
    patterns: ['api-keys', 'keys', 'streaming-platforms/auth', 'streaming-platforms/credentials', 'ir/credentials'],
    config: 'AUTH',
    priority: 1,
    maxRequests: 10,
    windowMs: 60000,
    description: 'Authentication and API key management'
  },
  'SYSTEM_MANAGEMENT': {
    patterns: ['health', 'system/', 'startup', 'circuit-breaker', 'cache/', 'test-env'],
    config: 'SYSTEM',
    priority: 6,
    maxRequests: 100,
    windowMs: 60000,
    description: 'System health and management endpoints'
  },
  'DATABASE_WRITE': {
    patterns: ['backup', 'config/track', 'logs/', 'device-subscriptions/poll', 'schedules/execute'],
    config: 'DATABASE_WRITE',
    priority: 4,
    maxRequests: 30,
    windowMs: 60000,
    description: 'Database write operations and logging'
  },
  'DATABASE_READ': {
    patterns: ['logs/', 'leagues', 'home-teams', 'selected-leagues', 'tv-brands', 'schedules', 'todos', 'diagnostics/'],
    config: 'DATABASE_READ',
    priority: 5,
    maxRequests: 60,
    windowMs: 60000,
    description: 'Database read operations'
  },
  'FILE_OPERATIONS': {
    patterns: ['file-system/', 'documents/', 'upload', 'bartender/layout', 'generate-script'],
    config: 'FILE_OPS',
    priority: 4,
    maxRequests: 20,
    windowMs: 60000,
    description: 'File system operations and uploads'
  },
  'GIT_OPERATIONS': {
    patterns: ['git/', 'github/'],
    config: 'GIT',
    priority: 4,
    maxRequests: 10,
    windowMs: 60000,
    description: 'Git operations and GitHub integration'
  },
  'EXTERNAL_API': {
    patterns: ['web-search', 'soundtrack/', 'streaming/', 'design-feature'],
    config: 'EXTERNAL',
    priority: 3,
    maxRequests: 20,
    windowMs: 60000,
    description: 'External API calls and integrations'
  },
  'SCHEDULING': {
    patterns: ['scheduler/', 'schedules/', 'cron/', 'scheduled-commands'],
    config: 'SCHEDULER',
    priority: 5,
    maxRequests: 30,
    windowMs: 60000,
    description: 'Scheduling and automation endpoints'
  },
  'TESTING': {
    patterns: ['test', 'tests/'],
    config: 'TESTING',
    priority: 6,
    maxRequests: 50,
    windowMs: 60000,
    description: 'Testing and diagnostics endpoints'
  },
  'WEBHOOKS': {
    patterns: ['n8n/webhook', 'webhook'],
    config: 'WEBHOOK',
    priority: 5,
    maxRequests: 100,
    windowMs: 60000,
    description: 'Webhook endpoints for external integrations'
  }
};

function categorizeEndpoint(endpoint) {
  const matched = [];

  for (const [categoryName, categoryInfo] of Object.entries(categories)) {
    for (const pattern of categoryInfo.patterns) {
      if (endpoint.includes(pattern)) {
        matched.push({
          category: categoryName,
          config: categoryInfo.config,
          priority: categoryInfo.priority,
          maxRequests: categoryInfo.maxRequests,
          windowMs: categoryInfo.windowMs,
          description: categoryInfo.description
        });
        break;
      }
    }
  }

  // Return highest priority match (lowest priority number)
  if (matched.length > 0) {
    matched.sort((a, b) => a.priority - b.priority);
    return matched[0];
  }

  // Default category
  return {
    category: 'GENERAL',
    config: 'DEFAULT',
    priority: 5,
    maxRequests: 30,
    windowMs: 60000,
    description: 'General API endpoints'
  };
}

// Categorize all endpoints
const categorizedEndpoints = endpoints.map(endpoint => ({
  endpoint,
  path: `/home/ubuntu/Sports-Bar-TV-Controller/src/app/api/${endpoint}/route.ts`,
  ...categorizeEndpoint(endpoint)
}));

// Group by category
const byCategory = {};
categorizedEndpoints.forEach(ep => {
  if (!byCategory[ep.category]) {
    byCategory[ep.category] = [];
  }
  byCategory[ep.category].push(ep);
});

// Print results
console.log('═══════════════════════════════════════════════════════════════');
console.log('RATE LIMITING DISCOVERY - ENDPOINT CATEGORIZATION');
console.log('═══════════════════════════════════════════════════════════════\n');

console.log(`Total Endpoints Found: ${endpoints.length}`);
console.log(`Currently Protected: 0 (0%)`);
console.log(`Unprotected: ${endpoints.length} (100%)\n`);

console.log('CATEGORIZATION BREAKDOWN:\n');

// Sort categories by priority
const sortedCategories = Object.entries(byCategory).sort((a, b) => {
  const priorityA = a[1][0].priority;
  const priorityB = b[1][0].priority;
  return priorityA - priorityB;
});

sortedCategories.forEach(([category, eps]) => {
  const sample = eps[0];
  console.log(`${category}:`);
  console.log(`  Count: ${eps.length}`);
  console.log(`  Config: ${sample.config}`);
  console.log(`  Priority: ${sample.priority}`);
  console.log(`  Rate Limit: ${sample.maxRequests} req/${sample.windowMs/1000}s`);
  console.log(`  Description: ${sample.description}`);
  console.log(`  Sample endpoints:`);
  eps.slice(0, 3).forEach(ep => {
    console.log(`    - ${ep.endpoint}`);
  });
  console.log('');
});

// Generate implementation summary
console.log('\n═══════════════════════════════════════════════════════════════');
console.log('REQUIRED RATE LIMIT CONFIGURATIONS');
console.log('═══════════════════════════════════════════════════════════════\n');

const configsNeeded = new Set();
categorizedEndpoints.forEach(ep => configsNeeded.add(ep.config));

const existingConfigs = ['DEFAULT', 'AI', 'SPORTS', 'EXPENSIVE', 'HARDWARE', 'AUTH'];
const newConfigsNeeded = Array.from(configsNeeded).filter(c => !existingConfigs.includes(c));

console.log('Existing configs (in rate-limiter.ts):');
existingConfigs.forEach(c => console.log(`  ✓ ${c}`));

console.log('\nNew configs needed:');
newConfigsNeeded.forEach(c => {
  const example = categorizedEndpoints.find(ep => ep.config === c);
  console.log(`  + ${c}: ${example.maxRequests} req/${example.windowMs/1000}s`);
});

// Write detailed report to file
const report = {
  summary: {
    totalEndpoints: endpoints.length,
    currentlyProtected: 0,
    unprotected: endpoints.length,
    categories: sortedCategories.length,
    existingConfigs,
    newConfigsNeeded
  },
  categorizedEndpoints,
  byCategory,
  implementationPlan: {
    priority1: byCategory['AUTHENTICATION'] || [],
    priority2: [...(byCategory['HARDWARE_CONTROL'] || []), ...(byCategory['DEVICE_MANAGEMENT'] || [])],
    priority3: [...(byCategory['AI_OPERATIONS'] || []), ...(byCategory['SPORTS_DATA'] || []), ...(byCategory['EXTERNAL_API'] || [])],
    priority4: [...(byCategory['DATABASE_WRITE'] || []), ...(byCategory['FILE_OPERATIONS'] || []), ...(byCategory['GIT_OPERATIONS'] || [])],
    priority5: [...(byCategory['DATABASE_READ'] || []), ...(byCategory['SCHEDULING'] || []), ...(byCategory['WEBHOOKS'] || [])],
    priority6: [...(byCategory['SYSTEM_MANAGEMENT'] || []), ...(byCategory['TESTING'] || [])]
  }
};

fs.writeFileSync(
  '/home/ubuntu/Sports-Bar-TV-Controller/rate-limiting-analysis.json',
  JSON.stringify(report, null, 2)
);

console.log('\n✓ Detailed report saved to: rate-limiting-analysis.json\n');
