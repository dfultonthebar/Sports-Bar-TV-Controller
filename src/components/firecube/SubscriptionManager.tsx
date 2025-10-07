
// Subscription Manager Component

import { useState, useEffect } from 'react';

interface SubscriptionManagerProps {
  deviceId: string;
  deviceName: string;
}

export function SubscriptionManager({ deviceId, deviceName }: SubscriptionManagerProps) {
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchSubscriptions();
  }, [deviceId]);

  const fetchSubscriptions = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/firecube/devices/${deviceId}/subscriptions`);
      const data = await response.json();
      setSubscriptions(data.subscriptions || []);
    } catch (error) {
      console.error('Failed to fetch subscriptions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    try {
      setRefreshing(true);
      const response = await fetch(`/api/firecube/devices/${deviceId}/subscriptions`, {
        method: 'POST'
      });
      const data = await response.json();
      setSubscriptions(data.subscriptions || []);
    } catch (error) {
      console.error('Failed to refresh subscriptions:', error);
    } finally {
      setRefreshing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">
          Active Subscriptions - {deviceName}
        </h3>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="px-3 py-1 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {refreshing ? 'Checking...' : 'Check Subscriptions'}
        </button>
      </div>

      {subscriptions.length === 0 ? (
        <div className="text-center py-8 bg-gray-50 rounded-lg">
          <p className="text-gray-600">No active subscriptions detected</p>
          <p className="text-sm text-gray-500 mt-1">
            Click "Check Subscriptions" to scan for logged-in streaming apps
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {subscriptions.map((sub) => (
            <div
              key={sub.id}
              className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  {sub.iconUrl && (
                    <img src={sub.iconUrl} alt={sub.appName} className="w-8 h-8 rounded" />
                  )}
                  <h4 className="font-semibold text-gray-900">{sub.appName}</h4>
                </div>
                {sub.subscriptionStatus && (
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                    sub.subscriptionStatus === 'active' ? 'bg-green-100 text-green-800' :
                    sub.subscriptionStatus === 'trial' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {sub.subscriptionStatus}
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-600">{sub.category}</p>
              {sub.lastChecked && (
                <p className="text-xs text-gray-500 mt-2">
                  Last checked: {new Date(sub.lastChecked).toLocaleString()}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
