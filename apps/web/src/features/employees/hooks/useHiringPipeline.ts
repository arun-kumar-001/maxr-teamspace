import { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchDepartments, fetchDesignations, fetchEmployeeDirectory } from '../api/employees';
import type { DepartmentItem, DesignationItem, EmployeeDirectoryItem } from '../types';
import type {
  CreateHiringCandidateInput,
  CreateRoleOpeningInput,
  HiringCandidate,
  HiringRoleOpening,
  HiringStage,
  RoleOpeningStatus,
} from '../types/hiring';

export const HIRING_STAGE_ORDER: readonly HiringStage[] = [
  'applied',
  'phone_screen',
  'interview',
  'offer',
  'hired',
];

export const HIRING_STAGE_META: Record<
  HiringStage,
  {
    label: string;
    dotClass: string;
    barClass: string;
    pillClass: string;
  }
> = {
  applied: {
    label: 'Applied',
    dotClass: 'bg-text-subtle',
    barClass: 'bg-text-subtle',
    pillClass: 'bg-surface-muted text-text-muted border-border',
  },
  phone_screen: {
    label: 'Phone screen',
    dotClass: 'bg-primary-strong',
    barClass: 'bg-primary-strong',
    pillClass: 'bg-primary-soft text-primary-deep border-primary-strong/25',
  },
  interview: {
    label: 'Interview',
    dotClass: 'bg-warning',
    barClass: 'bg-warning',
    pillClass: 'bg-tile-yellow text-warning border-warning/25',
  },
  offer: {
    label: 'Offer',
    dotClass: 'bg-sky-600',
    barClass: 'bg-sky-600',
    pillClass: 'bg-sky-50 text-sky-800 border-sky-200',
  },
  hired: {
    label: 'Hired',
    dotClass: 'bg-rose-600',
    barClass: 'bg-rose-600',
    pillClass: 'bg-rose-50 text-danger border-rose-200',
  },
};

const ROLES_STORAGE_KEY = 'maxr_hiring_roles_v1';
const CANDIDATES_STORAGE_KEY = 'maxr_hiring_candidates_v1';

const DEFAULT_ROLES: HiringRoleOpening[] = [
  {
    id: 'role-swe',
    code: 'REQ-104',
    title: 'Software Engineer',
    departmentId: '30000000-0000-0000-0000-000000000001',
    departmentName: 'Engineering',
    designationId: '40000000-0000-0000-0000-000000000004',
    contractType: 'Full-time',
    workMode: 'Hybrid',
    compensation: '₹14L – ₹20L',
    hiresNeeded: 2,
    status: 'hiring',
    daysOpen: 18,
    postedDate: '24 Oct',
    hiringManagerId: '50000000-0000-0000-0000-000000000003',
    hiringManagerName: 'Rajesh Patel',
  },
  {
    id: 'role-staff-eng',
    code: 'REQ-108',
    title: 'Staff Engineer',
    departmentId: '30000000-0000-0000-0000-000000000001',
    departmentName: 'Engineering',
    designationId: '40000000-0000-0000-0000-000000000002',
    contractType: 'Full-time',
    workMode: 'Hybrid',
    compensation: '₹28L – ₹36L',
    hiresNeeded: 1,
    status: 'hiring',
    daysOpen: 12,
    postedDate: '30 Oct',
    hiringManagerId: '50000000-0000-0000-0000-000000000001',
    hiringManagerName: 'Arun Kumar',
  },
  {
    id: 'role-hr-spec',
    code: 'REQ-112',
    title: 'HR Specialist',
    departmentId: '30000000-0000-0000-0000-000000000002',
    departmentName: 'Human Resources',
    designationId: '40000000-0000-0000-0000-000000000003',
    contractType: 'Full-time',
    workMode: 'On-site',
    compensation: '₹8L – ₹12L',
    hiresNeeded: 1,
    status: 'hiring',
    daysOpen: 7,
    postedDate: '4 Nov',
    hiringManagerId: '50000000-0000-0000-0000-000000000002',
    hiringManagerName: 'Priya Sharma',
  },
  {
    id: 'role-ops-coord',
    code: 'REQ-101',
    title: 'Operations Coordinator',
    departmentId: '30000000-0000-0000-0000-000000000003',
    departmentName: 'Operations',
    contractType: 'Full-time',
    workMode: 'On-site',
    compensation: '₹9L – ₹13L',
    hiresNeeded: 1,
    status: 'paused',
    daysOpen: 29,
    postedDate: '13 Oct',
    hiringManagerId: '50000000-0000-0000-0000-000000000001',
    hiringManagerName: 'Arun Kumar',
  },
  {
    id: 'role-qa-lead',
    code: 'REQ-097',
    title: 'QA Automation Engineer',
    departmentId: '30000000-0000-0000-0000-000000000001',
    departmentName: 'Engineering',
    contractType: 'Full-time',
    workMode: 'Remote',
    compensation: '₹12L – ₹16L',
    hiresNeeded: 1,
    status: 'filled',
    daysOpen: 21,
    postedDate: '21 Oct',
    hiringManagerId: '50000000-0000-0000-0000-000000000003',
    hiringManagerName: 'Rajesh Patel',
  },
];

const DEFAULT_CANDIDATES: HiringCandidate[] = [
  {
    id: 'cand-1',
    roleId: 'role-swe',
    firstName: 'Karthik',
    lastName: 'Subramanian',
    email: 'karthik.s@example.com',
    phone: '+91-9840112233',
    source: 'Careers page',
    stage: 'applied',
    rating: 4,
    daysInStage: 4,
    appliedDate: '2026-11-07',
    notes: 'Strong TypeScript + React portfolio, backend Node experience.',
  },
  {
    id: 'cand-2',
    roleId: 'role-hr-spec',
    firstName: 'Divya',
    lastName: 'Menon',
    email: 'divya.menon@example.com',
    phone: '+91-9840223344',
    source: 'LinkedIn',
    stage: 'applied',
    rating: 4,
    daysInStage: 3,
    appliedDate: '2026-11-08',
    notes: '4 years in HR operations & onboarding compliance.',
  },
  {
    id: 'cand-3',
    roleId: 'role-swe',
    firstName: 'Siddharth',
    lastName: 'Nair',
    email: 'siddharth.n@example.com',
    source: 'Referral',
    stage: 'applied',
    rating: 5,
    daysInStage: 1,
    appliedDate: '2026-11-10',
    notes: 'Referred by Ananya Sen; full-stack PostgreSQL + React.',
  },
  {
    id: 'cand-4',
    roleId: 'role-swe',
    firstName: 'Meera',
    lastName: 'Krishnan',
    email: 'meera.k@example.com',
    source: 'LinkedIn',
    stage: 'phone_screen',
    rating: 4,
    daysInStage: 5,
    appliedDate: '2026-11-02',
    notes: 'Passed initial recruiter call; tech screen scheduled.',
  },
  {
    id: 'cand-5',
    roleId: 'role-staff-eng',
    firstName: 'Vikram',
    lastName: 'Desai',
    email: 'vikram.d@example.com',
    source: 'Referral',
    stage: 'phone_screen',
    rating: 5,
    daysInStage: 3,
    appliedDate: '2026-11-05',
    notes: '8 yrs architecture experience across distributed APIs.',
  },
  {
    id: 'cand-6',
    roleId: 'role-ops-coord',
    firstName: 'Neha',
    lastName: 'Rao',
    email: 'neha.rao@example.com',
    source: 'Indeed',
    stage: 'phone_screen',
    rating: 3,
    daysInStage: 7,
    appliedDate: '2026-10-30',
    notes: 'Good roster scheduling background.',
  },
  {
    id: 'cand-7',
    roleId: 'role-swe',
    firstName: 'Rohan',
    lastName: 'Verma',
    email: 'rohan.v@example.com',
    source: 'Careers page',
    stage: 'interview',
    rating: 5,
    daysInStage: 2,
    appliedDate: '2026-10-29',
    notes: 'Cleared coding round; system design panel tomorrow.',
  },
  {
    id: 'cand-8',
    roleId: 'role-staff-eng',
    firstName: 'Pooja',
    lastName: 'Iyer',
    email: 'pooja.iyer@example.com',
    source: 'LinkedIn',
    stage: 'interview',
    rating: 4,
    daysInStage: 4,
    appliedDate: '2026-10-31',
    notes: 'Strong technical leadership feedback from Rajesh.',
  },
  {
    id: 'cand-9',
    roleId: 'role-hr-spec',
    firstName: 'Aishwarya',
    lastName: 'Kapoor',
    email: 'aishwarya.k@example.com',
    source: 'Referral',
    stage: 'interview',
    rating: 4,
    daysInStage: 2,
    appliedDate: '2026-11-05',
    notes: 'Final culture & policy round with Priya Sharma.',
  },
  {
    id: 'cand-10',
    roleId: 'role-swe',
    firstName: 'Arjun',
    lastName: 'Malhotra',
    email: 'arjun.m@example.com',
    source: 'Referral',
    stage: 'offer',
    rating: 5,
    daysInStage: 3,
    appliedDate: '2026-10-26',
    notes: 'Offer letter sent; awaiting counter-signature.',
  },
  {
    id: 'cand-11',
    roleId: 'role-ops-coord',
    firstName: 'Sneha',
    lastName: 'Kulkarni',
    email: 'sneha.k@example.com',
    source: 'Careers page',
    stage: 'offer',
    rating: 4,
    daysInStage: 2,
    appliedDate: '2026-10-28',
    notes: 'Verbal acceptance received.',
  },
  {
    id: 'cand-12',
    roleId: 'role-qa-lead',
    firstName: 'Harish',
    lastName: 'Chandra',
    email: 'harish.c@example.com',
    source: 'LinkedIn',
    stage: 'hired',
    rating: 5,
    daysInStage: 1,
    appliedDate: '2026-10-22',
    notes: 'Accepted offer. Ready for CRM onboarding setup.',
  },
  {
    id: 'cand-13',
    roleId: 'role-staff-eng',
    firstName: 'Kavya',
    lastName: 'Bhat',
    email: 'kavya.b@example.com',
    source: 'Referral',
    stage: 'hired',
    rating: 5,
    daysInStage: 0,
    appliedDate: '2026-10-25',
    notes: 'Joining Monday. Trigger HR & IT setup checklist.',
  },
];

function readStorage<T>(key: string, fallback: T): T {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return fallback;
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as T;
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function writeStorage<T>(key: string, value: T): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage quota / privacy mode errors
  }
}

export function useHiringPipeline() {
  const [roles, setRoles] = useState<HiringRoleOpening[]>(() =>
    readStorage(ROLES_STORAGE_KEY, DEFAULT_ROLES),
  );
  const [candidates, setCandidates] = useState<HiringCandidate[]>(() =>
    readStorage(CANDIDATES_STORAGE_KEY, DEFAULT_CANDIDATES),
  );
  const [crmDepartments, setCrmDepartments] = useState<DepartmentItem[]>([]);
  const [crmDesignations, setCrmDesignations] = useState<DesignationItem[]>([]);
  const [crmEmployees, setCrmEmployees] = useState<EmployeeDirectoryItem[]>([]);

  useEffect(() => {
    writeStorage(ROLES_STORAGE_KEY, roles);
  }, [roles]);

  useEffect(() => {
    writeStorage(CANDIDATES_STORAGE_KEY, candidates);
  }, [candidates]);

  useEffect(() => {
    let cancelled = false;
    Promise.allSettled([
      fetchDepartments(),
      fetchDesignations(),
      fetchEmployeeDirectory({ page: 1, pageSize: 50 }),
    ]).then(([deptRes, desigRes, empRes]) => {
      if (cancelled) return;
      const depts = deptRes.status === 'fulfilled' ? deptRes.value : [];
      const desigs = desigRes.status === 'fulfilled' ? desigRes.value : [];
      const emps = empRes.status === 'fulfilled' ? empRes.value.data : [];
      setCrmDepartments(depts);
      setCrmDesignations(desigs);
      setCrmEmployees(emps);

      if (depts.length > 0 || desigs.length > 0 || emps.length > 0) {
        setRoles((prev) =>
          prev.map((role) => {
            const matchedDept = depts.find(
              (d) => d.name.toLowerCase() === role.departmentName.toLowerCase(),
            );
            const matchedDesig = desigs.find(
              (d) => d.title.toLowerCase() === role.title.toLowerCase(),
            );
            const matchedMgr = emps.find(
              (e) =>
                `${e.firstName} ${e.lastName}`.toLowerCase() ===
                role.hiringManagerName.toLowerCase(),
            );
            return {
              ...role,
              departmentId: matchedDept?.id ?? role.departmentId,
              designationId: matchedDesig?.id ?? role.designationId,
              hiringManagerId: matchedMgr?.id ?? role.hiringManagerId,
            };
          }),
        );
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const rolesById = useMemo(() => {
    const map = new Map<string, HiringRoleOpening>();
    for (const r of roles) map.set(r.id, r);
    return map;
  }, [roles]);

  const moveCandidateStage = useCallback((candidateId: string, stage: HiringStage) => {
    setCandidates((prev) =>
      prev.map((cand) =>
        cand.id === candidateId
          ? {
              ...cand,
              stage,
              daysInStage: cand.stage === stage ? cand.daysInStage : 0,
            }
          : cand,
      ),
    );
  }, []);

  const addCandidate = useCallback((input: CreateHiringCandidateInput): HiringCandidate => {
    const newCandidate: HiringCandidate = {
      id: `cand-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      roleId: input.roleId,
      firstName: input.firstName.trim(),
      lastName: input.lastName.trim(),
      email: input.email.trim(),
      phone: input.phone?.trim() || undefined,
      source: input.source.trim() || 'Careers page',
      stage: input.stage ?? 'applied',
      rating: input.rating ?? 4,
      daysInStage: 0,
      appliedDate: new Date().toISOString().slice(0, 10),
      notes: input.notes?.trim() || undefined,
    };
    setCandidates((prev) => [newCandidate, ...prev]);
    return newCandidate;
  }, []);

  const updateCandidate = useCallback(
    (candidateId: string, patch: Partial<Omit<HiringCandidate, 'id'>>) => {
      setCandidates((prev) =>
        prev.map((cand) => (cand.id === candidateId ? { ...cand, ...patch } : cand)),
      );
    },
    [],
  );

  const removeCandidate = useCallback((candidateId: string) => {
    setCandidates((prev) => prev.filter((cand) => cand.id !== candidateId));
  }, []);

  const addRoleOpening = useCallback((input: CreateRoleOpeningInput): HiringRoleOpening => {
    const num = 115 + Math.floor(Math.random() * 80);
    const nowLabel = new Date().toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
    });
    const role: HiringRoleOpening = {
      id: `role-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      code: `REQ-${num}`,
      title: input.title.trim(),
      departmentId: input.departmentId,
      departmentName: input.departmentName,
      designationId: input.designationId,
      contractType: input.contractType,
      workMode: input.workMode,
      compensation: input.compensation.trim() || 'Competitive',
      hiresNeeded: Math.max(1, input.hiresNeeded),
      status: 'hiring',
      daysOpen: 0,
      postedDate: nowLabel,
      hiringManagerId: input.hiringManagerId,
      hiringManagerName: input.hiringManagerName,
    };
    setRoles((prev) => [role, ...prev]);
    return role;
  }, []);

  const updateRoleStatus = useCallback((roleId: string, status: RoleOpeningStatus) => {
    setRoles((prev) => prev.map((r) => (r.id === roleId ? { ...r, status } : r)));
  }, []);

  const resetHiringDemoData = useCallback(() => {
    setRoles(DEFAULT_ROLES);
    setCandidates(DEFAULT_CANDIDATES);
  }, []);

  return {
    roles,
    rolesById,
    candidates,
    crmDepartments,
    crmDesignations,
    crmEmployees,
    moveCandidateStage,
    addCandidate,
    updateCandidate,
    removeCandidate,
    addRoleOpening,
    updateRoleStatus,
    resetHiringDemoData,
  };
}
