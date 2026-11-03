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
}

export function useCreateEmployee({
  callerRole = ROLES.ADMIN,
  onSuccess,
}: UseCreateEmployeeOptions = {}) {
  const isAdmin = callerRole === ROLES.ADMIN;
  const isHRManager = callerRole === ROLES.HR_MANAGER;

  // HR Managers are only permitted to assign 'staff' or 'team_lead' roles
  const availableRoles = isAdmin
    ? ALL_ROLE_OPTIONS
    : ALL_ROLE_OPTIONS.filter((r) => r.value === ROLES.STAFF || r.value === ROLES.TEAM_LEAD);

  const getInitialDate = () => new Date().toISOString().slice(0, 10);

  const [formData, setFormData] = useState<CreateEmployeeFormState>({
    employeeCode: '',
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    departmentId: '',
    designationId: '',
    managerId: '',
    joiningDate: getInitialDate(),
    role: ROLES.STAFF,
  });

  const [errors, setErrors] = useState<CreateEmployeeValidationErrors>({});
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [createdEmployee, setCreatedEmployee] = useState<CreatedEmployee | null>(null);

  // Idempotency Key Management:
  // Must regenerate whenever the payload changes, but reuse for retries of the same payload.
  const idempotencyKeyRef = useRef<string>(generateIdempotencyKey());

  // Reference Data States
  const [departments, setDepartments] = useState<DepartmentSelectOption[]>([]);
  const [isLoadingDepartments, setIsLoadingDepartments] = useState<boolean>(true);
  const [departmentError, setDepartmentError] = useState<string | null>(null);

  const [designations, setDesignations] = useState<DesignationSelectOption[]>([]);
  const [isLoadingDesignations, setIsLoadingDesignations] = useState<boolean>(false);
  const [designationError, setDesignationError] = useState<string | null>(null);

  const [managers, setManagers] = useState<ManagerSelectOption[]>([]);
  const [isLoadingManagers, setIsLoadingManagers] = useState<boolean>(true);
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
          setDepartments(depts);
          setManagers(mgrs);
        }
      } catch {
        if (!ac.signal.aborted) {
          setDepartmentError('Failed to load active departments.');
          setManagerError('Failed to load manager options.');
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
          setDesignations(desigs);
        }
      } catch {
        if (!ac.signal.aborted) {
          setDesignationError('Failed to load designations for the selected department.');
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
        return {
          ...prev,
          [field]: value,
        };
      });

      // Clear field-specific error as user edits
      setErrors((prev) => {
        if (!prev[field]) return prev;
        const updated = { ...prev };
        delete updated[field];
        return updated;
      });

      setSubmitError(null);
    },
    [],
  );

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
    }

    setErrors((prev) => ({ ...prev, ...newErrors }));
    return Object.keys(newErrors).length === 0;
  };

  const validateAll = (): { isValid: boolean; errors: CreateEmployeeValidationErrors } => {
    const newErrors: CreateEmployeeValidationErrors = {};
    const fields: (keyof CreateEmployeeFormState)[] = [
      'employeeCode',
      'firstName',
      'lastName',
      'email',
      'phone',
      'departmentId',
      'designationId',
      'joiningDate',
      'role',
    ];

    for (const f of fields) {
      const err = validateField(f, formData[f]);
      if (err) newErrors[f] = err;
    }

    setErrors(newErrors);
    return {
      isValid: Object.keys(newErrors).length === 0,
      errors: newErrors,
    };
  };

  const nextStep = () => {
    if (validateStep(currentStep)) {
      setCurrentStep((prev) => Math.min(prev + 1, 3));
    }
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
        validation.errors.phone
      ) {
        setCurrentStep(1);
      } else if (
        validation.errors.employeeCode ||
        validation.errors.departmentId ||
        validation.errors.designationId ||
        validation.errors.joiningDate
      ) {
        setCurrentStep(2);
      } else {
        setCurrentStep(3);
      }
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    const payload: CreateEmployeePayload = {
      employeeCode: formData.employeeCode.trim().toUpperCase(),
      firstName: formData.firstName.trim(),
      lastName: formData.lastName.trim(),
      email: formData.email.trim().toLowerCase(),
      departmentId: formData.departmentId,
      designationId: formData.designationId,
      joiningDate: formData.joiningDate,
      role: formData.role,
    };

    if (formData.phone.trim()) {
      payload.phone = formData.phone.trim();
    }
    if (formData.managerId.trim()) {
      payload.managerId = formData.managerId.trim();
    }

    try {
      const result = await createEmployee(payload, idempotencyKeyRef.current);
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
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      departmentId: '',
      designationId: '',
      managerId: '',
      joiningDate: getInitialDate(),
      role: ROLES.STAFF,
    });
    setErrors({});
    setCurrentStep(1);
    setSubmitError(null);
    setCreatedEmployee(null);
  };

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
    setCurrentStep,
    nextStep,
    prevStep,
    validateStep,
    validateAll,
    handleSubmit,
    resetForm,
  };
}
