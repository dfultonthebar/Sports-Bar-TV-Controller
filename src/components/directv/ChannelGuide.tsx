
// DirecTV Channel Guide Component

import { useState, useEffect } from 'react';

interface ChannelGuideProps {
  boxes: any[];
}

export function ChannelGuide({ boxes }: ChannelGuideProps) {
  const [channels, setChannels] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedBox, setSelectedBox] = useState<string>('');
  const [category, setCategory] = useState<string>('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchChannels();
  }, [category, search]);

  const fetchChannels = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (category) params.append('category', category);
      if (search) params.append('search', search);
      params.append('limit', '100');

      const response = await fetch(`/api/directv/guide/channels?${params}`);
      const data = await response.json();
      setChannels(data.channels || []);
    } catch (error) {
      console.error('Error fetching channels:', error);
    } finally {
      setLoading(false);
    }
  };

  const refreshGuide = async () => {
    if (!selectedBox) {
      alert('Please select a DirecTV box to refresh from');
      return;
    }

    if (!confirm('This will scan channels and may take several minutes. Continue?')) {
      return;
    }

    setRefreshing(true);
    try {
      const response = await fetch('/api/directv/guide/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ boxId: selectedBox }),
      });

      const data = await response.json();

      if (data.success) {
        alert(`Guide refreshed!\n${data.added} channels added\n${data.updated} channels updated\nCompleted in ${(data.duration / 1000).toFixed(1)}s`);
        fetchChannels();
      } else {
        alert(`Refresh failed: ${data.error}`);
      }
    } catch (error: any) {
      alert(`Error: ${error.message}`);
    } finally {
      setRefreshing(false);
    }
  };

  const onlineBoxes = boxes.filter(box => box.status === 'online' && box.shefEnabled);

  return (
    <div className="space-y-6">
      {/* Refresh Controls */}
      <div className="bg-gray-50 rounded-lg p-4">
        <h3 className="text-sm font-medium text-gray-900 mb-3">Refresh Channel Guide</h3>
        <div className="flex gap-3 items-end">
          <div className="flex-1">
            <label className="block text-sm text-gray-700 mb-1">
              Select DirecTV Box
            </label>
            <select
              value={selectedBox}
              onChange={(e) => setSelectedBox(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              disabled={onlineBoxes.length === 0}
            >
              <option value="">Select a box...</option>
              {onlineBoxes.map((box) => (
                <option key={box.id} value={box.id}>
                  {box.model || 'Unknown'} - {box.ipAddress} {box.location ? `(${box.location})` : ''}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={refreshGuide}
            disabled={refreshing || !selectedBox}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {refreshing ? 'Refreshing...' : 'Refresh Guide'}
          </button>
        </div>
        {onlineBoxes.length === 0 && (
          <p className="mt-2 text-sm text-red-600">
            No online boxes available. Please discover boxes first.
          </p>
        )}
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <div className="flex-1">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search channels..."
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Categories</option>
          <option value="sports">Sports</option>
          <option value="news">News</option>
          <option value="entertainment">Entertainment</option>
          <option value="movies">Movies</option>
          <option value="local">Local</option>
          <option value="premium">Premium</option>
        </select>
      </div>

      {/* Channel List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : channels.length === 0 ? (
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
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">No channels found</h3>
          <p className="mt-1 text-sm text-gray-500">
            Refresh the channel guide to populate the list.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Channel
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Callsign
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Category
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {channels.map((channel) => (
                  <tr key={channel.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {channel.channelNumber}
                      {channel.subChannel && `.${channel.subChannel}`}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {channel.channelName}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {channel.callsign || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <span className="px-2 py-1 text-xs rounded-full bg-gray-100">
                        {channel.category || 'other'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <div className="flex gap-1">
                        {channel.isHD && (
                          <span className="px-2 py-0.5 text-xs bg-blue-100 text-blue-800 rounded">
                            HD
                          </span>
                        )}
                        {channel.isPPV && (
                          <span className="px-2 py-0.5 text-xs bg-yellow-100 text-yellow-800 rounded">
                            PPV
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
