
// Fire Cube Device Card Component

import { useState } from 'react';
import { FireCubeDevice } from '@/lib/firecube/types';

import { logger } from '@/lib/logger'
interface DeviceCardProps {
  device: FireCubeDevice;
  onUpdate: () => void;
  onDelete: (id: string) => void;
  onTest: (id: string) => void;
}

export function DeviceCard({ device, onUpdate, onDelete, onTest }: DeviceCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [name, setName] = useState(device.name);
  const [location, setLocation] = useState(device.location || '');

  const handleSave = async () => {
    try {
      const response = await fetch(`/api/firecube/devices/${device.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, location })
      });

      if (response.ok) {
        setIsEditing(false);
        onUpdate();
      }
    } catch (error) {
      logger.error('Failed to update device:', error);
    }
  };

  const handleTest = async () => {
    setIsTesting(true);
    try {
      await onTest(device.id);
    } finally {
      setIsTesting(false);
    }
  };

  const handleDelete = async () => {
    if (confirm(`Are you sure you want to remove ${device.name}?`)) {
      onDelete(device.id);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online': return 'bg-green-100 text-green-800';
      case 'offline': return 'bg-gray-100 text-gray-800';
      case 'error': return 'bg-red-100 text-red-800';
      default: return 'bg-yellow-100 text-yellow-800';
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          {isEditing ? (
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="text-lg font-semibold border border-gray-300 rounded px-2 py-1 w-full"
            />
          ) : (
            <h3 className="text-lg font-semibold text-gray-900">{device.name}</h3>
          )}
          <p className="text-sm text-gray-500 mt-1">{device.deviceModel || 'Fire TV Device'}</p>
        </div>
        <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(device.status)}`}>
          {device.status}
        </span>
      </div>

      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-600">IP Address:</span>
          <span className="font-mono text-gray-900">{device.ipAddress}:{device.port}</span>
        </div>
        
        {device.serialNumber && (
          <div className="flex justify-between">
            <span className="text-gray-600">Serial:</span>
            <span className="font-mono text-gray-900">{device.serialNumber}</span>
          </div>
        )}

        {device.softwareVersion && (
          <div className="flex justify-between">
            <span className="text-gray-600">Software:</span>
            <span className="text-gray-900">{device.softwareVersion}</span>
          </div>
        )}

        <div className="flex justify-between">
          <span className="text-gray-600">Location:</span>
          {isEditing ? (
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="border border-gray-300 rounded px-2 py-1 text-sm"
              placeholder="e.g., Main Bar"
            />
          ) : (
            <span className="text-gray-900">{device.location || 'Not set'}</span>
          )}
        </div>

        {device.matrixInputChannel && (
          <div className="flex justify-between">
            <span className="text-gray-600">Matrix Input:</span>
            <span className="text-gray-900">Channel {device.matrixInputChannel}</span>
          </div>
        )}

        <div className="flex justify-between">
          <span className="text-gray-600">Keep Awake:</span>
          <span className="text-gray-900">
            {device.keepAwakeEnabled ? `${device.keepAwakeStart} - ${device.keepAwakeEnd}` : 'Disabled'}
          </span>
        </div>

        {device.lastSeen && (
          <div className="flex justify-between">
            <span className="text-gray-600">Last Seen:</span>
            <span className="text-gray-900">{new Date(device.lastSeen).toLocaleString()}</span>
          </div>
        )}
      </div>

      <div className="mt-4 flex gap-2">
        {isEditing ? (
          <>
            <button
              onClick={handleSave}
              className="flex-1 px-3 py-2 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-700"
            >
              Save
            </button>
            <button
              onClick={() => setIsEditing(false)}
              className="flex-1 px-3 py-2 bg-gray-200 text-gray-700 text-sm font-medium rounded hover:bg-gray-300"
            >
              Cancel
            </button>
          </>
        ) : (
          <>
            <button
              onClick={handleTest}
              disabled={isTesting}
              className="flex-1 px-3 py-2 bg-green-600 text-white text-sm font-medium rounded hover:bg-green-700 disabled:opacity-50"
            >
              {isTesting ? 'Testing...' : 'Test'}
            </button>
            <button
              onClick={() => setIsEditing(true)}
              className="flex-1 px-3 py-2 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-700"
            >
              Edit
            </button>
            <button
              onClick={handleDelete}
              className="px-3 py-2 bg-red-600 text-white text-sm font-medium rounded hover:bg-red-700"
            >
              Remove
            </button>
          </>
        )}
      </div>
    </div>
  );
}
