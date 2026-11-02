import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import type { Department } from '../types';

export interface DepartmentDeactivateDialogProps {
  isOpen: boolean;
  department: Department | null;
  isDeactivating: boolean;
  serverError: string | null;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

export function DepartmentDeactivateDialog({
  isOpen,
  department,
  isDeactivating,
  serverError,
  onClose,
  onConfirm,
}: DepartmentDeactivateDialogProps) {
  if (!department) return null;

  const footer = (
    <>
      <Button
        type="button"
        variant="outline"
        onClick={onClose}
        disabled={isDeactivating}
        className="min-h-[44px]"
        data-testid="department-deactivate-cancel"
      >
        Cancel
      </Button>
      <Button
        type="button"
        variant="primary"
        onClick={onConfirm}
        disabled={isDeactivating}
        className="min-h-[44px] bg-danger hover:bg-rose-700 text-white"
        data-testid="department-deactivate-confirm"
      >
        {isDeactivating ? 'Deactivating...' : 'Confirm Deactivation'}
      </Button>
    </>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Deactivate Department"
      maxWidth="md"
      footer={footer}
    >
      <div className="space-y-4" data-testid="department-deactivate-dialog">
        {serverError && (
          <div
            className="p-3 bg-rose-50 border border-rose-200 text-danger text-xs rounded-card font-medium"
            role="alert"
            data-testid="department-deactivate-server-error"
          >
            {serverError}
          </div>
        )}

        <p className="text-xs sm:text-sm text-text leading-relaxed">
          Are you sure you want to deactivate{' '}
          <strong className="text-text font-semibold">{department.name}</strong> (
          <span className="font-mono">{department.code}</span>)?
        </p>

        <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded-card">
          <p className="font-semibold mb-1">Important System Rule:</p>
          <p>
            Departments with active designations or employees cannot be deactivated. You must
            reassign or deactivate all associated records first.
          </p>
        </div>
      </div>
    </Modal>
  );
}
