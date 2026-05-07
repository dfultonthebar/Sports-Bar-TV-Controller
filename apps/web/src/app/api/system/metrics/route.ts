import { NextRequest, NextResponse } from 'next/server';
import { execFile } from 'child_process';
import { promisify } from 'util';
import os from 'os';
import fs from 'fs/promises';
import { logger } from '@sports-bar/logger';
import { withRateLimit } from '@/lib/rate-limiting/middleware';
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter';

const execFileAsync = promisify(execFile);

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
    const { stdout } = await execFileAsync('df', ['-B1', '/']);
    // Parse the output, skip header line
    const lines = stdout.trim().split('\n');
    const dataLine = lines[lines.length - 1]; // Get last line (data row)
    const parts = dataLine.trim().split(/\s+/);

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
 * Get GPU metrics. Tries NVIDIA first (nvidia-smi), falls back to Intel iGPU
 * (intel_gpu_top, JSON snapshot). At v2.32.59+ the fleet runs Intel Iris Xe
 * for Ollama acceleration; the System Resources widget then surfaces real
 * iGPU load.
 *
 * intel_gpu_top requires CAP_PERFMON to run as a non-root user — granted by
 * scripts/setup-iris-ollama.sh via `setcap cap_perfmon=ep`. If the binary
 * lacks the capability we fall through and the widget shows "No GPU".
 *
 * Memory accounting on Intel: the iGPU shares system RAM. "used" comes from
 * the loaded Ollama model footprint via /api/ps (the only iGPU consumer at
 * a sports-bar deployment). "total" defaults to 16 GB when nothing's loaded
 * — the widget's percentage reads sensibly without misleading the operator.
 */
async function getGPUMetrics(): Promise<SystemMetrics['gpu']> {
  // 1. NVIDIA path (cheap to attempt; throws fast if missing)
  try {
    const { stdout } = await execFileAsync('nvidia-smi', [
      '--query-gpu=utilization.gpu,memory.total,memory.used,temperature.gpu',
      '--format=csv,noheader,nounits',
    ])
    const parts = stdout.trim().split(',').map(s => s.trim())
    const usage = parseInt(parts[0])
    const memoryTotal = parseInt(parts[1]) * 1024 * 1024
    const memoryUsed = parseInt(parts[2]) * 1024 * 1024
    const temperature = parseInt(parts[3])
    return {
      usage,
      memory: { total: memoryTotal, used: memoryUsed, usage: Math.floor((memoryUsed / memoryTotal) * 100) },
      temperature,
    }
  } catch {
    // not nvidia — fall through to Intel iGPU
  }

  // 2. Intel iGPU path. intel_gpu_top emits a streaming JSON array; we run
  // with a 500ms sample interval and a 1500ms timeout, then parse the first
  // complete object from whatever was emitted before the kill.
  let stdout = ''
  try {
    const result = await execFileAsync('intel_gpu_top', ['-J', '-s', '500'], { timeout: 1500 })
    stdout = result.stdout
  } catch (err) {
    // execFile times out as designed — its stdout buffer is still populated.
    if (err && typeof err === 'object' && 'stdout' in err) {
      stdout = String((err as { stdout?: string }).stdout || '')
    }
  }

  const match = stdout.match(/\{[\s\S]*?\n\}/)
  if (!match) {
    throw new Error('GPU metrics not available')
  }

  let snap: { engines?: Record<string, { busy?: number }> }
  try {
    snap = JSON.parse(match[0])
  } catch {
    throw new Error('GPU metrics not available')
  }

  const renderBusy = snap.engines?.['Render/3D']?.busy ?? 0
  const usage = Math.max(0, Math.min(100, Math.round(renderBusy)))

  // Ollama footprint via /api/ps (loaded model size). 800ms timeout — if
  // Ollama is unreachable, used=0 and the widget shows the iGPU as idle.
  let memoryUsed = 0
  try {
    const r = await fetch('http://localhost:11434/api/ps', {
      signal: AbortSignal.timeout(800),
    })
    if (r.ok) {
      const ps = await r.json() as { models?: Array<{ size?: number; size_vram?: number }> }
      memoryUsed = (ps.models ?? []).reduce(
        (sum, m) => sum + (m.size_vram ?? m.size ?? 0),
        0,
      )
    }
  } catch {
    // Ollama unreachable; leave used=0
  }

  // For "total" use a fixed 16 GB ceiling — Intel iGPU shared memory caps
  // are highly variable and reading the real value requires elevated perms.
  // The widget's percentage stays sensible (4 GB model = 25% used).
  const memoryTotal = 16 * 1024 * 1024 * 1024

  return {
    usage,
    memory: {
      total: memoryTotal,
      used: memoryUsed,
      usage: Math.floor((memoryUsed / memoryTotal) * 100),
    },
    // No reliable °C for Intel iGPU package without sudo — leave undefined
  }
}
