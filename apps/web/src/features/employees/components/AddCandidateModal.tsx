import { useEffect, useState } from 'react';
import { Button, FormField, Input, Modal, Select } from '../../../components/ui';
import { HIRING_STAGE_META, HIRING_STAGE_ORDER } from '../hooks/useHiringPipeline';
import type { CreateHiringCandidateInput, HiringRoleOpening, HiringStage } from '../types/hiring';

export interface AddCandidateModalProps {
  isOpen: boolean;
  onClose: () => void;
  roles: HiringRoleOpening[];
  defaultRoleId?: string;
  onSubmit: (input: CreateHiringCandidateInput) => void;
}

const SOURCES = ['Careers page', 'LinkedIn', 'Referral', 'Indeed', 'Campus', 'Agency'];

export function AddCandidateModal({
  isOpen,
  onClose,
  roles,
  defaultRoleId,
  onSubmit,
}: AddCandidateModalProps) {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [roleId, setRoleId] = useState(defaultRoleId ?? roles[0]?.id ?? '');
  const [stage, setStage] = useState<HiringStage>('applied');
  const [source, setSource] = useState('Careers page');
  const [rating, setRating] = useState<1 | 2 | 3 | 4 | 5>(4);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setFirstName('');
    setLastName('');
    setEmail('');
    setPhone('');
    setRoleId(defaultRoleId ?? roles.find((r) => r.status === 'hiring')?.id ?? roles[0]?.id ?? '');
    setStage('applied');
    setSource('Careers page');
    setRating(4);
    setNotes('');
    setError(null);
  }, [isOpen, defaultRoleId, roles]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim()) {
      setError('First name and last name are required.');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      setError('Please enter a valid candidate email address.');
      return;
    }
    if (!roleId) {
      setError('Please select a target role.');
      return;
    }

    onSubmit({
      roleId,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.trim(),
      phone: phone.trim() || undefined,
      source,
      stage,
      rating,
      notes: notes.trim() || undefined,
    });
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Add candidate"
      subtitle="Add a new applicant directly to the hiring pipeline."
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4" data-testid="add-candidate-form">
        {error && (
          <div className="p-2.5 rounded-tile bg-rose-50 border border-rose-200 text-xs text-danger font-medium">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FormField label="First name" required>
            <Input
              placeholder="e.g. Ananya"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              required
            />
          </FormField>
          <FormField label="Last name" required>
            <Input
              placeholder="e.g. Krishnan"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              required
            />
          </FormField>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FormField label="Email" required>
            <Input
              type="email"
              placeholder="candidate@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </FormField>
          <FormField label="Phone">
            <Input
              placeholder="+91-98..."
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </FormField>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FormField label="Role opening">
            <Select
              value={roleId}
              onChange={(e) => setRoleId(e.target.value)}
              options={roles.map((r) => ({
                value: r.id,
                label: `${r.title} (${r.departmentName})`,
              }))}
            />
          </FormField>
          <FormField label="Initial stage">
            <Select
              value={stage}
              onChange={(e) => setStage(e.target.value as HiringStage)}
              options={HIRING_STAGE_ORDER.map((s) => ({
                value: s,
                label: HIRING_STAGE_META[s].label,
              }))}
            />
          </FormField>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
          <FormField label="Source">
            <Select
              value={source}
              onChange={(e) => setSource(e.target.value)}
              options={SOURCES.map((s) => ({ value: s, label: s }))}
            />
          </FormField>

          <div>
            <span className="block text-xs font-medium text-text-muted mb-1.5">
              Screening fit ({rating}/5)
            </span>
            <div className="flex items-center gap-1.5 h-10 px-3 rounded-input border border-border bg-surface">
              {([1, 2, 3, 4, 5] as const).map((score) => (
                <button
                  key={score}
                  type="button"
                  onClick={() => setRating(score)}
                  aria-label={`Set fit rating ${score} of 5`}
                  className="p-1 focus:outline-none"
                >
                  <span
                    className={`block w-2.5 h-2.5 rounded-full transition-colors ${
                      score <= rating ? 'bg-primary-strong' : 'bg-border-strong'
                    }`}
                  />
                </button>
              ))}
            </div>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-text-muted mb-1">
            Recruiter notes (optional)
          </label>
          <textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Key strengths, notice period, portfolio link..."
            className="w-full rounded-input border border-border bg-surface px-3 py-2 text-sm text-text placeholder:text-text-subtle focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" data-testid="submit-candidate-btn">
            Add candidate
          </Button>
        </div>
      </form>
    </Modal>
  );
}
