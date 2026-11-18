import type {
  CreateMilestoneInput,
  CreateProjectInput,
  CreateProjectUpdateInput,
  Project,
  ProjectDetail,
  ProjectDocument,
  ProjectDocumentCategory,
  ProjectListQuery,
  ProjectListResponse,
  ProjectMilestone,
  ProjectsSummary,
  ProjectUpdate,
  UpdateMilestoneInput,
  UpdateProjectInput,
} from '../types';

const DEV_MOCK_SEED: ProjectDetail[] = [
  {
    id: '70000000-0000-0000-0000-000000000001',
    code: 'MAXR-PORTAL',
    name: 'MAXR Employee Portal V2',
    description:
      'Modernize self-service attendance, leave workflows, and staff analytics with responsive glassmorphic views.',
    status: 'active',
    priority: 'high',
    workflowStatus: 'in_progress',
    progressPercent: 68,
    objectives:
      'Deliver a unified employee workspace covering attendance tracking, dynamic leave applications, and real-time project visibility across desktop and mobile web.',
    scope:
      'Frontend React 18 modules, REST endpoints under /api/v1, and PostgreSQL 16 schema migrations.',
    technologies: ['React 18', 'TypeScript', 'Node.js', 'PostgreSQL 16', 'Tailwind CSS'],
    ownerEmployeeId: '50000000-0000-0000-0000-000000000003',
    ownerName: 'Rajesh Patel',
    ownerEmail: 'teamlead@maxr.internal',
    ownerDesignation: 'Staff Engineer',
    ownerDepartment: 'Engineering',
    startDate: '2026-09-01',
    endDate: '2026-12-15',
    version: 3,
    memberCount: 3,
    createdAt: '2026-09-01T09:00:00Z',
    updatedAt: '2026-11-10T14:30:00Z',
    members: [
      {
        employeeId: '50000000-0000-0000-0000-000000000003',
        name: 'Rajesh Patel',
        email: 'teamlead@maxr.internal',
        designation: 'Staff Engineer',
        department: 'Engineering',
        addedAt: '2026-09-01T09:00:00Z',
      },
      {
        employeeId: '50000000-0000-0000-0000-000000000004',
        name: 'Ananya Sen',
        email: 'staff@maxr.internal',
        designation: 'Software Engineer',
        department: 'Engineering',
        addedAt: '2026-09-01T09:05:00Z',
      },
      {
        employeeId: '50000000-0000-0000-0000-000000000002',
        name: 'Priya Sharma',
        email: 'hr@maxr.internal',
        designation: 'HR Manager',
        department: 'Human Resources',
        addedAt: '2026-09-05T11:00:00Z',
      },
    ],
    milestones: [
      {
        id: '71000000-0000-0000-0000-000000000001',
        projectId: '70000000-0000-0000-0000-000000000001',
        title: 'API Contract & Schema Freeze',
        description: 'Finalize REST schemas, RBAC scope checks, and PostgreSQL migrations.',
        startDate: '2026-09-01',
        dueDate: '2026-09-25',
        status: 'completed',
        completionPercent: 100,
        sortOrder: 1,
        createdAt: '2026-09-01T09:00:00Z',
        updatedAt: '2026-09-25T16:00:00Z',
      },
      {
        id: '71000000-0000-0000-0000-000000000002',
        projectId: '70000000-0000-0000-0000-000000000001',
        title: 'Employee Dashboard & Leave Experience',
        description:
          'Ship responsive overview widgets, attendance timer, and dynamic leave policy selector.',
        startDate: '2026-09-26',
        dueDate: '2026-11-15',
        status: 'in_progress',
        completionPercent: 75,
        sortOrder: 2,
        createdAt: '2026-09-26T09:00:00Z',
        updatedAt: '2026-11-10T10:00:00Z',
      },
      {
        id: '71000000-0000-0000-0000-000000000003',
        projectId: '70000000-0000-0000-0000-000000000001',
        title: 'QA Sign-Off & Production Cutover',
        description:
          'End-to-end Playwright verification across phone, tablet, and desktop viewports.',
        startDate: '2026-11-16',
        dueDate: '2026-12-15',
        status: 'not_started',
        completionPercent: 15,
        sortOrder: 3,
        createdAt: '2026-10-01T09:00:00Z',
        updatedAt: '2026-10-01T09:00:00Z',
      },
    ],
    updates: [
      {
        id: '72000000-0000-0000-0000-000000000001',
        projectId: '70000000-0000-0000-0000-000000000001',
        authorEmployeeId: '50000000-0000-0000-0000-000000000003',
        authorName: 'Rajesh Patel',
        authorRoleLabel: 'Project Manager',
        updateType: 'manager_update',
        content:
          'Sprint review completed. Focus this week is finalizing employee project workspaces and milestone progress tracking.',
        progressPercent: 68,
        createdAt: '2026-11-09T11:30:00Z',
      },
      {
        id: '72000000-0000-0000-0000-000000000002',
        projectId: '70000000-0000-0000-0000-000000000001',
        authorEmployeeId: '50000000-0000-0000-0000-000000000004',
        authorName: 'Ananya Sen',
        authorRoleLabel: 'Team Member',
        updateType: 'progress_update',
        content:
          'Completed integration of responsive overview KPIs and milestone timeline components.',
        progressPercent: 68,
        createdAt: '2026-11-10T14:30:00Z',
      },
    ],
    documents: [
      {
        id: '73000000-0000-0000-0000-000000000001',
        projectId: '70000000-0000-0000-0000-000000000001',
        uploadedByEmployeeId: '50000000-0000-0000-0000-000000000003',
        uploadedByName: 'Rajesh Patel',
        originalName: 'MAXR-Portal-Architecture-Spec.pdf',
        contentType: 'application/pdf',
        size: 482100,
        category: 'architecture',
        createdAt: '2026-09-12T10:00:00Z',
      },
    ],
  },
  {
    id: '70000000-0000-0000-0000-000000000002',
    code: 'OPS-AUTOMATION',
    name: 'Shift & Attendance Sync Pipeline',
    description:
      'Automate shift roster imports, biometric punch reconciliation, and late-arrival exception alerts.',
    status: 'active',
    priority: 'medium',
    workflowStatus: 'in_progress',
    progressPercent: 52,
    objectives:
      'Eliminate manual attendance reconciliation across engineering squads and surface actionable team summaries.',
    scope: 'Attendance rule engine, CSV export jobs, and shift policy enforcement.',
    technologies: ['TypeScript', 'Express', 'PostgreSQL 16', 'Redis'],
    ownerEmployeeId: '50000000-0000-0000-0000-000000000003',
    ownerName: 'Rajesh Patel',
    ownerEmail: 'teamlead@maxr.internal',
    ownerDesignation: 'Staff Engineer',
    ownerDepartment: 'Engineering',
    startDate: '2026-09-15',
    endDate: '2026-11-30',
    version: 2,
    memberCount: 2,
    createdAt: '2026-09-15T09:00:00Z',
    updatedAt: '2026-11-08T15:00:00Z',
    members: [
      {
        employeeId: '50000000-0000-0000-0000-000000000003',
        name: 'Rajesh Patel',
        email: 'teamlead@maxr.internal',
        designation: 'Staff Engineer',
        department: 'Engineering',
        addedAt: '2026-09-15T09:00:00Z',
      },
      {
        employeeId: '50000000-0000-0000-0000-000000000004',
        name: 'Ananya Sen',
        email: 'staff@maxr.internal',
        designation: 'Software Engineer',
        department: 'Engineering',
        addedAt: '2026-09-15T09:10:00Z',
      },
    ],
    milestones: [
      {
        id: '71000000-0000-0000-0000-000000000004',
        projectId: '70000000-0000-0000-0000-000000000002',
        title: 'Shift Schedule Rule Engine',
        description: 'Implement grace window calculations and weekend holiday exclusions.',
        startDate: '2026-09-15',
        dueDate: '2026-10-20',
        status: 'completed',
        completionPercent: 100,
        sortOrder: 1,
        createdAt: '2026-09-15T09:00:00Z',
        updatedAt: '2026-10-20T18:00:00Z',
      },
      {
        id: '71000000-0000-0000-0000-000000000005',
        projectId: '70000000-0000-0000-0000-000000000002',
        title: 'Exception Alerts & Export',
        description: 'Deliver late arrival notifications and payroll CSV summary export.',
        startDate: '2026-10-21',
        dueDate: '2026-11-30',
        status: 'in_progress',
        completionPercent: 40,
        sortOrder: 2,
        createdAt: '2026-10-21T09:00:00Z',
        updatedAt: '2026-11-08T15:00:00Z',
      },
    ],
    updates: [
      {
        id: '72000000-0000-0000-0000-000000000003',
        projectId: '70000000-0000-0000-0000-000000000002',
        authorEmployeeId: '50000000-0000-0000-0000-000000000003',
        authorName: 'Rajesh Patel',
        authorRoleLabel: 'Project Manager',
        updateType: 'manager_update',
        content:
          'Shift rule engine passed staging checks. Next milestone: CSV payroll export verification.',
        progressPercent: 52,
        createdAt: '2026-11-08T15:00:00Z',
      },
    ],
    documents: [],
  },
  {
    id: '70000000-0000-0000-0000-000000000003',
    code: 'SEC-SSO-ROLLOUT',
    name: 'Unified Session & Audit Hardening',
    description:
      'Security baseline hardening for HTTP-only session cookies, CSRF validation, and RBAC audit trails.',
    status: 'active',
    priority: 'high',
    workflowStatus: 'completed',
    progressPercent: 100,
    objectives:
      'Achieve zero bypasses on record-scoped routes and immutable audit trail coverage for sensitive actions.',
    scope:
      'Auth session lifecycle, Argon2id password policy, and role-permission matrix enforcement.',
    technologies: ['Argon2id', 'Node.js', 'PostgreSQL 16', 'Vitest'],
    ownerEmployeeId: '50000000-0000-0000-0000-000000000003',
    ownerName: 'Rajesh Patel',
    ownerEmail: 'teamlead@maxr.internal',
    ownerDesignation: 'Staff Engineer',
    ownerDepartment: 'Engineering',
    startDate: '2026-07-01',
    endDate: '2026-09-30',
    version: 4,
    memberCount: 2,
    createdAt: '2026-07-01T09:00:00Z',
    updatedAt: '2026-09-30T17:00:00Z',
    members: [
      {
        employeeId: '50000000-0000-0000-0000-000000000003',
        name: 'Rajesh Patel',
        email: 'teamlead@maxr.internal',
        designation: 'Staff Engineer',
        department: 'Engineering',
        addedAt: '2026-07-01T09:00:00Z',
      },
      {
        employeeId: '50000000-0000-0000-0000-000000000004',
        name: 'Ananya Sen',
        email: 'staff@maxr.internal',
        designation: 'Software Engineer',
        department: 'Engineering',
        addedAt: '2026-07-01T09:05:00Z',
      },
    ],
    milestones: [
      {
        id: '71000000-0000-0000-0000-000000000006',
        projectId: '70000000-0000-0000-0000-000000000003',
        title: 'Session Cookie & CSRF Enforcement',
        description: 'Enforce HttpOnly SameSite cookies and CSRF double-submit verification.',
        startDate: '2026-07-01',
        dueDate: '2026-09-30',
        status: 'completed',
        completionPercent: 100,
        sortOrder: 1,
        createdAt: '2026-07-01T09:00:00Z',
        updatedAt: '2026-09-30T17:00:00Z',
      },
    ],
    updates: [
      {
        id: '72000000-0000-0000-0000-000000000004',
        projectId: '70000000-0000-0000-0000-000000000003',
        authorEmployeeId: '50000000-0000-0000-0000-000000000003',
        authorName: 'Rajesh Patel',
        authorRoleLabel: 'Project Manager',
        updateType: 'manager_update',
        content: 'Project signed off and deployed with zero regression issues.',
        progressPercent: 100,
        createdAt: '2026-09-30T17:00:00Z',
      },
    ],
    documents: [],
  },
  {
    id: '70000000-0000-0000-0000-000000000004',
    code: 'CLOUD-PERF-26',
    name: 'Q4 Observability & Caching Upgrade',
    description:
      'Introduce Redis query caching for non-authoritative read dashboards and latency instrumentation.',
    status: 'active',
    priority: 'low',
    workflowStatus: 'not_started',
    progressPercent: 10,
    objectives: 'Keep p95 dashboard load latency under 180ms during peak check-in windows.',
    scope: 'Read-through Redis cache layer and OpenTelemetry trace spans.',
    technologies: ['Redis', 'Docker', 'Nginx', 'TypeScript'],
    ownerEmployeeId: '50000000-0000-0000-0000-000000000003',
    ownerName: 'Rajesh Patel',
    ownerEmail: 'teamlead@maxr.internal',
    ownerDesignation: 'Staff Engineer',
    ownerDepartment: 'Engineering',
    startDate: '2026-12-01',
    endDate: '2027-02-15',
    version: 1,
    memberCount: 2,
    createdAt: '2026-10-15T09:00:00Z',
    updatedAt: '2026-10-15T09:00:00Z',
    members: [
      {
        employeeId: '50000000-0000-0000-0000-000000000003',
        name: 'Rajesh Patel',
        email: 'teamlead@maxr.internal',
        designation: 'Staff Engineer',
        department: 'Engineering',
        addedAt: '2026-10-15T09:00:00Z',
      },
      {
        employeeId: '50000000-0000-0000-0000-000000000004',
        name: 'Ananya Sen',
        email: 'staff@maxr.internal',
        designation: 'Software Engineer',
        department: 'Engineering',
        addedAt: '2026-10-15T09:05:00Z',
      },
    ],
    milestones: [],
    updates: [],
    documents: [],
  },
];

let mockStore: ProjectDetail[] = structuredClone(DEV_MOCK_SEED);
const mockBlobUrls = new Map<string, string>();

function toListItem(detail: ProjectDetail): Project {
  const { members: _m, milestones: _ms, updates: _u, documents: _d, ...summaryFields } = detail;
  return summaryFields;
}

function buildSummary(items: ProjectDetail[]): ProjectsSummary {
  const active = items.filter((p) => p.status === 'active');
  return {
    totalAssigned: active.length,
    inProgress: active.filter((p) => (p.workflowStatus ?? 'in_progress') === 'in_progress').length,
    completed: active.filter((p) => p.workflowStatus === 'completed').length,
    upcoming: active.filter((p) => p.workflowStatus === 'not_started').length,
    onHold: active.filter((p) => p.workflowStatus === 'on_hold').length,
  };
}

function makeUuid(prefix: string): string {
  const suffix = Math.random().toString(16).slice(2, 14).padEnd(12, '0');
  return `${prefix}-0000-4000-8000-${suffix}`;
}

export function mockFetchProjects(query: ProjectListQuery = {}): ProjectListResponse {
  const summary = buildSummary(mockStore);
  let filtered = [...mockStore];

  if (query.status) {
    filtered = filtered.filter((p) => p.status === query.status);
  }
  if (query.workflowStatus) {
    filtered = filtered.filter((p) => (p.workflowStatus ?? 'in_progress') === query.workflowStatus);
  }
  if (query.priority) {
    filtered = filtered.filter((p) => (p.priority ?? 'medium') === query.priority);
  }
  if (query.q && query.q.trim()) {
    const q = query.q.trim().toLowerCase();
    filtered = filtered.filter(
      (p) => p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q),
    );
  }

  if (query.sort === 'deadline_asc') {
    filtered.sort((a, b) => (a.endDate ?? '9999-12-31').localeCompare(b.endDate ?? '9999-12-31'));
  } else if (query.sort === 'deadline_desc') {
    filtered.sort((a, b) => (b.endDate ?? '0000-01-01').localeCompare(a.endDate ?? '0000-01-01'));
  } else {
    filtered.sort((a, b) => a.name.localeCompare(b.name));
  }

  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 20;
  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);

  return {
    data: paged.map(toListItem),
    meta: { page, pageSize, total, totalPages },
    summary,
  };
}

export function mockFetchProjectById(id: string): ProjectDetail | null {
  const found = mockStore.find((p) => p.id === id);
  return found ? structuredClone(found) : null;
}

export function mockCreateProject(input: CreateProjectInput): ProjectDetail {
  const now = new Date().toISOString();
  const created: ProjectDetail = {
    id: makeUuid('70000000'),
    code: input.code.toUpperCase(),
    name: input.name,
    description: input.description ?? null,
    status: 'active',
    priority: input.priority ?? 'medium',
    workflowStatus: input.workflowStatus ?? 'not_started',
    progressPercent: input.progressPercent ?? 0,
    objectives: input.objectives ?? null,
    scope: input.scope ?? null,
    technologies: input.technologies ?? [],
    ownerEmployeeId: input.ownerEmployeeId ?? '50000000-0000-0000-0000-000000000003',
    ownerName: 'Rajesh Patel',
    ownerEmail: 'teamlead@maxr.internal',
    ownerDesignation: 'Staff Engineer',
    ownerDepartment: 'Engineering',
    startDate: input.startDate ?? null,
    endDate: input.endDate ?? null,
    version: 1,
    memberCount: 1,
    createdAt: now,
    updatedAt: now,
    members: [
      {
        employeeId: input.ownerEmployeeId ?? '50000000-0000-0000-0000-000000000003',
        name: 'Rajesh Patel',
        email: 'teamlead@maxr.internal',
        designation: 'Staff Engineer',
        department: 'Engineering',
        addedAt: now,
      },
    ],
    milestones: [],
    updates: [],
    documents: [],
  };
  mockStore = [created, ...mockStore];
  return structuredClone(created);
}

export function mockUpdateProject(id: string, input: UpdateProjectInput): ProjectDetail | null {
  const idx = mockStore.findIndex((p) => p.id === id);
  if (idx === -1) return null;
  const existing = mockStore[idx]!;
  const updated: ProjectDetail = {
    ...existing,
    ...(input.name !== undefined ? { name: input.name } : {}),
    ...(input.description !== undefined ? { description: input.description } : {}),
    ...(input.status !== undefined ? { status: input.status } : {}),
    ...(input.startDate !== undefined ? { startDate: input.startDate } : {}),
    ...(input.endDate !== undefined ? { endDate: input.endDate } : {}),
    ...(input.priority !== undefined ? { priority: input.priority } : {}),
    ...(input.workflowStatus !== undefined ? { workflowStatus: input.workflowStatus } : {}),
    ...(input.progressPercent !== undefined ? { progressPercent: input.progressPercent } : {}),
    ...(input.objectives !== undefined ? { objectives: input.objectives } : {}),
    ...(input.scope !== undefined ? { scope: input.scope } : {}),
    ...(input.technologies !== undefined ? { technologies: input.technologies } : {}),
    version: existing.version + 1,
    updatedAt: new Date().toISOString(),
  };
  mockStore[idx] = updated;
  return structuredClone(updated);
}

export function mockAddProjectMember(id: string, employeeId: string): ProjectDetail | null {
  const idx = mockStore.findIndex((p) => p.id === id);
  if (idx === -1) return null;
  const existing = mockStore[idx]!;
  if (!existing.members.some((m) => m.employeeId === employeeId)) {
    existing.members = [
      ...existing.members,
      { employeeId, name: 'Team Member', addedAt: new Date().toISOString() },
    ];
    existing.memberCount = existing.members.length;
    existing.version += 1;
  }
  return structuredClone(existing);
}

export function mockRemoveProjectMember(id: string, employeeId: string): ProjectDetail | null {
  const idx = mockStore.findIndex((p) => p.id === id);
  if (idx === -1) return null;
  const existing = mockStore[idx]!;
  existing.members = existing.members.filter((m) => m.employeeId !== employeeId);
  existing.memberCount = existing.members.length;
  existing.version += 1;
  return structuredClone(existing);
}

export function mockCreateProjectMilestone(
  projectId: string,
  input: CreateMilestoneInput,
): ProjectMilestone | null {
  const project = mockStore.find((p) => p.id === projectId);
  if (!project) return null;
  const now = new Date().toISOString();
  const milestones = project.milestones ?? [];
  const milestone: ProjectMilestone = {
    id: makeUuid('71000000'),
    projectId,
    title: input.title,
    description: input.description ?? null,
    startDate: input.startDate ?? null,
    dueDate: input.dueDate ?? null,
    status: input.status ?? 'not_started',
    completionPercent: input.completionPercent ?? 0,
    sortOrder: milestones.length + 1,
    createdAt: now,
    updatedAt: now,
  };
  project.milestones = [...milestones, milestone];
  return structuredClone(milestone);
}

export function mockUpdateProjectMilestone(
  projectId: string,
  milestoneId: string,
  input: UpdateMilestoneInput,
): ProjectMilestone | null {
  const project = mockStore.find((p) => p.id === projectId);
  if (!project || !project.milestones) return null;
  const idx = project.milestones.findIndex((m) => m.id === milestoneId);
  if (idx === -1) return null;
  const updated: ProjectMilestone = {
    ...project.milestones[idx]!,
    ...(input.title !== undefined ? { title: input.title } : {}),
    ...(input.description !== undefined ? { description: input.description } : {}),
    ...(input.startDate !== undefined ? { startDate: input.startDate } : {}),
    ...(input.dueDate !== undefined ? { dueDate: input.dueDate } : {}),
    ...(input.status !== undefined ? { status: input.status } : {}),
    ...(input.completionPercent !== undefined
      ? { completionPercent: input.completionPercent }
      : {}),
    updatedAt: new Date().toISOString(),
  };
  project.milestones[idx] = updated;
  return structuredClone(updated);
}

export function mockCreateProjectUpdate(
  projectId: string,
  input: CreateProjectUpdateInput,
): ProjectUpdate | null {
  const project = mockStore.find((p) => p.id === projectId);
  if (!project) return null;
  const now = new Date().toISOString();
  const update: ProjectUpdate = {
    id: makeUuid('72000000'),
    projectId,
    authorEmployeeId: '50000000-0000-0000-0000-000000000004',
    authorName: 'Ananya Sen',
    authorRoleLabel: 'Team Member',
    updateType: input.updateType,
    content: input.content,
    progressPercent: input.progressPercent ?? null,
    createdAt: now,
  };
  project.updates = [update, ...(project.updates ?? [])];
  if (input.progressPercent !== undefined) {
    project.progressPercent = input.progressPercent;
    if (input.progressPercent === 100) {
      project.workflowStatus = 'completed';
    } else if (input.progressPercent > 0 && project.workflowStatus === 'not_started') {
      project.workflowStatus = 'in_progress';
    }
    project.updatedAt = now;
  }
  return structuredClone(update);
}

export function mockUploadProjectDocument(
  projectId: string,
  file: File,
  category: ProjectDocumentCategory = 'general',
): ProjectDocument | null {
  const project = mockStore.find((p) => p.id === projectId);
  if (!project) return null;
  const id = makeUuid('73000000');
  const doc: ProjectDocument = {
    id,
    projectId,
    uploadedByEmployeeId: '50000000-0000-0000-0000-000000000004',
    uploadedByName: 'Ananya Sen',
    originalName: file.name,
    contentType: file.type || 'application/octet-stream',
    size: file.size,
    category,
    createdAt: new Date().toISOString(),
  };
  if (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
    mockBlobUrls.set(id, URL.createObjectURL(file));
  }
  project.documents = [doc, ...(project.documents ?? [])];
  return structuredClone(doc);
}

export function mockGetDocumentDownloadLink(documentId: string): {
  url: string;
  expiresAt: string;
} {
  const existingUrl = mockBlobUrls.get(documentId);
  const url =
    existingUrl ??
    `data:text/plain;charset=utf-8,${encodeURIComponent(
      'MAXR Teamspace sample project document preview (dev mock mode).',
    )}`;
  return {
    url,
    expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
  };
}

export function mockDeleteProjectDocument(projectId: string, documentId: string): boolean {
  const project = mockStore.find((p) => p.id === projectId);
  if (!project || !project.documents) return false;
  project.documents = project.documents.filter((d) => d.id !== documentId);
  mockBlobUrls.delete(documentId);
  return true;
}
