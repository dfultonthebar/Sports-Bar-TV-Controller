import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import os from 'os';
import fs from 'fs/promises';
import { logger } from '@/lib/logger';
import { withRateLimit } from '@/lib/rate-limiting/middleware';
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter';

const execAsync = promisify(exec);

interface SystemMetrics {
  cpu: {
    usage: number; // 0-100
    cores: number;
    model: string;
    speed: number; // MHz
  };
  memory: {
    total: number; // bytes
    used: number; // bytes
    free: number; // bytes
    usage: number; // 0-100
  };
  disk: {
    total: number; // bytes
    used: number; // bytes
    free: number; // bytes
    usage: number; // 0-100
  };
  gpu?: {
    usage: number; // 0-100
    memory: {
      total: number;
      used: number;
      usage: number;
    };
    temperature?: number;
  };
  uptime: number; // seconds
  timestamp: string;
}

// GET - Get system resource metrics
export async function GET(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.DEFAULT);
  if (!rateLimit.allowed) return rateLimit.response;

  logger.api.request('GET', '/api/system/metrics');

  try {
    const metrics: SystemMetrics = {
      cpu: await getCPUMetrics(),
      memory: getMemoryMetrics(),
      disk: await getDiskMetrics(),
      uptime: os.uptime(),
      timestamp: new Date().toISOString(),
    };

    // Try to get GPU metrics (optional)
    try {
      metrics.gpu = await getGPUMetrics();
    } catch (error) {
      // GPU metrics not available (no GPU or nvidia-smi not installed)
      logger.debug('[SYSTEM METRICS] GPU metrics not available');
    }

    logger.api.response('GET', '/api/system/metrics', 200);
    return NextResponse.json({
      success: true,
      metrics,
    });
  } catch (error: any) {
    logger.api.error('GET', '/api/system/metrics', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch system metrics', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * Get CPU metrics
 */
async function getCPUMetrics(): Promise<SystemMetrics['cpu']> {
  const cpus = os.cpus();
  const model = cpus[0]?.model || 'Unknown';
  const speed = cpus[0]?.speed || 0;
  const cores = cpus.length;

  // Calculate CPU usage by measuring idle time over a short period
  const startMeasure = getCPUTimes();
  await new Promise(resolve => setTimeout(resolve, 100));
  const endMeasure = getCPUTimes();

  const idleDiff = endMeasure.idle - startMeasure.idle;
  const totalDiff = endMeasure.total - startMeasure.total;
  const usage = 100 - Math.floor((100 * idleDiff) / totalDiff);

  return {
    usage: Math.max(0, Math.min(100, usage)),
    cores,
    model,
    speed,
  };
}

/**
 * Helper to get CPU times
 */
function getCPUTimes() {
  const cpus = os.cpus();
  let idle = 0;
  let total = 0;

  cpus.forEach(cpu => {
    for (const type in cpu.times) {
      total += cpu.times[type as keyof typeof cpu.times];
    }
    idle += cpu.times.idle;
  });

  return { idle, total };
}

/**
 * Get memory metrics
 */
function getMemoryMetrics(): SystemMetrics['memory'] {
  const total = os.totalmem();
  const free = os.freemem();
  const used = total - free;
  const usage = Math.floor((used / total) * 100);

  return {
    total,
    used,
    free,
    usage,
  };
}

/**
 * Get disk metrics
 */
async function getDiskMetrics(): Promise<SystemMetrics['disk']> {
  try {
    // Use df command to get disk usage for root filesystem
    const { stdout } = await execAsync('df -B1 / | tail -1');
    const parts = stdout.trim().split(/\s+/);

    const total = parseInt(parts[1]);
    const used = parseInt(parts[2]);
    const free = parseInt(parts[3]);
    const usage = Math.floor((used / total) * 100);

    return {
      total,
      used,
      free,
      usage,
    };
  } catch (error) {
    logger.error('[SYSTEM METRICS] Error getting disk metrics:', error);
    return {
      total: 0,
      used: 0,
      free: 0,
      usage: 0,
    };
  }
}

/**
 * Get GPU metrics (NVIDIA only via nvidia-smi)
 */
async function getGPUMetrics(): Promise<SystemMetrics['gpu']> {
  try {
    const { stdout } = await execAsync(
      'nvidia-smi --query-gpu=utilization.gpu,memory.total,memory.used,temperature.gpu --format=csv,noheader,nounits'
    );

    const parts = stdout.trim().split(',').map(s => s.trim());
    const usage = parseInt(parts[0]);
    const memoryTotal = parseInt(parts[1]) * 1024 * 1024; // MB to bytes
    const memoryUsed = parseInt(parts[2]) * 1024 * 1024;
    const temperature = parseInt(parts[3]);

    return {
      usage,
      memory: {
        total: memoryTotal,
        used: memoryUsed,
        usage: Math.floor((memoryUsed / memoryTotal) * 100),
      },
      temperature,
    };
  } catch (error) {
    throw new Error('GPU metrics not available');
  }
}
