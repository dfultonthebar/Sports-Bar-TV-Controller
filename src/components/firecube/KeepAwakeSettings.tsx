
// Keep-Awake Settings Component

import { useState, useEffect } from 'react';

interface KeepAwakeSettingsProps {
  deviceId: string;
  deviceName: string;
  initialEnabled: boolean;
  initialStart: string;
  initialEnd: string;
  onUpdate: () => void;
}

export function KeepAwakeSettings({
  deviceId,
  deviceName,
  initialEnabled,
  initialStart,
  initialEnd,
  onUpdate
}: KeepAwakeSettingsProps) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [startTime, setStartTime] = useState(initialStart);
  const [endTime, setEndTime] = useState(initialEnd);
  const [saving, setSaving] = useState(false);
  const [logs, setLogs] = useState<any[]>([]);
  const [showLogs, setShowLogs] = useState(false);

  useEffect(() => {
    if (showLogs) {
      fetchLogs();
    }
  }, [showLogs]);

  const fetchLogs = async () => {
    try {
      const response = await fetch(`/api/firecube/devices/${deviceId}/keep-awake-logs`);
      const data = await response.json();
      setLogs(data.logs || []);
    } catch (error) {
      console.error('Failed to fetch logs:', error);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const response = await fetch(`/api/firecube/devices/${deviceId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keepAwakeEnabled: enabled,
          keepAwakeStart: startTime,
          keepAwakeEnd: endTime
        })
      });

      if (response.ok) {
        onUpdate();
      }
    } catch (error) {
      console.error('Failed to update keep-awake settings:', error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <h4 className="font-semibold text-gray-900 mb-4">
        Keep-Awake Schedule - {deviceName}
      </h4>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-gray-700">
            Enable Keep-Awake
          </label>
          <button
            onClick={() => setEnabled(!enabled)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              enabled ? 'bg-blue-600' : 'bg-gray-200'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                enabled ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        {enabled && (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Start Time
                </label>
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  End Time
                </label>
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
              <p className="text-xs text-blue-800">
                Device will be kept awake from {startTime} to {endTime} daily.
                This prevents the screen from turning off during business hours.
              </p>
            </div>
          </>
        )}

        <div className="flex gap-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
          <button
            onClick={() => setShowLogs(!showLogs)}
            className="px-4 py-2 bg-gray-200 text-gray-700 text-sm font-medium rounded hover:bg-gray-300"
          >
            {showLogs ? 'Hide Logs' : 'View Logs'}
          </button>
        </div>

        {showLogs && (
          <div className="mt-4 border-t border-gray-200 pt-4">
            <h5 className="text-sm font-medium text-gray-900 mb-2">Recent Activity</h5>
            {logs.length === 0 ? (
              <p className="text-sm text-gray-500">No activity logs yet</p>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {logs.map((log) => (
                  <div
                    key={log.id}
                    className="flex items-center justify-between text-xs p-2 bg-gray-50 rounded"
                  >
                    <div>
                      <span className="font-medium">{log.action.replace('_', ' ')}</span>
                      {log.errorMessage && (
                        <span className="text-red-600 ml-2">- {log.errorMessage}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-1 rounded ${
                        log.success ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {log.success ? 'Success' : 'Failed'}
                      </span>
                      <span className="text-gray-500">
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
