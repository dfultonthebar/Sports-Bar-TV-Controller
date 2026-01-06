
// DirecTV Box List Component

import { useState } from 'react';
import { BoxCard } from './BoxCard';
import { AddBoxModal } from './AddBoxModal';

interface BoxListProps {
  boxes: any[];
  loading: boolean;
  onUpdate: () => void;
}

export function BoxList({ boxes, loading, onUpdate }: BoxListProps) {
  const [showAddModal, setShowAddModal] = useState(false);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (boxes.length === 0) {
    return (
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
            d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
          />
        </svg>
        <h3 className="mt-2 text-sm font-medium text-gray-900">No DirecTV boxes found</h3>
        <p className="mt-1 text-sm text-gray-500">
          Start by discovering boxes on your network or add one manually.
        </p>
        <div className="mt-6">
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
          >
            Add Box Manually
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="mb-4 flex justify-between items-center">
        <h3 className="text-lg font-medium text-gray-900">
          {boxes.length} Box{boxes.length !== 1 ? 'es' : ''} Found
        </h3>
        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Add Box Manually
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {boxes.map((box) => (
          <BoxCard key={box.id} box={box} onUpdate={onUpdate} />
        ))}
      </div>

      {showAddModal && (
        <AddBoxModal
          onClose={() => setShowAddModal(false)}
          onSuccess={() => {
            setShowAddModal(false);
            onUpdate();
          }}
        />
      )}
    </>
  );
}
