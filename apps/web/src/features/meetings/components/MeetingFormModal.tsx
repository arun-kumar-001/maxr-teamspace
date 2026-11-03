import { useEffect, useState } from 'react';
import { Button } from '../../../components/ui/Button';
import { FormField } from '../../../components/ui/FormField';
import { Input } from '../../../components/ui/Input';
import { Modal } from '../../../components/ui/Modal';
import { fetchEmployeeDirectory } from '../../employees/api/employees';
import type { EmployeeDirectoryItem } from '../../employees/types';
import {
  MAX_AGENDA_CHARS,
  MAX_INVITEES,
  type Meeting,
  type MeetingWithOverlaps,
  type Overlap,
  type ScheduleMeetingInput,
  type UpdateMeetingInput,
} from '../types';

export interface MeetingFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'create' | 'edit';
  initialMeeting?: Meeting | null;
  onSubmitCreate?: (input: ScheduleMeetingInput) => Promise<MeetingWithOverlaps>;
  onSubmitEdit?: (id: string, input: UpdateMeetingInput) => Promise<MeetingWithOverlaps>;
}

export function MeetingFormModal({
  isOpen,
  onClose,
  mode,
  initialMeeting,
  onSubmitCreate,
  onSubmitEdit,
}: MeetingFormModalProps) {
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [agenda, setAgenda] = useState('');
  const [selectedInviteeIds, setSelectedInviteeIds] = useState<string[]>([]);

  const [employees, setEmployees] = useState<EmployeeDirectoryItem[]>([]);
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [overlapWarnings, setOverlapWarnings] = useState<Overlap[]>([]);

  useEffect(() => {
    if (!isOpen) return;

    setErrors({});
    setServerError(null);
    setOverlapWarnings([]);

    if (mode === 'edit' && initialMeeting) {
      setTitle(initialMeeting.title);
      setAgenda(initialMeeting.agenda ?? '');

      const s = new Date(initialMeeting.startsAt);
      const e = new Date(initialMeeting.endsAt);

      setDate(
        `${s.getFullYear()}-${String(s.getMonth() + 1).padStart(2, '0')}-${String(
          s.getDate(),
        ).padStart(2, '0')}`,
      );
      setStartTime(
        `${String(s.getHours()).padStart(2, '0')}:${String(s.getMinutes()).padStart(2, '0')}`,
      );
      setEndTime(
        `${String(e.getHours()).padStart(2, '0')}:${String(e.getMinutes()).padStart(2, '0')}`,
      );
      setSelectedInviteeIds(initialMeeting.attendees.map((a) => a.employeeId));
    } else {
      // Default to tomorrow 10:00 - 11:00
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      setDate(
        `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(
          tomorrow.getDate(),
        ).padStart(2, '0')}`,
      );
      setStartTime('10:00');
      setEndTime('11:00');
      setTitle('');
      setAgenda('');
      setSelectedInviteeIds([]);
    }

    setLoadingEmployees(true);
    void fetchEmployeeDirectory({ status: 'active', pageSize: 100 })
      .then((res) => setEmployees(res.data))
      .catch(() => setEmployees([]))
      .finally(() => setLoadingEmployees(false));
  }, [isOpen, mode, initialMeeting]);

  const toggleInvitee = (id: string) => {
    if (selectedInviteeIds.includes(id)) {
      setSelectedInviteeIds((prev) => prev.filter((i) => i !== id));
    } else {
      if (selectedInviteeIds.length >= MAX_INVITEES) {
        setErrors((prev) => ({
          ...prev,
          invitees: `A meeting can have at most ${MAX_INVITEES} invitees`,
        }));
        return;
      }
      setSelectedInviteeIds((prev) => [...prev, id]);
    }
  };

  const validate = (): boolean => {
    const errs: Record<string, string> = {};

    if (!title.trim()) {
      errs.title = 'Title is required';
    } else if (title.trim().length > 200) {
      errs.title = 'Title must be 200 characters or less';
    }

    if (!date) {
      errs.date = 'Date is required';
    }

    if (!startTime) {
      errs.startTime = 'Start time is required';
    }

    if (!endTime) {
      errs.endTime = 'End time is required';
    }

    if (agenda && agenda.length > MAX_AGENDA_CHARS) {
      errs.agenda = `Agenda must be ${MAX_AGENDA_CHARS} characters or less`;
    }

    if (date && startTime && endTime) {
      const startsAt = new Date(`${date}T${startTime}:00`);
      const endsAt = new Date(`${date}T${endTime}:00`);

      if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
        errs.date = 'Invalid date or time format';
      } else {
        if (endsAt <= startsAt) {
          errs.endTime = 'End time must be after start time';
        }

        const durationMinutes = (endsAt.getTime() - startsAt.getTime()) / (60 * 1000);
        if (durationMinutes > 24 * 60) {
          errs.endTime = 'A meeting can last at most 24 hours';
        }

        if (mode === 'create' && startsAt.getTime() <= Date.now()) {
          errs.startTime = 'Meeting must start in the future';
        }
      }
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    const startsAt = new Date(`${date}T${startTime}:00`).toISOString();
    const endsAt = new Date(`${date}T${endTime}:00`).toISOString();

    setSubmitting(true);
    setServerError(null);

    try {
      if (mode === 'create') {
        if (!onSubmitCreate) return;
        const result = await onSubmitCreate({
          title: title.trim(),
          agenda: agenda.trim() || undefined,
          startsAt,
          endsAt,
          inviteeIds: selectedInviteeIds,
        });

        if (result?.overlaps && result.overlaps.length > 0) {
          setOverlapWarnings(result.overlaps);
          // Don't close immediately if there are overlap warnings, so the user sees the notice
        } else {
          onClose();
        }
      } else {
        if (!onSubmitEdit || !initialMeeting) return;
        const result = await onSubmitEdit(initialMeeting.id, {
          title: title.trim(),
          agenda: agenda.trim() || null,
          startsAt,
          endsAt,
          inviteeIds: selectedInviteeIds,
          version: initialMeeting.version,
        });

        if (result?.overlaps && result.overlaps.length > 0) {
          setOverlapWarnings(result.overlaps);
        } else {
          onClose();
        }
      }
    } catch (err: unknown) {
      setServerError(err instanceof Error ? err.message : 'Failed to save meeting.');
    } finally {
      setSubmitting(false);
    }
  };

  const getEmployeeName = (id: string): string => {
    const found = employees.find((e) => e.id === id);
    return found ? `${found.firstName} ${found.lastName}` : id;
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={mode === 'create' ? 'Schedule Meeting' : 'Edit Meeting'}
      maxWidth="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4" data-testid="meeting-form">
        {serverError && (
          <div
            className="p-3 bg-negative-soft border border-border text-danger text-sm rounded-tile"
            role="alert"
          >
            {serverError}
          </div>
        )}

        {overlapWarnings.length > 0 && (
          <div
            className="p-3.5 bg-tile-yellow border border-border rounded-tile text-sm space-y-1.5"
            data-testid="overlap-warning-banner"
          >
            <div className="font-semibold text-warning">
              Notice: Scheduled with attendee overlap(s)
            </div>
            <p className="text-xs text-text">
              The following invited team members have an overlapping meeting during this time:
            </p>
            <ul className="text-xs list-disc list-inside space-y-0.5 text-text-muted">
              {overlapWarnings.map((ov, idx) => (
                <li key={`${ov.employeeId}-${idx}`}>
                  <span className="font-medium text-text">{getEmployeeName(ov.employeeId)}</span>
                </li>
              ))}
            </ul>
            <div className="pt-2 flex justify-end">
              <Button type="button" variant="primary" size="sm" onClick={onClose}>
                Got it, close
              </Button>
            </div>
          </div>
        )}

        {/* Title */}
        <FormField label="Meeting Title" required error={errors.title}>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Sprint Planning & Retrospective"
            maxLength={200}
            data-testid="meeting-title-input"
          />
        </FormField>

        {/* Date and Time Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <FormField label="Date" required error={errors.date}>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              data-testid="meeting-date-input"
            />
          </FormField>

          <FormField label="Start Time" required error={errors.startTime}>
            <Input
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              data-testid="meeting-start-time-input"
            />
          </FormField>

          <FormField label="End Time" required error={errors.endTime}>
            <Input
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              data-testid="meeting-end-time-input"
            />
          </FormField>
        </div>

        {/* Agenda */}
        <FormField
          label="Agenda"
          helperText={`Optional · Up to ${MAX_AGENDA_CHARS} characters`}
          error={errors.agenda}
        >
          <textarea
            value={agenda}
            onChange={(e) => setAgenda(e.target.value)}
            placeholder="Key discussion points, goals, and links..."
            rows={3}
            maxLength={MAX_AGENDA_CHARS}
            className="w-full px-3 py-2 text-sm text-text bg-surface border border-border rounded-tile focus:outline-none focus:border-primary-strong"
            data-testid="meeting-agenda-input"
          />
        </FormField>

        {/* Invitees Multi-Select */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-text uppercase tracking-wider">
              Invite Attendees ({selectedInviteeIds.length} / {MAX_INVITEES})
            </label>
            {selectedInviteeIds.length > 0 && (
              <button
                type="button"
                onClick={() => setSelectedInviteeIds([])}
                className="text-xs text-primary-ink hover:underline"
              >
                Clear all
              </button>
            )}
          </div>

          {errors.invitees && <p className="text-xs text-danger">{errors.invitees}</p>}

          {/* Selected chips */}
          {selectedInviteeIds.length > 0 && (
            <div className="flex flex-wrap gap-1.5 p-2 bg-surface-muted rounded-tile border border-border max-h-28 overflow-y-auto">
              {selectedInviteeIds.map((id) => (
                <span
                  key={id}
                  className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-surface border border-border text-text"
                >
                  <span>{getEmployeeName(id)}</span>
                  <button
                    type="button"
                    onClick={() => toggleInvitee(id)}
                    className="text-text-muted hover:text-danger ml-0.5 focus:outline-none"
                    aria-label={`Remove ${getEmployeeName(id)}`}
                  >
                    &times;
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* Employee list picker */}
          <div className="border border-border rounded-tile max-h-40 overflow-y-auto bg-surface divide-y divide-border">
            {loadingEmployees ? (
              <div className="p-3 text-xs text-text-muted text-center">Loading team members...</div>
            ) : employees.length === 0 ? (
              <div className="p-3 text-xs text-text-muted text-center">No active team members.</div>
            ) : (
              employees.map((emp) => {
                const isSelected = selectedInviteeIds.includes(emp.id);
                return (
                  <button
                    key={emp.id}
                    type="button"
                    onClick={() => toggleInvitee(emp.id)}
                    className={`w-full px-3 py-2 text-left flex items-center justify-between text-xs min-h-[44px] transition-colors ${
                      isSelected ? 'bg-primary-soft/60 font-medium' : 'hover:bg-surface-muted'
                    }`}
                    data-testid={`invitee-toggle-${emp.id}`}
                  >
                    <div>
                      <div className="text-text font-medium">
                        {emp.firstName} {emp.lastName}
                      </div>
                      <div className="text-text-subtle text-[11px]">
                        {emp.department?.name || 'General'} · {emp.email}
                      </div>
                    </div>
                    <span
                      className={`w-4 h-4 rounded border flex items-center justify-center text-[10px] ${
                        isSelected
                          ? 'bg-primary-deep text-surface border-primary-deep'
                          : 'border-border-strong text-transparent'
                      }`}
                      aria-hidden="true"
                    >
                      ✓
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            disabled={submitting}
            className="min-h-[44px]"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            isLoading={submitting}
            disabled={submitting}
            className="min-h-[44px]"
            data-testid="submit-meeting-btn"
          >
            {mode === 'create' ? 'Schedule Meeting' : 'Save Changes'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
