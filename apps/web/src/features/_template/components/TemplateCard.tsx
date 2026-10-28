import React from 'react';
import { TemplateItem } from '../types/template';

interface TemplateCardProps {
  item: TemplateItem;
  onSelect?: (id: string) => void;
}

export const TemplateCard: React.FC<TemplateCardProps> = ({ item, onSelect }) => {
  return (
    <div
      onClick={() => onSelect?.(item.id)}
      className="p-4 bg-surface rounded-lg border border-slate-200 shadow-sm hover:border-teal-500 transition-colors cursor-pointer"
    >
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-semibold text-slate-900 text-base">{item.name}</h3>
        <span
          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
            item.isActive ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-800'
          }`}
        >
          {item.isActive ? 'Active' : 'Inactive'}
        </span>
      </div>
      {item.description && (
        <p className="text-slate-600 text-sm mb-3 line-clamp-2">{item.description}</p>
      )}
      <div className="text-xs text-slate-400">
        Created: {new Date(item.createdAt).toLocaleDateString()}
      </div>
    </div>
  );
};
