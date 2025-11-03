
// DirecTV Discovery Panel Component

import { useState } from 'react';

interface DiscoveryPanelProps {
  onDiscoveryComplete: () => void;
}

export function DiscoveryPanel({ onDiscoveryComplete }: DiscoveryPanelProps) {
  const [discovering, setDiscovering] = useState(false);
  const [progress, setProgress] = useState('');
  const [result, setResult] = useState<any>(null);

  const startDiscovery = async (method: 'ssdp' | 'port_scan' | 'both') => {
    setDiscovering(true);
    setProgress('Starting discovery...');
    setResult(null);

    try {
      const response = await fetch('/api/directv/discover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ method }),
      });

      const data = await response.json();

      if (data.success) {
        setResult({
          success: true,
          boxesFound: data.boxes.length,
          duration: data.duration,
          errors: data.errors,
        });
        setProgress(`Discovery complete! Found ${data.boxes.length} box(es) in ${(data.duration / 1000).toFixed(1)}s`);
        onDiscoveryComplete();
      } else {
        setResult({ success: false, error: data.error });
        setProgress('Discovery failed');
      }
    } catch (error: any) {
      setResult({ success: false, error: error.message });
      setProgress('Discovery failed');
    } finally {
      setDiscovering(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      <h2 className="text-xl font-semibold text-gray-900 mb-4">Discover DirecTV Boxes</h2>
      
      <div className="space-y-4">
        <p className="text-sm text-gray-600">
          Scan your network to find DirecTV set-top boxes. Make sure SHEF is enabled on your boxes
          (Menu → System Setup → Whole-Home → External Device → Allow).
        </p>

        <div className="flex gap-3">
          <button
            onClick={() => startDiscovery('both')}
            disabled={discovering}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            {discovering ? 'Discovering...' : 'Auto Discover'}
          </button>
          
          <button
            onClick={() => startDiscovery('ssdp')}
            disabled={discovering}
            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            SSDP Only
          </button>
          
          <button
            onClick={() => startDiscovery('port_scan')}
            disabled={discovering}
            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            Port Scan Only
          </button>
        </div>

        {discovering && (
          <div className="flex items-center gap-3 p-4 bg-blue-50 rounded-lg">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
            <span className="text-sm text-blue-900">{progress}</span>
          </div>
        )}

        {result && !discovering && (
          <div className={`p-4 rounded-lg ${result.success ? 'bg-green-50' : 'bg-red-50'}`}>
            <div className="flex items-start gap-3">
              <div className={`flex-shrink-0 ${result.success ? 'text-green-600' : 'text-red-600'}`}>
                {result.success ? (
                  <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                ) : (
                  <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                )}
              </div>
              <div className="flex-1">
                <p className={`text-sm font-medium ${result.success ? 'text-green-900' : 'text-red-900'}`}>
                  {result.success ? progress : 'Discovery Failed'}
                </p>
                {result.errors && result.errors.length > 0 && (
                  <ul className="mt-2 text-sm text-gray-600 list-disc list-inside">
                    {result.errors.map((error: string, index: number) => (
                      <li key={index}>{error}</li>
                    ))}
                  </ul>
                )}
                {result.error && (
                  <p className="mt-2 text-sm text-red-700">{result.error}</p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
