
'use client'

import { useState } from 'react'

interface Enhancement {
  id: number
  title: string
  description: string
  category: 'audio' | 'video' | 'automation' | 'experience'
  difficulty: 'Easy' | 'Medium' | 'Advanced'
  estimatedCost: string
}

export default function SystemEnhancement() {
  const [selectedCategory, setSelectedCategory] = useState<string>('all')

  const enhancements: Enhancement[] = [
    {
      id: 1,
      title: 'Zone Audio Control',
      description: 'Add independent volume control for different areas of your sports bar',
      category: 'audio',
      difficulty: 'Medium',
      estimatedCost: '$500-1000'
    },
    {
      id: 2,
      title: 'Automated Game Switching',
      description: 'Automatically switch to the most popular games based on customer preferences',
      category: 'automation',
      difficulty: 'Advanced',
      estimatedCost: '$1000-2000'
    },
    {
      id: 3,
      title: 'Multi-Screen Synchronization',
      description: 'Sync multiple displays to show the same content with perfect timing',
      category: 'video',
      difficulty: 'Medium',
      estimatedCost: '$300-600'
    },
    {
      id: 4,
      title: 'Customer Request System',
      description: 'Allow customers to request specific games or audio via mobile app',
      category: 'experience',
      difficulty: 'Advanced',
      estimatedCost: '$2000-3000'
    },
    {
      id: 5,
      title: 'Smart Lighting Integration',
      description: 'Sync lighting with game events and create atmosphere for different sports',
      category: 'experience',
      difficulty: 'Medium',
      estimatedCost: '$800-1500'
    },
    {
      id: 6,
      title: 'Audio Commentary Selection',
      description: 'Let customers choose between different audio feeds for the same game',
      category: 'audio',
      difficulty: 'Easy',
      estimatedCost: '$200-400'
    }
  ]

  const categories = [
    { id: 'all', name: 'All Categories', icon: '🎯' },
    { id: 'audio', name: 'Audio', icon: '🔊' },
    { id: 'video', name: 'Video', icon: '📺' },
    { id: 'automation', name: 'Automation', icon: '🤖' },
    { id: 'experience', name: 'Experience', icon: '✨' }
  ]

  const filteredEnhancements = selectedCategory === 'all' 
    ? enhancements 
    : enhancements.filter(e => e.category === selectedCategory)

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'Easy': return 'bg-green-100 text-green-800'
      case 'Medium': return 'bg-yellow-100 text-yellow-800'
      case 'Advanced': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="text-xl font-semibold text-gray-900 mb-2">
          System Enhancement Recommendations
        </h3>
        <p className="text-gray-600">
          Discover ways to improve your sports bar's AV system and customer experience
        </p>
      </div>

      {/* Category Filter */}
      <div className="flex flex-wrap justify-center gap-2">
        {categories.map((category) => (
          <button
            key={category.id}
            onClick={() => setSelectedCategory(category.id)}
            className={`px-4 py-2 rounded-full text-sm font-medium flex items-center space-x-2 ${
              selectedCategory === category.id
                ? 'bg-blue-500 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <span>{category.icon}</span>
            <span>{category.name}</span>
          </button>
        ))}
      </div>

      {/* Enhancement Cards */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {filteredEnhancements.map((enhancement) => (
          <div key={enhancement.id} className="bg-white border border-gray-200 rounded-lg shadow-sm p-6">
            <div className="flex items-start justify-between mb-4">
              <h4 className="text-lg font-semibold text-gray-900">
                {enhancement.title}
              </h4>
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${getDifficultyColor(enhancement.difficulty)}`}>
                {enhancement.difficulty}
              </span>
            </div>
            
            <p className="text-gray-600 mb-4">
              {enhancement.description}
            </p>
            
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-blue-600">
                {enhancement.estimatedCost}
              </span>
              <button className="bg-blue-500 text-white px-4 py-2 rounded-md text-sm hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500">
                Learn More
              </button>
            </div>
          </div>
        ))}
      </div>

      {filteredEnhancements.length === 0 && (
        <div className="text-center py-8">
          <p className="text-gray-500">No enhancements found for the selected category.</p>
        </div>
      )}
    </div>
  )
}
