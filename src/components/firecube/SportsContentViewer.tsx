
// Sports Content Viewer Component

import { useState, useEffect } from 'react';

interface SportsContentViewerProps {
  deviceId: string;
  deviceName: string;
}

export function SportsContentViewer({ deviceId, deviceName }: SportsContentViewerProps) {
  const [content, setContent] = useState<any[]>([]);
  const [contentType, setContentType] = useState<'live' | 'upcoming'>('live');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchContent();
  }, [deviceId, contentType]);

  const fetchContent = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/firecube/devices/${deviceId}/sports-content?type=${contentType}`);
      const data = await response.json();
      setContent(data.content || []);
    } catch (error) {
      console.error('Failed to fetch sports content:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    try {
      setRefreshing(true);
      const response = await fetch(`/api/firecube/devices/${deviceId}/sports-content`, {
        method: 'POST'
      });
      const data = await response.json();
      setContent(data.content || []);
    } catch (error) {
      console.error('Failed to refresh sports content:', error);
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
        <div className="flex items-center gap-4">
          <h3 className="text-lg font-semibold text-gray-900">
            Sports Content - {deviceName}
          </h3>
          <div className="flex gap-2">
            <button
              onClick={() => setContentType('live')}
              className={`px-3 py-1 text-sm font-medium rounded ${
                contentType === 'live'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              Live Now
            </button>
            <button
              onClick={() => setContentType('upcoming')}
              className={`px-3 py-1 text-sm font-medium rounded ${
                contentType === 'upcoming'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              Upcoming
            </button>
          </div>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="px-3 py-1 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {refreshing ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {content.length === 0 ? (
        <div className="text-center py-8 bg-gray-50 rounded-lg">
          <p className="text-gray-600">
            {contentType === 'live' ? 'No live sports content available' : 'No upcoming sports content'}
          </p>
          <p className="text-sm text-gray-500 mt-1">
            Make sure you have active subscriptions to sports streaming apps
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {content.map((item) => (
            <div
              key={item.id}
              className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h4 className="font-semibold text-gray-900">{item.contentTitle}</h4>
                    {item.isLive && (
                      <span className="px-2 py-1 bg-red-100 text-red-800 text-xs font-medium rounded-full flex items-center gap-1">
                        <span className="w-2 h-2 bg-red-600 rounded-full animate-pulse"></span>
                        LIVE
                      </span>
                    )}
                  </div>
                  
                  <div className="space-y-1 text-sm text-gray-600">
                    {item.league && (
                      <p><strong>League:</strong> {item.league}</p>
                    )}
                    {item.teams && (
                      <p><strong>Teams:</strong> {item.teams}</p>
                    )}
                    {item.channel && (
                      <p><strong>Channel:</strong> {item.channel}</p>
                    )}
                    {item.startTime && (
                      <p><strong>Time:</strong> {new Date(item.startTime).toLocaleString()}</p>
                    )}
                    {item.description && (
                      <p className="text-gray-500 mt-2">{item.description}</p>
                    )}
                  </div>
                </div>
                
                {item.thumbnailUrl && (
                  <img
                    src={item.thumbnailUrl}
                    alt={item.contentTitle}
                    className="w-24 h-16 object-cover rounded ml-4"
                  />
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
