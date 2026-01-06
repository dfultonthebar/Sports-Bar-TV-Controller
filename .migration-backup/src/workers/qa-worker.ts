#!/usr/bin/env tsx
/**
 * Q&A Generation Background Worker
 *
 * This worker runs independently of the Next.js server and processes
 * Q&A generation jobs from the database queue.
 */

// Load environment variables first
import dotenv from 'dotenv';
dotenv.config();

import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { schema } from '@/db';
import { processQAGenerationJob } from '@/lib/services/qa-generator-processor';

const POLL_INTERVAL = 5000; // Check for new jobs every 5 seconds

async function processNextJob(): Promise<boolean> {
  try {
    // Find the oldest pending job
    const pendingJobs = await db
      .select()
      .from(schema.qaGenerationJobs)
      .where(eq(schema.qaGenerationJobs.status, 'pending'))
      .orderBy(schema.qaGenerationJobs.createdAt)
      .limit(1)
      .execute();

    if (!pendingJobs || pendingJobs.length === 0) {
      return false; // No jobs to process
    }

    const job = pendingJobs[0];
    console.log(`[QA Worker] 📦 Processing job ${job.id}`);

    // Process the job
    const options = {
      sourceType: job.sourceType as 'repository' | 'documentation' | 'codebase',
      sourcePaths: job.sourcePath ? job.sourcePath.split(',') : undefined,
    };

    await processQAGenerationJob(job.id, options);

    console.log(`[QA Worker] ✓ Job ${job.id} completed successfully`);
    return true;
  } catch (error) {
    console.error('[QA Worker] ✗ Error processing job:', error);
    return false;
  }
}

async function workerLoop() {
  console.log('[QA Worker] 🚀 Starting Q&A Generation Worker');
  console.log(`[QA Worker] Database: ${process.env.DATABASE_URL}`);
  console.log(`[QA Worker] Polling interval: ${POLL_INTERVAL}ms`);
  console.log('[QA Worker] Waiting for pending jobs...\n');

  while (true) {
    try {
      const processed = await processNextJob();

      if (!processed) {
        // No jobs found, wait before checking again
        await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL));
      }
      // If a job was processed, immediately check for the next one
    } catch (error) {
      console.error('[QA Worker] Worker loop error:', error);
      // Wait a bit before retrying after an error
      await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL * 2));
    }
  }
}

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('\n[QA Worker] Received SIGTERM, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('\n[QA Worker] Received SIGINT, shutting down gracefully...');
  process.exit(0);
});

// Start the worker
workerLoop().catch(error => {
  console.error('[QA Worker] Fatal error:', error);
  process.exit(1);
});
