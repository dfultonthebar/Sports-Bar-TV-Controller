
'use client';

import React, { useState } from 'react';

interface Enhancement {
  id: string;
  title: string;
  description: string;
  category: 'audio' | 'video' | 'control' | 'network';
  priority: 'low' | 'medium' | 'high';
  status: 'pending' | 'in-progress' | 'completed';
  createdAt: Date;
}

interface SystemEnhancementProps {
  onEnhancementSubmit?: (enhancement: Omit<Enhancement, 'id' | 'createdAt' | 'status'>) => void;
}

const SystemEnhancement: React.FC<SystemEnhancementProps> = ({ onEnhancementSubmit }) => {
  const [enhancements, setEnhancements] = useState<Enhancement[]>([
    {
      id: '1',
      title: 'Upgrade Audio Processing',
      description: 'Implement advanced audio processing for better sound quality during peak hours',
      category: 'audio',
      priority: 'high',
      status: 'in-progress',
      createdAt: new Date('2024-01-15')
    },
    {
      id: '2',
      title: 'Add Zone Control',
      description: 'Create separate audio zones for different areas of the sports bar',
      category: 'control',
      priority: 'medium',
      status: 'pending',
      createdAt: new Date('2024-01-10')
    }
  ]);

  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: 'audio' as Enhancement['category'],
    priority: 'medium' as Enhancement['priority']
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const newEnhancement: Enhancement = {
      id: Date.now().toString(),
      ...formData,
      status: 'pending',
      createdAt: new Date()
    };

    setEnhancements(prev => [...prev, newEnhancement]);
    onEnhancementSubmit?.(formData);
    
    setFormData({
      title: '',
      description: '',
      category: 'audio',
      priority: 'medium'
    });
    setShowForm(false);
  };

  const getPriorityColor = (priority: Enhancement['priority']) => {
    switch (priority) {
      case 'high': return 'text-red-600 bg-red-100';
      case 'medium': return 'text-yellow-600 bg-yellow-100';
      case 'low': return 'text-green-600 bg-green-100';
    }
  };

  const getStatusColor = (status: Enhancement['status']) => {
    switch (status) {
      case 'completed': return 'text-green-600 bg-green-100';
      case 'in-progress': return 'text-blue-600 bg-blue-100';
      case 'pending': return 'text-gray-600 bg-gray-100';
    }
  };

  const getCategoryIcon = (category: Enhancement['category']) => {
    switch (category) {
      case 'audio': return '🔊';
      case 'video': return '📺';
      case 'control': return '🎛️';
      case 'network': return '🌐';
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">System Enhancements</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          {showForm ? 'Cancel' : 'Request Enhancement'}
        </button>
      </div>

      {showForm && (
        <div className="bg-white p-6 rounded-lg border border-gray-200 mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Request New Enhancement</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Enhancement Title
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                rows={3}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Category
                </label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value as Enhancement['category'] }))}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="audio">Audio</option>
                  <option value="video">Video</option>
                  <option value="control">Control</option>
                  <option value="network">Network</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Priority
                </label>
                <select
                  value={formData.priority}
                  onChange={(e) => setFormData(prev => ({ ...prev, priority: e.target.value as Enhancement['priority'] }))}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
            </div>
            
            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                Submit Request
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="space-y-4">
        {enhancements.map((enhancement) => (
          <div key={enhancement.id} className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center space-x-3 mb-2">
                  <span className="text-2xl">{getCategoryIcon(enhancement.category)}</span>
                  <h3 className="text-lg font-semibold text-gray-900">{enhancement.title}</h3>
                </div>
                <p className="text-gray-600 mb-3">{enhancement.description}</p>
                <div className="flex items-center space-x-4 text-sm">
                  <span className="text-gray-500">
                    Created: {enhancement.createdAt.toLocaleDateString()}
                  </span>
                  <span className="text-gray-500 capitalize">
                    Category: {enhancement.category}
                  </span>
                </div>
              </div>
              <div className="flex flex-col items-end space-y-2">
                <span className={`px-2 py-1 rounded-full text-xs font-medium capitalize ${getPriorityColor(enhancement.priority)}`}>
                  {enhancement.priority} Priority
                </span>
                <span className={`px-2 py-1 rounded-full text-xs font-medium capitalize ${getStatusColor(enhancement.status)}`}>
                  {enhancement.status.replace('-', ' ')}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SystemEnhancement;
