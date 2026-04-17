/**
 * Sports Guide Configuration Component
 *
 * Provides UI for managing Sports Guide API configuration:
 * - View API key status
 * - Verify API key
 * - Update API key
 * - Display API usage information
 */

'use client';

import { useState, useEffect } from 'react';
import { Key, CheckCircle, XCircle, RefreshCw, Settings, Info, Shield } from 'lucide-react';

import { logger } from '@sports-bar/logger'
interface ApiStatus {
  configured: boolean;
  apiUrl: string;
  userId: string | null;
  apiKeySet: boolean;
  apiKeyPreview: string | null;
}

export default function SportsGuideConfig() {
  const [status, setStatus] = useState<ApiStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [verificationResult, setVerificationResult] = useState<{
    valid: boolean;
    message: string;
  } | null>(null);
  const [showUpdateForm, setShowUpdateForm] = useState(false);
  const [newApiKey, setNewApiKey] = useState('');
  const [newUserId, setNewUserId] = useState('');
  const [updateMessage, setUpdateMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  useEffect(() => {
    fetchStatus();
  }, []);

  const fetchStatus = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/sports-guide/status');
      const data = await response.json();

      if (data.success) {
        setStatus(data);
        setNewUserId(data.userId || '');
      }
    } catch (error) {
      logger.error('Error fetching Sports Guide API status:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyKey = async () => {
    try {
      setVerifying(true);
      setVerificationResult(null);

      const response = await fetch('/api/sports-guide/verify-key');
      const data = await response.json();

      setVerificationResult({
        valid: data.valid,
        message: data.message,
      });
    } catch (error) {
      setVerificationResult({
        valid: false,
        message: error instanceof Error ? error.message : 'Failed to verify API key',
      });
    } finally {
      setVerifying(false);
    }
  };

  const handleUpdateKey = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newApiKey || !newUserId) {
      setUpdateMessage({
        type: 'error',
        text: 'Please provide both API key and User ID',
      });
      return;
    }

    try {
      setUpdating(true);
      setUpdateMessage(null);

      const response = await fetch('/api/sports-guide/update-key', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          apiKey: newApiKey,
          userId: newUserId,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setUpdateMessage({
          type: 'success',
          text: data.message,
        });
        setShowUpdateForm(false);
        setNewApiKey('');
        await fetchStatus();

        // Auto-verify after successful update
        setTimeout(() => {
          handleVerifyKey();
        }, 500);
      } else {
        setUpdateMessage({
          type: 'error',
          text: data.message,
        });
      }
    } catch (error) {
      setUpdateMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to update API key',
      });
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <div className="rounded-lg border border-slate-700 p-6">
        <h2 className="text-xl font-semibold text-white flex items-center gap-2 mb-4">
          <Key className="h-5 w-5 text-blue-400" />
          Sports Guide API Configuration
        </h2>
        <div className="flex items-center justify-center py-8">
          <RefreshCw className="h-6 w-6 text-blue-400 animate-spin" />
          <span className="ml-3 text-slate-400">Loading configuration...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-slate-700 p-6">
      <h2 className="text-xl font-semibold text-white flex items-center gap-2 mb-6">
        <Key className="h-5 w-5 text-blue-400" />
        Sports Guide API Configuration
      </h2>

      {/* API Status Section */}
      <div className="mb-6">
        <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
          <Shield className="h-4 w-4" />
          API Status
        </h3>
        <div className="rounded-lg bg-slate-800/50 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-slate-300">Configuration Status</span>
            <span className={`px-3 py-1 rounded-full text-xs font-medium border ${
              status?.configured
                ? 'bg-green-500/20 text-green-400 border-green-500/30'
                : 'bg-red-500/20 text-red-400 border-red-500/30'
            }`}>
              {status?.configured ? 'Configured' : 'Not Configured'}
            </span>
          </div>

          {status?.configured && (
            <>
              <div className="flex items-center justify-between">
                <span className="text-slate-300">API URL</span>
                <span className="text-slate-200 font-mono text-sm">{status.apiUrl}</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-300">User ID</span>
                <span className="text-slate-200 font-mono text-sm">{status.userId}</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-300">API Key</span>
                <span className="text-slate-200 font-mono text-sm">
                  {status.apiKeyPreview || 'Not set'}
                </span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Verification Section */}
      {status?.configured && (
        <div className="mb-6">
          <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wider mb-3">API Key Verification</h3>
          <button
            onClick={handleVerifyKey}
            disabled={verifying}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-lg transition-colors text-sm font-medium"
          >
            {verifying ? (
              <span className="flex items-center">
                <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                Verifying...
              </span>
            ) : (
              'Verify API Key'
            )}
          </button>

          {verificationResult && (
            <div className={`mt-3 p-3 rounded-lg border ${
              verificationResult.valid
                ? 'bg-green-500/10 border-green-500/30'
                : 'bg-red-500/10 border-red-500/30'
            }`}>
              <div className="flex items-center gap-2">
                {verificationResult.valid ? (
                  <CheckCircle className="h-5 w-5 text-green-400 shrink-0" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-400 shrink-0" />
                )}
                <p className={`text-sm font-medium ${
                  verificationResult.valid ? 'text-green-400' : 'text-red-400'
                }`}>
                  {verificationResult.message}
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Update API Key Section */}
      <div className="mb-6">
        <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
          <Settings className="h-4 w-4" />
          Update API Configuration
        </h3>

        {!showUpdateForm ? (
          <button
            onClick={() => setShowUpdateForm(true)}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg transition-colors text-sm font-medium border border-slate-600"
          >
            {status?.configured ? 'Change API Key' : 'Configure API Key'}
          </button>
        ) : (
          <form onSubmit={handleUpdateKey} className="rounded-lg bg-slate-800/50 p-4 space-y-4">
            <div>
              <label htmlFor="userId" className="block text-sm font-medium text-slate-300 mb-1">
                User ID
              </label>
              <input
                type="text"
                id="userId"
                value={newUserId}
                onChange={(e) => setNewUserId(e.target.value)}
                placeholder="258351"
                className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                required
              />
            </div>

            <div>
              <label htmlFor="apiKey" className="block text-sm font-medium text-slate-300 mb-1">
                API Key
              </label>
              <input
                type="text"
                id="apiKey"
                value={newApiKey}
                onChange={(e) => setNewApiKey(e.target.value)}
                placeholder="12548RK0000d2bb701f55b82bfa192e680985919"
                className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                required
              />
            </div>

            {updateMessage && (
              <div className={`p-3 rounded-lg border ${
                updateMessage.type === 'success'
                  ? 'bg-green-500/10 border-green-500/30 text-green-400'
                  : 'bg-red-500/10 border-red-500/30 text-red-400'
              }`}>
                <span className="text-sm">{updateMessage.text}</span>
              </div>
            )}

            <div className="flex space-x-3">
              <button
                type="submit"
                disabled={updating}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-lg transition-colors text-sm font-medium"
              >
                {updating ? (
                  <span className="flex items-center">
                    <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                    Updating...
                  </span>
                ) : (
                  'Update API Key'
                )}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowUpdateForm(false);
                  setNewApiKey('');
                  setUpdateMessage(null);
                }}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg transition-colors text-sm border border-slate-600"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Information Section */}
      <div className="rounded-lg bg-blue-500/10 border border-blue-500/30 p-4">
        <h4 className="text-sm font-medium text-blue-400 mb-2 flex items-center gap-2">
          <Info className="h-4 w-4" />
          About Sports Guide API
        </h4>
        <p className="text-sm text-slate-300 mb-2">
          The Sports Guide API provides real-time sports programming information for cable, satellite, and streaming services.
        </p>
        <ul className="text-sm text-slate-300 space-y-1 list-disc list-inside">
          <li>Cable box channel guide (currently supported)</li>
          <li>Direct TV channel guide (coming soon)</li>
          <li>Streaming service guide (coming soon)</li>
        </ul>
        <p className="text-xs text-slate-400 mt-3">
          API Provider: The Rail Media (guide.thedailyrail.com)
        </p>
      </div>
    </div>
  );
}
