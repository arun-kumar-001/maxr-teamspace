import React, { useEffect, useState } from 'react';
import { Button } from '../../../components/ui/Button';
import { Modal } from '../../../components/ui/Modal';
import { Select } from '../../../components/ui/Select';
import { fetchEligibleManagers } from '../api/creation';
import { changeEmployeeManager, HierarchyApiError } from '../api/hierarchy';
import type { ManagerChange, ManagerOption } from '../types';

export interface ChangeManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  employee: {
    id: string;
    name: string;
    employeeCode: string;
    version: number;
    manager?: { id: string; name?: string; employeeCode?: string } | null;
  } | null;
  onSuccess: (result: ManagerChange) => void;
}

export function ChangeManagerModal({
  isOpen,
  onClose,
  employee,
  onSuccess,
}: ChangeManagerModalProps) {
  const [managers, setManagers] = useState<ManagerOption[]>([]);
  const [loadingManagers, setLoadingManagers] = useState(false);
  const [managerChoice, setManagerChoice] = useState<'assign' | 'none'>('assign');
  const [selectedManagerId, setSelectedManagerId] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [conflictError, setConflictError] = useState(false);
  const [cycleError, setCycleError] = useState(false);

  useEffect(() => {
    if (!isOpen || !employee) return;

    // Initialize state from current manager
    if (employee.manager?.id) {
      setManagerChoice('assign');
      setSelectedManagerId(employee.manager.id);
    } else {
      setManagerChoice('none');
      setSelectedManagerId('');
    }

    setErrorMessage(null);
    setConflictError(false);
    setCycleError(false);

    // Fetch eligible managers
    let mounted = true;
    setLoadingManagers(true);
    fetchEligibleManagers()
      .then((data) => {
        if (!mounted) return;
        // Filter out the employee themselves
        const filtered = data.filter((m) => m.id !== employee.id);
        setManagers(filtered);
      })
      .catch(() => {
        if (!mounted) return;
        setManagers([]);
      })
      .finally(() => {
        if (mounted) setLoadingManagers(false);
      });

    return () => {
      mounted = false;
    };
  }, [isOpen, employee]);

  if (!employee) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setConflictError(false);
    setCycleError(false);

    const targetManagerId = managerChoice === 'assign' ? selectedManagerId || null : null;

    if (managerChoice === 'assign' && !targetManagerId) {
      setErrorMessage('Please select a manager or choose "No Manager".');
      return;
    }

    setSubmitting(true);
    try {
      const result = await changeEmployeeManager(employee.id, {
        version: employee.version,
        managerId: targetManagerId,
      });
      onSuccess(result);
      onClose();
    } catch (err) {
      if (err instanceof HierarchyApiError) {
        if (err.isConflict) {
          setConflictError(true);
          setErrorMessage(
            'This employee was modified by someone else. Please reload and try again.',
          );
        } else if (err.isCycleOrUnprocessable) {
          setCycleError(true);
          setErrorMessage(
            err.message ||
              'A reporting cycle was detected: An employee cannot report to themselves or anyone in their reporting line.',
          );
        } else {
          setErrorMessage(err.message);
        }
      } else if (err instanceof Error) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage('An unexpected error occurred while updating the reporting manager.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const managerOptions = [
    { value: '', label: '-- Select a reporting manager --' },
    ...managers.map((m) => ({
      value: m.id,
      label: `${m.name} (${m.employeeCode})`,
    })),
  ];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Change Reporting Manager" maxWidth="md">
      <form onSubmit={handleSubmit} className="space-y-5" data-testid="change-manager-form">
        <p className="text-xs text-text-muted -mt-2">
          Update reporting hierarchy for {employee.name} ({employee.employeeCode}).
        </p>
        {conflictError && (
          <div
            role="alert"
            className="p-3 bg-danger/10 border border-danger/30 rounded-control text-sm text-danger flex items-start justify-between gap-3"
            data-testid="conflict-alert"
          >
            <div>
              <p className="font-semibold">Concurrent Modification Conflict</p>
              <p className="text-xs mt-1">
                Another user updated this employee while you were viewing it. Please reload the
                latest employee data.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                onClose();
                window.location.reload();
              }}
              className="text-xs shrink-0"
            >
              Reload Page
            </Button>
          </div>
        )}

        {cycleError && (
          <div
            role="alert"
            className="p-3 bg-danger/10 border border-danger/30 rounded-control text-sm text-danger"
            data-testid="cycle-alert"
          >
            <p className="font-semibold">Reporting Hierarchy Cycle Detected</p>
            <p className="text-xs mt-1">{errorMessage}</p>
          </div>
        )}

        {errorMessage && !conflictError && !cycleError && (
          <div
            role="alert"
            className="p-3 bg-danger/10 border border-danger/30 rounded-control text-sm text-danger"
            data-testid="error-alert"
          >
            {errorMessage}
          </div>
        )}

        {/* Current status info */}
        <div className="bg-surface-muted p-3.5 rounded-tile border border-border text-sm space-y-1">
          <div className="flex justify-between items-center text-xs text-text-muted">
            <span>Target Employee:</span>
            <span className="font-mono text-text font-medium">{employee.employeeCode}</span>
          </div>
          <div className="font-semibold text-text">{employee.name}</div>
          <div className="text-xs text-text-subtle pt-1 border-t border-border mt-2">
            Current Manager:{' '}
            <span className="text-text font-medium">
              {employee.manager
                ? `${employee.manager.name || ''}${
                    employee.manager.employeeCode ? ` (${employee.manager.employeeCode})` : ''
                  }`.trim() || 'None'
                : 'None (Top Level Root)'}
            </span>
          </div>
        </div>

        {/* Radio selector for action */}
        <div className="space-y-3">
          <label className="text-sm font-semibold text-text block">
            Reporting Structure Setting
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label
              className={`flex items-start gap-3 p-3 rounded-control border cursor-pointer transition-colors ${
                managerChoice === 'assign'
                  ? 'border-primary-deep bg-primary-soft/40 ring-1 ring-primary-deep'
                  : 'border-border bg-surface hover:bg-surface-muted'
              }`}
            >
              <input
                type="radio"
                name="managerChoice"
                value="assign"
                checked={managerChoice === 'assign'}
                onChange={() => setManagerChoice('assign')}
                className="mt-1 text-primary-deep focus:ring-primary-strong"
                data-testid="radio-assign-manager"
              />
              <div className="text-xs">
                <span className="font-semibold text-text block">Assign / Change Manager</span>
                <span className="text-text-muted">Reports to a manager in the organization</span>
              </div>
            </label>

            <label
              className={`flex items-start gap-3 p-3 rounded-control border cursor-pointer transition-colors ${
                managerChoice === 'none'
                  ? 'border-primary-deep bg-primary-soft/40 ring-1 ring-primary-deep'
                  : 'border-border bg-surface hover:bg-surface-muted'
              }`}
            >
              <input
                type="radio"
                name="managerChoice"
                value="none"
                checked={managerChoice === 'none'}
                onChange={() => setManagerChoice('none')}
                className="mt-1 text-primary-deep focus:ring-primary-strong"
                data-testid="radio-remove-manager"
              />
              <div className="text-xs">
                <span className="font-semibold text-text block">No Manager (Org Root)</span>
                <span className="text-text-muted">Reports to no one (executive / top-level)</span>
              </div>
            </label>
          </div>
        </div>

        {/* Manager Select Field */}
        {managerChoice === 'assign' && (
          <div className="space-y-1.5" data-testid="manager-select-container">
            <label htmlFor="manager-select" className="text-sm font-medium text-text block">
              Select New Manager <span className="text-danger">*</span>
            </label>
            <Select
              id="manager-select"
              options={managerOptions}
              value={selectedManagerId}
              onChange={(e) => {
                const val = typeof e === 'string' ? e : (e?.target?.value ?? '');
                setSelectedManagerId(val);
                setErrorMessage(null);
              }}
              disabled={loadingManagers || submitting}
              className="w-full min-h-[44px]"
            />
            {loadingManagers && (
              <p className="text-xs text-text-subtle">Loading active employees...</p>
            )}
            <p className="text-xs text-text-muted">
              Note: Self-reporting and cycles (subordinates reporting to their reports) will be
              prevented.
            </p>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 pt-3 border-t border-border">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={submitting}
            className="w-full sm:w-auto min-h-[44px]"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={
              submitting || (managerChoice === 'assign' && (loadingManagers || !selectedManagerId))
            }
            className="w-full sm:w-auto min-h-[44px]"
            data-testid="submit-change-manager-btn"
          >
            {submitting ? 'Updating Hierarchy...' : 'Save Manager'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
