import { useState } from 'react';
import { Button } from '../../../components/ui';
import type { OnboardingItem } from '../types/onboarding';

export interface OnboardingItemRowProps {
  item: OnboardingItem;
  canVerify: boolean;
  canUnverify: boolean;
  onVerify: (itemKey: string, notes?: string) => void;
  onUnverify: (itemKey: string) => void;
  isSubmitting: boolean;
}

export function OnboardingItemRow({
  item,
  canVerify,
  canUnverify,
  onVerify,
  onUnverify,
  isSubmitting,
}: OnboardingItemRowProps) {
  const [showNotesInput, setShowNotesInput] = useState(false);
  const [notes, setNotes] = useState('');

  const handleVerifyClick = () => {
    if (showNotesInput) {
      onVerify(item.itemKey, notes.trim() || undefined);
      setShowNotesInput(false);
      setNotes('');
    } else {
      setShowNotesInput(true);
    }
  };

  const handleCancelNotes = () => {
    setShowNotesInput(false);
    setNotes('');
  };

  return (
    <div
      className={`p-4 rounded-tile border transition-all ${
        item.isVerified ? 'bg-surface border-emerald-200/80' : 'bg-surface border-border'
      }`}
      data-testid={`onboarding-item-${item.itemKey}`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        {/* Status Indicator & Title */}
        <div className="flex items-start gap-3">
          <div
            className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
              item.isVerified ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
            }`}
            aria-label={item.isVerified ? 'Verified' : 'Pending'}
          >
            {item.isVerified ? (
              <svg
                className="w-3.5 h-3.5 stroke-current"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth="2.5"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg
                className="w-3.5 h-3.5 stroke-current"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth="2"
              >
                <circle cx="12" cy="12" r="9" />
              </svg>
            )}
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-text text-sm sm:text-base">{item.title}</span>
              <span
                className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  item.isVerified
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : 'bg-slate-100 text-slate-600 border border-slate-200'
                }`}
              >
                {item.isVerified ? 'Verified' : 'Pending'}
              </span>
            </div>

            {item.description && (
              <p className="text-xs sm:text-sm text-text-muted">{item.description}</p>
            )}

            {item.isVerified && item.verifiedAt && (
              <div className="text-xs text-text-subtle flex items-center gap-1.5 pt-0.5">
                <svg className="w-3 h-3 stroke-current shrink-0" fill="none" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <span>Verified on {new Date(item.verifiedAt).toLocaleDateString()}</span>
              </div>
            )}

            {item.notes && (
              <div className="mt-1 text-xs text-text-muted bg-surface-muted border-l-2 border-primary-strong p-2 rounded-r-md">
                <span className="font-medium text-text">Notes: </span>
                {item.notes}
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
          {!item.isVerified && canVerify && !showNotesInput && (
            <Button size="sm" variant="primary" disabled={isSubmitting} onClick={handleVerifyClick}>
              Verify
            </Button>
          )}

          {item.isVerified && canUnverify && (
            <Button
              size="sm"
              variant="outline"
              disabled={isSubmitting}
              onClick={() => onUnverify(item.itemKey)}
            >
              Unverify
            </Button>
          )}
        </div>
      </div>

      {/* Inline Notes Entry */}
      {showNotesInput && (
        <div className="mt-3 pt-3 border-t border-border flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
          <input
            type="text"
            className="flex-1 px-3 py-1.5 text-xs sm:text-sm bg-surface-raised border border-border-strong rounded-control focus:outline-none focus:ring-2 focus:ring-primary-strong text-text"
            placeholder="Add optional verification note..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            disabled={isSubmitting}
          />
          <div className="flex items-center gap-2 justify-end">
            <Button size="sm" variant="ghost" disabled={isSubmitting} onClick={handleCancelNotes}>
              Cancel
            </Button>
            <Button
              size="sm"
              variant="primary"
              isLoading={isSubmitting}
              onClick={handleVerifyClick}
            >
              Confirm Verify
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
