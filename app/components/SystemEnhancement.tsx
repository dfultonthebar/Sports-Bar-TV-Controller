
'use client'

import { useState } from 'react'

interface Enhancement {
  id: number
  title: string
  description: string
  category: 'audio' | 'video' | 'automation' | 'experience'
  difficulty: 'Easy' | 'Medium' | 'Advanced'
  estimatedCost: string
  benefits: string[]
  requirements: string[]
  implementation: string
}

export default function SystemEnhancement() {
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [selectedEnhancement, setSelectedEnhancement] = useState<Enhancement | null>(null)

  const enhancements: Enhancement[] = [
    {
      id: 1,
      title: 'Zone Audio Control',
      description: 'Add independent volume control for different areas of your sports bar',
      category: 'audio',
      difficulty: 'Medium',
      estimatedCost: '$500-1000',
      benefits: ['Better customer experience', 'Reduced noise complaints', 'Flexible audio management'],
      requirements: ['Zone audio amplifiers', 'Wall-mounted volume controls', 'Audio distribution system'],
      implementation: 'Install zone amplifiers and volume controls in each area. Wire audio distribution system to separate zones for independent control.'
    },
    {
      id: 2,
      title: 'Automated Game Switching',
      description: 'Automatically switch to the most popular games based on customer preferences',
      category: 'automation',
      difficulty: 'Advanced',
      estimatedCost: '$1000-2000',
      benefits: ['Increased customer satisfaction', 'Reduced staff workload', 'Better game coverage'],
      requirements: ['Smart switching system', 'Game schedule integration', 'Customer preference tracking'],
      implementation: 'Deploy automated switching software with game schedule APIs and customer preference analytics.'
    },
    {
      id: 3,
      title: 'Multi-Screen Synchronization',
      description: 'Sync multiple displays to show the same content with perfect timing',
      category: 'video',
      difficulty: 'Medium',
      estimatedCost: '$300-600',
      benefits: ['Professional appearance', 'Better viewing experience', 'Reduced distraction'],
      requirements: ['Video synchronization equipment', 'HDMI distribution amplifiers', 'Network switches'],
      implementation: 'Install video sync equipment to ensure all displays show identical content timing.'
    },
    {
      id: 4,
      title: 'Customer Request System',
      description: 'Allow customers to request specific games or audio via mobile app',
      category: 'experience',
      difficulty: 'Advanced',
      estimatedCost: '$2000-3000',
      benefits: ['Enhanced customer engagement', 'Reduced staff interruptions', 'Data collection on preferences'],
      requirements: ['Mobile app development', 'Request management system', 'Staff notification system'],
      implementation: 'Develop mobile app with request system connected to your AV control infrastructure.'
    },
    {
      id: 5,
      title: 'Smart Lighting Integration',
      description: 'Sync lighting with game events and create atmosphere for different sports',
      category: 'experience',
      difficulty: 'Medium',
      estimatedCost: '$800-1500',
      benefits: ['Enhanced atmosphere', 'Team spirit building', 'Unique experience differentiation'],
      requirements: ['Smart LED lighting', 'Game event API integration', 'Lighting control system'],
      implementation: 'Install smart lighting system with game event triggers for dynamic atmosphere control.'
    },
    {
      id: 6,
      title: 'Audio Commentary Selection',
      description: 'Let customers choose between different audio feeds for the same game',
      category: 'audio',
      difficulty: 'Easy',
      estimatedCost: '$200-400',
      benefits: ['Multiple language support', 'Different commentary styles', 'Increased accessibility'],
      requirements: ['Multi-audio feed receiver', 'Audio switching system', 'Simple control interface'],
      implementation: 'Add multi-audio receivers and switching system for different commentary feeds.'
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
              <button 
                onClick={() => setSelectedEnhancement(enhancement)}
                className="bg-blue-500 text-white px-4 py-2 rounded-md text-sm hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
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

      {/* Enhancement Detail Modal */}
      {selectedEnhancement && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-gray-900">
                  {selectedEnhancement.title}
                </h3>
                <button
                  onClick={() => setSelectedEnhancement(null)}
                  className="text-gray-400 hover:text-gray-600 text-2xl"
                >
                  ×
                </button>
              </div>

              <div className="space-y-6">
                <div>
                  <h4 className="text-lg font-semibold text-gray-800 mb-2">Description</h4>
                  <p className="text-gray-600">{selectedEnhancement.description}</p>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="text-lg font-semibold text-gray-800 mb-2">Benefits</h4>
                    <ul className="space-y-1">
                      {selectedEnhancement.benefits.map((benefit, index) => (
                        <li key={index} className="text-gray-600 flex items-start">
                          <span className="text-green-500 mr-2">✓</span>
                          {benefit}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <h4 className="text-lg font-semibold text-gray-800 mb-2">Requirements</h4>
                    <ul className="space-y-1">
                      {selectedEnhancement.requirements.map((requirement, index) => (
                        <li key={index} className="text-gray-600 flex items-start">
                          <span className="text-blue-500 mr-2">•</span>
                          {requirement}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div>
                  <h4 className="text-lg font-semibold text-gray-800 mb-2">Implementation</h4>
                  <p className="text-gray-600">{selectedEnhancement.implementation}</p>
                </div>

                <div className="flex items-center justify-between bg-gray-50 p-4 rounded-lg">
                  <div>
                    <span className="text-sm text-gray-500">Estimated Cost</span>
                    <p className="text-lg font-semibold text-green-600">{selectedEnhancement.estimatedCost}</p>
                  </div>
                  <div>
                    <span className="text-sm text-gray-500">Difficulty</span>
                    <p className={`text-sm font-medium px-2 py-1 rounded ${getDifficultyColor(selectedEnhancement.difficulty)}`}>
                      {selectedEnhancement.difficulty}
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <button
                    onClick={() => setSelectedEnhancement(null)}
                    className="flex-1 bg-gray-100 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-200"
                  >
                    Close
                  </button>
                  <button
                    onClick={() => {
                      alert(`Contact your AV installer to implement: ${selectedEnhancement.title}`)
                      setSelectedEnhancement(null)
                    }}
                    className="flex-1 bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600"
                  >
                    Get Quote
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
