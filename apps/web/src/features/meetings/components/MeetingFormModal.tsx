import { useEffect, useState } from 'react';
import { Button } from '../../../components/ui/Button';
import { FormField } from '../../../components/ui/FormField';
import { Input } from '../../../components/ui/Input';
import { Modal } from '../../../components/ui/Modal';
import { fetchEmployeeDirectory } from '../../employees/api/employees';
import type { EmployeeDirectoryItem } from '../../employees/types';
import { fetchProjects } from '../../projects/api/projectsApi';
import type { Project } from '../../projects/types';
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
  defaultDate?: string;
  onSubmitCreate?: (input: ScheduleMeetingInput) => Promise<MeetingWithOverlaps>;
  onSubmitEdit?: (id: string, input: UpdateMeetingInput) => Promise<MeetingWithOverlaps>;
}

const EVENT_KINDS = ['Meeting', 'Review', 'Team Sync', 'Deadline'] as const;
const DURATION_OPTIONS = [
  { label: '30 min', minutes: 30 },
  { label: '1 h', minutes: 60 },
  { label: '1.5 h', minutes: 90 },
  { label: '2 h', minutes: 120 },
];

function addMinutesToTime(timeStr: string, minutes: number): string {
  const [hh, mm] = timeStr.split(':').map(Number);
  if (hh === undefined || mm === undefined || Number.isNaN(hh) || Number.isNaN(mm)) return '11:00';
  const total = Math.min(23 * 60 + 55, hh * 60 + mm + minutes);
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

export function MeetingFormModal({
  isOpen,
  onClose,
  mode,
  initialMeeting,
  defaultDate,
  onSubmitCreate,
  onSubmitEdit,
}: MeetingFormModalProps) {
  const [title, setTitle] = useState('');
  const [eventKind, setEventKind] = useState<string>('Meeting');
  const [projectId, setProjectId] = useState<string>('');
  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [lengthMinutes, setLengthMinutes] = useState<number>(60);
  const [agenda, setAgenda] = useState('');
  const [selectedInviteeIds, setSelectedInviteeIds] = useState<string[]>([]);

  const [employees, setEmployees] = useState<EmployeeDirectoryItem[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
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
      setEventKind('Meeting');
      setProjectId('');
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
      setLengthMinutes(Math.max(30, Math.round((e.getTime() - s.getTime()) / 60_000)));
      setSelectedInviteeIds(initialMeeting.attendees.map((a) => a.employeeId));
    } else {
      const now = new Date();
      const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(
        2,
        '0',
      )}-${String(now.getDate()).padStart(2, '0')}`;
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowKey = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(
        2,
        '0',
      )}-${String(tomorrow.getDate()).padStart(2, '0')}`;

      let resolvedDate = defaultDate && defaultDate >= todayKey ? defaultDate : tomorrowKey;
      let startHr = 10;
      if (resolvedDate === todayKey) {
        if (now.getHours() >= 22) {
          resolvedDate = tomorrowKey;
        } else {
          startHr = Math.max(10, now.getHours() + 1);
        }
      }

      const startStr = `${String(startHr).padStart(2, '0')}:00`;
      setDate(resolvedDate);
      setStartTime(startStr);
      setLengthMinutes(60);
      setEndTime(addMinutesToTime(startStr, 60));
      setTitle('');
      setEventKind('Meeting');
      setProjectId('');
      setAgenda('');
      setSelectedInviteeIds([]);
    }

    setLoadingEmployees(true);
    void fetchEmployeeDirectory({ status: 'active', pageSize: 100 })
      .then((res) => setEmployees(res.data))
      .catch(() => setEmployees([]))
      .finally(() => setLoadingEmployees(false));

    void fetchProjects({ status: 'active', pageSize: 100 })
      .then((res) => setProjects(res.data || []))
      .catch(() => setProjects([]));
  }, [isOpen, mode, initialMeeting, defaultDate]);

  const handleStartTimeChange = (newStart: string) => {
    setStartTime(newStart);
    setEndTime(addMinutesToTime(newStart, lengthMinutes));
  };

  const handleLengthChange = (mins: number) => {
    setLengthMinutes(mins);
    setEndTime(addMinutesToTime(startTime, mins));
  };

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
          errs.endTime = 'An event can last at most 24 hours';
        }

        if (mode === 'create' && startsAt.getTime() <= Date.now()) {
          errs.startTime = 'Event must start in the future';
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

    const selectedProject = projects.find((p) => p.id === projectId);
    const contextParts: string[] = [];
    if (eventKind !== 'Meeting') contextParts.push(eventKind);
    if (selectedProject) contextParts.push(`${selectedProject.code} ${selectedProject.name}`);
    const prefix = contextParts.length > 0 ? `[${contextParts.join(' · ')}]` : '';
    const trimmedAgenda = agenda.trim();
    const combinedAgenda = [prefix, trimmedAgenda].filter(Boolean).join('\n');

    setSubmitting(true);
    setServerError(null);

    try {
      if (mode === 'create') {
        if (!onSubmitCreate) return;
        const result = await onSubmitCreate({
          title: title.trim(),
          agenda: combinedAgenda || undefined,
          startsAt,
          endsAt,
          inviteeIds: selectedInviteeIds,
        });

        if (result?.overlaps && result.overlaps.length > 0) {
          setOverlapWarnings(result.overlaps);
        } else {
          onClose();
        }
      } else {
        if (!onSubmitEdit || !initialMeeting) return;
        const result = await onSubmitEdit(initialMeeting.id, {
          title: title.trim(),
          agenda: trimmedAgenda || null,
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
      setServerError(err instanceof Error ? err.message : 'Failed to save event.');
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
      title={mode === 'create' ? 'Book time' : 'Edit event'}
      subtitle={
        mode === 'create' ? 'A meeting, review, team sync, or milestone deadline.' : undefined
      }
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
              The following invited team members have an overlapping booking during this time:
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
        <FormField label="Title" required error={errors.title}>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Sprint Planning or Client Review"
            maxLength={200}
            data-testid="meeting-title-input"
          />
        </FormField>

        {/* Kind & Project Row */}
        {mode === 'create' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="event-kind-select"
                className="block text-xs font-semibold text-text mb-1"
              >
                Kind
              </label>
              <select
                id="event-kind-select"
                value={eventKind}
                onChange={(e) => setEventKind(e.target.value)}
                className="w-full min-h-[40px] px-3 py-1.5 text-sm bg-surface border border-border rounded-tile text-text focus:outline-none focus:border-primary-strong"
              >
                {EVENT_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="event-project-select"
                className="block text-xs font-semibold text-text mb-1"
              >
                Project
              </label>
              <select
                id="event-project-select"
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                className="w-full min-h-[40px] px-3 py-1.5 text-sm bg-surface border border-border rounded-tile text-text focus:outline-none focus:border-primary-strong"
              >
                <option value="">None</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.code} — {p.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Date, Start Time, Length & End Time */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <FormField label="Date" required error={errors.date}>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              data-testid="meeting-date-input"
            />
          </FormField>

          <FormField label="Start" required error={errors.startTime}>
            <Input
              type="time"
              value={startTime}
              onChange={(e) => handleStartTimeChange(e.target.value)}
              data-testid="meeting-start-time-input"
            />
          </FormField>

          <div>
            <label
              htmlFor="event-length-select"
              className="block text-xs font-semibold text-text mb-1"
            >
              Length
            </label>
            <select
              id="event-length-select"
              value={lengthMinutes}
              onChange={(e) => handleLengthChange(Number(e.target.value))}
              className="w-full min-h-[40px] px-3 py-1.5 text-sm bg-surface border border-border rounded-tile text-text focus:outline-none focus:border-primary-strong"
            >
              {DURATION_OPTIONS.map((opt) => (
                <option key={opt.minutes} value={opt.minutes}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Hidden/editable exact End Time fallback */}
        <FormField label="End Time" required error={errors.endTime}>
          <Input
            type="time"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            data-testid="meeting-end-time-input"
          />
        </FormField>

        {/* Agenda / Notes */}
        <FormField
          label="Notes / Agenda"
          helperText={`Optional · Up to ${MAX_AGENDA_CHARS} characters`}
          error={errors.agenda}
        >
          <textarea
            value={agenda}
            onChange={(e) => setAgenda(e.target.value)}
            placeholder="Key discussion points, goals, and links..."
            rows={2}
            maxLength={MAX_AGENDA_CHARS}
            className="w-full px-3 py-2 text-sm text-text bg-surface border border-border rounded-tile focus:outline-none focus:border-primary-strong"
            data-testid="meeting-agenda-input"
          />
        </FormField>

        {/* Invitees Multi-Select */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-text uppercase tracking-wider">
              Invite Team ({selectedInviteeIds.length} / {MAX_INVITEES})
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

          {selectedInviteeIds.length > 0 && (
            <div className="flex flex-wrap gap-1.5 p-2 bg-surface-muted rounded-tile border border-border max-h-24 overflow-y-auto">
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

          <div className="border border-border rounded-tile max-h-36 overflow-y-auto bg-surface divide-y divide-border">
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
                    className={`w-full px-3 py-2 text-left flex items-center justify-between text-xs min-h-[40px] transition-colors ${
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
            className="min-h-[40px]"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={submitting}
            className="min-h-[40px]"
            data-testid="submit-meeting-btn"
          >
            {submitting ? 'Saving...' : mode === 'create' ? 'Book it' : 'Save Changes'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
