
// DirecTV Management Page

import { useState, useEffect } from 'react';
import Head from 'next/head';
import { DiscoveryPanel } from '@/components/directv/DiscoveryPanel';
import { BoxList } from '@/components/directv/BoxList';
import { ChannelGuide } from '@/components/directv/ChannelGuide';

export default function DirecTVPage() {
  const [activeTab, setActiveTab] = useState<'boxes' | 'guide'>('boxes');
  const [boxes, setBoxes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBoxes();
  }, []);

  const fetchBoxes = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/directv/boxes');
      const data = await response.json();
      setBoxes(data.boxes || []);
    } catch (error) {
      console.error('Error fetching boxes:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Head>
        <title>DirecTV Management - Sports Bar TV Controller</title>
      </Head>

      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-gray-900">DirecTV Management</h1>
            <p className="text-gray-600 mt-2">
              Discover and manage DirecTV boxes on your network
            </p>
          </div>

          {/* Discovery Panel */}
          <DiscoveryPanel onDiscoveryComplete={fetchBoxes} />

          {/* Tabs */}
          <div className="bg-white rounded-lg shadow-sm mt-6">
            <div className="border-b border-gray-200">
              <nav className="flex -mb-px">
                <button
                  onClick={() => setActiveTab('boxes')}
                  className={`px-6 py-3 text-sm font-medium border-b-2 ${
                    activeTab === 'boxes'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  DirecTV Boxes ({boxes.length})
                </button>
                <button
                  onClick={() => setActiveTab('guide')}
                  className={`px-6 py-3 text-sm font-medium border-b-2 ${
                    activeTab === 'guide'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  Channel Guide
                </button>
              </nav>
            </div>

            <div className="p-6">
              {activeTab === 'boxes' && (
                <BoxList boxes={boxes} loading={loading} onUpdate={fetchBoxes} />
              )}
              {activeTab === 'guide' && <ChannelGuide boxes={boxes} />}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
