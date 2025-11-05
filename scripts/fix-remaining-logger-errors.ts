#!/usr/bin/env tsx

/**
 * Fix remaining logger errors that couldn't be auto-fixed
 * These are multi-line logger calls with custom properties
 */

import * as fs from 'fs';
import * as path from 'path';

const fixes = [
  // bartender/layout/route.ts
  {
    file: 'src/app/api/bartender/layout/route.ts',
    line: 48,
    find: `logger.error('Failed to parse bartender layout file:', { parseError, data: data?.substring(0, 100) })`,
    replace: `logger.error('Failed to parse bartender layout file:', { error: parseError, data: { preview: data?.substring(0, 100) } })`
  },

  // bartender/layout/upload/route.ts
  {
    file: 'src/app/api/bartender/layout/upload/route.ts',
    line: 74,
    find: `      logger.info('[Layout Upload] Detection result:', {
        zonesFound: detectionResult.zones.length,
        detectionsCount: detectionResult.detectionsCount,
        errors: detectionResult.errors`,
    replace: `      logger.info('[Layout Upload] Detection result:', {
        data: {
          zonesFound: detectionResult.zones.length,
          detectionsCount: detectionResult.detectionsCount,
          errors: detectionResult.errors
        }`
  },

  // bartender/upload-layout/route.ts
  {
    file: 'src/app/api/bartender/upload-layout/route.ts',
    line: 344,
    find: `      logger.info('[Upload Layout] Detection result:', {
        zonesFound: detectionResult.zones.length,
        detectionsCount: detectionResult.detectionsCount,
        errors: detectionResult.errors`,
    replace: `      logger.info('[Upload Layout] Detection result:', {
        data: {
          zonesFound: detectionResult.zones.length,
          detectionsCount: detectionResult.detectionsCount,
          errors: detectionResult.errors
        }`
  },

  // channel-presets/route.ts
  {
    file: 'src/app/api/channel-presets/route.ts',
    line: 78,
    find: `logger.info('Saved channel preset:', { name, zoneId, channels: channels.length })`,
    replace: `logger.info('Saved channel preset:', { data: { name, zoneId, channels: channels.length } })`
  },

  // n8n/webhook/route.ts - multiple
  {
    file: 'src/app/api/n8n/webhook/route.ts',
    line: 180,
    find: `logger.info('[N8N Webhook] Switching output:', { outputNumber, targetInput })`,
    replace: `logger.info('[N8N Webhook] Switching output:', { data: { outputNumber, targetInput } })`
  },
  {
    file: 'src/app/api/n8n/webhook/route.ts',
    line: 214,
    find: `logger.info('[N8N Webhook] Setting volume for zone:', { zoneNumber, targetVolume })`,
    replace: `logger.info('[N8N Webhook] Setting volume for zone:', { data: { zoneNumber, targetVolume } })`
  },
  {
    file: 'src/app/api/n8n/webhook/route.ts',
    line: 248,
    find: `logger.info('[N8N Webhook] Assigning preset to Wolfpack input:', { wolfpackInputNumber, presetId })`,
    replace: `logger.info('[N8N Webhook] Assigning preset to Wolfpack input:', { data: { wolfpackInputNumber, presetId } })`
  },
  {
    file: 'src/app/api/n8n/webhook/route.ts',
    line: 281,
    find: `logger.info('[N8N Webhook] Triggering IR command schedule:', { scheduleId })`,
    replace: `logger.info('[N8N Webhook] Triggering IR command schedule:', { data: { scheduleId } })`
  },
  {
    file: 'src/app/api/n8n/webhook/route.ts',
    line: 313,
    find: `logger.info('[N8N Webhook] Sending IR command:', { command, deviceId: irDeviceId })`,
    replace: `logger.info('[N8N Webhook] Sending IR command:', { data: { command, deviceId: irDeviceId } })`
  },

  // rag/query/route.ts
  {
    file: 'src/app/api/rag/query/route.ts',
    line: 39,
    find: `logger.info('[RAG Query] Received query:', {
    query,`,
    replace: `logger.info('[RAG Query] Received query:', {
    data: { query },`
  },

  // rag/rebuild/route.ts - multiple
  {
    file: 'src/app/api/rag/rebuild/route.ts',
    line: 40,
    find: `logger.info('[RAG] Starting knowledge base rebuild...', { count: documentFiles.length })`,
    replace: `logger.info('[RAG] Starting knowledge base rebuild...', { data: { count: documentFiles.length } })`
  },
  {
    file: 'src/app/api/rag/rebuild/route.ts',
    line: 67,
    find: `        logger.info('[RAG] Processing document:', {
          file: filename,`,
    replace: `        logger.info('[RAG] Processing document:', {
          data: { file: filename },`
  },
  {
    file: 'src/app/api/rag/rebuild/route.ts',
    line: 80,
    find: `      logger.info('[RAG] Batch processed:', {
        batch: i / BATCH_SIZE + 1,`,
    replace: `      logger.info('[RAG] Batch processed:', {
        data: {
          batch: i / BATCH_SIZE + 1,`
  },
  {
    file: 'src/app/api/rag/rebuild/route.ts',
    line: 89,
    find: `    logger.info('[RAG] Knowledge base rebuilt successfully:', {
      documentsProcessed: processedDocs.length,`,
    replace: `    logger.info('[RAG] Knowledge base rebuilt successfully:', {
      data: {
        documentsProcessed: processedDocs.length,`
  },

  // selected-leagues/route.ts
  {
    file: 'src/app/api/selected-leagues/route.ts',
    line: 71,
    find: `logger.info('Selected leagues updated successfully', { leagueIds })`,
    replace: `logger.info('Selected leagues updated successfully', { data: { leagueIds } })`
  },

  // streaming/launch/route.ts
  {
    file: 'src/app/api/streaming/launch/route.ts',
    line: 62,
    find: `logger.warn('Failed to parse streaming launch request:', { parseError })`,
    replace: `logger.warn('Failed to parse streaming launch request:', { error: parseError })`
  },

  // streaming/subscribed-apps/route.ts
  {
    file: 'src/app/api/streaming/subscribed-apps/route.ts',
    line: 25,
    find: `logger.warn('Failed to parse subscribed apps response:', { parseError })`,
    replace: `logger.warn('Failed to parse subscribed apps response:', { error: parseError })`
  },
  {
    file: 'src/app/api/streaming/subscribed-apps/route.ts',
    line: 67,
    find: `logger.warn('Failed to parse subscribed apps put response:', { parseError })`,
    replace: `logger.warn('Failed to parse subscribed apps put response:', { error: parseError })`
  },

  // components/AudioZoneControl.tsx
  {
    file: 'src/components/AudioZoneControl.tsx',
    line: 147,
    find: `      logger.info('Fetching zone configuration:', {
        processor,`,
    replace: `      logger.info('Fetching zone configuration:', {
        data: { processor },`
  },

  // components/SportsGuide.tsx
  {
    file: 'src/components/SportsGuide.tsx',
    line: 105,
    find: `      logger.info('[Sports Guide] Events fetched:', {
        success: true,`,
    replace: `      logger.info('[Sports Guide] Events fetched:', {
        data: {
          success: true,`
  },
  {
    file: 'src/components/SportsGuide.tsx',
    line: 115,
    find: `logger.info('[Sports Guide] Sports available:', groupedByLeague.map(g => ({ title: g.title, listings: g.listings.length })))`,
    replace: `logger.info('[Sports Guide] Sports available:', { data: groupedByLeague.map(g => ({ title: g.title, listings: g.listings.length })) })`
  },
];

let appliedCount = 0;
let skippedCount = 0;

for (const fix of fixes) {
  const filePath = path.join(process.cwd(), fix.file);

  try {
    if (!fs.existsSync(filePath)) {
      console.log(`⚠️  File not found: ${fix.file}`);
      skippedCount++;
      continue;
    }

    const content = fs.readFileSync(filePath, 'utf-8');

    if (!content.includes(fix.find)) {
      console.log(`⚠️  Pattern not found in ${fix.file} (line ${fix.line})`);
      skippedCount++;
      continue;
    }

    const newContent = content.replace(fix.find, fix.replace);
    fs.writeFileSync(filePath, newContent, 'utf-8');

    console.log(`✓ Fixed ${fix.file}:${fix.line}`);
    appliedCount++;
  } catch (err) {
    console.error(`❌ Error fixing ${fix.file}:`, err);
    skippedCount++;
  }
}

console.log(`\n✨ Applied ${appliedCount} fixes, skipped ${skippedCount}`);
