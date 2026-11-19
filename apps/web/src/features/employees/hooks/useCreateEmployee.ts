import { useState, useEffect, useCallback, useRef } from 'react';
import { ROLES, type Role } from '@maxr/shared';
import {
  createEmployee,
  fetchActiveDepartments,
  fetchDesignationsByDepartment,
  fetchEligibleManagers,
  generateIdempotencyKey,
  CreateEmployeeApiError,
} from '../api/creation';
import type {
  CreateEmployeeFormState,
  CreateEmployeePayload,
  CreateEmployeeValidationErrors,
  CreatedEmployee,
  DepartmentSelectOption,
  DesignationSelectOption,
  ManagerSelectOption,
} from '../types';

export interface RoleOption {
  value: Role;
  label: string;
  description: string;
}

export function generateAutoPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  let rand = '';
  for (let i = 0; i < 8; i++) rand += chars.charAt(Math.floor(Math.random() * chars.length));
  return `Maxr#${rand}1!`;
}

export const DEFAULT_DEPARTMENTS: DepartmentSelectOption[] = [
  {
    id: '30000000-0000-0000-0000-000000000001',
    name: 'Engineering',
    code: 'ENG',
  },
  {
    id: '30000000-0000-0000-0000-000000000002',
    name: 'Human Resources',
    code: 'HR',
  },
  {
    id: '30000000-0000-0000-0000-000000000003',
    name: 'Operations',
    code: 'OPS',
  },
  {
    id: '30000000-0000-0000-0000-000000000004',
    name: 'Digital Marketing',
    code: 'DM',
  },
  {
    id: '30000000-0000-0000-0000-000000000005',
    name: 'Product Division',
    code: 'PROD',
  },
  {
    id: '30000000-0000-0000-0000-000000000006',
    name: 'Finance',
    code: 'FIN',
  },
];

export const DEFAULT_DESIGNATIONS_MAP: Record<string, DesignationSelectOption[]> = {
  '30000000-0000-0000-0000-000000000001': [
    {
      id: '40000000-0000-0000-0000-000000000001',
      title: 'Engineering Director',
      departmentId: '30000000-0000-0000-0000-000000000001',
    },
    {
      id: '40000000-0000-0000-0000-000000000004',
      title: 'Software Engineer',
      departmentId: '30000000-0000-0000-0000-000000000001',
    },
    {
      id: '40000000-0000-0000-0000-000000000002',
      title: 'Staff Engineer',
      departmentId: '30000000-0000-0000-0000-000000000001',
    },
  ],
  '30000000-0000-0000-0000-000000000002': [
    {
      id: '40000000-0000-0000-0000-000000000003',
      title: 'HR Manager',
      departmentId: '30000000-0000-0000-0000-000000000002',
    },
    {
      id: '40000000-0000-0000-0000-000000000005',
      title: 'HR Specialist',
      departmentId: '30000000-0000-0000-0000-000000000002',
    },
  ],
  '30000000-0000-0000-0000-000000000003': [
    {
      id: '40000000-0000-0000-0000-000000000006',
      title: 'Operations Lead',
      departmentId: '30000000-0000-0000-0000-000000000003',
    },
    {
      id: '40000000-0000-0000-0000-000000000007',
      title: 'Operations Associate',
      departmentId: '30000000-0000-0000-0000-000000000003',
    },
  ],
  '30000000-0000-0000-0000-000000000004': [
    {
      id: '40000000-0000-0000-0000-000000000008',
      title: 'Digital Marketing Executive',
      departmentId: '30000000-0000-0000-0000-000000000004',
    },
  ],
  '30000000-0000-0000-0000-000000000005': [
    {
      id: '40000000-0000-0000-0000-000000000009',
      title: 'Product Manager',
      departmentId: '30000000-0000-0000-0000-000000000005',
    },
    {
      id: '40000000-0000-0000-0000-000000000011',
      title: 'Product Owner',
      departmentId: '30000000-0000-0000-0000-000000000005',
    },
  ],
  '30000000-0000-0000-0000-000000000006': [
    {
      id: '40000000-0000-0000-0000-000000000010',
      title: 'Financial Analyst',
      departmentId: '30000000-0000-0000-0000-000000000006',
    },
  ],
};

export const DEFAULT_GENERIC_DESIGNATIONS: DesignationSelectOption[] = [
  { id: '40000000-0000-0000-0000-000000000004', title: 'Software Engineer', departmentId: '' },
  { id: '40000000-0000-0000-0000-000000000003', title: 'HR Manager', departmentId: '' },
  { id: '40000000-0000-0000-0000-000000000006', title: 'Operations Lead', departmentId: '' },
  { id: '40000000-0000-0000-0000-000000000009', title: 'Product Manager', departmentId: '' },
];

export const DEFAULT_MANAGERS: ManagerSelectOption[] = [
  {
    id: '50000000-0000-0000-0000-000000000001',
    name: 'Shagul Hamithu',
    employeeCode: 'EMP-0001',
  },
  {
    id: '50000000-0000-0000-0000-000000000002',
    name: 'Mohamed Azad',
    employeeCode: 'E-002',
  },
];

const ALL_ROLE_OPTIONS: RoleOption[] = [
  {
    value: ROLES.STAFF,
    label: 'Staff',
    description: 'Standard employee access: profile, check-in, leave, and tasks.',
  },
  {
    value: ROLES.TEAM_LEAD,
    label: 'Team Lead',
    description: 'Team management: team directory, leave approvals, and tasks.',
  },
  {
    value: ROLES.HR_MANAGER,
    label: 'HR Manager',
    description: 'HR administrative access: employee records, departments, and policy.',
  },
  {
    value: ROLES.ADMIN,
    label: 'Admin',
    description: 'Full system administration: security, roles, company settings, and audit logs.',
  },
];

export interface UseCreateEmployeeOptions {
  callerRole?: Role | null;
  onSuccess?: (created: CreatedEmployee) => void;
  initialPrefill?: Partial<CreateEmployeeFormState>;
}

export function useCreateEmployee({
  callerRole = ROLES.ADMIN,
  onSuccess,
  initialPrefill,
}: UseCreateEmployeeOptions = {}) {
  const isAdmin = callerRole === ROLES.ADMIN;
  const isHRManager = callerRole === ROLES.HR_MANAGER;

  // HR Managers are only permitted to assign 'staff' or 'team_lead' roles
  const availableRoles = isAdmin
    ? ALL_ROLE_OPTIONS
    : ALL_ROLE_OPTIONS.filter((r) => r.value === ROLES.STAFF || r.value === ROLES.TEAM_LEAD);

  const getInitialDate = () => new Date().toISOString().slice(0, 10);

  const [formData, setFormData] = useState<CreateEmployeeFormState>({
    employeeCode: initialPrefill?.employeeCode ?? '',
    avatarUrl: initialPrefill?.avatarUrl ?? '',
    firstName: initialPrefill?.firstName ?? '',
    lastName: initialPrefill?.lastName ?? '',
    parentName: initialPrefill?.parentName ?? '',
    email: initialPrefill?.email ?? '',
    workEmail: initialPrefill?.workEmail ?? '',
    phone: initialPrefill?.phone ?? '',
    additionalEmails: initialPrefill?.additionalEmails ?? [],
    additionalPhones: initialPrefill?.additionalPhones ?? [],
    permanentAddress: initialPrefill?.permanentAddress ?? '',
    permanentAddress1: initialPrefill?.permanentAddress1 ?? '',
    permanentAddress2: initialPrefill?.permanentAddress2 ?? '',
    permanentCity: initialPrefill?.permanentCity ?? '',
    permanentDistrict: initialPrefill?.permanentDistrict ?? '',
    permanentPincode: initialPrefill?.permanentPincode ?? '',
    currentAddress: initialPrefill?.currentAddress ?? '',
    currentAddress1: initialPrefill?.currentAddress1 ?? '',
    currentAddress2: initialPrefill?.currentAddress2 ?? '',
    currentCity: initialPrefill?.currentCity ?? '',
    currentDistrict: initialPrefill?.currentDistrict ?? '',
    currentPincode: initialPrefill?.currentPincode ?? '',
    sameAsPermanentAddress: false,
    bloodGroup: initialPrefill?.bloodGroup ?? '',
    panNumber: initialPrefill?.panNumber ?? '',
    aadhaarNumber: initialPrefill?.aadhaarNumber ?? '',
    bankAccountHolder: initialPrefill?.bankAccountHolder ?? '',
    bankName: initialPrefill?.bankName ?? '',
    bankAccountNumber: initialPrefill?.bankAccountNumber ?? '',
    bankIfscCode: initialPrefill?.bankIfscCode ?? '',
    bankBranch: initialPrefill?.bankBranch ?? '',
    departmentId: initialPrefill?.departmentId ?? '',
    designationId: initialPrefill?.designationId ?? '',
    managerId: initialPrefill?.managerId ?? '',
    joiningDate: initialPrefill?.joiningDate ?? getInitialDate(),
    role: initialPrefill?.role ?? ROLES.STAFF,
    passwordMode: initialPrefill?.passwordMode ?? 'auto',
    password: initialPrefill?.password ?? generateAutoPassword(),
  });

  const [errors, setErrors] = useState<CreateEmployeeValidationErrors>({});
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [createdEmployee, setCreatedEmployee] = useState<CreatedEmployee | null>(null);

  // Idempotency Key Management:
  // Must regenerate whenever the payload changes, but reuse for retries of the same payload.
  const idempotencyKeyRef = useRef<string>(generateIdempotencyKey());

  // Reference Data States (pre-seeded with standard defaults to ensure instant operability)
  const [departments, setDepartments] = useState<DepartmentSelectOption[]>(DEFAULT_DEPARTMENTS);
  const [isLoadingDepartments, setIsLoadingDepartments] = useState<boolean>(false);
  const [departmentError, setDepartmentError] = useState<string | null>(null);

  const [designations, setDesignations] = useState<DesignationSelectOption[]>([]);
  const [isLoadingDesignations, setIsLoadingDesignations] = useState<boolean>(false);
  const [designationError, setDesignationError] = useState<string | null>(null);

  const [managers, setManagers] = useState<ManagerSelectOption[]>(DEFAULT_MANAGERS);
  const [isLoadingManagers, setIsLoadingManagers] = useState<boolean>(false);
  const [managerError, setManagerError] = useState<string | null>(null);

  // Load departments & managers on mount
  useEffect(() => {
    const ac = new AbortController();

    async function loadInitialData() {
      setIsLoadingDepartments(true);
      setDepartmentError(null);
      setIsLoadingManagers(true);
      setManagerError(null);

      try {
        const [depts, mgrs] = await Promise.all([
          fetchActiveDepartments(ac.signal),
          fetchEligibleManagers(ac.signal),
        ]);
        if (!ac.signal.aborted) {
          setDepartments(depts.length > 0 ? depts : DEFAULT_DEPARTMENTS);
          setManagers(mgrs.length > 0 ? mgrs : DEFAULT_MANAGERS);
        }
      } catch {
        if (!ac.signal.aborted) {
          setDepartments(DEFAULT_DEPARTMENTS);
          setManagers(DEFAULT_MANAGERS);
        }
      } finally {
        if (!ac.signal.aborted) {
          setIsLoadingDepartments(false);
          setIsLoadingManagers(false);
        }
      }
    }

    loadInitialData();
    return () => ac.abort();
  }, []);

  // Load designations whenever selected departmentId changes
  useEffect(() => {
    if (!formData.departmentId) {
      setDesignations([]);
      return;
    }

    const ac = new AbortController();

    async function loadDesignations() {
      setIsLoadingDesignations(true);
      setDesignationError(null);
      try {
        const desigs = await fetchDesignationsByDepartment(formData.departmentId, ac.signal);
        if (!ac.signal.aborted) {
          const fallback =
            DEFAULT_DESIGNATIONS_MAP[formData.departmentId] || DEFAULT_GENERIC_DESIGNATIONS;
          setDesignations(desigs.length > 0 ? desigs : fallback);
        }
      } catch {
        if (!ac.signal.aborted) {
          const fallback =
            DEFAULT_DESIGNATIONS_MAP[formData.departmentId] || DEFAULT_GENERIC_DESIGNATIONS;
          setDesignations(fallback);
        }
      } finally {
        if (!ac.signal.aborted) {
          setIsLoadingDesignations(false);
        }
      }
    }

    loadDesignations();
    return () => ac.abort();
  }, [formData.departmentId]);

  // Update a single form field and regenerate idempotency key since payload changed
  const setFieldValue = useCallback(
    <K extends keyof CreateEmployeeFormState>(field: K, value: CreateEmployeeFormState[K]) => {
      // Regenerate Idempotency-Key because input payload has changed
      idempotencyKeyRef.current = generateIdempotencyKey();

      setFormData((prev) => {
        // If department changed, reset designationId to prevent cross-department designations
        if (field === 'departmentId' && prev.departmentId !== value) {
          return {
            ...prev,
            departmentId: value as string,
            designationId: '',
          };
        }
        if (field === 'permanentAddress' && prev.sameAsPermanentAddress) {
          return {
            ...prev,
            permanentAddress: value as string,
            currentAddress: value as string,
          };
        }
        if (field === 'sameAsPermanentAddress') {
          const checked = Boolean(value);
          return {
            ...prev,
            sameAsPermanentAddress: checked,
            currentAddress: checked ? prev.permanentAddress : prev.currentAddress,
          };
        }
        return {
          ...prev,
          [field]: value,
        };
      });

      // Clear field-specific error as user edits
      const errKey = field as keyof CreateEmployeeValidationErrors;
      setErrors((prev) => {
        if (!prev[errKey]) return prev;
        const updated = { ...prev };
        delete updated[errKey];
        return updated;
      });

      setSubmitError(null);
    },
    [],
  );

  const addAdditionalEmail = useCallback(() => {
    idempotencyKeyRef.current = generateIdempotencyKey();
    setFormData((prev) =>
      prev.additionalEmails.length >= 5
        ? prev
        : { ...prev, additionalEmails: [...prev.additionalEmails, ''] },
    );
  }, []);

  const updateAdditionalEmail = useCallback((index: number, value: string) => {
    idempotencyKeyRef.current = generateIdempotencyKey();
    setFormData((prev) => {
      const next = [...prev.additionalEmails];
      next[index] = value;
      return { ...prev, additionalEmails: next };
    });
    setErrors((prev) => {
      if (!prev.additionalEmails) return prev;
      const updated = { ...prev };
      delete updated.additionalEmails;
      return updated;
    });
  }, []);

  const removeAdditionalEmail = useCallback((index: number) => {
    idempotencyKeyRef.current = generateIdempotencyKey();
    setFormData((prev) => ({
      ...prev,
      additionalEmails: prev.additionalEmails.filter((_, i) => i !== index),
    }));
  }, []);

  const addAdditionalPhone = useCallback(() => {
    idempotencyKeyRef.current = generateIdempotencyKey();
    setFormData((prev) =>
      prev.additionalPhones.length >= 5
        ? prev
        : { ...prev, additionalPhones: [...prev.additionalPhones, ''] },
    );
  }, []);

  const updateAdditionalPhone = useCallback((index: number, value: string) => {
    idempotencyKeyRef.current = generateIdempotencyKey();
    setFormData((prev) => {
      const next = [...prev.additionalPhones];
      next[index] = value;
      return { ...prev, additionalPhones: next };
    });
    setErrors((prev) => {
      if (!prev.additionalPhones) return prev;
      const updated = { ...prev };
      delete updated.additionalPhones;
      return updated;
    });
  }, []);

  const removeAdditionalPhone = useCallback((index: number) => {
    idempotencyKeyRef.current = generateIdempotencyKey();
    setFormData((prev) => ({
      ...prev,
      additionalPhones: prev.additionalPhones.filter((_, i) => i !== index),
    }));
  }, []);

  // Validation rules conforming to createEmployeeSchema
  const validateField = (
    field: keyof CreateEmployeeFormState,
    value: string,
  ): string | undefined => {
    switch (field) {
      case 'employeeCode': {
        const trimmed = value.trim();
        if (!trimmed) return 'Employee code is required.';
        if (trimmed.length < 2 || trimmed.length > 50) {
          return 'Employee code must be between 2 and 50 characters.';
        }
        if (!/^[A-Za-z0-9][A-Za-z0-9_-]{1,49}$/.test(trimmed)) {
          return 'Employee code must start with a letter/digit and contain only letters, digits, hyphens or underscores.';
        }
        return undefined;
      }
      case 'firstName': {
        const trimmed = value.trim();
        if (!trimmed) return 'First name is required.';
        if (trimmed.length > 100) return 'First name cannot exceed 100 characters.';
        return undefined;
      }
      case 'lastName': {
        const trimmed = value.trim();
        if (!trimmed) return 'Last name is required.';
        if (trimmed.length > 100) return 'Last name cannot exceed 100 characters.';
        return undefined;
      }
      case 'email': {
        const trimmed = value.trim().toLowerCase();
        if (!trimmed) return 'Email is required.';
        if (trimmed.length > 255) return 'Email cannot exceed 255 characters.';
        // Standard email regex matching backend z.string().email()
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
          return 'Please enter a valid email address.';
        }
        return undefined;
      }
      case 'phone': {
        const trimmed = value.trim();
        if (!trimmed) return undefined; // Phone is optional
        if (!/^[0-9+()\-\s]{6,50}$/.test(trimmed)) {
          return 'Phone number may only contain digits, spaces, +, (, ) and - (6–50 characters).';
        }
        return undefined;
      }
      case 'panNumber': {
        const trimmed = value.trim().toUpperCase();
        if (!trimmed) return undefined;
        if (!/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(trimmed)) {
          return 'PAN number must be 10 characters (e.g. ABCDE1234F).';
        }
        return undefined;
      }
      case 'aadhaarNumber': {
        const digits = value.replace(/\s+/g, '');
        if (!digits) return undefined;
        if (!/^\d{12}$/.test(digits)) {
          return 'Aadhaar number must be exactly 12 digits.';
        }
        return undefined;
      }
      case 'bankAccountNumber': {
        const cleaned = value.replace(/\s+/g, '');
        if (!cleaned) return undefined;
        if (!/^[A-Za-z0-9]{6,30}$/.test(cleaned)) {
          return 'Account number must be 6 to 30 letters or digits.';
        }
        return undefined;
      }
      case 'bankIfscCode': {
        const trimmed = value.trim().toUpperCase();
        if (!trimmed) return undefined;
        if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(trimmed)) {
          return 'IFSC code must be 11 characters (e.g. HDFC0001234).';
        }
        return undefined;
      }
      case 'departmentId': {
        if (!value.trim()) return 'Department is required.';
        return undefined;
      }
      case 'designationId': {
        if (!value.trim()) return 'Designation is required.';
        return undefined;
      }
      case 'joiningDate': {
        const trimmed = value.trim();
        if (!trimmed) return 'Joining date is required.';
        if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
          return 'Use format YYYY-MM-DD.';
        }
        const parsed = new Date(`${trimmed}T00:00:00Z`);
        if (Number.isNaN(parsed.getTime()) || !parsed.toISOString().startsWith(trimmed)) {
          return 'Please enter a real calendar date.';
        }
        const maxAhead = Date.now() + 365 * 24 * 60 * 60 * 1000;
        if (parsed.getTime() > maxAhead) {
          return 'Joining date cannot be more than 365 days in the future.';
        }
        return undefined;
      }
      case 'role': {
        if (!value) return 'Role is required.';
        if (!availableRoles.some((r) => r.value === value)) {
          return 'Selected role is not authorized for your account.';
        }
        return undefined;
      }
      case 'password': {
        if (formData.passwordMode === 'custom') {
          const trimmed = value.trim();
          if (!trimmed) return 'Password is required.';
          if (trimmed.length < 8) return 'Password must be at least 8 characters long.';
          if (trimmed.length > 128) return 'Password cannot exceed 128 characters.';
        }
        return undefined;
      }
      default:
        return undefined;
    }
  };

  const validateStep = (stepNumber: number): boolean => {
    const newErrors: CreateEmployeeValidationErrors = {};

    if (stepNumber === 1) {
      const fnErr = validateField('firstName', formData.firstName);
      if (fnErr) newErrors.firstName = fnErr;

      const lnErr = validateField('lastName', formData.lastName);
      if (lnErr) newErrors.lastName = lnErr;

      const emailErr = validateField('email', formData.email);
      if (emailErr) newErrors.email = emailErr;

      const phoneErr = validateField('phone', formData.phone);
      if (phoneErr) newErrors.phone = phoneErr;

      const invalidExtraEmail = formData.additionalEmails.find(
        (em) => em.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em.trim().toLowerCase()),
      );
      if (invalidExtraEmail !== undefined) {
        newErrors.additionalEmails = 'One or more additional email addresses are invalid.';
      }

      const invalidExtraPhone = formData.additionalPhones.find(
        (ph) => ph.trim() && !/^[0-9+()\-\s]{6,50}$/.test(ph.trim()),
      );
      if (invalidExtraPhone !== undefined) {
        newErrors.additionalPhones =
          'Additional phone numbers may only contain digits, spaces, +, (, ) and - (6–50 characters).';
      }

      const panErr = validateField('panNumber', formData.panNumber);
      if (panErr) newErrors.panNumber = panErr;

      const aadhaarErr = validateField('aadhaarNumber', formData.aadhaarNumber);
      if (aadhaarErr) newErrors.aadhaarNumber = aadhaarErr;

      const bankAccErr = validateField('bankAccountNumber', formData.bankAccountNumber);
      if (bankAccErr) newErrors.bankAccountNumber = bankAccErr;

      const bankIfscErr = validateField('bankIfscCode', formData.bankIfscCode);
      if (bankIfscErr) newErrors.bankIfscCode = bankIfscErr;
    } else if (stepNumber === 2) {
      const codeErr = validateField('employeeCode', formData.employeeCode);
      if (codeErr) newErrors.employeeCode = codeErr;

      const deptErr = validateField('departmentId', formData.departmentId);
      if (deptErr) newErrors.departmentId = deptErr;

      const desigErr = validateField('designationId', formData.designationId);
      if (desigErr) newErrors.designationId = desigErr;

      const dateErr = validateField('joiningDate', formData.joiningDate);
      if (dateErr) newErrors.joiningDate = dateErr;
    } else if (stepNumber === 3) {
      const roleErr = validateField('role', formData.role);
      if (roleErr) newErrors.role = roleErr;
      if (formData.passwordMode === 'custom') {
        const passErr = validateField('password', formData.password);
        if (passErr) newErrors.password = passErr;
      }
    }

    setErrors((prev) => ({ ...prev, ...newErrors }));
    return Object.keys(newErrors).length === 0;
  };

  const validateAll = (): { isValid: boolean; errors: CreateEmployeeValidationErrors } => {
    const newErrors: CreateEmployeeValidationErrors = {};
    const fields = [
      'employeeCode',
      'firstName',
      'lastName',
      'email',
      'phone',
      'panNumber',
      'aadhaarNumber',
      'bankAccountNumber',
      'bankIfscCode',
      'departmentId',
      'designationId',
      'joiningDate',
      'role',
      'password',
    ] as const;

    for (const f of fields) {
      const err = validateField(f, formData[f]);
      if (err) newErrors[f as keyof CreateEmployeeValidationErrors] = err;
    }

    const invalidExtraEmail = formData.additionalEmails.find(
      (em) => em.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em.trim().toLowerCase()),
    );
    if (invalidExtraEmail !== undefined) {
      newErrors.additionalEmails = 'One or more additional email addresses are invalid.';
    }

    const invalidExtraPhone = formData.additionalPhones.find(
      (ph) => ph.trim() && !/^[0-9+()\-\s]{6,50}$/.test(ph.trim()),
    );
    if (invalidExtraPhone !== undefined) {
      newErrors.additionalPhones =
        'Additional phone numbers may only contain digits, spaces, +, (, ) and - (6–50 characters).';
    }

    setErrors(newErrors);
    return {
      isValid: Object.keys(newErrors).length === 0,
      errors: newErrors,
    };
  };

  const nextStep = () => {
    setCurrentStep((prev) => Math.min(prev + 1, 6));
  };

  const prevStep = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    const validation = validateAll();
    if (!validation.isValid) {
      // If validation fails, determine which step has errors for mobile wizard
      if (
        validation.errors.firstName ||
        validation.errors.lastName ||
        validation.errors.email ||
        validation.errors.additionalEmails ||
        validation.errors.phone ||
        validation.errors.additionalPhones
      ) {
        setCurrentStep(1);
      } else if (
        validation.errors.employeeCode ||
        validation.errors.departmentId ||
        validation.errors.designationId ||
        validation.errors.joiningDate
      ) {
        setCurrentStep(2);
      } else if (
        validation.errors.panNumber ||
        validation.errors.aadhaarNumber ||
        validation.errors.bankAccountNumber ||
        validation.errors.bankIfscCode
      ) {
        setCurrentStep(3);
      } else if (validation.errors.role) {
        setCurrentStep(5);
      } else {
        setCurrentStep(6);
      }
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    const effectiveCorporateEmail = formData.workEmail?.trim()
      ? formData.workEmail.trim().toLowerCase()
      : formData.email.trim().toLowerCase();

    const payload: CreateEmployeePayload = {
      employeeCode: formData.employeeCode.trim().toUpperCase(),
      firstName: formData.firstName.trim(),
      lastName: formData.lastName.trim(),
      email: effectiveCorporateEmail,
      departmentId: formData.departmentId,
      designationId: formData.designationId,
      joiningDate: formData.joiningDate,
      role: formData.role,
      password: formData.password.trim(),
    };

    if (formData.phone.trim()) {
      payload.phone = formData.phone.trim();
    }
    if (formData.managerId.trim()) {
      payload.managerId = formData.managerId.trim();
    }
    const extraEmails = formData.additionalEmails
      .map((em) => em.trim().toLowerCase())
      .filter(Boolean);

    // If separate work email provided, ensure personal email is in additionalEmails
    if (
      formData.workEmail?.trim() &&
      formData.email.trim().toLowerCase() !== formData.workEmail.trim().toLowerCase() &&
      !extraEmails.includes(formData.email.trim().toLowerCase())
    ) {
      extraEmails.unshift(formData.email.trim().toLowerCase());
    }

    if (extraEmails.length > 0) {
      payload.additionalEmails = extraEmails.slice(0, 5);
    }
    const extraPhones = formData.additionalPhones.map((ph) => ph.trim()).filter(Boolean);
    if (extraPhones.length > 0) {
      payload.additionalPhones = extraPhones;
    }
    if (formData.permanentAddress.trim()) {
      payload.permanentAddress = formData.permanentAddress.trim();
    }
    if (formData.currentAddress.trim()) {
      payload.currentAddress = formData.currentAddress.trim();
    }
    if (formData.bloodGroup.trim()) {
      payload.bloodGroup = formData.bloodGroup.trim();
    }
    if (formData.panNumber.trim()) {
      payload.panNumber = formData.panNumber.trim().toUpperCase();
    }
    if (formData.aadhaarNumber.trim()) {
      payload.aadhaarNumber = formData.aadhaarNumber.replace(/\s+/g, '');
    }
    if (formData.bankAccountHolder.trim()) {
      payload.bankAccountHolder = formData.bankAccountHolder.trim();
    }
    if (formData.bankName.trim()) {
      payload.bankName = formData.bankName.trim();
    }
    if (formData.bankAccountNumber.trim()) {
      payload.bankAccountNumber = formData.bankAccountNumber.replace(/\s+/g, '');
    }
    if (formData.bankIfscCode.trim()) {
      payload.bankIfscCode = formData.bankIfscCode.trim().toUpperCase();
    }
    if (formData.bankBranch.trim()) {
      payload.bankBranch = formData.bankBranch.trim();
    }

    try {
      const result = await createEmployee(payload, idempotencyKeyRef.current);
      if (formData.avatarUrl && typeof window !== 'undefined' && window.localStorage) {
        try {
          if (result.id) localStorage.setItem(`maxr_avatar_${result.id}`, formData.avatarUrl);
          if (result.userId)
            localStorage.setItem(`maxr_avatar_${result.userId}`, formData.avatarUrl);
          if (result.email)
            localStorage.setItem(`maxr_avatar_${result.email.toLowerCase()}`, formData.avatarUrl);
        } catch {
          // ignore localStorage error
        }
      }
      setCreatedEmployee(result);
      onSuccess?.(result);
    } catch (err: unknown) {
      if (err instanceof CreateEmployeeApiError) {
        setSubmitError(err.message);
        if (Object.keys(err.fieldErrors).length > 0) {
          setErrors((prev) => ({ ...prev, ...err.fieldErrors }));
          // Switch to step containing the field error
          if (
            err.fieldErrors.firstName ||
            err.fieldErrors.lastName ||
            err.fieldErrors.email ||
            err.fieldErrors.phone
          ) {
            setCurrentStep(1);
          } else if (
            err.fieldErrors.employeeCode ||
            err.fieldErrors.departmentId ||
            err.fieldErrors.designationId ||
            err.fieldErrors.managerId ||
            err.fieldErrors.joiningDate
          ) {
            setCurrentStep(2);
          } else if (err.fieldErrors.role) {
            setCurrentStep(3);
          }
        }
      } else if (err instanceof Error) {
        setSubmitError(err.message);
      } else {
        setSubmitError('An unexpected error occurred while creating the employee.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    idempotencyKeyRef.current = generateIdempotencyKey();
    setFormData({
      employeeCode: '',
      avatarUrl: '',
      firstName: '',
      lastName: '',
      parentName: '',
      email: '',
      additionalEmails: [],
      phone: '',
      additionalPhones: [],
      permanentAddress: '',
      currentAddress: '',
      sameAsPermanentAddress: false,
      bloodGroup: '',
      panNumber: '',
      aadhaarNumber: '',
      bankAccountHolder: '',
      bankName: '',
      bankAccountNumber: '',
      bankIfscCode: '',
      bankBranch: '',
      departmentId: '',
      designationId: '',
      managerId: '',
      joiningDate: getInitialDate(),
      role: ROLES.STAFF,
      passwordMode: 'auto',
      password: generateAutoPassword(),
    });
    setErrors({});
    setCurrentStep(1);
    setSubmitError(null);
    setCreatedEmployee(null);
  };

  const regeneratePassword = useCallback(() => {
    idempotencyKeyRef.current = generateIdempotencyKey();
    const newPass = generateAutoPassword();
    setFormData((prev) => ({
      ...prev,
      password: newPass,
    }));
  }, []);

  return {
    formData,
    errors,
    currentStep,
    isSubmitting,
    submitError,
    createdEmployee,
    idempotencyKey: idempotencyKeyRef.current,
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
    isHRManager,
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
    validateStep,
    validateAll,
    handleSubmit,
    resetForm,
    regeneratePassword,
  };
}
