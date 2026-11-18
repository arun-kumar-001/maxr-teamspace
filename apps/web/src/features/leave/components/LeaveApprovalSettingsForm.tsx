import { useEffect, useState } from 'react';
import { Button, Select } from '../../../components/ui';
import { fetchLeaveApprovalSettings, updateLeaveApprovalSettings } from '../api/leave';
import type { LeaveApprovalSettings } from '../types';

export function LeaveApprovalSettingsForm() {
  const [settings, setSettings] = useState<LeaveApprovalSettings | null>(null);
  const [approverRole, setApproverRole] =
    useState<LeaveApprovalSettings['approverRole']>('hr_manager');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setIsLoading(true);
    setError(null);
    fetchLeaveApprovalSettings(controller.signal)
      .then((value) => {
        if (controller.signal.aborted) return;
        setSettings(value);
        setApproverRole(value.approverRole);
      })
      .catch((err: unknown) => {
        if (!controller.signal.aborted)
          setError(err instanceof Error ? err.message : 'Could not load approval settings');
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });
    return () => controller.abort();
  }, [reload]);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!settings || isSaving || isLoading || settings.approverRole === approverRole) return;
    setIsSaving(true);
    setError(null);
    setSaved(false);
    try {
      const updated = await updateLeaveApprovalSettings({
        approverRole,
        version: settings.version,
      });
      setSettings(updated);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save approval settings');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form
      onSubmit={save}
      className="bg-white border border-border/80 rounded-card shadow-xs p-4 sm:p-6 space-y-4"
      aria-label="Leave approval settings"
    >
      <div>
        <h2 className="font-display text-lg font-semibold text-text">Leave approvals</h2>
        <p className="text-sm text-text-muted mt-1">
          HR leave goes to Admin. Changes apply to new requests.
        </p>
      </div>
      {isLoading && (
        <p role="status" className="text-sm text-text-muted">
          Loading approval settings…
        </p>
      )}
      {error && (
        <div role="alert" className="text-sm text-danger space-y-2">
          <p>{error}</p>
          <Button
            type="button"
            variant="outline"
            disabled={isSaving}
            onClick={() => setReload((value) => value + 1)}
          >
            Reload settings
          </Button>
        </div>
      )}
      {settings && (
        <div className="flex flex-col sm:flex-row sm:items-end gap-4">
          <div className="w-full sm:max-w-sm space-y-2">
            <label htmlFor="leave-approver-role" className="block text-sm font-medium text-text">
              Default approver
            </label>
            <Select
              id="leave-approver-role"
              value={approverRole}
              disabled={isLoading || isSaving}
              onChange={(event) => {
                setApproverRole(event.target.value as LeaveApprovalSettings['approverRole']);
                setSaved(false);
              }}
              options={[
                { value: 'hr_manager', label: 'HR Manager' },
                { value: 'team_lead', label: 'Team Lead' },
              ]}
            />
          </div>
          <Button
            type="submit"
            disabled={isLoading || isSaving || settings.approverRole === approverRole}
          >
            {isSaving ? 'Saving…' : 'Save approval settings'}
          </Button>
        </div>
      )}
      {settings?.approverRole === 'team_lead' && (
        <p className="text-sm text-text-muted">
          Requests go to the assigned Team Lead. HR handles requests without an active Team Lead.
        </p>
      )}
      {saved && (
        <p role="status" className="text-sm text-primary-deep">
          Approval settings saved.
        </p>
      )}
    </form>
  );
}
