import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import type { Designation } from '../types';

export interface DesignationDeactivateDialogProps {
  isOpen: boolean;
  designation: Designation | null;
  isDeactivating: boolean;
  serverError: string | null;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

export function DesignationDeactivateDialog({
  isOpen,
  designation,
  isDeactivating,
  serverError,
  onClose,
  onConfirm,
}: DesignationDeactivateDialogProps) {
  if (!designation) return null;

  const footer = (
    <>
      <Button
        type="button"
        variant="outline"
        onClick={onClose}
        disabled={isDeactivating}
        className="min-h-[44px]"
        data-testid="designation-deactivate-cancel"
      >
        Cancel
      </Button>
      <Button
        type="button"
        variant="primary"
        onClick={onConfirm}
        disabled={isDeactivating}
        className="min-h-[44px] bg-danger hover:bg-rose-700 text-white"
        data-testid="designation-deactivate-confirm"
      >
        {isDeactivating ? 'Deactivating...' : 'Confirm Deactivation'}
      </Button>
    </>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Deactivate Designation"
      maxWidth="md"
      footer={footer}
    >
      <div className="space-y-4" data-testid="designation-deactivate-dialog">
        {serverError && (
          <div
            className="p-3 bg-rose-50 border border-rose-200 text-danger text-xs rounded-card font-medium"
            role="alert"
            data-testid="designation-deactivate-server-error"
          >
            {serverError}
          </div>
        )}

        <p className="text-xs sm:text-sm text-text leading-relaxed">
          Are you sure you want to deactivate{' '}
          <strong className="text-text font-semibold">{designation.title}</strong> (
          <span className="font-mono">{designation.code}</span>)?
        </p>

        <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded-card">
          <p className="font-semibold mb-1">Important System Rule:</p>
          <p>
            Designations currently assigned to active employees cannot be deactivated. You must
            reassign all active employees to another role first.
          </p>
        </div>
      </div>
    </Modal>
  );
}
