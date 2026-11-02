import { Button, Input } from '../../../components/ui';

export interface PhoneEditorProps {
  currentPhone: string | null;
  phoneDraft: string;
  isEditing: boolean;
  isSaving: boolean;
  isDeactivated: boolean;
  saveError: string | null;
  conflictWarning: string | null;
  onDraftChange: (value: string) => void;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSave: () => void;
}

export function PhoneEditor({
  currentPhone,
  phoneDraft,
  isEditing,
  isSaving,
  isDeactivated,
  saveError,
  conflictWarning,
  onDraftChange,
  onStartEdit,
  onCancelEdit,
  onSave,
}: PhoneEditorProps) {
  if (!isEditing) {
    return (
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
        <div>
          <span className="block text-xs font-semibold uppercase tracking-wider text-text-subtle mb-1">
            Phone Number
          </span>
          <p className="text-sm font-medium text-text" data-testid="profile-phone-display">
            {currentPhone ? (
              <span className="font-mono">{currentPhone}</span>
            ) : (
              <span className="text-text-muted italic">Not provided</span>
            )}
          </p>
        </div>

        {!isDeactivated && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onStartEdit}
            className="shrink-0 min-h-[44px] min-w-[44px] self-start sm:self-auto"
            data-testid="edit-phone-button"
            aria-label="Edit phone number"
          >
            <svg
              className="w-4 h-4 mr-1.5 stroke-current"
              viewBox="0 0 24 24"
              fill="none"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
            </svg>
            Edit Phone
          </Button>
        )}
      </div>
    );
  }

  return (
    <div
      className="p-4 bg-surface-muted border border-primary-strong/30 rounded-input space-y-3"
      data-testid="phone-editor-form"
    >
      <div>
        <label
          htmlFor="profile-phone-input"
          className="block text-xs font-semibold uppercase tracking-wider text-text mb-1"
        >
          Phone Number
        </label>
        <Input
          id="profile-phone-input"
          type="text"
          value={phoneDraft}
          onChange={(e) => onDraftChange(e.target.value)}
          placeholder="+91 98765 43210"
          disabled={isSaving}
          error={saveError ?? undefined}
          data-testid="phone-input"
          aria-describedby="phone-helper-text"
          autoFocus
        />
        <p id="phone-helper-text" className="text-xs text-text-muted mt-1">
          Digits, spaces, +, (, ) and - only (6–50 chars). Clear field and save to remove phone.
        </p>
      </div>

      {conflictWarning && (
        <div
          className="p-3 bg-amber-50 border border-amber-200 rounded-input text-xs text-amber-900"
          role="alert"
          data-testid="conflict-warning-alert"
        >
          <div className="flex items-start gap-2">
            <svg
              className="w-4 h-4 text-amber-600 shrink-0 mt-0.5"
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z"
                clipRule="evenodd"
              />
            </svg>
            <div>
              <p className="font-semibold">Version Conflict</p>
              <p>{conflictWarning}</p>
            </div>
          </div>
        </div>
      )}

      {saveError && (
        <div
          className="p-3 bg-rose-50 border border-rose-200 rounded-input text-xs text-rose-800"
          role="alert"
          data-testid="save-error-alert"
        >
          {saveError}
        </div>
      )}

      <div className="flex items-center gap-3 pt-1">
        <Button
          type="button"
          variant="primary"
          size="sm"
          onClick={onSave}
          disabled={isSaving}
          className="min-h-[44px] min-w-[44px]"
          data-testid="save-phone-button"
        >
          {isSaving ? (
            <span className="flex items-center gap-2">
              <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24" fill="none">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              Saving...
            </span>
          ) : (
            'Save Phone'
          )}
        </Button>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onCancelEdit}
          disabled={isSaving}
          className="min-h-[44px] min-w-[44px]"
          data-testid="cancel-phone-button"
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}
