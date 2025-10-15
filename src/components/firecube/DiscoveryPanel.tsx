
// Fire Cube Discovery Panel Component

import { useState } from 'react';

interface DiscoveryPanelProps {
  onDiscoveryComplete: () => void;
}

export function DiscoveryPanel({ onDiscoveryComplete }: DiscoveryPanelProps) {
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [discoveryMethod, setDiscoveryMethod] = useState<'adb' | 'network_scan' | 'both'>('both');
  const [showManualAdd, setShowManualAdd] = useState(false);
  const [manualIp, setManualIp] = useState('');
  const [manualName, setManualName] = useState('');
  const [manualLocation, setManualLocation] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleDiscover = async () => {
    setIsDiscovering(true);
    setError(null);

    try {
      const response = await fetch('/api/firetv-devices/discover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ method: discoveryMethod })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Discovery failed');
      }

      onDiscoveryComplete();
    } catch (error: any) {
      setError(error.message || 'An error occurred during discovery');
    } finally {
      setIsDiscovering(false);
    }
  };

  const handleManualAdd = async () => {
    if (!manualIp) {
      setError('IP address is required');
      return;
    }

    setIsDiscovering(true);
    setError(null);

    try {
      const response = await fetch('/api/firetv-devices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ipAddress: manualIp,
          name: manualName || `Fire TV ${manualIp}`,
          location: manualLocation
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to add device');
      }

      setShowManualAdd(false);
      setManualIp('');
      setManualName('');
      setManualLocation('');
      onDiscoveryComplete();
    } catch (error: any) {
      setError(error.message || 'An error occurred while adding the device');
    } finally {
      setIsDiscovering(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Device Discovery</h2>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {!showManualAdd ? (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Discovery Method
            </label>
            <select
              value={discoveryMethod}
              onChange={(e) => setDiscoveryMethod(e.target.value as any)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
              disabled={isDiscovering}
            >
              <option value="both">ADB + Network Scan (Recommended)</option>
              <option value="adb">ADB Only (Faster)</option>
              <option value="network_scan">Network Scan Only</option>
            </select>
            <p className="mt-1 text-xs text-gray-500">
              ADB discovery is faster but requires devices to be already connected. Network scan is slower but more thorough.
            </p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleDiscover}
              disabled={isDiscovering}
              className="flex-1 px-4 py-2 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isDiscovering ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Discovering...
                </span>
              ) : (
                'Auto Discover'
              )}
            </button>
            <button
              onClick={() => setShowManualAdd(true)}
              disabled={isDiscovering}
              className="px-4 py-2 bg-gray-200 text-gray-700 font-medium rounded-md hover:bg-gray-300 disabled:opacity-50"
            >
              Add Manually
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              IP Address *
            </label>
            <input
              type="text"
              value={manualIp}
              onChange={(e) => setManualIp(e.target.value)}
              placeholder="192.168.1.100"
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Device Name (Optional)
            </label>
            <input
              type="text"
              value={manualName}
              onChange={(e) => setManualName(e.target.value)}
              placeholder="e.g., Main Bar Fire Cube"
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Location (Optional)
            </label>
            <input
              type="text"
              value={manualLocation}
              onChange={(e) => setManualLocation(e.target.value)}
              placeholder="e.g., Main Bar"
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleManualAdd}
              disabled={isDiscovering}
              className="flex-1 px-4 py-2 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {isDiscovering ? 'Adding...' : 'Add Device'}
            </button>
            <button
              onClick={() => {
                setShowManualAdd(false);
                setError(null);
              }}
              disabled={isDiscovering}
              className="px-4 py-2 bg-gray-200 text-gray-700 font-medium rounded-md hover:bg-gray-300 disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
        <p className="text-xs text-blue-800">
          <strong>Note:</strong> Make sure ADB debugging is enabled on your Fire Cubes. 
          Go to Settings → My Fire TV → Developer Options → ADB Debugging → ON
        </p>
      </div>
    </div>
  );
}
