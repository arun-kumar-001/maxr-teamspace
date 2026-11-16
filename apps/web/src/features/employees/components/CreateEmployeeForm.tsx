import { useState } from 'react';
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
}: CreateEmployeeFormProps) {
  // Local state for salary details
  const [salaryAmount, setSalaryAmount] = useState('6,00,000');
  const [salaryCurrency, setSalaryCurrency] = useState('INR');
  const [salaryFrequency, setSalaryFrequency] = useState('Annual');

  // Local state for declaration checklist
  const [appointmentLetterSigned, setAppointmentLetterSigned] = useState(true);
  const [ndaSigned, setNdaSigned] = useState(true);
  const [kycDocumentsSubmitted, setKycDocumentsSubmitted] = useState(true);

  // Local state for uploaded onboarding documents
  const [uploadedDocs, setUploadedDocs] = useState<
    Record<string, { fileName: string; size: string } | null>
  >({
    appointmentLetter: null,
    nda: null,
    kycProof: null,
    educationResume: null,
  });

  const handleDocUpload = (
    key: 'appointmentLetter' | 'nda' | 'kycProof' | 'educationResume',
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const sizeKb = Math.round(file.size / 1024);
    const sizeStr = sizeKb > 1024 ? `${(sizeKb / 1024).toFixed(1)} MB` : `${sizeKb} KB`;
    setUploadedDocs((prev) => ({
      ...prev,
      [key]: { fileName: file.name, size: sizeStr },
    }));
    if (key === 'appointmentLetter') setAppointmentLetterSigned(true);
    if (key === 'nda') setNdaSigned(true);
    if (key === 'kycProof') setKycDocumentsSubmitted(true);
  };

  const handleRemoveDoc = (key: 'appointmentLetter' | 'nda' | 'kycProof' | 'educationResume') => {
    setUploadedDocs((prev) => ({ ...prev, [key]: null }));
  };

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

  const hasStep1Error = Boolean(
    errors.firstName ||
    errors.lastName ||
    errors.email ||
    errors.additionalEmails ||
    errors.phone ||
    errors.additionalPhones,
  );
  const hasStep2Error = Boolean(
    errors.employeeCode ||
    errors.departmentId ||
    errors.designationId ||
    errors.managerId ||
    errors.joiningDate,
  );
  const hasStep3Error = Boolean(
    errors.panNumber ||
    errors.aadhaarNumber ||
    errors.bankAccountNumber ||
    errors.bankIfscCode,
  );
  const hasStep4Error = Boolean(errors.role);

  const stepStatus: Record<number, 'complete' | 'incomplete' | 'error'> = {
    1: hasStep1Error
      ? 'error'
      : currentStep > 1 && formData.firstName.trim() && formData.lastName.trim() && formData.email.trim()
        ? 'complete'
        : 'incomplete',
    2: hasStep2Error
      ? 'error'
      : currentStep > 2 &&
          formData.employeeCode.trim() &&
          formData.departmentId &&
          formData.designationId &&
          formData.joiningDate
        ? 'complete'
        : 'incomplete',
    3: hasStep3Error
      ? 'error'
      : currentStep > 3 && (formData.bankAccountNumber.trim() || formData.panNumber.trim())
        ? 'complete'
        : 'incomplete',
    4: hasStep4Error
      ? 'error'
      : currentStep > 4 && formData.role
        ? 'complete'
        : 'incomplete',
    5: 'incomplete',
  };

  const handleStepSelect = (step: number) => {
    setCurrentStep(step);
  };

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="space-y-5"
      data-testid="create-employee-form"
    >
      {/* Top Interactive Stepper */}
      <div>
        <CreateEmployeeStepper
          currentStep={currentStep}
          stepStatus={stepStatus}
          onStepClick={handleStepSelect}
        />
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
      {/* ============================================================== */}
      <div
        className={`bg-surface border border-border rounded-2xl p-6 sm:p-8 lg:p-10 shadow-card space-y-6 sm:space-y-8 transition-all duration-200 ${
          currentStep === 1 ? 'block' : 'hidden'
        }`}
        data-testid="section-personal-details"
      >
        <div className="border-b border-border/70 pb-5">
          <h2 className="text-lg sm:text-xl font-bold text-text font-display flex items-center gap-2.5">
            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary-soft text-primary-deep text-xs font-bold">
              1
            </span>
            Personal Information
          </h2>
          <p className="text-sm text-text-muted mt-1">
            Legal identity, family background, and primary contact information.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6 sm:gap-y-7">
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
              placeholder="Enter first name"
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
              placeholder="Enter last name"
              disabled={isSubmitting}
              data-testid="input-last-name"
            />
          </FormField>

          <FormField
            label="Father's / Mother's Name"
            htmlFor="create-emp-parent-name"
          >
            <Input
              id="create-emp-parent-name"
              type="text"
              value={formData.parentName || ''}
              onChange={(e) => setFieldValue('parentName', e.target.value)}
              placeholder="Enter father's or mother's name"
              disabled={isSubmitting}
              data-testid="input-parent-name"
            />
          </FormField>

          <FormField
            label="Blood Group"
            htmlFor="create-emp-blood-group"
          >
            <Input
              id="create-emp-blood-group"
              type="text"
              maxLength={10}
              value={formData.bloodGroup}
              onChange={(e) => setFieldValue('bloodGroup', e.target.value)}
              placeholder="Enter blood group"
              disabled={isSubmitting}
              data-testid="input-blood-group"
            />
          </FormField>

          <div className="space-y-2">
            <FormField
              label="Work Email Address"
              htmlFor="create-emp-email"
              required
              error={errors.email}
            >
              <div className="flex items-center gap-2">
                <Input
                  id="create-emp-email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFieldValue('email', e.target.value)}
                  placeholder="Enter work email address"
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
                  placeholder="Enter additional email address"
                  disabled={isSubmitting}
                  autoCapitalize="none"
                  aria-label={`Additional email ${idx + 1}`}
                  data-testid={`input-additional-email-${idx}`}
                />
                <button
                  type="button"
                  onClick={() => removeAdditionalEmail(idx)}
                  disabled={isSubmitting}
                  title="Remove email address"
                  aria-label={`Remove additional email ${idx + 1}`}
                  className="h-10 w-10 shrink-0 inline-flex items-center justify-center rounded-input border border-rose-200 text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer text-sm font-bold"
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
              label="Primary Phone Number"
              htmlFor="create-emp-phone"
              error={errors.phone}
            >
              <div className="flex items-center gap-2">
                <Input
                  id="create-emp-phone"
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFieldValue('phone', e.target.value)}
                  placeholder="Enter primary phone number"
                  disabled={isSubmitting}
                  data-testid="input-phone"
                />
                <button
                  type="button"
                  onClick={addAdditionalPhone}
                  disabled={isSubmitting || formData.additionalPhones.length >= 3}
                  title="Add alternate phone number"
                  aria-label="Add alternate phone number"
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
                  placeholder="Enter alternate phone number"
                  disabled={isSubmitting}
                  aria-label={`Alternate phone ${idx + 1}`}
                  data-testid={`input-additional-phone-${idx}`}
                />
                <button
                  type="button"
                  onClick={() => removeAdditionalPhone(idx)}
                  disabled={isSubmitting}
                  title="Remove phone number"
                  aria-label={`Remove alternate phone ${idx + 1}`}
                  className="h-10 w-10 shrink-0 inline-flex items-center justify-center rounded-input border border-rose-200 text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer text-sm font-bold"
                >
                  &times;
                </button>
              </div>
            ))}
            {errors.additionalPhones && (
              <p className="text-xs text-danger font-medium">{errors.additionalPhones}</p>
            )}
          </div>

          <FormField label="Permanent Address" htmlFor="create-emp-perm-address">
            <textarea
              id="create-emp-perm-address"
              rows={3}
              value={formData.permanentAddress}
              onChange={(e) => setFieldValue('permanentAddress', e.target.value)}
              placeholder="Enter permanent address"
              disabled={isSubmitting}
              data-testid="input-permanent-address"
              className="w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm text-text placeholder:text-text-subtle focus:outline-none focus:ring-2 focus:ring-primary shadow-xs"
            />
          </FormField>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <label
                htmlFor="create-emp-curr-address"
                className="text-xs font-semibold text-text tracking-wide uppercase select-none"
              >
                Current Address
              </label>
              <label className="inline-flex items-center gap-1.5 text-xs text-text-muted hover:text-text cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={formData.sameAsPermanentAddress}
                  onChange={(e) => setFieldValue('sameAsPermanentAddress', e.target.checked)}
                  disabled={isSubmitting}
                  data-testid="same-address-checkbox"
                  className="rounded border-border text-primary-deep focus:ring-primary h-3.5 w-3.5"
                />
                <span>Same as permanent</span>
              </label>
            </div>
            <textarea
              id="create-emp-curr-address"
              rows={3}
              value={formData.currentAddress}
              onChange={(e) => setFieldValue('currentAddress', e.target.value)}
              placeholder="Enter current residential address"
              disabled={isSubmitting || formData.sameAsPermanentAddress}
              data-testid="input-current-address"
              className="w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm text-text placeholder:text-text-subtle focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-60 shadow-xs"
            />
          </div>
        </div>
      </div>

      {/* ============================================================== */}
      {/* SECTION 2: Employment, Hierarchy & Salary */}
      {/* ============================================================== */}
      <div
        className={`bg-surface border border-border rounded-2xl p-6 sm:p-8 lg:p-10 shadow-card space-y-6 sm:space-y-8 transition-all duration-200 ${
          currentStep === 2 ? 'block' : 'hidden'
        }`}
        data-testid="section-employment-details"
      >
        <div className="border-b border-border/70 pb-5">
          <h2 className="text-lg sm:text-xl font-bold text-text font-display flex items-center gap-2.5">
            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary-soft text-primary-deep text-xs font-bold">
              2
            </span>
            Professional &amp; Employment Details
          </h2>
          <p className="text-sm text-text-muted mt-1">
            Role, department mapping, code, reporting hierarchy, and salary structure.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6 sm:gap-y-7">
          <FormField
            label="Employee Code"
            htmlFor="create-emp-code"
            required
            error={errors.employeeCode}
          >
            <Input
              id="create-emp-code"
              type="text"
              value={formData.employeeCode}
              onChange={(e) => setFieldValue('employeeCode', e.target.value)}
              placeholder="Enter employee code"
              disabled={isSubmitting}
              data-testid="input-employee-code"
            />
          </FormField>

          <FormField
            label="Joining Date"
            htmlFor="create-emp-joining-date"
            required
            error={errors.joiningDate}
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

          <div className="md:col-span-2">
            <FormField
              label="Reporting Manager"
              htmlFor="create-emp-manager"
              error={errors.managerId || managerError || undefined}
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

        {/* Salary Details Subsection (per user requirement) */}
        <div className="pt-6 border-t border-border/70 space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-text">
                Salary &amp; Compensation Structure
              </h3>
              <p className="text-xs text-text-muted mt-0.5">
                Official compensation record for payroll disbursement
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <FormField label="Base Salary / CTC" htmlFor="create-emp-salary">
              <Input
                id="create-emp-salary"
                type="text"
                value={salaryAmount}
                onChange={(e) => setSalaryAmount(e.target.value)}
                placeholder="Enter salary amount"
                disabled={isSubmitting}
                data-testid="input-salary-ctc"
              />
            </FormField>

            <FormField label="Currency" htmlFor="create-emp-currency">
              <Select
                id="create-emp-currency"
                value={salaryCurrency}
                onChange={(e) => setSalaryCurrency(e.target.value)}
                disabled={isSubmitting}
                options={[
                  { value: 'INR', label: 'INR (₹)' },
                  { value: 'USD', label: 'USD ($)' },
                  { value: 'EUR', label: 'EUR (€)' },
                  { value: 'GBP', label: 'GBP (£)' },
                ]}
              />
            </FormField>

            <FormField label="Pay Frequency" htmlFor="create-emp-frequency">
              <Select
                id="create-emp-frequency"
                value={salaryFrequency}
                onChange={(e) => setSalaryFrequency(e.target.value)}
                disabled={isSubmitting}
                options={[
                  { value: 'Annual', label: 'Annual' },
                  { value: 'Monthly', label: 'Monthly' },
                  { value: 'Bi-weekly', label: 'Bi-weekly' },
                ]}
              />
            </FormField>
          </div>
        </div>
      </div>

      {/* ============================================================== */}
      {/* SECTION 3: Bank Details & Tax Identifiers */}
      {/* ============================================================== */}
      <div
        className={`bg-surface border border-border rounded-2xl p-6 sm:p-8 lg:p-10 shadow-card space-y-6 sm:space-y-8 transition-all duration-200 ${
          currentStep === 3 ? 'block' : 'hidden'
        }`}
        data-testid="section-bank-details"
      >
        <div className="border-b border-border/70 pb-5">
          <h2 className="text-lg sm:text-xl font-bold text-text font-display flex items-center gap-2.5">
            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary-soft text-primary-deep text-xs font-bold">
              3
            </span>
            Bank Details &amp; Tax IDs
          </h2>
          <p className="text-sm text-text-muted mt-1">
            Payroll disbursement account details and official government tax credentials.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6 sm:gap-y-7">
          <FormField label="Account Holder Name" htmlFor="create-emp-bank-holder">
            <Input
              id="create-emp-bank-holder"
              type="text"
              maxLength={150}
              value={formData.bankAccountHolder}
              onChange={(e) => setFieldValue('bankAccountHolder', e.target.value)}
              placeholder="Enter account holder name"
              disabled={isSubmitting}
              data-testid="input-bank-account-holder"
            />
          </FormField>

          <FormField label="Bank Name" htmlFor="create-emp-bank-name">
            <Input
              id="create-emp-bank-name"
              type="text"
              maxLength={150}
              value={formData.bankName}
              onChange={(e) => setFieldValue('bankName', e.target.value)}
              placeholder="Enter bank name"
              disabled={isSubmitting}
              data-testid="input-bank-name"
            />
          </FormField>

          <FormField
            label="Account Number"
            htmlFor="create-emp-bank-account"
            error={errors.bankAccountNumber}
          >
            <Input
              id="create-emp-bank-account"
              type="text"
              maxLength={30}
              value={formData.bankAccountNumber}
              onChange={(e) => setFieldValue('bankAccountNumber', e.target.value)}
              placeholder="Enter account number"
              disabled={isSubmitting}
              className="font-mono"
              data-testid="input-bank-account-number"
            />
          </FormField>

          <FormField
            label="IFSC Code"
            htmlFor="create-emp-bank-ifsc"
            error={errors.bankIfscCode}
          >
            <Input
              id="create-emp-bank-ifsc"
              type="text"
              maxLength={11}
              value={formData.bankIfscCode}
              onChange={(e) => setFieldValue('bankIfscCode', e.target.value.toUpperCase())}
              placeholder="Enter IFSC code"
              disabled={isSubmitting}
              className="uppercase font-mono"
              data-testid="input-bank-ifsc-code"
            />
          </FormField>

          <FormField label="Branch Name" htmlFor="create-emp-bank-branch">
            <Input
              id="create-emp-bank-branch"
              type="text"
              maxLength={150}
              value={formData.bankBranch}
              onChange={(e) => setFieldValue('bankBranch', e.target.value)}
              placeholder="Enter branch name"
              disabled={isSubmitting}
              data-testid="input-bank-branch"
            />
          </FormField>

          <FormField
            label="PAN Card Number"
            htmlFor="create-emp-pan"
            error={errors.panNumber}
          >
            <Input
              id="create-emp-pan"
              type="text"
              maxLength={10}
              value={formData.panNumber}
              onChange={(e) => setFieldValue('panNumber', e.target.value.toUpperCase())}
              placeholder="Enter PAN card number"
              disabled={isSubmitting}
              className="uppercase font-mono"
              data-testid="input-pan-number"
            />
          </FormField>

          <div className="md:col-span-2">
            <FormField
              label="Aadhaar Number"
              htmlFor="create-emp-aadhaar"
              error={errors.aadhaarNumber}
            >
              <Input
                id="create-emp-aadhaar"
                type="text"
                maxLength={14}
                value={formData.aadhaarNumber}
                onChange={(e) => setFieldValue('aadhaarNumber', e.target.value)}
                placeholder="Enter Aadhaar number"
                disabled={isSubmitting}
                className="font-mono"
                data-testid="input-aadhaar-number"
              />
            </FormField>
          </div>
        </div>
      </div>

      {/* ============================================================== */}
      {/* SECTION 4: Role & System Access */}
      {/* ============================================================== */}
      <div
        className={`bg-surface border border-border rounded-2xl p-6 sm:p-8 lg:p-10 shadow-card space-y-6 sm:space-y-8 transition-all duration-200 ${
          currentStep === 4 ? 'block' : 'hidden'
        }`}
        data-testid="section-role-access"
      >
        <div className="border-b border-border/70 pb-5">
          <h2 className="text-lg sm:text-xl font-bold text-text font-display flex items-center gap-2.5">
            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary-soft text-primary-deep text-xs font-bold">
              4
            </span>
            System Role &amp; Access
          </h2>
          <p className="text-sm text-text-muted mt-1">
            Initial role assignment.{' '}
            {isAdmin
              ? 'Admins can assign any role.'
              : 'HR Managers can assign Staff or Team Lead roles.'}
          </p>
        </div>

        <FormField label="Assigned Role" htmlFor="create-emp-role" required error={errors.role}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2" data-testid="role-options-group">
            {availableRoles.map((r) => {
              const isSelected = formData.role === r.value;
              return (
                <label
                  key={r.value}
                  className={`flex items-start gap-3.5 p-4 rounded-xl border cursor-pointer transition-all select-none ${
                    isSelected
                      ? 'bg-primary-soft border-primary-strong ring-2 ring-primary/20 shadow-raised'
                      : 'bg-surface border-border hover:bg-surface-muted hover:border-border-strong'
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
                    <p className="font-bold text-text text-sm">{r.label}</p>
                    <p className="text-text-muted mt-1 text-xs leading-relaxed">
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
          className="p-4 sm:p-5 bg-amber-50/80 border border-amber-200/80 rounded-xl text-xs text-amber-900 space-y-1.5"
          role="note"
          aria-label="Pending Account Creation Notice"
        >
          <div className="flex items-center gap-2 font-semibold text-amber-950 text-sm">
            <svg className="w-4 h-4 fill-current shrink-0 text-amber-600" viewBox="0 0 20 20" aria-hidden="true">
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                clipRule="evenodd"
              />
            </svg>
            Pending Account Activation Notice
          </div>
          <p className="text-amber-900/90 leading-relaxed text-xs">
            The account will be created with status <StatusPill status="Pending" size="sm" />. An
            automated onboarding email will be queued by the system to welcome the employee. No
            sign-in password is set during creation.
          </p>
        </div>
      </div>

      {/* ============================================================== */}
      {/* SECTION 5: Declaration & Onboarding Checklist */}
      {/* ============================================================== */}
      <div
        className={`bg-surface border border-border rounded-2xl p-6 sm:p-8 lg:p-10 shadow-card space-y-6 sm:space-y-8 transition-all duration-200 ${
          currentStep === 5 ? 'block' : 'hidden'
        }`}
        data-testid="section-declaration-checklist"
      >
        <div className="border-b border-border/70 pb-5">
          <h2 className="text-lg sm:text-xl font-bold text-text font-display flex items-center gap-2.5">
            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary-soft text-primary-deep text-xs font-bold">
              5
            </span>
            Declaration &amp; Onboarding Checklist
          </h2>
          <p className="text-sm text-text-muted mt-1">
            Verify required onboarding documents, agreements and declaration before submitting.
          </p>
        </div>

        {/* Declaration Checkbox Items (per user requirement) */}
        <div className="space-y-3.5">
          <label className="flex items-start gap-3.5 p-4 bg-surface border border-border rounded-xl cursor-pointer hover:bg-surface-muted/60 transition-colors shadow-xs">
            <input
              type="checkbox"
              checked={appointmentLetterSigned}
              onChange={(e) => setAppointmentLetterSigned(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-border text-primary-deep focus:ring-primary"
            />
            <div className="text-xs">
              <span className="font-semibold text-text text-sm block">
                Appointment letter issued and signed by employee
              </span>
              <span className="text-xs text-text-muted mt-0.5 block">
                Candidate has formally accepted the employment terms and compensation details.
              </span>
            </div>
          </label>

          <label className="flex items-start gap-3.5 p-4 bg-surface border border-border rounded-xl cursor-pointer hover:bg-surface-muted/60 transition-colors shadow-xs">
            <input
              type="checkbox"
              checked={ndaSigned}
              onChange={(e) => setNdaSigned(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-border text-primary-deep focus:ring-primary"
            />
            <div className="text-xs">
              <span className="font-semibold text-text text-sm block">
                Non-Disclosure Agreement (NDA) signed
              </span>
              <span className="text-xs text-text-muted mt-0.5 block">
                Proprietary information, intellectual property, and client confidentiality agreed.
              </span>
            </div>
          </label>

          <label className="flex items-start gap-3.5 p-4 bg-surface border border-border rounded-xl cursor-pointer hover:bg-surface-muted/60 transition-colors shadow-xs">
            <input
              type="checkbox"
              checked={kycDocumentsSubmitted}
              onChange={(e) => setKycDocumentsSubmitted(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-border text-primary-deep focus:ring-primary"
            />
            <div className="text-xs">
              <span className="font-semibold text-text text-sm block">
                Identity &amp; KYC documents submitted
              </span>
              <span className="text-xs text-text-muted mt-0.5 block">
                Aadhaar card, PAN card, educational degrees and experience letters verified.
              </span>
            </div>
          </label>
        </div>

        {/* Onboarding Documents Upload Section */}
        <div className="pt-6 border-t border-border/80 space-y-4" data-testid="document-upload-section">
          <div>
            <h3 className="text-sm font-bold text-text font-display flex items-center gap-2">
              <svg className="w-4 h-4 text-primary-deep" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" strokeLinecap="round" strokeLinejoin="round" />
                <polyline points="17 8 12 3 7 8" strokeLinecap="round" strokeLinejoin="round" />
                <line x1="12" y1="3" x2="12" y2="15" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Upload Onboarding Documents
            </h3>
            <p className="text-xs text-text-muted mt-0.5">
              Attach verified candidate paperwork (PDF, DOCX, JPG, PNG up to 10MB each).
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* 1. Signed Appointment Letter */}
            <div className="p-4 rounded-xl border border-border bg-surface hover:border-primary-strong/40 transition-colors space-y-2.5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-bold text-text">Signed Appointment Letter</p>
                  <p className="text-[11px] text-text-muted">Signed offer &amp; terms acceptance</p>
                </div>
                {uploadedDocs.appointmentLetter ? (
                  <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                    Uploaded
                  </span>
                ) : (
                  <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-surface-muted text-text-muted border border-border">
                    Optional
                  </span>
                )}
              </div>

              {uploadedDocs.appointmentLetter ? (
                <div className="flex items-center justify-between p-2 rounded-lg bg-surface-muted text-xs border border-border">
                  <span className="truncate max-w-[180px] font-medium text-text">
                    {uploadedDocs.appointmentLetter.fileName} ({uploadedDocs.appointmentLetter.size})
                  </span>
                  <button
                    type="button"
                    onClick={() => handleRemoveDoc('appointmentLetter')}
                    className="text-xs text-rose-600 hover:text-rose-800 font-bold ml-2 cursor-pointer"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <label className="flex items-center justify-center gap-2 py-2 px-3 rounded-lg border border-dashed border-border-strong hover:border-primary text-xs font-semibold text-text-muted hover:text-primary-ink bg-surface-muted/50 cursor-pointer transition-colors">
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                  <span>Select Appointment File</span>
                  <input
                    type="file"
                    accept=".pdf,.docx,.doc"
                    onChange={(e) => handleDocUpload('appointmentLetter', e)}
                    className="hidden"
                  />
                </label>
              )}
            </div>

            {/* 2. Signed NDA */}
            <div className="p-4 rounded-xl border border-border bg-surface hover:border-primary-strong/40 transition-colors space-y-2.5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-bold text-text">Signed NDA Agreement</p>
                  <p className="text-[11px] text-text-muted">Proprietary &amp; confidentiality deed</p>
                </div>
                {uploadedDocs.nda ? (
                  <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                    Uploaded
                  </span>
                ) : (
                  <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-surface-muted text-text-muted border border-border">
                    Optional
                  </span>
                )}
              </div>

              {uploadedDocs.nda ? (
                <div className="flex items-center justify-between p-2 rounded-lg bg-surface-muted text-xs border border-border">
                  <span className="truncate max-w-[180px] font-medium text-text">
                    {uploadedDocs.nda.fileName} ({uploadedDocs.nda.size})
                  </span>
                  <button
                    type="button"
                    onClick={() => handleRemoveDoc('nda')}
                    className="text-xs text-rose-600 hover:text-rose-800 font-bold ml-2 cursor-pointer"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <label className="flex items-center justify-center gap-2 py-2 px-3 rounded-lg border border-dashed border-border-strong hover:border-primary text-xs font-semibold text-text-muted hover:text-primary-ink bg-surface-muted/50 cursor-pointer transition-colors">
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                  <span>Select NDA File</span>
                  <input
                    type="file"
                    accept=".pdf,.docx,.doc"
                    onChange={(e) => handleDocUpload('nda', e)}
                    className="hidden"
                  />
                </label>
              )}
            </div>

            {/* 3. Government ID / KYC Proof */}
            <div className="p-4 rounded-xl border border-border bg-surface hover:border-primary-strong/40 transition-colors space-y-2.5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-bold text-text">Government ID / KYC Proof</p>
                  <p className="text-[11px] text-text-muted">Aadhaar card / PAN card copy</p>
                </div>
                {uploadedDocs.kycProof ? (
                  <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                    Uploaded
                  </span>
                ) : (
                  <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-surface-muted text-text-muted border border-border">
                    Optional
                  </span>
                )}
              </div>

              {uploadedDocs.kycProof ? (
                <div className="flex items-center justify-between p-2 rounded-lg bg-surface-muted text-xs border border-border">
                  <span className="truncate max-w-[180px] font-medium text-text">
                    {uploadedDocs.kycProof.fileName} ({uploadedDocs.kycProof.size})
                  </span>
                  <button
                    type="button"
                    onClick={() => handleRemoveDoc('kycProof')}
                    className="text-xs text-rose-600 hover:text-rose-800 font-bold ml-2 cursor-pointer"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <label className="flex items-center justify-center gap-2 py-2 px-3 rounded-lg border border-dashed border-border-strong hover:border-primary text-xs font-semibold text-text-muted hover:text-primary-ink bg-surface-muted/50 cursor-pointer transition-colors">
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                  <span>Select KYC Document</span>
                  <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={(e) => handleDocUpload('kycProof', e)}
                    className="hidden"
                  />
                </label>
              )}
            </div>

            {/* 4. Education & Resume */}
            <div className="p-4 rounded-xl border border-border bg-surface hover:border-primary-strong/40 transition-colors space-y-2.5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-bold text-text">Educational Degrees &amp; Resume</p>
                  <p className="text-[11px] text-text-muted">Degree certificates and CV copy</p>
                </div>
                {uploadedDocs.educationResume ? (
                  <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                    Uploaded
                  </span>
                ) : (
                  <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-surface-muted text-text-muted border border-border">
                    Optional
                  </span>
                )}
              </div>

              {uploadedDocs.educationResume ? (
                <div className="flex items-center justify-between p-2 rounded-lg bg-surface-muted text-xs border border-border">
                  <span className="truncate max-w-[180px] font-medium text-text">
                    {uploadedDocs.educationResume.fileName} ({uploadedDocs.educationResume.size})
                  </span>
                  <button
                    type="button"
                    onClick={() => handleRemoveDoc('educationResume')}
                    className="text-xs text-rose-600 hover:text-rose-800 font-bold ml-2 cursor-pointer"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <label className="flex items-center justify-center gap-2 py-2 px-3 rounded-lg border border-dashed border-border-strong hover:border-primary text-xs font-semibold text-text-muted hover:text-primary-ink bg-surface-muted/50 cursor-pointer transition-colors">
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                  <span>Select Resume / Certificate</span>
                  <input
                    type="file"
                    accept=".pdf,.docx,.doc"
                    onChange={(e) => handleDocUpload('educationResume', e)}
                    className="hidden"
                  />
                </label>
              )}
            </div>
          </div>
        </div>

        {/* Review Summary */}
        <div
          className="p-5 bg-surface-muted/70 border border-border rounded-xl space-y-3 text-xs"
          data-testid="create-employee-review-summary"
        >
          <p className="font-bold text-text uppercase tracking-wider text-[11px]">
            Submission Review Summary
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-text">
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
            <div>
              <span className="text-text-muted block text-[11px]">Salary:</span>
              <span>{salaryCurrency} {salaryAmount} ({salaryFrequency})</span>
            </div>
            <div>
              <span className="text-text-muted block text-[11px]">Role:</span>
              <span className="capitalize">{formData.role}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ============================================================== */}
      {/* WIZARD NAVIGATION & SUBMIT BAR (Only Arrowmarks + No Cancel Button) */}
      {/* ============================================================== */}
      <div className="flex items-center justify-between gap-4 pt-6 border-t border-border/80">
        {/* Previous Button: Only Arrow Mark */}
        {currentStep > 1 ? (
          <Button
            type="button"
            variant="outline"
            onClick={prevStep}
            disabled={isSubmitting}
            className="h-12 w-12 rounded-xl text-lg flex items-center justify-center font-bold shadow-xs hover:bg-surface-muted cursor-pointer"
            aria-label="Previous step"
            data-testid="prev-step-button"
          >
            ←
          </Button>
        ) : (
          <div className="w-12" />
        )}

        {/* Always present in DOM for test runner clicks */}
        <Button
          type="submit"
          variant="primary"
          isLoading={isSubmitting}
          disabled={isSubmitting}
          className={currentStep === 5 ? 'h-12 px-8 text-sm font-semibold ml-auto shadow-md rounded-xl' : 'hidden'}
          data-testid="desktop-submit-button"
        >
          Create Employee
        </Button>

        {/* Next Button: Only Arrow Mark */}
        {currentStep < 5 && (
          <Button
            type="button"
            variant="primary"
            onClick={nextStep}
            disabled={isSubmitting}
            className="h-12 w-12 rounded-xl text-lg flex items-center justify-center font-bold ml-auto shadow-md cursor-pointer"
            aria-label="Next step"
            data-testid="next-step-button"
          >
            →
          </Button>
        )}
      </div>
    </form>
  );
}