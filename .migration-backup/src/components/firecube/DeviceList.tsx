
// Fire Cube Device List Component

import { DeviceCard } from './DeviceCard';
import { FireCubeDevice } from '@/lib/firecube/types';

import { logger } from '@/lib/logger'
interface DeviceListProps {
  devices: FireCubeDevice[];
  loading: boolean;
  onUpdate: () => void;
}

export function DeviceList({ devices, loading, onUpdate }: DeviceListProps) {
  const handleDelete = async (id: string) => {
    try {
      const response = await fetch(`/api/firecube/devices/${id}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        onUpdate();
      }
    } catch (error) {
      logger.error('Failed to delete device:', error);
    }
  };

  const handleTest = async (id: string) => {
    try {
      const response = await fetch(`/api/firecube/devices/${id}/test`, {
        method: 'POST'
      });

      if (response.ok) {
        onUpdate();
      }
    } catch (error) {
      logger.error('Failed to test device:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (devices.length === 0) {
    return (
      <div className="text-center py-12">
        <svg
          className="mx-auto h-12 w-12 text-gray-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
          />
        </svg>
        <h3 className="mt-2 text-sm font-medium text-gray-900">No Fire Cubes found</h3>
        <p className="mt-1 text-sm text-gray-500">
          Get started by discovering devices on your network or adding one manually.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {devices.map((device) => (
        <DeviceCard
          key={device.id}
          device={device}
          onUpdate={onUpdate}
          onDelete={handleDelete}
          onTest={handleTest}
        />
      ))}
    </div>
  );
}
