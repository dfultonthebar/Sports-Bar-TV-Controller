#!/usr/bin/env ts-node
/**
 * Script to systematically fix logger API usage errors across the codebase
 * Converts incorrect logger calls to proper LogOptions format
 */

import * as fs from 'fs/promises';
import * as path from 'path';

// Files to fix (from type-check output)
const FILES_TO_FIX = [
  'src/app/api/atlas/query-hardware/route.ts',
  'src/app/api/atlas/upload-config/route.ts',
  'src/app/api/audio-processor/control/route.ts',
  'src/app/api/audio-processor/[id]/input-gain/route.ts',
  'src/app/api/auth/login/route.ts',
  'src/app/api/auth/logout/route.ts',
  'src/app/api/bartender/layout/route.ts',
  'src/app/api/bartender/layout/upload/route.ts',
  'src/app/api/bartender/upload-layout/route.ts',
  'src/app/api/cec/devices/route.ts',
  'src/app/api/cec/power-control/route.ts',
  'src/app/api/channel-guide/route.ts',
  'src/app/api/channel-presets/route.ts',
  'src/app/api/chat/route.ts',
  'src/app/api/directv-logs/route.ts',
  'src/app/api/enhanced-chat/route.ts',
  'src/app/api/firetv-devices/test-connection/route.ts',
  'src/app/api/globalcache/devices/[id]/test/route.ts',
  'src/app/api/globalcache/devices/route.ts',
  'src/app/api/globalcache/learn/route.ts',
  'src/app/api/health/route.ts',
  'src/app/api/ir/commands/[id]/route.ts',
  'src/app/api/ir/commands/route.ts',
  'src/app/api/ir/commands/send/route.ts',
  'src/app/api/ir/credentials/route.ts',
  'src/app/api/ir/database/brands/route.ts',
  'src/app/api/ir/database/download/route.ts',
  'src/app/api/ir/database/functions/route.ts',
  'src/app/api/ir/database/models/route.ts',
  'src/app/api/ir/database/types/route.ts',
  'src/app/api/ir/devices/[id]/commands/route.ts',
  'src/app/api/ir/devices/[id]/load-template/route.ts',
  'src/app/api/ir/devices/[id]/route.ts',
  'src/app/api/ir-devices/learn/route.ts',
  'src/app/api/ir/devices/route.ts',
  'src/app/api/ir-devices/search-codes/route.ts',
  'src/app/api/ir-devices/send-command/route.ts',
  'src/app/api/ir-devices/start-learning/route.ts',
  'src/app/api/ir-devices/stop-learning/route.ts',
  'src/app/api/ir-devices/test-connection/route.ts',
  'src/app/api/ir/learn/route.ts',
  'src/app/api/matrix/config/cec-input/route.ts',
  'src/app/api/n8n/webhook/route.ts',
  'src/app/api/rag/query/route.ts',
  'src/app/api/rag/rebuild/route.ts',
  'src/app/api/schedules/execute/route.ts',
  'src/app/api/selected-leagues/route.ts',
  'src/app/api/soundtrack/config/route.ts',
  'src/app/api/sports-guide/route.ts',
  'src/app/api/streaming/launch/route.ts',
  'src/app/api/streaming/subscribed-apps/route.ts',
  'src/app/api/system/health/route.ts',
  'src/app/api/tests/wolfpack/connection/route.ts',
  'src/app/api/tests/wolfpack/switching/route.ts',
  'src/app/error.tsx',
  'src/components/AILayoutAnalyzer.tsx',
  'src/components/AtlasInputMeters.tsx',
  'src/components/AtlasOutputMeters.tsx',
  'src/components/AtlasProgrammingInterface.tsx',
  'src/components/AudioProcessorManager.tsx',
  'src/components/AudioZoneControl.tsx',
  'src/components/BartenderRemoteControl.tsx',
  'src/components/DocumentUpload.tsx',
  'src/components/ir/IRDeviceSetup.tsx',
  'src/components/LayoutConfiguration.tsx',
  'src/components/SportsGuide.tsx',
  'src/components/WolfpackAIMonitor.tsx',
  'src/lib/ai-gain-service.ts',
  'src/lib/ai-tools/security/sandbox.ts',
  'src/lib/atlas-ai-analyzer.ts',
  'src/lib/atlas-hardware-query.ts',
  'src/lib/atlas-realtime-meter-service.ts',
  'src/lib/atlas-tcp-client.ts',
  'src/lib/database-logger.ts',
  'src/lib/db-audit-logger.ts',
  'src/lib/directv-logger.ts',
  'src/lib/enhanced-ai-client.ts',
  'src/lib/local-ai-analyzer.ts',
  'src/lib/memory-bank/file-watcher.ts',
  'src/lib/memory-bank/index.ts',
  'src/lib/memory-bank/storage.ts',
  'src/lib/rag-server/doc-processor.ts',
  'src/lib/rag-server/llm-client.ts',
  'src/lib/rag-server/query-engine.ts',
  'src/lib/rag-server/vector-store.ts',
  'src/lib/services/command-scheduler.ts',
  'src/lib/services/ir-database.ts',
  'src/lib/services/qa-generator-processor.ts',
  'src/lib/services/qa-generator.ts',
  'src/lib/soundtrack-your-brand.ts',
  'src/lib/validation/middleware.ts',
  'src/services/firetv-health-monitor.ts',
  'src/services/presetCronService.ts',
];

/**
 * Fix logger calls in a file by applying regex transformations
 */
async function fixFileLoggerCalls(filePath: string): Promise<number> {
  const fullPath = path.join(process.cwd(), filePath);
  let content = await fs.readFile(fullPath, 'utf-8');
  let fixCount = 0;

  // Pattern 1: logger.method('message', primitiveValue) -> logger.method('message', { data: primitiveValue })
  // Matches: logger.info('msg', 'string'), logger.error('msg', 123), logger.info('msg', true), etc.
  const primitivePattern = /\b(logger\.(debug|info|warn|error|success))\(([^,]+),\s*(?!{)([^)]+)\)/g;
  const newContent1 = content.replace(primitivePattern, (match, loggerMethod, level, message, value) => {
    // Don't transform if value already looks like an options object or is a function call that might return LogOptions
    if (value.trim().startsWith('{') || value.includes('instanceof Error')) {
      return match;
    }
    fixCount++;
    return `${loggerMethod}(${message}, { data: ${value} })`;
  });

  if (newContent1 !== content) {
    content = newContent1;
  }

  // Pattern 2: logger.method('message', { unknownProp: value }) -> logger.method('message', { data: { unknownProp: value } })
  // This is trickier and we'll handle specific cases

  // Save if changes were made
  if (fixCount > 0) {
    await fs.writeFile(fullPath, content, 'utf-8');
    console.log(`Fixed ${fixCount} logger calls in ${filePath}`);
  }

  return fixCount;
}

async function main() {
  console.log('Starting logger API usage fixes...\n');

  let totalFixed = 0;
  let filesProcessed = 0;

  for (const file of FILES_TO_FIX) {
    try {
      const fixes = await fixFileLoggerCalls(file);
      totalFixed += fixes;
      filesProcessed++;

      if (fixes > 0) {
        console.log(`✓ ${file}: ${fixes} fixes`);
      }
    } catch (error) {
      console.error(`✗ Error processing ${file}:`, error);
    }
  }

  console.log(`\n✓ Complete! Fixed ${totalFixed} logger calls across ${filesProcessed} files.`);
}

main().catch(console.error);
