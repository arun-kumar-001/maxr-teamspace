import { useCallback, useEffect, useState } from 'react';
import { Button } from '../../../components/ui/Button';
import { defaultShiftsApi, ShiftsApiClient } from '../api/shiftsApi';
import { AttendancePolicy, Shift } from '../types/shifts';

export interface ShiftsManagementProps {
  api?: ShiftsApiClient;
}

export function ShiftsManagement({ api = defaultShiftsApi }: ShiftsManagementProps) {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [, setPolicy] = useState<AttendancePolicy | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'shifts' | 'policy'>('shifts');

  // New Shift Modal / Form State
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [name, setName] = useState<string>('');
  const [code, setCode] = useState<string>('');
  const [startTime, setStartTime] = useState<string>('09:00:00');
  const [endTime, setEndTime] = useState<string>('17:30:00');
  const [breakMinutes, setBreakMinutes] = useState<number>(60);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Policy Form State
  const [gracePeriod, setGracePeriod] = useState<number>(15);
  const [halfDayThreshold, setHalfDayThreshold] = useState<number>(240);
  const [fullDayThreshold, setFullDayThreshold] = useState<number>(480);
  const [policySubmitting, setPolicySubmitting] = useState<boolean>(false);
  const [policySuccess, setPolicySuccess] = useState<boolean>(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [shiftsRes, policyRes] = await Promise.all([api.listShifts(), api.getPolicy()]);
      setShifts(shiftsRes.data);
      setPolicy(policyRes);
      setGracePeriod(policyRes.gracePeriodMinutes);
      setHalfDayThreshold(policyRes.halfDayThresholdMinutes);
      setFullDayThreshold(policyRes.fullDayThresholdMinutes);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load shifts and policy data');
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCreateShift = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setFormError(null);
    try {
      await api.createShift({
        name: name.trim(),
        code: code.trim(),
        startTime,
        endTime,
        breakMinutes: Number(breakMinutes),
      });
      setShowCreateModal(false);
      setName('');
      setCode('');
      await loadData();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to create shift');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdatePolicy = async (e: React.FormEvent) => {
    e.preventDefault();
    setPolicySubmitting(true);
    setPolicySuccess(false);
    setError(null);
    try {
      const updated = await api.updatePolicy({
        gracePeriodMinutes: Number(gracePeriod),
        halfDayThresholdMinutes: Number(halfDayThreshold),
        fullDayThresholdMinutes: Number(fullDayThreshold),
      });
      setPolicy(updated);
      setPolicySuccess(true);
      setTimeout(() => setPolicySuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update attendance policy');
    } finally {
      setPolicySubmitting(false);
    }
  };

  return (
    <div className="w-full space-y-6">
      {/* Header and Tab Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-4">
        <div>
          <h2 className="text-xl font-bold text-text">Shifts & Policies</h2>
          <p className="text-sm text-text-muted">
            Configure company working shifts, daily roster hours, and attendance rules.
          </p>
        </div>

        <div className="flex items-center gap-2" role="tablist" aria-label="Shifts views">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'shifts'}
            onClick={() => setActiveTab('shifts')}
            className={`min-h-[44px] px-4 py-2 text-xs font-semibold rounded-input transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 ${
              activeTab === 'shifts'
                ? 'bg-teal-500 text-white'
                : 'bg-surface border border-border text-text hover:bg-surface-muted'
            }`}
          >
            Work Shifts
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'policy'}
            onClick={() => setActiveTab('policy')}
            className={`min-h-[44px] px-4 py-2 text-xs font-semibold rounded-input transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 ${
              activeTab === 'policy'
                ? 'bg-teal-500 text-white'
                : 'bg-surface border border-border text-text hover:bg-surface-muted'
            }`}
          >
            Attendance Rules
          </button>
        </div>
      </div>

      {loading ? (
        <div className="p-8 text-center text-text-muted animate-pulse" role="status">
          Loading shifts and attendance policies...
        </div>
      ) : error ? (
        <div
          className="p-4 rounded-card bg-red-50 border border-danger text-danger text-sm"
          role="alert"
        >
          {error}
        </div>
      ) : activeTab === 'shifts' ? (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-base font-bold text-text">Configured Shifts</h3>
            <Button variant="primary" size="sm" onClick={() => setShowCreateModal(true)}>
              + Create New Shift
            </Button>
          </div>

          {/* Mobile Shift Cards */}
          <div className="grid grid-cols-1 gap-3 sm:hidden" role="list" aria-label="Shifts list">
            {shifts.map((s) => (
              <div
                key={s.id}
                role="listitem"
                className="p-4 rounded-card bg-surface border border-border space-y-2 shadow-xs"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-semibold text-text text-sm">{s.name}</h4>
                    <span className="text-xs font-mono text-text-muted">{s.code}</span>
                  </div>
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${
                      s.isActive
                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                        : 'bg-slate-50 text-slate-600 border border-slate-200'
                    }`}
                  >
                    {s.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>

                <div className="text-xs text-text-muted grid grid-cols-2 gap-2 pt-1 border-t border-border">
                  <div>
                    <span className="font-medium text-text">Start:</span> {s.startTime}
                  </div>
                  <div>
                    <span className="font-medium text-text">End:</span> {s.endTime}
                  </div>
                  <div className="col-span-2">
                    <span className="font-medium text-text">Break:</span> {s.breakMinutes} mins
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop Shifts Table */}
          <div className="hidden sm:block overflow-x-auto rounded-card border border-border bg-surface">
            <table className="w-full text-left text-sm" aria-label="Shifts Table">
              <thead className="bg-surface-muted text-xs font-semibold text-text uppercase border-b border-border">
                <tr>
                  <th scope="col" className="px-4 py-3">
                    Shift Name
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Code
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Hours
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Break Duration
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {shifts.map((s) => (
                  <tr key={s.id} className="hover:bg-surface-muted/50 transition-colors">
                    <td className="px-4 py-3.5 font-medium text-text">{s.name}</td>
                    <td className="px-4 py-3.5 text-xs font-mono text-text-muted">{s.code}</td>
                    <td className="px-4 py-3.5 text-xs text-text-muted">
                      {s.startTime} — {s.endTime}
                    </td>
                    <td className="px-4 py-3.5 text-xs text-text-muted">{s.breakMinutes} mins</td>
                    <td className="px-4 py-3.5">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${
                          s.isActive
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                            : 'bg-slate-50 text-slate-600 border border-slate-200'
                        }`}
                      >
                        {s.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Attendance Policy Tab */
        <div className="max-w-xl rounded-card bg-surface border border-border p-6 space-y-6">
          <div>
            <h3 className="text-base font-bold text-text">Company Attendance Policy</h3>
            <p className="text-xs text-text-muted mt-0.5">
              Rules governing tardiness grace periods and half-day vs full-day recognition.
            </p>
          </div>

          {policySuccess && (
            <div
              className="p-3 rounded-input bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs"
              role="status"
            >
              Attendance policy successfully updated!
            </div>
          )}

          <form onSubmit={handleUpdatePolicy} className="space-y-4">
            <div>
              <label
                htmlFor="grace-period-input"
                className="block text-xs font-semibold text-text mb-1"
              >
                Grace Period (Minutes)
              </label>
              <input
                id="grace-period-input"
                type="number"
                min={0}
                max={120}
                value={gracePeriod}
                onChange={(e) => setGracePeriod(Number(e.target.value))}
                className="w-full rounded-input border border-border bg-surface px-3 py-2 text-sm text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 min-h-[44px]"
              />
              <span className="text-xs text-text-muted">
                Check-ins within this buffer after shift start are marked PRESENT rather than LATE.
              </span>
            </div>

            <div>
              <label
                htmlFor="half-day-threshold-input"
                className="block text-xs font-semibold text-text mb-1"
              >
                Half-Day Minimum Threshold (Minutes)
              </label>
              <input
                id="half-day-threshold-input"
                type="number"
                min={60}
                max={720}
                value={halfDayThreshold}
                onChange={(e) => setHalfDayThreshold(Number(e.target.value))}
                className="w-full rounded-input border border-border bg-surface px-3 py-2 text-sm text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 min-h-[44px]"
              />
              <span className="text-xs text-text-muted">
                Minimum total worked minutes required to qualify for half-day attendance (typically
                240m = 4h).
              </span>
            </div>

            <div>
              <label
                htmlFor="full-day-threshold-input"
                className="block text-xs font-semibold text-text mb-1"
              >
                Full-Day Minimum Threshold (Minutes)
              </label>
              <input
                id="full-day-threshold-input"
                type="number"
                min={120}
                max={1440}
                value={fullDayThreshold}
                onChange={(e) => setFullDayThreshold(Number(e.target.value))}
                className="w-full rounded-input border border-border bg-surface px-3 py-2 text-sm text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 min-h-[44px]"
              />
              <span className="text-xs text-text-muted">
                Minimum total worked minutes required for full workday attendance (typically 480m =
                8h).
              </span>
            </div>

            <div className="pt-2">
              <Button
                type="submit"
                variant="primary"
                size="md"
                className="w-full min-h-[44px]"
                isLoading={policySubmitting}
              >
                Save Attendance Policy
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Create Shift Modal */}
      {showCreateModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-shift-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/60 backdrop-blur-xs"
        >
          <div className="w-full max-w-md rounded-card bg-surface border border-border p-6 shadow-xl space-y-4">
            <h3 id="create-shift-title" className="text-lg font-bold text-text">
              Create New Shift
            </h3>

            {formError && (
              <div
                className="p-3 rounded-input bg-red-50 border border-danger text-danger text-xs"
                role="alert"
              >
                {formError}
              </div>
            )}

            <form onSubmit={handleCreateShift} className="space-y-3">
              <div>
                <label htmlFor="shift-name" className="block text-xs font-semibold text-text mb-1">
                  Shift Name
                </label>
                <input
                  id="shift-name"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Afternoon Shift"
                  className="w-full rounded-input border border-border bg-surface px-3 py-2 text-sm text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 min-h-[44px]"
                />
              </div>

              <div>
                <label htmlFor="shift-code" className="block text-xs font-semibold text-text mb-1">
                  Shift Code
                </label>
                <input
                  id="shift-code"
                  type="text"
                  required
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="e.g. AFT-01"
                  className="w-full rounded-input border border-border bg-surface px-3 py-2 text-sm text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 min-h-[44px]"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label
                    htmlFor="shift-start"
                    className="block text-xs font-semibold text-text mb-1"
                  >
                    Start Time
                  </label>
                  <input
                    id="shift-start"
                    type="time"
                    step="1"
                    required
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full rounded-input border border-border bg-surface px-3 py-2 text-sm text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 min-h-[44px]"
                  />
                </div>

                <div>
                  <label htmlFor="shift-end" className="block text-xs font-semibold text-text mb-1">
                    End Time
                  </label>
                  <input
                    id="shift-end"
                    type="time"
                    step="1"
                    required
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="w-full rounded-input border border-border bg-surface px-3 py-2 text-sm text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 min-h-[44px]"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="shift-break" className="block text-xs font-semibold text-text mb-1">
                  Break Duration (Minutes)
                </label>
                <input
                  id="shift-break"
                  type="number"
                  min={0}
                  max={480}
                  value={breakMinutes}
                  onChange={(e) => setBreakMinutes(Number(e.target.value))}
                  className="w-full rounded-input border border-border bg-surface px-3 py-2 text-sm text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 min-h-[44px]"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="md"
                  disabled={submitting}
                  onClick={() => setShowCreateModal(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" variant="primary" size="md" isLoading={submitting}>
                  Create Shift
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
