import React, { useEffect, useState } from 'react';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Modal } from '../../../components/ui/Modal';
import { fetchEmployeeDirectory } from '../../employees/api/employees';
import type { EmployeeDirectoryItem } from '../../employees/types';
import type { ProjectMember } from '../types';

export interface AddMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingMembers: ProjectMember[];
  onAddMember: (employeeId: string) => Promise<unknown>;
}

export function AddMemberModal({
  isOpen,
  onClose,
  existingMembers,
  onAddMember,
}: AddMemberModalProps) {
  const [employees, setEmployees] = useState<EmployeeDirectoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    let mounted = true;
    setSelectedEmployeeId(null);
    setSearch('');
    setError(null);
    setLoading(true);

    const loadEmployees = async () => {
      try {
        const res = await fetchEmployeeDirectory({ pageSize: 100, status: 'active' });
        if (mounted) {
          setEmployees(res.data);
        }
      } catch (err: unknown) {
        if (mounted) {
          setError(
            err instanceof Error ? err.message : 'Failed to fetch employees for member selection.',
          );
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void loadEmployees();

    return () => {
      mounted = false;
    };
  }, [isOpen]);

  const existingMemberIds = new Set(existingMembers.map((m) => m.employeeId));

  const eligibleEmployees = employees
    .filter((emp) => !existingMemberIds.has(emp.id))
    .filter((emp) => {
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      const fullName = `${emp.firstName} ${emp.lastName}`.toLowerCase();
      const code = (emp.employeeCode || '').toLowerCase();
      const dept = (emp.department?.name || '').toLowerCase();
      return fullName.includes(q) || code.includes(q) || dept.includes(q);
    });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmployeeId) {
      setError('Please select an employee to add.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await onAddMember(selectedEmployeeId);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to add employee to project.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Add Project Member"
      maxWidth="md"
      footer={
        <div className="flex items-center justify-end gap-3 w-full">
          <Button variant="outline" onClick={onClose} disabled={submitting} type="button">
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            disabled={!selectedEmployeeId || submitting}
            type="submit"
            data-testid="confirm-add-member-btn"
          >
            {submitting ? 'Adding...' : 'Add Member'}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4 p-1">
        {error && (
          <div
            className="p-3 bg-rose-50 border border-rose-200 text-danger text-sm rounded-lg"
            role="alert"
          >
            {error}
          </div>
        )}

        <div>
          <Input
            type="search"
            placeholder="Search by name, code or department..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            disabled={loading || submitting}
            aria-label="Filter available employees"
          />
        </div>

        <div className="max-h-64 overflow-y-auto border border-border rounded-lg divide-y divide-border bg-surface">
          {loading ? (
            <div className="p-6 text-center text-sm text-text-muted">Loading employees...</div>
          ) : eligibleEmployees.length === 0 ? (
            <div className="p-6 text-center text-sm text-text-muted">
              {search.trim()
                ? 'No matching active employees found.'
                : 'All eligible active employees are already members.'}
            </div>
          ) : (
            eligibleEmployees.map((emp) => {
              const fullName = `${emp.firstName} ${emp.lastName}`.trim();
              const isSelected = selectedEmployeeId === emp.id;

              return (
                <div
                  key={emp.id}
                  onClick={() => setSelectedEmployeeId(emp.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setSelectedEmployeeId(emp.id);
                    }
                  }}
                  tabIndex={0}
                  role="button"
                  aria-pressed={isSelected}
                  className={`flex items-center justify-between p-3 cursor-pointer transition-colors min-h-[44px] ${
                    isSelected
                      ? 'bg-primary-soft text-primary-ink font-medium'
                      : 'hover:bg-surface-muted text-text'
                  }`}
                  data-testid={`select-employee-${emp.id}`}
                >
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">{fullName}</span>
                    <span className="text-xs text-text-subtle">
                      {emp.employeeCode}{' '}
                      {emp.designation?.title ? `· ${emp.designation.title}` : ''}
                      {emp.department?.name ? ` (${emp.department.name})` : ''}
                    </span>
                  </div>

                  <div className="w-5 h-5 rounded-full border flex items-center justify-center shrink-0 border-border">
                    {isSelected && <div className="w-2.5 h-2.5 rounded-full bg-primary-strong" />}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </Modal>
  );
}
