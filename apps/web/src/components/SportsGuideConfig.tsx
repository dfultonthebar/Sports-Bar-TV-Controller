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
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Sports Guide API Configuration</h2>
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-3 text-gray-600">Loading configuration...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-xl font-semibold mb-4">Sports Guide API Configuration</h2>
      
      {/* API Status Section */}
      <div className="mb-6">
        <h3 className="text-lg font-medium mb-3">API Status</h3>
        <div className="bg-gray-50 rounded-lg p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-gray-700">Configuration Status:</span>
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${
              status?.configured 
                ? 'bg-green-100 text-green-800' 
                : 'bg-red-100 text-red-800'
            }`}>
              {status?.configured ? 'Configured' : 'Not Configured'}
            </span>
          </div>
          
          {status?.configured && (
            <>
              <div className="flex items-center justify-between">
                <span className="text-gray-700">API URL:</span>
                <span className="text-gray-900 font-mono text-sm">{status.apiUrl}</span>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-gray-700">User ID:</span>
                <span className="text-gray-900 font-mono text-sm">{status.userId}</span>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-gray-700">API Key:</span>
                <span className="text-gray-900 font-mono text-sm">
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
          <h3 className="text-lg font-medium mb-3">API Key Verification</h3>
          <button
            onClick={handleVerifyKey}
            disabled={verifying}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            {verifying ? (
              <span className="flex items-center">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Verifying...
              </span>
            ) : (
              'Verify API Key'
            )}
          </button>
          
          {verificationResult && (
            <div className={`mt-3 p-4 rounded-lg ${
              verificationResult.valid 
                ? 'bg-green-50 border border-green-200' 
                : 'bg-red-50 border border-red-200'
            }`}>
              <div className="flex items-start">
                <div className={`flex-shrink-0 ${
                  verificationResult.valid ? 'text-green-600' : 'text-red-600'
                }`}>
                  {verificationResult.valid ? (
                    <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  ) : (
                    <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>
                <div className="ml-3">
                  <p className={`text-sm font-medium ${
                    verificationResult.valid ? 'text-green-800' : 'text-red-800'
                  }`}>
                    {verificationResult.message}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Update API Key Section */}
      <div className="mb-6">
        <h3 className="text-lg font-medium mb-3">Update API Configuration</h3>
        
        {!showUpdateForm ? (
          <button
            onClick={() => setShowUpdateForm(true)}
            className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors"
          >
            {status?.configured ? 'Change API Key' : 'Configure API Key'}
          </button>
        ) : (
          <form onSubmit={handleUpdateKey} className="bg-gray-50 rounded-lg p-4 space-y-4">
            <div>
              <label htmlFor="userId" className="block text-sm font-medium text-gray-700 mb-1">
                User ID
              </label>
              <input
                type="text"
                id="userId"
                value={newUserId}
                onChange={(e) => setNewUserId(e.target.value)}
                placeholder="258351"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>
            
            <div>
              <label htmlFor="apiKey" className="block text-sm font-medium text-gray-700 mb-1">
                API Key
              </label>
              <input
                type="text"
                id="apiKey"
                value={newApiKey}
                onChange={(e) => setNewApiKey(e.target.value)}
                placeholder="12548RK0000d2bb701f55b82bfa192e680985919"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                required
              />
            </div>
            
            {updateMessage && (
              <div className={`p-3 rounded-lg ${
                updateMessage.type === 'success' 
                  ? 'bg-green-50 border border-green-200 text-green-800' 
                  : 'bg-red-50 border border-red-200 text-red-800'
              }`}>
                {updateMessage.text}
              </div>
            )}
            
            <div className="flex space-x-3">
              <button
                type="submit"
                disabled={updating}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                {updating ? 'Updating...' : 'Update API Key'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowUpdateForm(false);
                  setNewApiKey('');
                  setUpdateMessage(null);
                }}
                className="bg-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-400 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Information Section */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="text-sm font-medium text-blue-900 mb-2">About Sports Guide API</h4>
        <p className="text-sm text-blue-800 mb-2">
          The Sports Guide API provides real-time sports programming information for cable, satellite, and streaming services.
        </p>
        <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
          <li>Cable box channel guide (currently supported)</li>
          <li>Direct TV channel guide (coming soon)</li>
          <li>Streaming service guide (coming soon)</li>
        </ul>
        <p className="text-xs text-blue-700 mt-3">
          API Provider: The Rail Media (guide.thedailyrail.com)
        </p>
      </div>
    </div>
  );
}
