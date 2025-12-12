'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface SystemMetrics {
  cpu: {
    usage: number;
    cores: number;
    model: string;
    speed: number;
  };
  memory: {
    total: number;
    used: number;
    free: number;
    usage: number;
  };
  disk: {
    total: number;
    used: number;
    free: number;
    usage: number;
  };
  gpu?: {
    usage: number;
    memory: {
      total: number;
      used: number;
      usage: number;
    };
    temperature?: number;
  };
  uptime: number;
  timestamp: string;
}

interface ResourceGaugeProps {
  label: string;
  value: number;
  max?: number;
  unit?: string;
  subtitle?: string;
  warning?: number;
  critical?: number;
}

function ResourceGauge({ label, value, max = 100, unit = '%', subtitle, warning = 75, critical = 90 }: ResourceGaugeProps) {
  const percentage = max > 0 ? (value / max) * 100 : 0;

  // Determine color based on usage
  let color = 'text-green-500';
  let strokeColor = '#10b981'; // green-500

  if (percentage >= critical) {
    color = 'text-red-500';
    strokeColor = '#ef4444'; // red-500
  } else if (percentage >= warning) {
    color = 'text-yellow-500';
    strokeColor = '#eab308'; // yellow-500
  }

  // SVG circle parameters
  const size = 120;
  const strokeWidth = 12;
  const center = size / 2;
  const radius = center - strokeWidth / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;

  return (
    <div className="flex flex-col items-center space-y-2">
      <div className="relative" style={{ width: size, height: size }}>
        {/* Background circle */}
        <svg width={size} height={size} className="transform -rotate-90">
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke="#1e293b"
            strokeWidth={strokeWidth}
          />
          {/* Progress circle */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            className="transition-all duration-500 ease-out"
          />
        </svg>
        {/* Center text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`text-2xl font-bold ${color}`}>
            {Math.round(percentage)}
          </span>
          <span className="text-xs text-slate-400">{unit}</span>
        </div>
      </div>
      <div className="text-center">
        <div className="text-sm font-medium text-slate-200">{label}</div>
        {subtitle && (
          <div className="text-xs text-slate-400">{subtitle}</div>
        )}
      </div>
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (days > 0) {
    return `${days}d ${hours}h ${minutes}m`;
  } else if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else {
    return `${minutes}m`;
  }
}

export function SystemResourceMonitor() {
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMetrics = async () => {
    try {
      const response = await fetch('/api/system/metrics');
      const data = await response.json();

      if (data.success) {
        setMetrics(data.metrics);
        setError(null);
      } else {
        setError(data.error || 'Failed to fetch metrics');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();

    // Refresh every 3 seconds
    const interval = setInterval(fetchMetrics, 3000);

    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <Card className="bg-sportsBar-800/50 border-sportsBar-700">
        <CardHeader>
          <CardTitle className="text-slate-100">System Resources</CardTitle>
          <CardDescription className="text-slate-300">Loading system metrics...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="bg-sportsBar-800/50 border-sportsBar-700">
        <CardHeader>
          <CardTitle className="text-slate-100">System Resources</CardTitle>
          <CardDescription className="text-red-400">Error: {error}</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (!metrics) {
    return null;
  }

  return (
    <Card className="bg-sportsBar-800/50 border-sportsBar-700 [&>*]:!bg-transparent">
      <CardHeader className="bg-transparent">
        <CardTitle className="text-slate-100">System Resources</CardTitle>
        <CardDescription className="text-slate-300">
          Real-time system resource monitoring • Uptime: {formatUptime(metrics.uptime)}
        </CardDescription>
      </CardHeader>
      <CardContent className="bg-transparent">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {/* CPU Gauge */}
          <ResourceGauge
            label="CPU Usage"
            value={metrics.cpu.usage}
            subtitle={`${metrics.cpu.cores} cores @ ${(metrics.cpu.speed / 1000).toFixed(1)} GHz`}
          />

          {/* Memory Gauge */}
          <ResourceGauge
            label="Memory"
            value={metrics.memory.usage}
            subtitle={`${formatBytes(metrics.memory.used)} / ${formatBytes(metrics.memory.total)}`}
          />

          {/* Disk Gauge */}
          <ResourceGauge
            label="Disk Usage"
            value={metrics.disk.usage}
            subtitle={`${formatBytes(metrics.disk.used)} / ${formatBytes(metrics.disk.total)}`}
            warning={80}
            critical={95}
          />

          {/* GPU Gauge (if available) */}
          {metrics.gpu ? (
            <ResourceGauge
              label="GPU Usage"
              value={metrics.gpu.usage}
              subtitle={`${formatBytes(metrics.gpu.memory.used)} VRAM${metrics.gpu.temperature ? ` • ${metrics.gpu.temperature}°C` : ''}`}
            />
          ) : (
            <div className="flex flex-col items-center justify-center space-y-2 opacity-50">
              <div className="w-[120px] h-[120px] rounded-full border-2 border-dashed border-slate-600 flex items-center justify-center">
                <span className="text-slate-500 text-sm">No GPU</span>
              </div>
              <div className="text-center">
                <div className="text-sm font-medium text-slate-400">GPU</div>
                <div className="text-xs text-slate-500">Not detected</div>
              </div>
            </div>
          )}
        </div>

        {/* System Info */}
        <div className="mt-6 pt-6 border-t border-slate-700">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-slate-400">CPU Model:</span>
              <span className="ml-2 text-slate-200">{metrics.cpu.model}</span>
            </div>
            <div>
              <span className="text-slate-400">Memory Free:</span>
              <span className="ml-2 text-slate-200">{formatBytes(metrics.memory.free)}</span>
            </div>
            <div>
              <span className="text-slate-400">Disk Free:</span>
              <span className="ml-2 text-slate-200">{formatBytes(metrics.disk.free)}</span>
            </div>
          </div>
        </div>

        {/* Last Updated */}
        <div className="mt-4 text-xs text-slate-500 text-right">
          Last updated: {new Date(metrics.timestamp).toLocaleTimeString()}
        </div>
      </CardContent>
    </Card>
  );
}
