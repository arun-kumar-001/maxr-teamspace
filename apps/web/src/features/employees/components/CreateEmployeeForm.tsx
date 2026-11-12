import { useEffect, useRef } from 'react';
import { Button, FormField, Input, Select, StatusPill } from '../../../components/ui';
import { CreateEmployeeStepper } from './CreateEmployeeStepper';
import type { useCreateEmployee } from '../hooks/useCreateEmployee';

export type CreateEmployeeFormProps = ReturnType<typeof useCreateEmployee> & {
  onCancel?: () => void;
};

export function CreateEmployeeForm({
  formData,
  errors,
  currentStep,
  isSubmitting,
  submitError,
  departments,
  isLoadingDepartments,
  departmentError,
  designations,
  isLoadingDesignations,
  designationError,
  managers,
  isLoadingManagers,
  managerError,
  availableRoles,
  isAdmin,
  setFieldValue,
  addAdditionalEmail,
  updateAdditionalEmail,
  removeAdditionalEmail,
  addAdditionalPhone,
  updateAdditionalPhone,
  removeAdditionalPhone,
  setCurrentStep,
  nextStep,
  prevStep,
  handleSubmit,
  onCancel,
}: CreateEmployeeFormProps) {
  // Department options formatted for Select
  const departmentOptions = departments.map((d) => ({
    value: d.id,
    label: d.code ? `${d.name} (${d.code})` : d.name,
  }));

  // Designation options formatted for Select
  const designationOptions = designations.map((d) => ({
    value: d.id,
    label: d.code ? `${d.title} (${d.code})` : d.title,
  }));

  // Manager options formatted for Select
  const managerOptions = [
    { value: '', label: 'None (Top Level / Direct Report)' },
    ...managers.map((m) => ({
      value: m.id,
      label: `${m.name} (${m.employeeCode})`,
    })),
  ];

  const selectedDepartment = departments.find((d) => d.id === formData.departmentId);
  const selectedDesignation = designations.find((d) => d.id === formData.designationId);
  const selectedManager = managers.find((m) => m.id === formData.managerId);

  const section1Ref = useRef<HTMLDivElement>(null);
  const section2Ref = useRef<HTMLDivElement>(null);
  const section3Ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    const handleScrollSpy = () => {
      if (window.innerWidth < 640) return; // Mobile uses explicit wizard steps
      const sections = [
        { step: 1, el: section1Ref.current },
        { step: 2, el: section2Ref.current },
        { step: 3, el: section3Ref.current },
      ].filter((s): s is { step: number; el: HTMLDivElement } => Boolean(s.el));

      if (sections.length === 0) return;

      const anchorY = window.innerHeight * 0.34;
      let activeStep = 1;
      let bestDist = Infinity;

      for (const s of sections) {
        const rect = s.el.getBoundingClientRect();
        if (rect.top <= anchorY && rect.bottom >= anchorY * 0.5) {
          activeStep = s.step;
          bestDist = -1;
          break;
        }
        const dist = Math.abs(rect.top - anchorY);
        if (dist < bestDist) {
          bestDist = dist;
          activeStep = s.step;
        }
      }

      setCurrentStep(activeStep);
    };

    document.addEventListener('scroll', handleScrollSpy, { passive: true, capture: true });
    return () => {
      document.removeEventListener('scroll', handleScrollSpy, { capture: true });
    };
  }, [setCurrentStep]);

  const handleStepSelect = (step: number) => {
    setCurrentStep(step);
    const targetRef = step === 1 ? section1Ref : step === 2 ? section2Ref : section3Ref;
    if (typeof window !== 'undefined' && window.innerWidth >= 640) {
      targetRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="space-y-6"
      data-testid="create-employee-form"
    >
      {/* Top Visual Stepper (sticky on desktop so scroll-spy stays visible) */}
      <div className="sm:sticky sm:top-2 sm:z-20 sm:bg-bg/90 sm:backdrop-blur-sm sm:py-2 sm:-mx-1 sm:px-1 rounded-card">
        <CreateEmployeeStepper currentStep={currentStep} onStepClick={handleStepSelect} />
      </div>

      {/* General Submission Error Alert */}
      {submitError && (
        <div
          className="p-4 bg-rose-50 border border-rose-200 rounded-card text-xs text-rose-800 flex items-start gap-3"
          role="alert"
          data-testid="create-employee-error-alert"
        >
          <svg
            className="w-5 h-5 text-rose-600 shrink-0 mt-0.5"
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
              clipRule="evenodd"
            />
          </svg>
          <div>
            <p className="font-semibold text-sm">Failed to Create Employee</p>
            <p className="mt-0.5">{submitError}</p>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* SECTION 1: Personal Details */}
      {/* Mobile: visible when currentStep === 1. Desktop: always in flow */}
      {/* ============================================================== */}
      <div
        ref={section1Ref}
        onFocusCapture={() => setCurrentStep(1)}
        className={`bg-surface border rounded-card p-4 sm:p-6 shadow-card space-y-4 scroll-mt-24 transition-colors duration-300 ${
          currentStep === 1
            ? 'block sm:border-primary-strong/50 sm:ring-1 sm:ring-primary/15'
            : 'hidden sm:block border-border'
        }`}
        data-testid="section-personal-details"
      >
        <div className="border-b border-border pb-3">
          <h2 className="text-base font-bold text-text font-display flex items-center gap-2">
            <span className="flex items-center justify-center w-5 h-5 rounded-full bg-primary-soft text-primary-ink text-xs font-bold">
              1
            </span>
            Personal Information
          </h2>
          <p className="text-xs text-text-muted mt-0.5">
            Legal identity and primary contact information.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField
            label="First Name"
            htmlFor="create-emp-first-name"
            required
            error={errors.firstName}
          >
            <Input
              id="create-emp-first-name"
              type="text"
              value={formData.firstName}
              onChange={(e) => setFieldValue('firstName', e.target.value)}
              placeholder="e.g. Rahul"
              disabled={isSubmitting}
              data-testid="input-first-name"
              autoFocus
            />
          </FormField>

          <FormField
            label="Last Name"
            htmlFor="create-emp-last-name"
            required
            error={errors.lastName}
          >
            <Input
              id="create-emp-last-name"
              type="text"
              value={formData.lastName}
              onChange={(e) => setFieldValue('lastName', e.target.value)}
              placeholder="e.g. Sharma"
              disabled={isSubmitting}
              data-testid="input-last-name"
            />
          </FormField>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <FormField
              label="Work Email Address"
              htmlFor="create-emp-email"
              required
              error={errors.email}
              helperText="Used as the sign-in username and for onboarding communications."
            >
              <div className="flex items-center gap-2">
                <Input
                  id="create-emp-email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFieldValue('email', e.target.value)}
                  placeholder="e.g. rahul.sharma@maxr.example"
                  disabled={isSubmitting}
                  autoCapitalize="none"
                  data-testid="input-email"
                />
                <button
                  type="button"
                  onClick={addAdditionalEmail}
                  disabled={isSubmitting || formData.additionalEmails.length >= 5}
                  title="Add additional email address"
                  aria-label="Add additional email address"
                  data-testid="add-email-btn"
                  className="h-10 w-10 shrink-0 inline-flex items-center justify-center rounded-input border border-border bg-surface-muted/70 text-text hover:bg-primary-soft hover:text-primary-deep hover:border-primary-strong/40 transition-colors disabled:opacity-40 cursor-pointer font-semibold text-base"
                >
                  +
                </button>
              </div>
            </FormField>

            {formData.additionalEmails.map((extraEmail, idx) => (
              <div key={idx} className="flex items-center gap-2 animate-crm-fade-up">
                <Input
                  type="email"
                  value={extraEmail}
                  onChange={(e) => updateAdditionalEmail(idx, e.target.value)}
                  placeholder={`Additional email #${idx + 1} (personal / secondary)`}
                  disabled={isSubmitting}
                  autoCapitalize="none"
                  aria-label={`Additional email ${idx + 1}`}
                  data-testid={`input-additional-email-${idx}`}
                />
                <button
                  type="button"
                  onClick={() => removeAdditionalEmail(idx)}
                  disabled={isSubmitting}
                  aria-label={`Remove additional email ${idx + 1}`}
                  className="h-10 w-10 shrink-0 inline-flex items-center justify-center rounded-input border border-border bg-surface text-text-muted hover:text-danger hover:bg-rose-50 transition-colors cursor-pointer"
                >
                  &times;
                </button>
              </div>
            ))}
            {errors.additionalEmails && (
              <p className="text-xs text-danger font-medium">{errors.additionalEmails}</p>
            )}
          </div>

          <div className="space-y-2">
            <FormField
              label="Phone Number"
              htmlFor="create-emp-phone"
              error={errors.phone}
              helperText="Optional. Digits, spaces, +, (, ) and - (6–50 characters)."
            >
              <div className="flex items-center gap-2">
                <Input
                  id="create-emp-phone"
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFieldValue('phone', e.target.value)}
                  placeholder="e.g. +91 98765 43210"
                  disabled={isSubmitting}
                  data-testid="input-phone"
                />
                <button
                  type="button"
                  onClick={addAdditionalPhone}
                  disabled={isSubmitting || formData.additionalPhones.length >= 5}
                  title="Add additional mobile number"
                  aria-label="Add additional mobile number"
                  data-testid="add-phone-btn"
                  className="h-10 w-10 shrink-0 inline-flex items-center justify-center rounded-input border border-border bg-surface-muted/70 text-text hover:bg-primary-soft hover:text-primary-deep hover:border-primary-strong/40 transition-colors disabled:opacity-40 cursor-pointer font-semibold text-base"
                >
                  +
                </button>
              </div>
            </FormField>

            {formData.additionalPhones.map((extraPhone, idx) => (
              <div key={idx} className="flex items-center gap-2 animate-crm-fade-up">
                <Input
                  type="tel"
                  value={extraPhone}
                  onChange={(e) => updateAdditionalPhone(idx, e.target.value)}
                  placeholder={`Additional mobile #${idx + 1} (alternate / emergency)`}
                  disabled={isSubmitting}
                  aria-label={`Additional mobile ${idx + 1}`}
                  data-testid={`input-additional-phone-${idx}`}
                />
                <button
                  type="button"
                  onClick={() => removeAdditionalPhone(idx)}
                  disabled={isSubmitting}
                  aria-label={`Remove additional mobile ${idx + 1}`}
                  className="h-10 w-10 shrink-0 inline-flex items-center justify-center rounded-input border border-border bg-surface text-text-muted hover:text-danger hover:bg-rose-50 transition-colors cursor-pointer"
                >
                  &times;
                </button>
              </div>
            ))}
            {errors.additionalPhones && (
              <p className="text-xs text-danger font-medium">{errors.additionalPhones}</p>
            )}
          </div>
        </div>

        {/* Blood Group, PAN Card Number, Aadhaar Number */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-border/70">
          <FormField label="Blood Group" htmlFor="create-emp-blood-group">
            <Select
              id="create-emp-blood-group"
              value={formData.bloodGroup}
              onChange={(e) => setFieldValue('bloodGroup', e.target.value)}
              disabled={isSubmitting}
              data-testid="select-blood-group"
              options={[
                { value: '', label: 'Select blood group' },
                { value: 'A+', label: 'A+' },
                { value: 'A-', label: 'A-' },
                { value: 'B+', label: 'B+' },
                { value: 'B-', label: 'B-' },
                { value: 'O+', label: 'O+' },
                { value: 'O-', label: 'O-' },
                { value: 'AB+', label: 'AB+' },
                { value: 'AB-', label: 'AB-' },
              ]}
            />
          </FormField>

          <FormField
            label="PAN Card Number"
            htmlFor="create-emp-pan"
            error={errors.panNumber}
            helperText="10-char format (e.g. ABCDE1234F)"
          >
            <Input
              id="create-emp-pan"
              type="text"
              maxLength={10}
              value={formData.panNumber}
              onChange={(e) => setFieldValue('panNumber', e.target.value.toUpperCase())}
              placeholder="ABCDE1234F"
              disabled={isSubmitting}
              className="uppercase font-mono"
              data-testid="input-pan-number"
            />
          </FormField>

          <FormField
            label="Aadhaar Number"
            htmlFor="create-emp-aadhaar"
            error={errors.aadhaarNumber}
            helperText="12-digit Aadhaar ID"
          >
            <Input
              id="create-emp-aadhaar"
              type="text"
              maxLength={14}
              value={formData.aadhaarNumber}
              onChange={(e) => setFieldValue('aadhaarNumber', e.target.value)}
              placeholder="1234 5678 9012"
              disabled={isSubmitting}
              className="font-mono"
              data-testid="input-aadhaar-number"
            />
          </FormField>
        </div>

        {/* Permanent Address & Current Address */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-border/70">
          <FormField label="Permanent Address" htmlFor="create-emp-perm-address">
            <textarea
              id="create-emp-perm-address"
              rows={2}
              value={formData.permanentAddress}
              onChange={(e) => setFieldValue('permanentAddress', e.target.value)}
              placeholder="Door No, Street, City, State, PIN..."
              disabled={isSubmitting}
              data-testid="input-permanent-address"
              className="w-full rounded-input border border-border bg-surface px-3 py-2 text-sm text-text placeholder:text-text-subtle focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </FormField>

          <div className="space-y-1">
            <div className="flex items-center justify-between gap-2">
              <label
                htmlFor="create-emp-curr-address"
                className="block text-xs font-semibold text-text-muted uppercase tracking-wider"
              >
                Current Address
              </label>
              <label className="inline-flex items-center gap-1.5 text-xs text-text-muted cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={formData.sameAsPermanentAddress}
                  onChange={(e) => setFieldValue('sameAsPermanentAddress', e.target.checked)}
                  disabled={isSubmitting}
                  data-testid="same-address-checkbox"
                  className="rounded border-border text-primary-deep focus:ring-primary"
                />
                <span>Same as permanent</span>
              </label>
            </div>
            <textarea
              id="create-emp-curr-address"
              rows={2}
              value={formData.currentAddress}
              onChange={(e) => setFieldValue('currentAddress', e.target.value)}
              placeholder="Current residential address..."
              disabled={isSubmitting || formData.sameAsPermanentAddress}
              data-testid="input-current-address"
              className="w-full rounded-input border border-border bg-surface px-3 py-2 text-sm text-text placeholder:text-text-subtle focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-60"
            />
          </div>
        </div>
      </div>

      {/* ============================================================== */}
      {/* SECTION 2: Employment & Hierarchy */}
      {/* Mobile: visible when currentStep === 2. Desktop: always in flow */}
      {/* ============================================================== */}
      <div
        ref={section2Ref}
        onFocusCapture={() => setCurrentStep(2)}
        className={`bg-surface border rounded-card p-4 sm:p-6 shadow-card space-y-4 scroll-mt-24 transition-colors duration-300 ${
          currentStep === 2
            ? 'block sm:border-primary-strong/50 sm:ring-1 sm:ring-primary/15'
            : 'hidden sm:block border-border'
        }`}
        data-testid="section-employment-details"
      >
        <div className="border-b border-border pb-3">
          <h2 className="text-base font-bold text-text font-display flex items-center gap-2">
            <span className="flex items-center justify-center w-5 h-5 rounded-full bg-primary-soft text-primary-ink text-xs font-bold">
              2
            </span>
            Employment & Hierarchy
          </h2>
          <p className="text-xs text-text-muted mt-0.5">
            Company identifier, department mapping, designation, and reporting structure.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField
            label="Employee Code"
            htmlFor="create-emp-code"
            required
            error={errors.employeeCode}
            helperText="Unique uppercase ID: 2–50 chars (letters, digits, -, _)."
          >
            <Input
              id="create-emp-code"
              type="text"
              value={formData.employeeCode}
              onChange={(e) => setFieldValue('employeeCode', e.target.value)}
              placeholder="e.g. EMP-042"
              disabled={isSubmitting}
              data-testid="input-employee-code"
            />
          </FormField>

          <FormField
            label="Joining Date"
            htmlFor="create-emp-joining-date"
            required
            error={errors.joiningDate}
            helperText="Format: YYYY-MM-DD. Cannot be > 365 days in future."
          >
            <Input
              id="create-emp-joining-date"
              type="date"
              value={formData.joiningDate}
              onChange={(e) => setFieldValue('joiningDate', e.target.value)}
              disabled={isSubmitting}
              data-testid="input-joining-date"
            />
          </FormField>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField
            label="Department"
            htmlFor="create-emp-department"
            required
            error={errors.departmentId || departmentError || undefined}
          >
            <Select
              id="create-emp-department"
              value={formData.departmentId}
              onChange={(e) => setFieldValue('departmentId', e.target.value)}
              disabled={isSubmitting || isLoadingDepartments}
              placeholder={isLoadingDepartments ? 'Loading departments...' : 'Select department'}
              options={departmentOptions}
              data-testid="select-department"
            />
          </FormField>

          <FormField
            label="Designation"
            htmlFor="create-emp-designation"
            required
            error={errors.designationId || designationError || undefined}
            helperText={
              !formData.departmentId
                ? 'Select a department first to view its designations.'
                : undefined
            }
          >
            <Select
              id="create-emp-designation"
              value={formData.designationId}
              onChange={(e) => setFieldValue('designationId', e.target.value)}
              disabled={
                isSubmitting ||
                isLoadingDesignations ||
                !formData.departmentId ||
                designationOptions.length === 0
              }
              placeholder={
                !formData.departmentId
                  ? 'Select department first'
                  : isLoadingDesignations
                    ? 'Loading designations...'
                    : designationOptions.length === 0
                      ? 'No designations for this department'
                      : 'Select designation'
              }
              options={designationOptions}
              data-testid="select-designation"
            />
          </FormField>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField
            label="Reporting Manager"
            htmlFor="create-emp-manager"
            error={errors.managerId || managerError || undefined}
            helperText="Optional. Active workforce member who approves leave and attendance."
          >
            <Select
              id="create-emp-manager"
              value={formData.managerId}
              onChange={(e) => setFieldValue('managerId', e.target.value)}
              disabled={isSubmitting || isLoadingManagers}
              placeholder={isLoadingManagers ? 'Loading managers...' : 'Select manager'}
              options={managerOptions}
              data-testid="select-manager"
            />
          </FormField>
        </div>
      </div>

      {/* ============================================================== */}
      {/* SECTION 3: Role & System Access */}
      {/* Mobile: visible when currentStep === 3. Desktop: always in flow */}
      {/* ============================================================== */}
      <div
        ref={section3Ref}
        onFocusCapture={() => setCurrentStep(3)}
        className={`bg-surface border rounded-card p-4 sm:p-6 shadow-card space-y-4 scroll-mt-24 transition-colors duration-300 ${
          currentStep === 3
            ? 'block sm:border-primary-strong/50 sm:ring-1 sm:ring-primary/15'
            : 'hidden sm:block border-border'
        }`}
        data-testid="section-role-access"
      >
        <div className="border-b border-border pb-3">
          <h2 className="text-base font-bold text-text font-display flex items-center gap-2">
            <span className="flex items-center justify-center w-5 h-5 rounded-full bg-primary-soft text-primary-ink text-xs font-bold">
              3
            </span>
            System Role & Access
          </h2>
          <p className="text-xs text-text-muted mt-0.5">
            Initial role assignment.{' '}
            {isAdmin
              ? 'Admins can assign any role.'
              : 'HR Managers can assign Staff or Team Lead roles.'}
          </p>
        </div>

        <FormField label="Assigned Role" htmlFor="create-emp-role" required error={errors.role}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" data-testid="role-options-group">
            {availableRoles.map((r) => {
              const isSelected = formData.role === r.value;
              return (
                <label
                  key={r.value}
                  className={`flex items-start gap-3 p-3.5 rounded-input border cursor-pointer transition-all select-none ${
                    isSelected
                      ? 'bg-primary-soft border-primary-strong ring-1 ring-primary-strong shadow-raised'
                      : 'bg-surface border-border-strong hover:bg-surface-muted'
                  }`}
                  data-testid={`role-card-${r.value}`}
                >
                  <input
                    type="radio"
                    name="assignedRole"
                    value={r.value}
                    checked={isSelected}
                    onChange={() => setFieldValue('role', r.value)}
                    disabled={isSubmitting}
                    className="mt-1 h-4 w-4 text-primary-deep focus:ring-primary-strong"
                  />
                  <div className="text-xs">
                    <p className="font-bold text-text">{r.label}</p>
                    <p className="text-text-muted mt-0.5 text-[11px] leading-relaxed">
                      {r.description}
                    </p>
                  </div>
                </label>
              );
            })}
          </div>
        </FormField>

        {/* Informative Notice on Pending Status */}
        <div
          className="p-3.5 bg-amber-50 border border-amber-200 rounded-input text-xs text-amber-900 space-y-1"
          role="note"
          aria-label="Pending Account Creation Notice"
        >
          <div className="flex items-center gap-2 font-semibold text-amber-950">
            <svg className="w-4 h-4 fill-current shrink-0" viewBox="0 0 20 20" aria-hidden="true">
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                clipRule="evenodd"
              />
            </svg>
            Pending Account Activation Notice
          </div>
          <p className="text-amber-900/90 leading-relaxed">
            The account will be created with status <StatusPill status="Pending" size="sm" />. An
            automated onboarding email will be queued by the system to welcome the employee. No
            sign-in password is set during creation.
          </p>
        </div>

        {/* Review Summary (visible on Step 3) */}
        {currentStep === 3 && (
          <div
            className="p-4 bg-surface-muted border border-border rounded-input space-y-2 text-xs"
            data-testid="create-employee-review-summary"
          >
            <p className="font-bold text-text uppercase tracking-wider text-[10px]">
              Submission Review Summary
            </p>
            <div className="grid grid-cols-2 gap-2 text-text">
              <div>
                <span className="text-text-muted block text-[11px]">Employee:</span>
                <span className="font-semibold">
                  {formData.firstName || '—'} {formData.lastName || '—'}
                </span>
              </div>
              <div>
                <span className="text-text-muted block text-[11px]">Code:</span>
                <span className="font-mono font-semibold">{formData.employeeCode || '—'}</span>
              </div>
              <div>
                <span className="text-text-muted block text-[11px]">Email:</span>
                <span className="font-mono">{formData.email || '—'}</span>
              </div>
              <div>
                <span className="text-text-muted block text-[11px]">Department:</span>
                <span>{selectedDepartment?.name || '—'}</span>
              </div>
              <div>
                <span className="text-text-muted block text-[11px]">Designation:</span>
                <span>{selectedDesignation?.title || '—'}</span>
              </div>
              <div>
                <span className="text-text-muted block text-[11px]">Manager:</span>
                <span>{selectedManager ? selectedManager.name : 'None (Top Level)'}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ============================================================== */}
      {/* FORM ACTIONS & CONTROLS */}
      {/* ============================================================== */}

      {/* Mobile-only Action Bar (< 640px) */}
      <div className="flex sm:hidden items-center justify-between gap-3 pt-2">
        {currentStep > 1 ? (
          <Button
            type="button"
            variant="outline"
            onClick={prevStep}
            disabled={isSubmitting}
            className="min-h-[44px] min-w-[80px]"
            data-testid="mobile-prev-step-button"
          >
            Previous
          </Button>
        ) : (
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isSubmitting}
            className="min-h-[44px]"
            data-testid="mobile-cancel-button"
          >
            Cancel
          </Button>
        )}

        {currentStep < 3 ? (
          <Button
            type="button"
            variant="primary"
            onClick={nextStep}
            disabled={isSubmitting}
            className="min-h-[44px] ml-auto"
            data-testid="mobile-next-step-button"
          >
            Continue
          </Button>
        ) : (
          <Button
            type="submit"
            variant="primary"
            isLoading={isSubmitting}
            disabled={isSubmitting}
            className="min-h-[44px] ml-auto"
            data-testid="mobile-submit-button"
          >
            Create Employee
          </Button>
        )}
      </div>

      {/* Desktop & Tablet Action Bar (>= 640px) */}
      <div className="hidden sm:flex items-center justify-end gap-3 pt-2 border-t border-border">
        {onCancel && (
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isSubmitting}
            className="min-h-[44px]"
            data-testid="desktop-cancel-button"
          >
            Cancel
          </Button>
        )}

        <Button
          type="submit"
          variant="primary"
          isLoading={isSubmitting}
          disabled={isSubmitting}
          className="min-h-[44px]"
          data-testid="desktop-submit-button"
        >
          Create Employee
        </Button>
      </div>
    </form>
  );
}
