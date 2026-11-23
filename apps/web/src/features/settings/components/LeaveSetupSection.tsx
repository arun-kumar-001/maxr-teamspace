import { useCallback, useEffect, useState } from 'react';
import { Button } from '../../../components/ui/Button';
import { FormField } from '../../../components/ui/FormField';
import { Input } from '../../../components/ui/Input';
import { createLeavePolicy, fetchLeavePolicies, updateLeavePolicy } from '../../leave/api/leave';
import { LeavePolicyFormModal } from '../../leave/components/LeavePolicyFormModal';
import type {
  CreateLeavePolicyInput,
  LeavePolicy,
  UpdateLeavePolicyInput,
} from '../../leave/types';
import {
  type SettingsDraft,
  type PermissionPolicyConfig,
  DEFAULT_PERMISSION_POLICY,
} from '../hooks/useSettings';

interface LeaveSetupSectionProps {
  draft: SettingsDraft;
  onUpdate: (updates: Partial<SettingsDraft>) => void;
  disabled?: boolean;
}

function describePolicy(policy: LeavePolicy): string {
  if (!policy.hasBalance) return 'No yearly balance';
  const carry = policy.carryForwardMax > 0 ? `, carry forward up to ${policy.carryForwardMax}` : '';
  return `${policy.annualDays} days a year${carry}`;
}

/**
 * Leave types live on the server: what is created here is exactly what employees see under
 * My Leave & Balances and can apply for. Nothing is kept in the browser.
 */
export function LeaveSetupSection({ draft, onUpdate, disabled = false }: LeaveSetupSectionProps) {
  const permissionPolicy: PermissionPolicyConfig =
    draft.permissionPolicy ?? DEFAULT_PERMISSION_POLICY;

  const [policies, setPolicies] = useState<LeavePolicy[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editing, setEditing] = useState<LeavePolicy | null>(null);
  const [withoutBalance, setWithoutBalance] = useState(false);

  const load = useCallback(async () => {
    try {
      setIsLoading(true);
      setLoadError(null);
      setPolicies(await fetchLeavePolicies());
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Could not load leave types');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openCreate = (noBalance = false) => {
    setEditing(null);
    setWithoutBalance(noBalance);
    setIsFormOpen(true);
  };

  const openEdit = (policy: LeavePolicy) => {
    setEditing(policy);
    setWithoutBalance(false);
    setIsFormOpen(true);
  };

  const handleSubmit = async (
    data: CreateLeavePolicyInput | (UpdateLeavePolicyInput & { id: string }),
  ) => {
    if ('id' in data) {
      const { id, ...changes } = data;
      await updateLeavePolicy(id, changes);
    } else {
      await createLeavePolicy(data);
    }
    setIsFormOpen(false);
    await load();
  };

  const handleToggleActive = async (policy: LeavePolicy) => {
    try {
      setActionError(null);
      await updateLeavePolicy(policy.id, { isActive: !policy.isActive, version: policy.version });
      await load();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not update the leave type');
    }
  };

  const updatePermission = (changes: Partial<PermissionPolicyConfig>) => {
    onUpdate({ permissionPolicy: { ...permissionPolicy, ...changes } });
  };

  return (
    <div
      className="p-5 sm:p-6 bg-surface border border-border rounded-card shadow-card space-y-6"
      data-testid="leave-setup-section"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/80 pb-4">
        <div>
          <h3 className="text-lg font-bold text-primary-deep font-display tracking-tight">
            Leave Types &amp; Yearly Allowance
          </h3>
          <p className="text-xs text-text-muted mt-1 max-w-prose">
            Each leave type you create here appears in everyone&apos;s My Leave &amp; Balances and
            in the apply-for-leave form.
          </p>
        </div>
        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => openCreate(true)}
            disabled={disabled}
            data-testid="create-permission-btn"
          >
            Create Permission
          </Button>
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={() => openCreate()}
            disabled={disabled}
            data-testid="create-leave-type-btn"
          >
            Create Leave Type
          </Button>
        </div>
      </div>

      {actionError && (
        <p role="alert" className="text-sm text-danger">
          {actionError}
        </p>
      )}

      {isLoading ? (
        <p role="status" className="text-sm text-text-muted">
          Loading leave types…
        </p>
      ) : loadError ? (
        <div role="alert" className="space-y-2" data-testid="leave-types-error">
          <p className="text-sm text-danger">{loadError}</p>
          <Button type="button" variant="outline" size="sm" onClick={() => void load()}>
            Try again
          </Button>
        </div>
      ) : policies.length === 0 ? (
        <div
          className="p-8 rounded-2xl bg-surface-muted/40 border border-dashed border-border-strong text-center space-y-2"
          data-testid="leave-types-empty"
        >
          <h4 className="text-base font-bold text-text font-display">No Leave Types Configured</h4>
          <p className="text-xs text-text-muted max-w-md mx-auto">
            Create the leave types your company offers, for example Casual Leave or Sick Leave.
            Balances are then added for every active employee automatically.
          </p>
        </div>
      ) : (
        <ul
          className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-3"
          data-testid="leave-types-list"
        >
          {policies.map((policy) => (
            <li
              key={policy.id}
              className="p-4 rounded-tile border border-border bg-surface-raised flex items-start justify-between gap-3"
              data-testid={`leave-type-${policy.code}`}
            >
              <div className="min-w-0">
                <p className="font-bold text-sm text-text truncate">
                  {policy.name}{' '}
                  <span className="font-mono text-xs text-text-muted">({policy.code})</span>
                </p>
                <p className="text-xs text-text-muted mt-0.5">{describePolicy(policy)}</p>
                <p className="text-xs mt-1 font-semibold text-text-subtle">
                  {policy.isActive ? 'Active' : 'Inactive'}
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 shrink-0">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => openEdit(policy)}
                  disabled={disabled}
                >
                  Edit
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => void handleToggleActive(policy)}
                  disabled={disabled}
                >
                  {policy.isActive ? 'Deactivate' : 'Activate'}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="border-t border-border/80 pt-5 space-y-3" data-testid="permission-policy">
        <h4 className="text-base font-bold text-text font-display">Short Permission</h4>
        <label className="flex items-center gap-2 text-sm text-text min-h-[44px]">
          <input
            type="checkbox"
            checked={permissionPolicy.enabled}
            onChange={(e) => updatePermission({ enabled: e.target.checked })}
            disabled={disabled}
          />
          Allow short permissions
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-xl">
          <FormField label="Permissions per month" htmlFor="perm-per-month">
            <Input
              id="perm-per-month"
              type="number"
              min={1}
              value={permissionPolicy.maxPermissionsPerMonth}
              disabled={disabled || !permissionPolicy.enabled}
              onChange={(e) =>
                updatePermission({
                  maxPermissionsPerMonth: Math.max(1, Number(e.target.value) || 1),
                })
              }
            />
          </FormField>
          <FormField label="Hours per permission" htmlFor="perm-hours">
            <Input
              id="perm-hours"
              type="number"
              min={0.5}
              step={0.5}
              value={permissionPolicy.maxHoursPerPermission}
              disabled={disabled || !permissionPolicy.enabled}
              onChange={(e) =>
                updatePermission({
                  maxHoursPerPermission: Math.max(0.5, Number(e.target.value) || 0.5),
                })
              }
            />
          </FormField>
        </div>
      </div>

      <LeavePolicyFormModal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        policy={editing}
        withoutBalance={withoutBalance}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
