

'use client'

import { useState, useEffect } from 'react'
import { ArrowLeft, Save, Settings, Tv, Smartphone, Monitor } from 'lucide-react'
import Link from 'next/link'
import DirecTVController from '../../components/DirecTVController'

interface TabProps {
  activeTab: string
  setActiveTab: (tab: string) => void
}

function DeviceConfigTabs({ activeTab, setActiveTab }: TabProps) {
  const tabs = [
    { id: 'directv', label: 'DirecTV', icon: Tv },
    { id: 'firetv', label: 'Fire TV', icon: Monitor },
    { id: 'ir', label: 'IR Devices', icon: Smartphone },
  ]

  return (
    <div className="border-b border-gray-200 mb-6">
      <nav className="-mb-px flex space-x-8">
        {tabs.map((tab) => {
          const Icon = tab.icon
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`${
                activeTab === tab.id
                  ? 'border-amber-500 text-amber-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm flex items-center space-x-2`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          )
        })}
      </nav>
    </div>
  )
}

export default function DeviceConfigPage() {
  const [activeTab, setActiveTab] = useState('directv')

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <header className="bg-white/90 backdrop-blur-sm border-b border-slate-200/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <Link href="/" className="p-2 rounded-lg hover:bg-slate-100 transition-colors">
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div className="bg-gradient-to-br from-amber-600 to-orange-600 rounded-xl p-2.5 shadow-lg">
                <Tv className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900">Device Configuration</h1>
                <p className="text-sm text-slate-500">TV & streaming device management</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-6">
          <div className="flex items-center space-x-3 mb-6">
            <Settings className="w-6 h-6 text-amber-600" />
            <h2 className="text-2xl font-bold text-slate-900">Device Management</h2>
          </div>
          
          <DeviceConfigTabs activeTab={activeTab} setActiveTab={setActiveTab} />
          
          <div className="mt-6">
            {activeTab === 'directv' && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">DirecTV Configuration</h3>
                <DirecTVController />
              </div>
            )}
            
            {activeTab === 'firetv' && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Fire TV Configuration</h3>
                <div className="p-6 bg-gray-50 rounded-lg">
                  <p className="text-gray-600">Fire TV device configuration interface will be displayed here.</p>
                  <p className="text-sm text-gray-500 mt-2">Configure Fire TV devices, network settings, and remote control options.</p>
                </div>
              </div>
            )}
            
            {activeTab === 'ir' && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">IR Device Configuration</h3>
                <div className="p-6 bg-gray-50 rounded-lg">
                  <p className="text-gray-600">IR device configuration interface will be displayed here.</p>
                  <p className="text-sm text-gray-500 mt-2">Configure infrared devices, learning remotes, and control codes.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
