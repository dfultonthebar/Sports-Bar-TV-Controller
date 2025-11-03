
// Sideload Manager Component

import { useState, useEffect } from 'react';

import { logger } from '@/lib/logger'
interface SideloadManagerProps {
  devices: any[];
  onUpdate: () => void;
}

export function SideloadManager({ devices, onUpdate }: SideloadManagerProps) {
  const [sourceDevice, setSourceDevice] = useState('');
  const [targetDevices, setTargetDevices] = useState<string[]>([]);
  const [selectedApp, setSelectedApp] = useState('');
  const [apps, setApps] = useState<any[]>([]);
  const [operations, setOperations] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (sourceDevice) {
      fetchApps();
    }
  }, [sourceDevice]);

  useEffect(() => {
    fetchOperations();
    const interval = setInterval(fetchOperations, 5000); // Poll every 5 seconds
    return () => clearInterval(interval);
  }, []);

  const fetchApps = async () => {
    try {
      const response = await fetch(`/api/firecube/devices/${sourceDevice}/apps`);
      const data = await response.json();
      setApps(data.apps || []);
    } catch (error) {
      logger.error('Failed to fetch apps:', error);
    }
  };

  const fetchOperations = async () => {
    try {
      const response = await fetch('/api/firecube/sideload');
      const data = await response.json();
      setOperations(data.operations || []);
    } catch (error) {
      logger.error('Failed to fetch operations:', error);
    }
  };

  const handleSideload = async () => {
    if (!sourceDevice || !selectedApp || targetDevices.length === 0) {
      alert('Please select source device, app, and at least one target device');
      return;
    }

    try {
      setLoading(true);
      const response = await fetch('/api/firecube/sideload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceDeviceId: sourceDevice,
          targetDeviceIds: targetDevices,
          packageName: selectedApp,
          action: 'sideload'
        })
      });

      if (response.ok) {
        alert('Sideload operation started');
        setTargetDevices([]);
        setSelectedApp('');
        fetchOperations();
      }
    } catch (error) {
      logger.error('Failed to start sideload:', error);
      alert('Failed to start sideload operation');
    } finally {
      setLoading(false);
    }
  };

  const handleSyncAll = async () => {
    if (!sourceDevice || !selectedApp) {
      alert('Please select source device and app');
      return;
    }

    if (!confirm('This will install the app on all other Fire Cubes. Continue?')) {
      return;
    }

    try {
      setLoading(true);
      const response = await fetch('/api/firecube/sideload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceDeviceId: sourceDevice,
          packageName: selectedApp,
          action: 'sync_all'
        })
      });

      if (response.ok) {
        alert('Sync operation started');
        setSelectedApp('');
        fetchOperations();
      }
    } catch (error) {
      logger.error('Failed to start sync:', error);
      alert('Failed to start sync operation');
    } finally {
      setLoading(false);
    }
  };

  const toggleTargetDevice = (deviceId: string) => {
    setTargetDevices(prev =>
      prev.includes(deviceId)
        ? prev.filter(id => id !== deviceId)
        : [...prev, deviceId]
    );
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'in_progress': return 'bg-blue-100 text-blue-800';
      case 'failed': return 'bg-red-100 text-red-800';
      case 'partial': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      {/* Sideload Form */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Sideload App</h3>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Source Device
            </label>
            <select
              value={sourceDevice}
              onChange={(e) => setSourceDevice(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
            >
              <option value="">Select source device...</option>
              {devices.map((device) => (
                <option key={device.id} value={device.id}>
                  {device.name} ({device.ipAddress})
                </option>
              ))}
            </select>
          </div>

          {sourceDevice && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Select App
              </label>
              <select
                value={selectedApp}
                onChange={(e) => setSelectedApp(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
              >
                <option value="">Select app...</option>
                {apps.filter(app => !app.isSystemApp).map((app) => (
                  <option key={app.packageName} value={app.packageName}>
                    {app.appName} ({app.version || 'unknown version'})
                  </option>
                ))}
              </select>
            </div>
          )}

          {sourceDevice && selectedApp && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Target Devices
              </label>
              <div className="space-y-2 max-h-48 overflow-y-auto border border-gray-200 rounded-md p-3">
                {devices
                  .filter(d => d.id !== sourceDevice)
                  .map((device) => (
                    <label key={device.id} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={targetDevices.includes(device.id)}
                        onChange={() => toggleTargetDevice(device.id)}
                        className="rounded border-gray-300"
                      />
                      <span className="text-sm text-gray-900">
                        {device.name} ({device.ipAddress})
                      </span>
                    </label>
                  ))}
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={handleSideload}
              disabled={loading || !sourceDevice || !selectedApp || targetDevices.length === 0}
              className="flex-1 px-4 py-2 bg-blue-600 text-white font-medium rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Starting...' : 'Sideload to Selected'}
            </button>
            <button
              onClick={handleSyncAll}
              disabled={loading || !sourceDevice || !selectedApp}
              className="flex-1 px-4 py-2 bg-green-600 text-white font-medium rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Sync to All Devices
            </button>
          </div>
        </div>
      </div>

      {/* Operations List */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Operations</h3>

        {operations.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-4">No sideload operations yet</p>
        ) : (
          <div className="space-y-3">
            {operations.slice(0, 10).map((op) => (
              <div key={op.id} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h4 className="font-medium text-gray-900">{op.appName}</h4>
                    <p className="text-sm text-gray-600">
                      {op.completedDevices} of {op.totalDevices} devices completed
                      {op.failedDevices > 0 && ` (${op.failedDevices} failed)`}
                    </p>
                  </div>
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(op.status)}`}>
                    {op.status}
                  </span>
                </div>

                {op.status === 'in_progress' && (
                  <div className="mt-2">
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${op.progress}%` }}
                      ></div>
                    </div>
                    <p className="text-xs text-gray-600 mt-1">{op.progress}% complete</p>
                  </div>
                )}

                <p className="text-xs text-gray-500 mt-2">
                  Started: {new Date(op.startedAt).toLocaleString()}
                  {op.completedAt && ` • Completed: ${new Date(op.completedAt).toLocaleString()}`}
                </p>

                {op.errorLog && op.errorLog.length > 0 && (
                  <details className="mt-2">
                    <summary className="text-xs text-red-600 cursor-pointer">View Errors</summary>
                    <div className="mt-1 text-xs text-red-600 bg-red-50 p-2 rounded">
                      {op.errorLog.map((error: string, i: number) => (
                        <div key={i}>• {error}</div>
                      ))}
                    </div>
                  </details>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
