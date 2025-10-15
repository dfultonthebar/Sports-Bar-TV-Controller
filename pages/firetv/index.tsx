
// Fire TV Settings Page

import { useState, useEffect } from 'react';
import Head from 'next/head';
import { DiscoveryPanel } from '@/components/firecube/DiscoveryPanel';
import { DeviceList } from '@/components/firecube/DeviceList';
import { SubscriptionManager } from '@/components/firecube/SubscriptionManager';
import { SportsContentViewer } from '@/components/firecube/SportsContentViewer';
import { KeepAwakeSettings } from '@/components/firecube/KeepAwakeSettings';
import { SideloadManager } from '@/components/firecube/SideloadManager';

export default function FireTVPage() {
  const [activeTab, setActiveTab] = useState<'devices' | 'subscriptions' | 'sports' | 'keepawake' | 'sideload'>('devices');
  const [devices, setDevices] = useState<any[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDevices();
  }, []);

  const fetchDevices = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/firetv-devices');
      const data = await response.json();
      setDevices(data.devices || []);
      
      // Auto-select first device if none selected
      if (!selectedDevice && data.devices.length > 0) {
        setSelectedDevice(data.devices[0].id);
      }
    } catch (error) {
      console.error('Error fetching devices:', error);
    } finally {
      setLoading(false);
    }
  };

  const selectedDeviceData = devices.find(d => d.id === selectedDevice);

  return (
    <>
      <Head>
        <title>Fire TV Settings - Sports Bar TV Controller</title>
      </Head>

      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-gray-900">Fire TV Settings</h1>
            <p className="text-gray-600 mt-2">
              Manage Fire Cubes, subscriptions, and sports content
            </p>
          </div>

          {/* Discovery Panel */}
          <DiscoveryPanel onDiscoveryComplete={fetchDevices} />

          {/* Device Selector */}
          {devices.length > 0 && (
            <div className="mt-6 bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Device
              </label>
              <select
                value={selectedDevice || ''}
                onChange={(e) => setSelectedDevice(e.target.value)}
                className="w-full md:w-96 border border-gray-300 rounded-md px-3 py-2 text-sm"
              >
                {devices.map((device) => (
                  <option key={device.id} value={device.id}>
                    {device.name} ({device.ipAddress}) - {device.status}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Tabs */}
          <div className="bg-white rounded-lg shadow-sm mt-6">
            <div className="border-b border-gray-200">
              <nav className="flex -mb-px overflow-x-auto">
                <button
                  onClick={() => setActiveTab('devices')}
                  className={`px-6 py-3 text-sm font-medium border-b-2 whitespace-nowrap ${
                    activeTab === 'devices'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  Devices ({devices.length})
                </button>
                <button
                  onClick={() => setActiveTab('subscriptions')}
                  className={`px-6 py-3 text-sm font-medium border-b-2 whitespace-nowrap ${
                    activeTab === 'subscriptions'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                  disabled={!selectedDevice}
                >
                  Subscriptions
                </button>
                <button
                  onClick={() => setActiveTab('sports')}
                  className={`px-6 py-3 text-sm font-medium border-b-2 whitespace-nowrap ${
                    activeTab === 'sports'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                  disabled={!selectedDevice}
                >
                  Live Sports
                </button>
                <button
                  onClick={() => setActiveTab('keepawake')}
                  className={`px-6 py-3 text-sm font-medium border-b-2 whitespace-nowrap ${
                    activeTab === 'keepawake'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                  disabled={!selectedDevice}
                >
                  Keep-Awake
                </button>
                <button
                  onClick={() => setActiveTab('sideload')}
                  className={`px-6 py-3 text-sm font-medium border-b-2 whitespace-nowrap ${
                    activeTab === 'sideload'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                  disabled={devices.length < 2}
                >
                  App Sideload
                </button>
              </nav>
            </div>

            <div className="p-6">
              {activeTab === 'devices' && (
                <DeviceList devices={devices} loading={loading} onUpdate={fetchDevices} />
              )}
              
              {activeTab === 'subscriptions' && selectedDeviceData && (
                <SubscriptionManager
                  deviceId={selectedDeviceData.id}
                  deviceName={selectedDeviceData.name}
                />
              )}
              
              {activeTab === 'sports' && selectedDeviceData && (
                <SportsContentViewer
                  deviceId={selectedDeviceData.id}
                  deviceName={selectedDeviceData.name}
                />
              )}
              
              {activeTab === 'keepawake' && selectedDeviceData && (
                <KeepAwakeSettings
                  deviceId={selectedDeviceData.id}
                  deviceName={selectedDeviceData.name}
                  initialEnabled={selectedDeviceData.keepAwakeEnabled}
                  initialStart={selectedDeviceData.keepAwakeStart}
                  initialEnd={selectedDeviceData.keepAwakeEnd}
                  onUpdate={fetchDevices}
                />
              )}
              
              {activeTab === 'sideload' && (
                <SideloadManager devices={devices} onUpdate={fetchDevices} />
              )}
            </div>
          </div>

          {/* Info Panel */}
          <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-blue-900 mb-2">Setup Instructions</h3>
            <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
              <li>Enable ADB debugging on your Fire Cubes: Settings → My Fire TV → Developer Options → ADB Debugging → ON</li>
              <li>Connect Fire Cubes to the same network as this controller</li>
              <li>Use "Auto Discover" to find devices automatically, or add them manually by IP address</li>
              <li>Configure keep-awake schedules to prevent devices from sleeping during business hours</li>
              <li>Check subscriptions to see which streaming apps are logged in</li>
              <li>Use sideload to clone apps and settings across all Fire Cubes</li>
            </ol>
          </div>
        </div>
      </div>
    </>
  );
}
