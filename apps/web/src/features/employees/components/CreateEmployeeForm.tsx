import { photoProblem } from '../lib/photo';
import { useRef, useState, type ChangeEvent } from 'react';
import { Button, FormField, Input, Select, StatusPill } from '../../../components/ui';
import { CreateEmployeeStepper } from './CreateEmployeeStepper';
import type { useCreateEmployee } from '../hooks/useCreateEmployee';

function IconUpload({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  );
}

function IconTrash({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7c-1 0-2-1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  );
}

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
  regeneratePassword,
}: CreateEmployeeFormProps) {
  // Local state for password view & copy
  const [showPassword, setShowPassword] = useState(false);
  const [copiedPassword, setCopiedPassword] = useState(false);

  const handleCopyPassword = async () => {
    try {
      await navigator.clipboard.writeText(formData.password);
      setCopiedPassword(true);
      setTimeout(() => setCopiedPassword(false), 2000);
    } catch {
      // ignore
    }
  };

  // Profile picture upload state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);

  const handlePhotoChange = (e: ChangeEvent<HTMLInputElement>) => {
    setPhotoError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    const problem = photoProblem(file);
    if (problem) {
      setPhotoError(problem);
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === 'string') {
        setFieldValue('avatarUrl', result);
      }
    };
    reader.onerror = () => {
      setPhotoError('Failed to read image file.');
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Local state for currently working / relieving date
  const [isCurrentlyWorking, setIsCurrentlyWorking] = useState(true);
  const [relievingDate, setRelievingDate] = useState('');

  // Local state for declaration checklist
  const [appointmentLetterSigned, setAppointmentLetterSigned] = useState(true);
  const [ndaSigned, setNdaSigned] = useState(true);
  const [kycDocumentsSubmitted, setKycDocumentsSubmitted] = useState(true);

  // Local state for uploaded onboarding documents
  const [uploadedDocs, setUploadedDocs] = useState<
    Record<string, { fileName: string; size: string } | null>
  >({
    resume: null,
    aadharCard: null,
    panCard: null,
    degreeCertificates: null,
    appointmentLetter: null,
    nda: null,
    kycProof: null,
    educationResume: null,
  });

  const handleDocUpload = (
    key:
      | 'resume'
      | 'aadharCard'
      | 'panCard'
      | 'degreeCertificates'
      | 'appointmentLetter'
      | 'nda'
      | 'kycProof'
      | 'educationResume',
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
    if (
      key === 'kycProof' ||
      key === 'aadharCard' ||
      key === 'panCard' ||
      key === 'degreeCertificates'
    ) {
      setKycDocumentsSubmitted(true);
    }
  };

  const handleRemoveDoc = (
    key:
      | 'resume'
      | 'aadharCard'
      | 'panCard'
      | 'degreeCertificates'
      | 'appointmentLetter'
      | 'nda'
      | 'kycProof'
      | 'educationResume',
  ) => {
    setUploadedDocs((prev) => ({ ...prev, [key]: null }));
  };

  // Structured address states
  const [permAddress, setPermAddress] = useState({
    address1: formData.permanentAddress1 || '',
    address2: formData.permanentAddress2 || '',
    city: formData.permanentCity || '',
    district: formData.permanentDistrict || '',
    pincode: formData.permanentPincode || '',
  });

  const [currAddress, setCurrAddress] = useState({
    address1: formData.currentAddress1 || '',
    address2: formData.currentAddress2 || '',
    city: formData.currentCity || '',
    district: formData.currentDistrict || '',
    pincode: formData.currentPincode || '',
  });

  const updatePermField = (field: keyof typeof permAddress, val: string) => {
    const updated = { ...permAddress, [field]: val };
    setPermAddress(updated);
    const formatted = [
      updated.address1,
      updated.address2,
      updated.city,
      updated.district,
      updated.pincode,
    ]
      .map((s) => s.trim())
      .filter(Boolean)
      .join(', ');
    setFieldValue('permanentAddress', formatted);
    setFieldValue(
      (
        {
          address1: 'permanentAddress1',
          address2: 'permanentAddress2',
          city: 'permanentCity',
          district: 'permanentDistrict',
          pincode: 'permanentPincode',
        } as const
      )[field],
      val,
    );

    if (formData.sameAsPermanentAddress) {
      setCurrAddress(updated);
      setFieldValue('currentAddress', formatted);
      setFieldValue(
        (
          {
            address1: 'currentAddress1',
            address2: 'currentAddress2',
            city: 'currentCity',
            district: 'currentDistrict',
            pincode: 'currentPincode',
          } as const
        )[field],
        val,
      );
    }
  };

  const updateCurrField = (field: keyof typeof currAddress, val: string) => {
    const updated = { ...currAddress, [field]: val };
    setCurrAddress(updated);
    const formatted = [
      updated.address1,
      updated.address2,
      updated.city,
      updated.district,
      updated.pincode,
    ]
      .map((s) => s.trim())
      .filter(Boolean)
      .join(', ');
    setFieldValue('currentAddress', formatted);
    setFieldValue(
      (
        {
          address1: 'currentAddress1',
          address2: 'currentAddress2',
          city: 'currentCity',
          district: 'currentDistrict',
          pincode: 'currentPincode',
        } as const
      )[field],
      val,
    );
  };

  const handleSameAddressToggle = (checked: boolean) => {
    setFieldValue('sameAsPermanentAddress', checked);
    if (checked) {
      setCurrAddress({ ...permAddress });
      const formatted = [
        permAddress.address1,
        permAddress.address2,
        permAddress.city,
        permAddress.district,
        permAddress.pincode,
      ]
        .map((s) => s.trim())
        .filter(Boolean)
        .join(', ');
      setFieldValue('currentAddress', formatted);
    }
  };

  // Department options formatted for Select
  const departmentOptions = departments.map((d) => ({
    value: d.id,
    label: d.name,
  }));

  // Designation options formatted for Select
  const designationOptions = designations.map((d) => ({
    value: d.id,
    label: d.title,
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
    errors.panNumber || errors.aadhaarNumber || errors.bankAccountNumber || errors.bankIfscCode,
  );
  const hasStep5Error = Boolean(errors.role);

  const stepStatus: Record<number, 'complete' | 'incomplete' | 'error'> = {
    1: hasStep1Error
      ? 'error'
      : currentStep > 1 &&
          formData.firstName.trim() &&
          formData.lastName.trim() &&
          formData.email.trim()
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
    4: currentStep > 4 ? 'complete' : 'incomplete',
    5: hasStep5Error ? 'error' : currentStep > 5 && formData.role ? 'complete' : 'incomplete',
    6: 'incomplete',
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
            Enter the employee’s personal details and contact information.
          </p>
        </div>

        {/* Profile Picture Upload Section */}
        <div
          className="flex flex-col sm:flex-row items-start sm:items-center gap-5 p-4 rounded-xl bg-surface-muted/60 border border-border"
          data-testid="employee-photo-upload-section"
        >
          <div className="relative shrink-0">
            {formData.avatarUrl ? (
              <img
                src={formData.avatarUrl}
                alt="Employee avatar preview"
                className="w-20 h-20 rounded-full object-cover border-2 border-primary-strong shadow-card"
                data-testid="employee-avatar-preview"
              />
            ) : (
              <div
                className="w-20 h-20 rounded-full bg-primary-soft text-primary-deep flex items-center justify-center font-display font-bold text-xl border-2 border-border-strong select-none"
                data-testid="employee-avatar-placeholder"
              >
                {formData.firstName || formData.lastName
                  ? `${formData.firstName?.[0] || ''}${formData.lastName?.[0] || ''}`.toUpperCase()
                  : 'EMP'}
              </div>
            )}
          </div>

          <div className="flex-1 space-y-1.5">
            <h3 className="text-sm font-semibold text-text">Employee Profile Picture</h3>
            <p className="text-xs text-text-muted">
              Upload a professional portrait or passport-size photo (PNG or JPEG, max 2MB).
            </p>
            <div className="flex items-center gap-2 pt-1">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png, image/jpeg"
                className="hidden"
                data-testid="input-employee-photo"
                onChange={handlePhotoChange}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={isSubmitting}
                data-testid="btn-upload-employee-photo"
                className="gap-1.5 text-xs"
              >
                <IconUpload className="w-3.5 h-3.5 text-text-muted" />
                <span>{formData.avatarUrl ? 'Change Photo' : 'Upload Photo'}</span>
              </Button>
              {formData.avatarUrl && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setFieldValue('avatarUrl', '')}
                  disabled={isSubmitting}
                  data-testid="btn-remove-employee-photo"
                  className="gap-1.5 text-xs text-danger hover:bg-rose-50"
                >
                  <IconTrash className="w-3.5 h-3.5" />
                  <span>Remove</span>
                </Button>
              )}
            </div>
            {photoError && <p className="text-xs text-danger font-medium pt-1">{photoError}</p>}
          </div>
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

          <FormField label="Father's / Mother's Name" htmlFor="create-emp-parent-name">
            <Input
              id="create-emp-parent-name"
              type="text"
              value={formData.parentName || ''}
              onChange={(e) => setFieldValue('parentName', e.target.value)}
              placeholder="Enter parent or guardian name"
              disabled={isSubmitting}
              data-testid="input-parent-name"
            />
          </FormField>

          <FormField label="Blood Group" htmlFor="create-emp-blood-group">
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
              label="Email Address"
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
                  placeholder="Enter email address"
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
            <FormField label="Primary Phone Number" htmlFor="create-emp-phone" error={errors.phone}>
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

          {/* Permanent Address - Structured Fields */}
          <div className="md:col-span-2 space-y-3.5 pt-2 border-t border-border/70">
            <h3 className="text-xs font-bold text-text uppercase tracking-wider">
              Permanent Address
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField label="Address Line 1" htmlFor="create-emp-perm-addr1">
                <Input
                  id="create-emp-perm-addr1"
                  type="text"
                  value={permAddress.address1}
                  onChange={(e) => updatePermField('address1', e.target.value)}
                  placeholder="Enter door number, building, and street"
                  disabled={isSubmitting}
                  data-testid="input-permanent-address"
                />
              </FormField>
              <FormField label="Address Line 2" htmlFor="create-emp-perm-addr2">
                <Input
                  id="create-emp-perm-addr2"
                  type="text"
                  value={permAddress.address2}
                  onChange={(e) => updatePermField('address2', e.target.value)}
                  placeholder="Enter area, landmark, or locality"
                  disabled={isSubmitting}
                  data-testid="input-permanent-address2"
                />
              </FormField>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <FormField label="City / Town" htmlFor="create-emp-perm-city">
                <Input
                  id="create-emp-perm-city"
                  type="text"
                  value={permAddress.city}
                  onChange={(e) => updatePermField('city', e.target.value)}
                  placeholder="Enter city"
                  disabled={isSubmitting}
                  data-testid="input-permanent-city"
                />
              </FormField>
              <FormField label="District" htmlFor="create-emp-perm-district">
                <Input
                  id="create-emp-perm-district"
                  type="text"
                  value={permAddress.district}
                  onChange={(e) => updatePermField('district', e.target.value)}
                  placeholder="Enter district"
                  disabled={isSubmitting}
                  data-testid="input-permanent-district"
                />
              </FormField>
              <FormField label="PIN Code" htmlFor="create-emp-perm-pincode">
                <Input
                  id="create-emp-perm-pincode"
                  type="text"
                  maxLength={10}
                  value={permAddress.pincode}
                  onChange={(e) => updatePermField('pincode', e.target.value)}
                  placeholder="Enter PIN code"
                  disabled={isSubmitting}
                  className="font-mono"
                  data-testid="input-permanent-pincode"
                />
              </FormField>
            </div>
          </div>

          {/* Current Address - Structured Fields */}
          <div className="md:col-span-2 space-y-3.5 pt-2 border-t border-border/70">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-xs font-bold text-text uppercase tracking-wider">
                Current Residential Address
              </h3>
              <label className="inline-flex items-center gap-1.5 text-xs text-text-muted hover:text-text cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={formData.sameAsPermanentAddress}
                  onChange={(e) => handleSameAddressToggle(e.target.checked)}
                  disabled={isSubmitting}
                  data-testid="same-address-checkbox"
                  className="rounded border-border text-primary-deep focus:ring-primary h-3.5 w-3.5"
                />
                <span className="font-medium">Same as permanent address</span>
              </label>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField label="Address Line 1" htmlFor="create-emp-curr-addr1">
                <Input
                  id="create-emp-curr-addr1"
                  type="text"
                  value={currAddress.address1}
                  onChange={(e) => updateCurrField('address1', e.target.value)}
                  placeholder="Enter door number, building, and street"
                  disabled={isSubmitting || formData.sameAsPermanentAddress}
                  data-testid="input-current-address"
                />
              </FormField>
              <FormField label="Address Line 2" htmlFor="create-emp-curr-addr2">
                <Input
                  id="create-emp-curr-addr2"
                  type="text"
                  value={currAddress.address2}
                  onChange={(e) => updateCurrField('address2', e.target.value)}
                  placeholder="Enter area, landmark, or locality"
                  disabled={isSubmitting || formData.sameAsPermanentAddress}
                  data-testid="input-current-address2"
                />
              </FormField>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <FormField label="City / Town" htmlFor="create-emp-curr-city">
                <Input
                  id="create-emp-curr-city"
                  type="text"
                  value={currAddress.city}
                  onChange={(e) => updateCurrField('city', e.target.value)}
                  placeholder="Enter city"
                  disabled={isSubmitting || formData.sameAsPermanentAddress}
                  data-testid="input-current-city"
                />
              </FormField>
              <FormField label="District" htmlFor="create-emp-curr-district">
                <Input
                  id="create-emp-curr-district"
                  type="text"
                  value={currAddress.district}
                  onChange={(e) => updateCurrField('district', e.target.value)}
                  placeholder="Enter district"
                  disabled={isSubmitting || formData.sameAsPermanentAddress}
                  data-testid="input-current-district"
                />
              </FormField>
              <FormField label="PIN Code" htmlFor="create-emp-curr-pincode">
                <Input
                  id="create-emp-curr-pincode"
                  type="text"
                  maxLength={10}
                  value={currAddress.pincode}
                  onChange={(e) => updateCurrField('pincode', e.target.value)}
                  placeholder="Enter PIN code"
                  disabled={isSubmitting || formData.sameAsPermanentAddress}
                  className="font-mono"
                  data-testid="input-current-pincode"
                />
              </FormField>
            </div>
          </div>

          {/* Resume Upload inside Personal Details */}
          <div className="md:col-span-2 pt-2 border-t border-border/70">
            <FormField label="Candidate Resume / Curriculum Vitae (CV)" htmlFor="create-emp-resume">
              <div className="p-4 rounded-xl border border-border bg-surface-muted/30 hover:border-primary-strong/40 transition-colors">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-primary-soft text-primary-deep flex items-center justify-center font-bold shrink-0">
                      <svg
                        className="w-4 h-4"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                        <line x1="16" y1="13" x2="8" y2="13" />
                        <line x1="16" y1="17" x2="8" y2="17" />
                        <polyline points="10 9 9 9 8 9" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-text">Employee resume</p>
                      <p className="text-[11px] text-text-muted">
                        Upload the employee’s resume (PDF, DOCX, or DOC, up to 10 MB).
                      </p>
                    </div>
                  </div>
                  {uploadedDocs.resume ? (
                    <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                      Uploaded
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-surface-muted text-text-muted border border-border">
                      Optional
                    </span>
                  )}
                </div>

                {uploadedDocs.resume ? (
                  <div className="mt-3 flex items-center justify-between p-2 rounded-lg bg-surface text-xs border border-border">
                    <span className="truncate max-w-[260px] font-medium text-text">
                      {uploadedDocs.resume.fileName} ({uploadedDocs.resume.size})
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemoveDoc('resume')}
                      className="text-xs text-rose-600 hover:text-rose-800 font-bold ml-2 cursor-pointer"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <label className="mt-2.5 flex items-center justify-center gap-2 py-2 px-3 rounded-lg border border-dashed border-border-strong hover:border-primary text-xs font-semibold text-text-muted hover:text-primary-ink bg-surface cursor-pointer transition-colors">
                    <svg
                      className="w-3.5 h-3.5"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="17 8 12 3 7 8" />
                      <line x1="12" y1="3" x2="12" y2="15" />
                    </svg>
                    <span>Select file</span>
                    <input
                      id="create-emp-resume"
                      type="file"
                      accept=".pdf,.docx,.doc"
                      onChange={(e) => handleDocUpload('resume', e)}
                      className="hidden"
                      data-testid="input-resume-upload"
                    />
                  </label>
                )}
              </div>
            </FormField>
          </div>
        </div>
      </div>

      {/* ============================================================== */}
      {/* SECTION 2: Employment and Hierarchy */}
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
            Enter the employee’s role, department and reporting manager.
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
            helperText={
              !isLoadingDepartments && departmentOptions.length === 0 && !departmentError
                ? 'No departments have been created yet.'
                : undefined
            }
          >
            <Select
              id="create-emp-department"
              value={formData.departmentId}
              onChange={(e) => setFieldValue('departmentId', e.target.value)}
              disabled={isSubmitting || (isLoadingDepartments && departmentOptions.length === 0)}
              placeholder={
                isLoadingDepartments && departmentOptions.length === 0
                  ? 'Loading departments...'
                  : 'Select department'
              }
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

          <FormField label="Work Email Address" htmlFor="create-emp-work-email">
            <Input
              id="create-emp-work-email"
              type="email"
              value={formData.workEmail || ''}
              onChange={(e) => setFieldValue('workEmail', e.target.value)}
              placeholder="Enter work email address"
              disabled={isSubmitting}
              autoCapitalize="none"
              data-testid="input-work-email"
            />
          </FormField>

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

          {/* Employment Service Status: Currently Working or Relieving Date */}
          <div className="md:col-span-2 pt-2 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl border border-border bg-surface-muted/40">
              <label className="flex items-start sm:items-center gap-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={isCurrentlyWorking}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setIsCurrentlyWorking(checked);
                    if (checked) setRelievingDate('');
                  }}
                  disabled={isSubmitting}
                  data-testid="checkbox-currently-working"
                  className="mt-0.5 sm:mt-0 rounded border-border text-primary-deep focus:ring-primary h-4 w-4"
                />
                <div>
                  <span className="font-semibold text-text text-sm block">
                    Currently working in this company
                  </span>
                  <span className="text-xs text-text-muted mt-0.5 block">
                    Check if employee is active; uncheck if contract ended or relieving date applies
                  </span>
                </div>
              </label>

              <span
                className={`px-3 py-1 text-xs font-semibold rounded-full border self-start sm:self-auto ${
                  isCurrentlyWorking
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-amber-50 text-amber-700 border-amber-200'
                }`}
              >
                {isCurrentlyWorking ? 'Active Employee' : 'Leaving / Resigned'}
              </span>
            </div>

            {!isCurrentlyWorking && (
              <div className="animate-crm-fade-up max-w-sm">
                <FormField
                  label="Relieving / Exit Date"
                  htmlFor="create-emp-relieving-date"
                  required
                >
                  <Input
                    id="create-emp-relieving-date"
                    type="date"
                    value={relievingDate}
                    onChange={(e) => setRelievingDate(e.target.value)}
                    disabled={isSubmitting}
                    data-testid="input-relieving-date"
                  />
                </FormField>
              </div>
            )}
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
            Bank and tax details
          </h2>
          <p className="text-sm text-text-muted mt-1">
            Enter the employee’s bank account and tax identification details.
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
              data-testid="input-bank-account-number"
            />
          </FormField>

          <FormField label="IFSC Code" htmlFor="create-emp-bank-ifsc" error={errors.bankIfscCode}>
            <Input
              id="create-emp-bank-ifsc"
              type="text"
              maxLength={11}
              value={formData.bankIfscCode}
              onChange={(e) => setFieldValue('bankIfscCode', e.target.value.toUpperCase())}
              placeholder="Enter IFSC code"
              disabled={isSubmitting}
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

          <FormField label="PAN Card Number" htmlFor="create-emp-pan" error={errors.panNumber}>
            <Input
              id="create-emp-pan"
              type="text"
              maxLength={10}
              value={formData.panNumber}
              onChange={(e) => setFieldValue('panNumber', e.target.value.toUpperCase())}
              placeholder="Enter PAN card number"
              disabled={isSubmitting}
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
                data-testid="input-aadhaar-number"
              />
            </FormField>
          </div>
        </div>
      </div>

      {/* ============================================================== */}
      {/* SECTION 4: Onboarding Documents (Aadhaar, PAN, Degree Certificates) */}
      {/* ============================================================== */}
      <div
        className={`bg-surface border border-border rounded-2xl p-6 sm:p-8 lg:p-10 shadow-card space-y-6 sm:space-y-8 transition-all duration-200 ${
          currentStep === 4 ? 'block' : 'hidden'
        }`}
        data-testid="section-onboarding-documents"
      >
        <div className="border-b border-border/70 pb-5">
          <h2 className="text-lg sm:text-xl font-bold text-text font-display flex items-center gap-2.5">
            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary-soft text-primary-deep text-xs font-bold">
              4
            </span>
            Onboarding Documents
          </h2>
          <p className="text-sm text-text-muted mt-1">
            Upload the employee’s identity and education documents.
          </p>
        </div>

        <div
          className="grid grid-cols-1 md:grid-cols-2 gap-5"
          data-testid="document-upload-section"
        >
          {/* 1. Aadhaar Card Upload */}
          <div className="p-5 rounded-2xl border border-border bg-surface hover:border-primary-strong/40 transition-all shadow-xs space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-primary-soft text-primary-deep flex items-center justify-center font-bold shrink-0">
                  <svg
                    className="w-4 h-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <rect x="3" y="4" width="18" height="16" rx="2" />
                    <circle cx="9" cy="10" r="2" />
                    <line x1="15" y1="8" x2="17" y2="8" />
                    <line x1="15" y1="12" x2="17" y2="12" />
                    <line x1="7" y1="16" x2="17" y2="16" />
                  </svg>
                </div>
                <div>
                  <p className="text-xs font-bold text-text">Aadhaar Card</p>
                  <p className="text-[11px] text-text-muted">
                    Government identity document (PDF, JPG, or PNG).
                  </p>
                </div>
              </div>
              {uploadedDocs.aadharCard ? (
                <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                  Uploaded
                </span>
              ) : (
                <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-surface-muted text-text-muted border border-border">
                  Optional
                </span>
              )}
            </div>

            {uploadedDocs.aadharCard ? (
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-surface-muted text-xs border border-border">
                <span className="truncate max-w-[200px] font-medium text-text">
                  {uploadedDocs.aadharCard.fileName} ({uploadedDocs.aadharCard.size})
                </span>
                <button
                  type="button"
                  onClick={() => handleRemoveDoc('aadharCard')}
                  className="text-xs text-rose-600 hover:text-rose-800 font-bold ml-2 cursor-pointer"
                >
                  Remove
                </button>
              </div>
            ) : (
              <label className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border border-dashed border-border-strong hover:border-primary text-xs font-semibold text-text-muted hover:text-primary-ink bg-surface-muted/40 cursor-pointer transition-colors">
                <svg
                  className="w-4 h-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                <span>Upload Aadhaar card</span>
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={(e) => handleDocUpload('aadharCard', e)}
                  className="hidden"
                  data-testid="upload-aadhaar"
                />
              </label>
            )}
          </div>

          {/* 2. PAN Card Upload */}
          <div className="p-5 rounded-2xl border border-border bg-surface hover:border-primary-strong/40 transition-all shadow-xs space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-primary-soft text-primary-deep flex items-center justify-center font-bold shrink-0">
                  <svg
                    className="w-4 h-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <rect x="2" y="5" width="20" height="14" rx="2" />
                    <line x1="2" y1="10" x2="22" y2="10" />
                  </svg>
                </div>
                <div>
                  <p className="text-xs font-bold text-text">PAN Card</p>
                  <p className="text-[11px] text-text-muted">
                    Income tax document (PDF, JPG, or PNG).
                  </p>
                </div>
              </div>
              {uploadedDocs.panCard ? (
                <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                  Uploaded
                </span>
              ) : (
                <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-surface-muted text-text-muted border border-border">
                  Optional
                </span>
              )}
            </div>

            {uploadedDocs.panCard ? (
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-surface-muted text-xs border border-border">
                <span className="truncate max-w-[200px] font-medium text-text">
                  {uploadedDocs.panCard.fileName} ({uploadedDocs.panCard.size})
                </span>
                <button
                  type="button"
                  onClick={() => handleRemoveDoc('panCard')}
                  className="text-xs text-rose-600 hover:text-rose-800 font-bold ml-2 cursor-pointer"
                >
                  Remove
                </button>
              </div>
            ) : (
              <label className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border border-dashed border-border-strong hover:border-primary text-xs font-semibold text-text-muted hover:text-primary-ink bg-surface-muted/40 cursor-pointer transition-colors">
                <svg
                  className="w-4 h-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                <span>Upload PAN card</span>
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={(e) => handleDocUpload('panCard', e)}
                  className="hidden"
                  data-testid="upload-pan"
                />
              </label>
            )}
          </div>

          {/* 3. Degree Certificates Upload */}
          <div className="p-5 rounded-2xl border border-border bg-surface hover:border-primary-strong/40 transition-all shadow-xs space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-primary-soft text-primary-deep flex items-center justify-center font-bold shrink-0">
                  <svg
                    className="w-4 h-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
                    <path d="M6 12v5c3 3 9 3 12 0v-5" />
                  </svg>
                </div>
                <div>
                  <p className="text-xs font-bold text-text">Degree Certificates</p>
                  <p className="text-[11px] text-text-muted">
                    Degree certificates (PDF, JPG, or PNG).
                  </p>
                </div>
              </div>
              {uploadedDocs.degreeCertificates ? (
                <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                  Uploaded
                </span>
              ) : (
                <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-surface-muted text-text-muted border border-border">
                  Optional
                </span>
              )}
            </div>

            {uploadedDocs.degreeCertificates ? (
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-surface-muted text-xs border border-border">
                <span className="truncate max-w-[200px] font-medium text-text">
                  {uploadedDocs.degreeCertificates.fileName} ({uploadedDocs.degreeCertificates.size}
                  )
                </span>
                <button
                  type="button"
                  onClick={() => handleRemoveDoc('degreeCertificates')}
                  className="text-xs text-rose-600 hover:text-rose-800 font-bold ml-2 cursor-pointer"
                >
                  Remove
                </button>
              </div>
            ) : (
              <label className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border border-dashed border-border-strong hover:border-primary text-xs font-semibold text-text-muted hover:text-primary-ink bg-surface-muted/40 cursor-pointer transition-colors">
                <svg
                  className="w-4 h-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                <span>Upload degree certificates</span>
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.docx"
                  onChange={(e) => handleDocUpload('degreeCertificates', e)}
                  className="hidden"
                  data-testid="upload-degrees"
                />
              </label>
            )}
          </div>

          {/* 4. Signed Appointment Letter */}
          <div className="p-5 rounded-2xl border border-border bg-surface hover:border-primary-strong/40 transition-all shadow-xs space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-primary-soft text-primary-deep flex items-center justify-center font-bold shrink-0">
                  <svg
                    className="w-4 h-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                  </svg>
                </div>
                <div>
                  <p className="text-xs font-bold text-text">Signed Appointment Letter</p>
                  <p className="text-[11px] text-text-muted">
                    Signed offer and terms (PDF or DOCX).
                  </p>
                </div>
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
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-surface-muted text-xs border border-border">
                <span className="truncate max-w-[200px] font-medium text-text">
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
              <label className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border border-dashed border-border-strong hover:border-primary text-xs font-semibold text-text-muted hover:text-primary-ink bg-surface-muted/40 cursor-pointer transition-colors">
                <svg
                  className="w-4 h-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                <span>Upload appointment letter</span>
                <input
                  type="file"
                  accept=".pdf,.docx,.doc"
                  onChange={(e) => handleDocUpload('appointmentLetter', e)}
                  className="hidden"
                />
              </label>
            )}
          </div>
        </div>
      </div>

      {/* ============================================================== */}
      {/* SECTION 5: Role & System Access */}
      {/* ============================================================== */}
      <div
        className={`bg-surface border border-border rounded-2xl p-6 sm:p-8 lg:p-10 shadow-card space-y-6 sm:space-y-8 transition-all duration-200 ${
          currentStep === 5 ? 'block' : 'hidden'
        }`}
        data-testid="section-role-access"
      >
        <div className="border-b border-border/70 pb-5">
          <h2 className="text-lg sm:text-xl font-bold text-text font-display flex items-center gap-2.5">
            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary-soft text-primary-deep text-xs font-bold">
              5
            </span>
            System Role &amp; Access
          </h2>
          <p className="text-sm text-text-muted mt-1">
            Choose the employee’s initial role.{' '}
            {isAdmin
              ? 'Admins can assign any role.'
              : 'HR Managers can assign Staff or Team Lead roles.'}
          </p>
        </div>

        <FormField label="Assigned Role" htmlFor="create-emp-role" required error={errors.role}>
          <div
            className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2"
            data-testid="role-options-group"
          >
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
                    <p className="text-text-muted mt-1 text-xs leading-relaxed">{r.description}</p>
                  </div>
                </label>
              );
            })}
          </div>
        </FormField>

        {/* Sign-in Password Configuration */}
        <div
          className="space-y-4 pt-4 border-t border-border/70"
          data-testid="password-config-section"
        >
          <div>
            <label className="block text-xs font-bold text-text mb-1">
              Initial Sign-in Password <span className="text-danger">*</span>
            </label>
            <p className="text-xs text-text-muted">
              Configure initial credentials for the employee. Choose automatic generation or specify
              a custom password.
            </p>
          </div>

          {/* Mode Selector: Automatic vs Custom / Edit */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setFieldValue('passwordMode', 'auto')}
              className={`flex items-start gap-3 p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                formData.passwordMode === 'auto'
                  ? 'bg-primary-soft border-primary-strong ring-2 ring-primary/20 shadow-raised'
                  : 'bg-surface border-border hover:bg-surface-muted'
              }`}
              data-testid="password-mode-auto"
            >
              <input
                type="radio"
                name="passwordMode"
                checked={formData.passwordMode === 'auto'}
                onChange={() => setFieldValue('passwordMode', 'auto')}
                className="mt-0.5 h-4 w-4 text-primary-deep focus:ring-primary-strong"
              />
              <div>
                <p className="text-xs font-bold text-text">Automatic Password</p>
                <p className="text-[11px] text-text-muted mt-0.5">
                  Generates a strong, random password automatically.
                </p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setFieldValue('passwordMode', 'custom')}
              className={`flex items-start gap-3 p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                formData.passwordMode === 'custom'
                  ? 'bg-primary-soft border-primary-strong ring-2 ring-primary/20 shadow-raised'
                  : 'bg-surface border-border hover:bg-surface-muted'
              }`}
              data-testid="password-mode-custom"
            >
              <input
                type="radio"
                name="passwordMode"
                checked={formData.passwordMode === 'custom'}
                onChange={() => setFieldValue('passwordMode', 'custom')}
                className="mt-0.5 h-4 w-4 text-primary-deep focus:ring-primary-strong"
              />
              <div>
                <p className="text-xs font-bold text-text">Edit / Custom Password</p>
                <p className="text-[11px] text-text-muted mt-0.5">
                  Set a specific initial password for this employee.
                </p>
              </div>
            </button>
          </div>

          {/* Password Input Display */}
          {formData.passwordMode === 'auto' ? (
            <div className="p-4 rounded-xl bg-surface-muted border border-border space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-text uppercase tracking-wider">
                  Generated Password
                </span>
                <button
                  type="button"
                  onClick={regeneratePassword}
                  disabled={isSubmitting}
                  className="text-xs font-semibold text-primary-deep hover:text-primary-ink flex items-center gap-1.5 transition-colors cursor-pointer"
                  data-testid="regenerate-password-btn"
                >
                  <svg
                    className="w-3.5 h-3.5"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
                  </svg>
                  Regenerate
                </button>
              </div>

              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={formData.password}
                    readOnly
                    className="w-full pl-3.5 pr-10 py-2.5 bg-surface border border-border rounded-xl text-xs sm:text-sm font-mono text-text select-all"
                    data-testid="input-auto-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-text-muted hover:text-text cursor-pointer transition-colors"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    data-testid="toggle-show-auto-password"
                  >
                    {showPassword ? (
                      <svg
                        className="w-4 h-4"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                        <line x1="1" y1="1" x2="23" y2="23" />
                      </svg>
                    ) : (
                      <svg
                        className="w-4 h-4"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    )}
                  </button>
                </div>
                <button
                  type="button"
                  onClick={handleCopyPassword}
                  className="px-3.5 py-2.5 rounded-xl border border-border bg-surface hover:bg-surface-raised text-xs font-semibold text-text flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 shadow-2xs"
                  data-testid="copy-auto-password-btn"
                >
                  {copiedPassword ? (
                    <>
                      <span className="text-emerald-600 font-bold">✓</span>
                      <span className="text-emerald-700">Copied</span>
                    </>
                  ) : (
                    <>
                      <svg
                        className="w-3.5 h-3.5 text-text-muted"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                      </svg>
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>
              <p className="text-[11px] text-text-muted">
                This password will be securely assigned to the user account. Administrators can view
                or copy it anytime from User Accounts.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <FormField
                label="Custom Password"
                htmlFor="create-emp-custom-password"
                required
                error={errors.password}
              >
                <div className="relative">
                  <Input
                    id="create-emp-custom-password"
                    type={showPassword ? 'text' : 'password'}
                    value={formData.password}
                    onChange={(e) => setFieldValue('password', e.target.value)}
                    placeholder="Enter at least 8 characters"
                    disabled={isSubmitting}
                    className="font-mono pr-10"
                    data-testid="input-custom-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-text-muted hover:text-text cursor-pointer transition-colors"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    data-testid="toggle-show-custom-password"
                  >
                    {showPassword ? (
                      <svg
                        className="w-4 h-4"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                        <line x1="1" y1="1" x2="23" y2="23" />
                      </svg>
                    ) : (
                      <svg
                        className="w-4 h-4"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    )}
                  </button>
                </div>
              </FormField>
              <p className="text-[11px] text-text-muted">
                Must be at least 8 characters. Recommended to include letters, numbers, and symbols.
              </p>
            </div>
          )}
        </div>

        {/* Informative Notice on Pending Status */}
        <div
          className="p-4 sm:p-5 bg-amber-50/80 border border-amber-200/80 rounded-xl text-xs text-amber-900 space-y-1.5"
          role="note"
          aria-label="Pending Account Creation Notice"
        >
          <div className="flex items-center gap-2 font-semibold text-amber-950 text-sm">
            <svg
              className="w-4 h-4 fill-current shrink-0 text-amber-600"
              viewBox="0 0 20 20"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                clipRule="evenodd"
              />
            </svg>
            Pending Account Activation Notice
          </div>
          <p className="text-amber-900/90 leading-relaxed text-xs">
            The account will be created with status <StatusPill status="Pending" size="sm" />. The
            initial password configured above will be provisioned for sign-in once the account is
            activated.
          </p>
        </div>
      </div>

      {/* ============================================================== */}
      {/* SECTION 6: Declaration & Onboarding Checklist */}
      {/* ============================================================== */}
      <div
        className={`bg-surface border border-border rounded-2xl p-6 sm:p-8 lg:p-10 shadow-card space-y-6 sm:space-y-8 transition-all duration-200 ${
          currentStep === 6 ? 'block' : 'hidden'
        }`}
        data-testid="section-declaration-checklist"
      >
        <div className="border-b border-border/70 pb-5">
          <h2 className="text-lg sm:text-xl font-bold text-text font-display flex items-center gap-2.5">
            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary-soft text-primary-deep text-xs font-bold">
              6
            </span>
            Declaration &amp; Onboarding Checklist
          </h2>
          <p className="text-sm text-text-muted mt-1">
            Review the employee’s details and confirm the onboarding checklist before submitting.
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
              <span className="font-mono">{formData.workEmail || formData.email || '—'}</span>
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
              <span className="text-text-muted block text-[11px]">Role:</span>
              <span className="capitalize">{formData.role}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ============================================================== */}
      {/* WIZARD NAVIGATION AND SUBMIT BAR */}
      {/* ============================================================== */}
      <div className="flex items-center justify-between gap-4 pt-6 border-t border-border/80">
        {/* Previous step */}
        {currentStep > 1 ? (
          <Button
            type="button"
            variant="outline"
            onClick={prevStep}
            disabled={isSubmitting}
            className="h-12 px-5 rounded-xl text-sm flex items-center justify-center font-semibold shadow-xs hover:bg-surface-muted cursor-pointer"
            data-testid="prev-step-button"
          >
            Previous
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
          className={
            currentStep === 6
              ? 'h-12 px-8 text-sm font-semibold ml-auto shadow-md rounded-xl'
              : 'hidden'
          }
          data-testid="desktop-submit-button"
        >
          Create Employee
        </Button>

        {/* Next step */}
        {currentStep < 6 && (
          <Button
            type="button"
            variant="primary"
            onClick={nextStep}
            disabled={isSubmitting}
            className="h-12 px-6 rounded-xl text-sm flex items-center justify-center font-semibold ml-auto shadow-md cursor-pointer"
            data-testid="next-step-button"
          >
            Next
          </Button>
        )}
      </div>
    </form>
  );
}
