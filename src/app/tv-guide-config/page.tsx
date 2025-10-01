
import React from 'react'
import TVGuideConfigurationPanel from '@/components/tv-guide/TVGuideConfigurationPanel'

export default function TVGuideConfigPage() {
  return (
    <div className="min-h-screen bg-gray-100">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-slate-100">TV Guide Configuration</h1>
            <p className="text-gray-600 mt-2">
              Configure your TV guide data sources for comprehensive sports bar programming information.
            </p>
          </div>
          
          <TVGuideConfigurationPanel />
          
          <div className="mt-8 bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-semibold mb-4">About Professional TV Guide Services</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold text-lg text-blue-600">Gracenote (Nielsen)</h3>
                  <p className="text-gray-600 text-sm">
                    Industry-standard professional TV guide data with comprehensive metadata, 
                    sports-focused features, and real-time updates. Perfect for sports bars 
                    requiring detailed programming information.
                  </p>
                  <ul className="text-sm text-slate-400 mt-2 space-y-1">
                    <li>• Comprehensive sports metadata</li>
                    <li>• Team and league information</li>
                    <li>• Event status and scoring</li>
                    <li>• Professional-grade reliability</li>
                  </ul>
                </div>
                
                <div>
                  <h4 className="font-medium">Getting Started with Gracenote:</h4>
                  <ol className="text-sm text-slate-300 space-y-1 list-decimal list-inside">
                    <li>Visit <a href="https://developer.gracenote.com" className="text-blue-600 underline">developer.gracenote.com</a></li>
                    <li>Create a developer account</li>
                    <li>Register your application</li>
                    <li>Obtain API Key and Partner ID</li>
                    <li>Add credentials to your environment variables</li>
                  </ol>
                </div>
              </div>
              
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold text-lg text-purple-600">Spectrum Business API</h3>
                  <p className="text-gray-600 text-sm">
                    Direct integration with Spectrum Business TV services providing 
                    real-time channel lineup and programming data specific to your 
                    business account and service level.
                  </p>
                  <ul className="text-sm text-slate-400 mt-2 space-y-1">
                    <li>• Account-specific channel lineup</li>
                    <li>• Subscription-aware programming</li>
                    <li>• Regional sports networks</li>
                    <li>• Package-level channel access</li>
                  </ul>
                </div>
                
                <div>
                  <h4 className="font-medium">Getting Spectrum Business API Access:</h4>
                  <ol className="text-sm text-slate-300 space-y-1 list-decimal list-inside">
                    <li>Contact your Spectrum Business representative</li>
                    <li>Request API access for your account</li>
                    <li>Obtain API credentials and account ID</li>
                    <li>Configure region settings</li>
                    <li>Add credentials to your environment variables</li>
                  </ol>
                </div>
              </div>
            </div>
            
            <div className="mt-6 p-4 bg-yellow-50 rounded border border-yellow-200">
              <h4 className="font-medium text-yellow-800">💡 Pro Tip</h4>
              <p className="text-yellow-700 text-sm">
                You can use both services simultaneously! The unified TV guide will automatically 
                merge data from both sources, providing the most comprehensive programming information 
                available. Gracenote provides rich metadata while Spectrum ensures accuracy for your 
                specific subscription.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
