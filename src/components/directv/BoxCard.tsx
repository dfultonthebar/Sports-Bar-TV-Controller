
// DirecTV Box Card Component

import { useState } from 'react';

interface BoxCardProps {
  box: any;
  onUpdate: () => void;
}

export function BoxCard({ box, onUpdate }: BoxCardProps) {
  const [testing, setTesting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [location, setLocation] = useState(box.location || '');

  const testConnection = async () => {
    setTesting(true);
    try {
      const response = await fetch(`/api/directv/boxes/${box.id}/test`, {
        method: 'POST',
      });
      const data = await response.json();
      
      if (data.connected) {
        alert(`✓ Connected to ${box.model || 'DirecTV box'}\nSHEF Version: ${data.version}`);
      } else {
        alert(`✗ Connection failed: ${data.message || 'Box is offline'}`);
      }
      
      onUpdate();
    } catch (error: any) {
      alert(`Error: ${error.message}`);
    } finally {
      setTesting(false);
    }
  };

  const updateLocation = async () => {
    try {
      const response = await fetch(`/api/directv/boxes/${box.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ location }),
      });

      if (response.ok) {
        setEditing(false);
        onUpdate();
      }
    } catch (error: any) {
      alert(`Error: ${error.message}`);
    }
  };

  const deleteBox = async () => {
    if (!confirm(`Are you sure you want to remove ${box.model || 'this box'}?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/directv/boxes/${box.id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        onUpdate();
      }
    } catch (error: any) {
      alert(`Error: ${error.message}`);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online':
        return 'bg-green-100 text-green-800';
      case 'offline':
        return 'bg-red-100 text-red-800';
      case 'discovered':
        return 'bg-yellow-100 text-yellow-800';
      case 'error':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="font-semibold text-gray-900">
              {box.model || 'Unknown Model'}
            </h4>
            {box.isServer && (
              <span className="px-2 py-0.5 text-xs bg-blue-100 text-blue-800 rounded">
                Server
              </span>
            )}
            {box.isClient && (
              <span className="px-2 py-0.5 text-xs bg-purple-100 text-purple-800 rounded">
                Client
              </span>
            )}
          </div>
          <span className={`inline-block px-2 py-0.5 text-xs rounded ${getStatusColor(box.status)}`}>
            {box.status}
          </span>
        </div>
      </div>

      <div className="space-y-2 text-sm text-gray-600 mb-4">
        <div className="flex items-center gap-2">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
          </svg>
          <span className="font-mono">{box.ipAddress}</span>
        </div>

        {editing ? (
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Location (e.g., Main Bar)"
              className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded"
            />
            <button
              onClick={updateLocation}
              className="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700"
            >
              Save
            </button>
            <button
              onClick={() => setEditing(false)}
              className="px-2 py-1 text-xs bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
            >
              Cancel
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span>{box.location || 'No location set'}</span>
            <button
              onClick={() => setEditing(true)}
              className="ml-auto text-blue-600 hover:text-blue-800"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            </button>
          </div>
        )}

        {box.shefVersion && (
          <div className="text-xs text-gray-500">
            SHEF v{box.shefVersion}
          </div>
        )}

        {!box.shefEnabled && (
          <div className="text-xs text-red-600 font-medium">
            ⚠ SHEF not enabled
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <button
          onClick={testConnection}
          disabled={testing}
          className="flex-1 px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400"
        >
          {testing ? 'Testing...' : 'Test'}
        </button>
        <button
          onClick={deleteBox}
          className="px-3 py-1.5 text-sm bg-red-600 text-white rounded hover:bg-red-700"
        >
          Remove
        </button>
      </div>
    </div>
  );
}
