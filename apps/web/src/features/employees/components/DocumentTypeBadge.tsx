import { DOCUMENT_TYPE_LABELS, type DocumentType } from '../types/documents';

export interface DocumentTypeBadgeProps {
  type: DocumentType;
  isSensitive?: boolean;
  className?: string;
}

export function DocumentTypeBadge({
  type,
  isSensitive = false,
  className = '',
}: DocumentTypeBadgeProps) {
  const label = DOCUMENT_TYPE_LABELS[type] || type;

  return (
    <div className={`inline-flex items-center gap-1.5 flex-wrap ${className}`}>
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-surface-muted text-text border border-border">
        <svg
          className="w-3 h-3 stroke-current text-primary-strong"
          fill="none"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
          />
        </svg>
        <span>{label}</span>
      </span>

      {isSensitive && (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-800 border border-rose-200">
          <svg
            className="w-2.5 h-2.5 stroke-current"
            fill="none"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
            />
          </svg>
          <span>Sensitive</span>
        </span>
      )}
    </div>
  );
}
