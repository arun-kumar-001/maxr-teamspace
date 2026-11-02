import React, { useState } from 'react';
import { TemplateCard } from '../components/TemplateCard';
import { TemplateItem } from '../types/template';

export const TemplatePage: React.FC = () => {
  // Demonstration states: loading, empty, error, content
  const [items] = useState<TemplateItem[]>([
    {
      id: '1',
      name: 'Sample Template Record A',
      description: 'Demonstrates modular feature layout and card component responsiveness.',
      isActive: true,
      createdAt: new Date().toISOString(),
    },
    {
      id: '2',
      name: 'Sample Template Record B',
      description:
        'Supports fluid responsive scaling across mobile, tablet, and ultrawide viewports.',
      isActive: true,
      createdAt: new Date().toISOString(),
    },
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Module Template Demo</h1>
          <p className="text-sm text-slate-600">
            Standard feature pattern: features/&lt;module&gt;/(components, hooks, api, pages, types)
          </p>
        </div>
        <button
          type="button"
          className="min-h-[44px] px-4 py-2 bg-teal-500 hover:bg-teal-600 text-white font-medium rounded-md shadow-sm transition-colors self-start sm:self-auto"
        >
          Create Item
        </button>
      </div>

      {/* Responsive Grid: 1 col on mobile, 2 on tablet, 3 on desktop, 4 on 2xl+ */}
      {items.length === 0 ? (
        <div className="p-8 text-center bg-surface rounded-lg border border-dashed border-slate-300">
          <p className="text-slate-500">No template items found.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-4">
          {items.map((item) => (
            <TemplateCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
};
