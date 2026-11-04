import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { test, expect } from '@playwright/test';
import { expectNoHorizontalScroll } from './helpers';

// The nine reference viewports from AGENTS.md section 8.
const REFERENCE_VIEWPORTS = [
  [360, 640, 'small-phone'],
  [390, 844, 'modern-phone'],
  [768, 1024, 'tablet-portrait'],
  [1024, 768, 'tablet-landscape'],
  [1366, 768, 'laptop'],
  [1440, 900, 'desktop'],
  [1920, 1080, 'fhd-monitor'],
  [2560, 1440, 'qhd-monitor'],
  [3440, 1440, 'ultrawide'],
] as const;

const SCREENSHOT_DIR = resolve(
  import.meta.dirname,
  '../../../e2e-output/screenshots/employee-lifecycle',
);

interface MockEmployee {
  id: string;
  userId?: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  departmentId: string;
  designationId: string;
  department?: { id: string; name: string; code: string };
  designation?: { id: string; title: string; code: string; level?: number };
  managerId: string | null;
  manager?: { id: string; firstName: string; lastName: string; employeeCode: string } | null;
  status: 'active' | 'pending' | 'deactivated';
  role?: string;
  joiningDate: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

interface MockOnboardingItem {
  id: string;
  checklistId: string;
  step: 'hr' | 'system' | 'it_admin' | 'employee';
  itemKey: string;
  title: string;
  description: string | null;
  isVerified: boolean;
  verifiedAt: string | null;
  verifiedBy: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

interface MockChecklist {
  id: string;
  employeeId: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  email: string;
  departmentId: string;
  departmentName: string;
  designationId: string;
  designationTitle: string;
  managerId: string | null;
  joiningDate: string;
  employeeStatus: string;
  userActive: boolean;
  status: 'in_progress' | 'completed';
  currentStep: 'hr' | 'system' | 'it_admin' | 'employee' | 'completed';
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  totalItems: number;
  verifiedItems: number;
  items: MockOnboardingItem[];
}

interface MockDoc {
  id: string;
  employeeId: string;
  uploadedByEmployeeId: string;
  documentType: string;
  title: string;
  isSensitive: boolean;
  originalName: string;
  contentType: string;
  sizeBytes: number;
  createdAt: string;
  updatedAt: string;
}

function createInitialMockState() {
  const departments = [
    { id: 'dept-eng', name: 'Engineering', code: 'ENG', isActive: true },
    { id: 'dept-hr', name: 'Human Resources', code: 'HR', isActive: true },
    { id: 'dept-ops', name: 'Operations', code: 'OPS', isActive: true },
  ];

  const designations = [
    {
      id: 'desig-swe',
      title: 'Software Engineer',
      code: 'SWE',
      departmentId: 'dept-eng',
      isActive: true,
      level: 3,
    },
    {
      id: 'desig-lead',
      title: 'Engineering Lead',
      code: 'TECH_LEAD',
      departmentId: 'dept-eng',
      isActive: true,
      level: 4,
    },
    {
      id: 'desig-hr-spec',
      title: 'HR Specialist',
      code: 'HR_SPEC',
      departmentId: 'dept-hr',
      isActive: true,
      level: 3,
    },
  ];

  const employees: MockEmployee[] = [
    {
      id: 'emp-001',
      userId: 'usr-admin-001',
      employeeCode: 'MAX001',
      firstName: 'Sarah',
      lastName: 'Connor',
      email: 'admin@maxr.internal',
      phone: '+91 98765 00001',
      departmentId: 'dept-eng',
      designationId: 'desig-lead',
      department: departments[0],
      designation: designations[1],
      managerId: null,
      manager: null,
      status: 'active',
      role: 'admin',
      joiningDate: '2023-01-01',
      version: 1,
      createdAt: '2023-01-01T00:00:00Z',
      updatedAt: '2023-01-01T00:00:00Z',
    },
    {
      id: 'emp-002',
      userId: 'usr-hr-002',
      employeeCode: 'MAX002',
      firstName: 'Elena',
      lastName: 'Rostova',
      email: 'hr@maxr.internal',
      phone: '+91 98765 00002',
      departmentId: 'dept-hr',
      designationId: 'desig-hr-spec',
      department: departments[1],
      designation: designations[2],
      managerId: 'emp-001',
      manager: {
        id: 'emp-001',
        firstName: 'Sarah',
        lastName: 'Connor',
        employeeCode: 'MAX001',
      },
      status: 'active',
      role: 'hr_manager',
      joiningDate: '2023-03-01',
      version: 1,
      createdAt: '2023-03-01T00:00:00Z',
      updatedAt: '2023-03-01T00:00:00Z',
    },
    {
      id: 'emp-003',
      userId: 'usr-lead-003',
      employeeCode: 'MAX003',
      firstName: 'Marcus',
      lastName: 'Vance',
      email: 'teamlead@maxr.internal',
      phone: '+91 98765 00003',
      departmentId: 'dept-eng',
      designationId: 'desig-lead',
      department: departments[0],
      designation: designations[1],
      managerId: 'emp-001',
      manager: {
        id: 'emp-001',
        firstName: 'Sarah',
        lastName: 'Connor',
        employeeCode: 'MAX001',
      },
      status: 'active',
      role: 'team_lead',
      joiningDate: '2023-06-01',
      version: 1,
      createdAt: '2023-06-01T00:00:00Z',
      updatedAt: '2023-06-01T00:00:00Z',
    },
    {
      id: 'emp-004',
      userId: 'usr-staff-004',
      employeeCode: 'MAX004',
      firstName: 'Alex',
      lastName: 'Mercer',
      email: 'staff@maxr.internal',
      phone: '+91 98765 00004',
      departmentId: 'dept-eng',
      designationId: 'desig-swe',
      department: departments[0],
      designation: designations[0],
      managerId: 'emp-003',
      manager: {
        id: 'emp-003',
        firstName: 'Marcus',
        lastName: 'Vance',
        employeeCode: 'MAX003',
      },
      status: 'active',
      role: 'staff',
      joiningDate: '2024-01-15',
      version: 1,
      createdAt: '2024-01-15T00:00:00Z',
      updatedAt: '2024-01-15T00:00:00Z',
    },
    {
      id: 'emp-101',
      userId: 'usr-101',
      employeeCode: 'MAX101',
      firstName: 'Rohan',
      lastName: 'Sharma',
      email: 'rohan.sharma@maxr.internal',
      phone: '+91 98765 10101',
      departmentId: 'dept-eng',
      designationId: 'desig-swe',
      department: departments[0],
      designation: designations[0],
      managerId: 'emp-003',
      manager: {
        id: 'emp-003',
        firstName: 'Marcus',
        lastName: 'Vance',
        employeeCode: 'MAX003',
      },
      status: 'pending',
      role: 'staff',
      joiningDate: '2026-11-15',
      version: 1,
      createdAt: '2026-11-01T09:00:00Z',
      updatedAt: '2026-11-01T10:30:00Z',
    },
  ];

  const makeItems = (chkId: string): MockOnboardingItem[] => [
    {
      id: `item-${chkId}-1`,
      checklistId: chkId,
      step: 'hr',
      itemKey: 'id_verification',
      title: 'Identity & Address Verification',
      description: 'Check government ID and proof of address documents.',
      isVerified: true,
      verifiedAt: '2026-11-01T10:00:00Z',
      verifiedBy: 'emp-002',
      notes: 'Verified against passport',
      createdAt: '2026-11-01T09:00:00Z',
      updatedAt: '2026-11-01T10:00:00Z',
    },
    {
      id: `item-${chkId}-2`,
      checklistId: chkId,
      step: 'system',
      itemKey: 'account_provisioning',
      title: 'Account Provisioning',
      description: 'System credentials generated and welcome email queued.',
      isVerified: true,
      verifiedAt: '2026-11-01T10:30:00Z',
      verifiedBy: 'system',
      notes: null,
      createdAt: '2026-11-01T09:00:00Z',
      updatedAt: '2026-11-01T10:30:00Z',
    },
    {
      id: `item-${chkId}-3`,
      checklistId: chkId,
      step: 'it_admin',
      itemKey: 'hardware_assignment',
      title: 'IT Hardware & Access Card',
      description: 'Workstation, laptop and building pass assigned.',
      isVerified: false,
      verifiedAt: null,
      verifiedBy: null,
      notes: null,
      createdAt: '2026-11-01T09:00:00Z',
      updatedAt: '2026-11-01T09:00:00Z',
    },
    {
      id: `item-${chkId}-4`,
      checklistId: chkId,
      step: 'employee',
      itemKey: 'profile_completion',
      title: 'Employee Profile & Password Setup',
      description: 'Employee sets initial secure password and emergency contacts.',
      isVerified: false,
      verifiedAt: null,
      verifiedBy: null,
      notes: null,
      createdAt: '2026-11-01T09:00:00Z',
      updatedAt: '2026-11-01T09:00:00Z',
    },
  ];

  const onboardingChecklists: MockChecklist[] = [
    {
      id: 'chk-101',
      employeeId: 'emp-101',
      employeeCode: 'MAX101',
      firstName: 'Rohan',
      lastName: 'Sharma',
      email: 'rohan.sharma@maxr.internal',
      departmentId: 'dept-eng',
      departmentName: 'Engineering',
      designationId: 'desig-swe',
      designationTitle: 'Software Engineer',
      managerId: 'emp-003',
      joiningDate: '2026-11-15',
      employeeStatus: 'pending',
      userActive: false,
      status: 'in_progress',
      currentStep: 'it_admin',
      completedAt: null,
      createdAt: '2026-11-01T09:00:00Z',
      updatedAt: '2026-11-01T10:30:00Z',
      totalItems: 4,
      verifiedItems: 2,
      items: makeItems('chk-101'),
    },
  ];

  const documents: MockDoc[] = [
    {
      id: 'doc-001',
      employeeId: 'emp-004',
      uploadedByEmployeeId: 'emp-004',
      documentType: 'id_proof',
      title: 'Aadhaar Card Copy',
      isSensitive: true,
      originalName: 'aadhaar_card.pdf',
      contentType: 'application/pdf',
      sizeBytes: 245000,
      createdAt: '2026-01-16T10:00:00Z',
      updatedAt: '2026-01-16T10:00:00Z',
    },
  ];

  return {
    departments,
    designations,
    employees,
    onboardingChecklists,
    documents,
  };
}

async function setupEmployeeLifecycleMockRoutes(page: any) {
  const state = createInitialMockState();

  // Polling notifications route to prevent Vite proxy errors
  await page.route('**/api/v1/notifications*', async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: [],
        meta: { unreadCount: 0, total: 0, page: 1, pageSize: 10 },
      }),
    });
  });

  // Departments
  await page.route('**/api/v1/departments*', async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: state.departments }),
    });
  });

  // Designations
  await page.route('**/api/v1/designations*', async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: state.designations }),
    });
  });

  // Settings
  await page.route('**/api/v1/settings', async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          companyName: 'MAXR Global Inc.',
          timezone: 'Asia/Kolkata',
          workWeek: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
          currency: 'INR',
        },
      }),
    });
  });

  // Deactivate Employee
  await page.route(/\/api\/v1\/employees\/([^/]+)\/deactivate$/, async (route: any) => {
    const url = route.request().url();
    const id = url.split('/employees/')[1]?.split('/deactivate')[0];
    const target = state.employees.find((e) => e.id === id);

    if (target) {
      target.status = 'deactivated';
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          id,
          status: 'deactivated',
          deactivatedAt: new Date().toISOString(),
          version: 2,
          alreadyDeactivated: false,
          sessionsRevoked: 2,
          directReports: [],
        },
      }),
    });
  });

  // Documents Routes
  await page.route(/\/api\/v1\/employees\/([^/]+)\/documents/, async (route: any) => {
    const req = route.request();
    const url = req.url();
    const id = url.split('/employees/')[1]?.split('/documents')[0];

    if (req.method() === 'GET') {
      const empDocs = state.documents.filter((d) => d.employeeId === id);
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: empDocs }),
      });
      return;
    }

    if (req.method() === 'POST') {
      const newDoc: MockDoc = {
        id: `doc-${Date.now()}`,
        employeeId: id,
        uploadedByEmployeeId: 'emp-001',
        documentType: 'id_proof',
        title: 'Uploaded Identification Proof',
        isSensitive: true,
        originalName: 'passport.pdf',
        contentType: 'application/pdf',
        sizeBytes: 154000,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      state.documents.push(newDoc);
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ data: newDoc }),
      });
      return;
    }
  });

  // Onboarding detail actions
  await page.route(/\/api\/v1\/onboarding\/([^/]+)\/activate/, async (route: any) => {
    const url = route.request().url();
    const id = url.split('/onboarding/')[1]?.split('/activate')[0];
    const chk = state.onboardingChecklists.find((c) => c.employeeId === id || c.id === id);
    if (chk) {
      chk.status = 'completed';
      chk.userActive = true;
      chk.currentStep = 'completed';
      const emp = state.employees.find((e) => e.id === chk.employeeId);
      if (emp) emp.status = 'active';
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          employeeId: chk?.employeeId || id,
          activatedAt: new Date().toISOString(),
        },
      }),
    });
  });

  await page.route(/\/api\/v1\/onboarding\/([^/]+)\/verify-item/, async (route: any) => {
    const url = route.request().url();
    const id = url.split('/onboarding/')[1]?.split('/verify-item')[0];
    const payload = JSON.parse(route.request().postData() || '{}');
    const chk = state.onboardingChecklists.find((c) => c.employeeId === id || c.id === id);
    if (chk) {
      const itm = chk.items.find((i) => i.itemKey === payload.itemKey);
      if (itm) {
        itm.isVerified = true;
        itm.verifiedAt = new Date().toISOString();
        itm.verifiedBy = 'emp-001';
      }
      chk.verifiedItems = chk.items.filter((i) => i.isVerified).length;
      chk.currentStep = 'employee';
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: chk }),
    });
  });

  await page.route(/\/api\/v1\/onboarding\/([^/]+)\/generate-token/, async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          token: 'mock-token-xyz-123',
          expiresAt: new Date(Date.now() + 86400000).toISOString(),
        },
      }),
    });
  });

  // Onboarding me
  await page.route('**/api/v1/onboarding/me', async (route: any) => {
    const chk = state.onboardingChecklists[0];
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: chk }),
    });
  });

  // Onboarding detail GET by ID (excluding 'me')
  await page.route(/\/api\/v1\/onboarding\/(?!me\b)([a-zA-Z0-9_-]+)$/, async (route: any) => {
    const url = route.request().url();
    const id = url.split('/onboarding/')[1]?.split('?')[0];
    const chk = state.onboardingChecklists.find((c) => c.employeeId === id || c.id === id);
    if (!chk) {
      await route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({ error: { message: 'Checklist not found' } }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: chk }),
    });
  });

  // Onboarding list GET
  await page.route(/\/api\/v1\/onboarding(\?.*)?$/, async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: state.onboardingChecklists,
        meta: { total: state.onboardingChecklists.length },
      }),
    });
  });

  // Employees Directory GET & POST
  await page.route(/\/api\/v1\/employees(\?.*)?$/, async (route: any) => {
    const req = route.request();

    if (req.method() === 'POST') {
      const payload = JSON.parse(req.postData() || '{}');
      const newEmpId = 'emp-new-created';
      const dept = state.departments.find((d) => d.id === payload.departmentId);
      const desig = state.designations.find((d) => d.id === payload.designationId);
      const mgr = state.employees.find((e) => e.id === payload.managerId);

      const createdEmp: MockEmployee = {
        id: newEmpId,
        userId: 'usr-new-created',
        employeeCode: payload.employeeCode,
        firstName: payload.firstName,
        lastName: payload.lastName,
        email: payload.email,
        phone: payload.phone || null,
        departmentId: payload.departmentId,
        designationId: payload.designationId,
        department: dept,
        designation: desig,
        managerId: payload.managerId || null,
        manager: mgr
          ? {
              id: mgr.id,
              firstName: mgr.firstName,
              lastName: mgr.lastName,
              employeeCode: mgr.employeeCode,
            }
          : null,
        status: 'pending',
        role: payload.role || 'staff',
        joiningDate: payload.joiningDate,
        version: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      state.employees.unshift(createdEmp);

      // Create matching onboarding checklist
      const newChk: MockChecklist = {
        id: `chk-${newEmpId}`,
        employeeId: newEmpId,
        employeeCode: createdEmp.employeeCode,
        firstName: createdEmp.firstName,
        lastName: createdEmp.lastName,
        email: createdEmp.email,
        departmentId: createdEmp.departmentId,
        departmentName: dept?.name || 'Engineering',
        designationId: createdEmp.designationId,
        designationTitle: desig?.title || 'Software Engineer',
        managerId: createdEmp.managerId,
        joiningDate: createdEmp.joiningDate,
        employeeStatus: 'pending',
        userActive: false,
        status: 'in_progress',
        currentStep: 'hr',
        completedAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        totalItems: 4,
        verifiedItems: 0,
        items: [
          {
            id: `item-${newEmpId}-1`,
            checklistId: `chk-${newEmpId}`,
            step: 'hr',
            itemKey: 'id_verification',
            title: 'Identity & Address Verification',
            description: 'Check government ID and proof of address documents.',
            isVerified: false,
            verifiedAt: null,
            verifiedBy: null,
            notes: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          {
            id: `item-${newEmpId}-2`,
            checklistId: `chk-${newEmpId}`,
            step: 'system',
            itemKey: 'account_provisioning',
            title: 'Account Provisioning',
            description: 'System credentials generated and welcome email queued.',
            isVerified: false,
            verifiedAt: null,
            verifiedBy: null,
            notes: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          {
            id: `item-${newEmpId}-3`,
            checklistId: `chk-${newEmpId}`,
            step: 'it_admin',
            itemKey: 'hardware_assignment',
            title: 'IT Hardware & Access Card',
            description: 'Workstation, laptop and building pass assigned.',
            isVerified: false,
            verifiedAt: null,
            verifiedBy: null,
            notes: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          {
            id: `item-${newEmpId}-4`,
            checklistId: `chk-${newEmpId}`,
            step: 'employee',
            itemKey: 'profile_completion',
            title: 'Employee Profile & Password Setup',
            description: 'Employee sets initial secure password and emergency contacts.',
            isVerified: false,
            verifiedAt: null,
            verifiedBy: null,
            notes: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
      };

      state.onboardingChecklists.unshift(newChk);

      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ data: createdEmp }),
      });
      return;
    }

    // GET list
    const url = new URL(req.url());
    const search = url.searchParams.get('search')?.toLowerCase() || '';
    const statusParam = url.searchParams.get('status')?.toLowerCase() || '';

    let result = state.employees;
    if (statusParam && statusParam !== 'all') {
      result = result.filter((e) => e.status === statusParam);
    }
    if (search) {
      result = result.filter(
        (e) =>
          e.firstName.toLowerCase().includes(search) ||
          e.lastName.toLowerCase().includes(search) ||
          e.employeeCode.toLowerCase().includes(search) ||
          e.email.toLowerCase().includes(search),
      );
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: result,
        meta: { page: 1, pageSize: 20, total: result.length },
      }),
    });
  });

  // Single employee GET by ID (excluding 'me')
  await page.route(/\/api\/v1\/employees\/(?!me\b)([a-zA-Z0-9_-]+)$/, async (route: any) => {
    const url = route.request().url();
    const id = url.split('/employees/')[1]?.split('?')[0];
    if (id === 'me') {
      await route.continue();
      return;
    }
    const emp = state.employees.find((e) => e.id === id);
    if (!emp) {
      await route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({ error: { message: 'Employee not found' } }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          ...emp,
          departmentName: emp.department?.name || 'Engineering',
          designationTitle: emp.designation?.title || 'Software Engineer',
          account: {
            id: emp.userId || 'usr-mock',
            isActive: emp.status === 'active',
            role: emp.role || 'staff',
          },
        },
      }),
    });
  });

  // My Profile GET & PUT
  await page.route('**/api/v1/employees/me', async (route: any) => {
    const method = route.request().method();
    const alex = state.employees.find((e) => e.id === 'emp-004');
    if (!alex) {
      await route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({ error: { message: 'Not found' } }),
      });
      return;
    }

    if (method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            ...alex,
            account: {
              userId: alex.userId || 'usr-staff-004',
              email: alex.email,
              roles: [alex.role || 'staff'],
              isActive: alex.status === 'active',
              lastLoginAt: '2026-11-01T12:00:00Z',
            },
          },
        }),
      });
      return;
    }

    if (method === 'PUT') {
      const payload = JSON.parse(route.request().postData() || '{}');
      if (payload.phone !== undefined) {
        alex.phone = payload.phone;
      }
      alex.version = (alex.version || 1) + 1;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            ...alex,
            account: {
              userId: alex.userId || 'usr-staff-004',
              email: alex.email,
              roles: [alex.role || 'staff'],
              isActive: alex.status === 'active',
              lastLoginAt: '2026-11-01T12:00:00Z',
            },
          },
        }),
      });
      return;
    }
  });
}

test.describe('Issue #32: Employee Module Hardening & Lifecycle E2E Suite', () => {
  test.beforeEach(async () => {
    mkdirSync(SCREENSHOT_DIR, { recursive: true });
  });

  test('Critical Flow 1: Full Employee Lifecycle (create -> onboard -> activate -> documents -> deactivate)', async ({
    page,
  }, testInfo) => {
    test.setTimeout(90000);
    test.skip(testInfo.project.name !== 'desktop', 'Desktop lifecycle master flow');

    await setupEmployeeLifecycleMockRoutes(page);
    await page.addInitScript(() => {
      window.localStorage.setItem('maxr_auth_session', 'admin');
    });

    // 1. Create Employee
    await page.goto('/employees/new');
    await expect(page.getByTestId('create-employee-page')).toBeVisible();

    await page.getByTestId('input-first-name').fill('Aarav');
    await page.getByTestId('input-last-name').fill('Patel');
    await page.getByTestId('input-email').fill('aarav.patel@maxr.internal');
    await page.getByTestId('input-phone').fill('+91 98765 99999');
    await page.getByTestId('input-employee-code').fill('MAX-999');
    await page.getByTestId('select-department').selectOption('dept-eng');
    await page.getByTestId('select-designation').selectOption('desig-swe');
    await page.getByTestId('input-joining-date').fill('2026-12-01');
    await page.getByTestId('role-card-staff').click();

    await page.getByTestId('desktop-submit-button').click();
    await expect(page.getByTestId('create-employee-success-view')).toBeVisible();
    await expect(page.getByText('MAX-999')).toBeVisible();

    // 2. Onboarding Board
    await page.goto('/onboarding');
    await expect(page.getByTestId('onboarding-page')).toBeVisible();
    await expect(page.getByText('Aarav Patel').filter({ visible: true }).first()).toBeVisible();

    // 3. Onboarding Detail & Step Verification
    await page.goto('/hr/onboarding/emp-new-created');
    await expect(page.getByTestId('onboarding-detail-view')).toBeVisible();
    await expect(page.getByText('Aarav Patel').filter({ visible: true }).first()).toBeVisible();
    await expect(page.getByText('Identity & Address Verification')).toBeVisible();

    // Verify checklist item
    const verifyButtons = page.getByRole('button', { name: /^Verify$/i });
    if ((await verifyButtons.count()) > 0) {
      await verifyButtons.first().click();
      const confirmBtn = page.getByRole('button', { name: /Confirm Verify/i });
      if (await confirmBtn.isVisible()) {
        await confirmBtn.click();
      }
    }

    // Activate Account
    const activateBtn = page.getByRole('button', { name: /Activate Account/i });
    if (await activateBtn.isVisible()) {
      await activateBtn.click();
      await expect(page.getByText(/activated/i).first()).toBeVisible();
    }

    // 4. Employee Directory
    await page.goto('/employees');
    await expect(page.getByText('MAX-999').filter({ visible: true }).first()).toBeVisible();
    await expect(page.getByText('Aarav Patel').filter({ visible: true }).first()).toBeVisible();

    // 5. Employee Documents
    await page.goto('/employees/emp-new-created/documents');
    await expect(page.getByTestId('employee-documents-page')).toBeVisible();

    // 6. Deactivate Employee
    await page.goto('/employees/emp-new-created/deactivate');
    await expect(page.getByTestId('employee-deactivation-page')).toBeVisible();
    await expect(page.getByText('Aarav Patel').filter({ visible: true }).first()).toBeVisible();

    // Trigger deactivation modal
    const deactTrigger = page.getByTestId('start-deactivation-btn');
    await expect(deactTrigger).toBeVisible();
    await deactTrigger.click();

    // Confirm in modal
    await expect(page.getByTestId('deactivate-employee-modal')).toBeVisible();
    await page.getByTestId('confirm-deactivation-btn').click();

    // Dismiss completion modal
    await expect(page.getByTestId('deactivation-done-btn')).toBeVisible();
    await page.getByTestId('deactivation-done-btn').click();

    // Verified deactivated status badge and notice
    await expect(page.getByText('Deactivated').first()).toBeVisible();
    await expect(page.getByText('Account is Already Deactivated')).toBeVisible();

    await expectNoHorizontalScroll(page);
  });

  test('Critical Flow 2a: Role-Matrix - Team Lead Scopes', async ({ page }, testInfo) => {
    test.setTimeout(60000);
    test.skip(testInfo.project.name !== 'desktop', 'Desktop role matrix check');

    await setupEmployeeLifecycleMockRoutes(page);

    // --- Role: Team Lead ---
    await page.addInitScript(() => {
      window.localStorage.setItem('maxr_auth_session', 'team_lead');
    });

    // Team Lead in Directory
    await page.goto('/employees');
    await expect(page.locator('h1, h2').first()).toBeVisible();

    // Team Lead blocked from deactivating
    await page.goto('/employees/emp-004/deactivate');
    await expect(page.getByTestId('forbidden-route-container')).toBeVisible();

    // Team Lead blocked from creating employees
    await page.goto('/employees/new');
    await expect(page.getByTestId('forbidden-route-container')).toBeVisible();

    await expectNoHorizontalScroll(page);
  });

  test('Critical Flow 2b: Role-Matrix - Staff Member Scopes', async ({ page }, testInfo) => {
    test.setTimeout(60000);
    test.skip(testInfo.project.name !== 'desktop', 'Desktop role matrix check');

    await setupEmployeeLifecycleMockRoutes(page);

    // --- Role: Staff Member ---
    await page.addInitScript(() => {
      window.localStorage.setItem('maxr_auth_session', 'staff');
    });

    // Staff viewing own profile
    await page.goto('/profile');
    await expect(page.getByTestId('my-profile-page')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Alex Mercer' })).toBeVisible();

    // Staff viewing own onboarding
    await page.goto('/staff/onboarding');
    await expect(page.locator('h1, h2').first()).toBeVisible();

    // Staff blocked from accessing other employee deactivation
    await page.goto('/employees/emp-001/deactivate');
    await expect(page.getByTestId('forbidden-route-container')).toBeVisible();

    // Staff blocked from creating employees
    await page.goto('/employees/new');
    await expect(page.getByTestId('forbidden-route-container')).toBeVisible();

    await expectNoHorizontalScroll(page);
  });

  test('Critical Flow 3: Candidate Self-Service Profile Update', async ({ page }, testInfo) => {
    test.setTimeout(60000);
    test.skip(testInfo.project.name !== 'desktop', 'Desktop profile edit');

    await setupEmployeeLifecycleMockRoutes(page);
    await page.addInitScript(() => {
      window.localStorage.setItem('maxr_auth_session', 'staff');
    });

    await page.goto('/profile');
    await expect(page.getByTestId('my-profile-page')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Alex Mercer' })).toBeVisible();

    // Edit phone number
    const editPhoneBtn = page.getByTestId('edit-phone-button');
    await expect(editPhoneBtn).toBeVisible();
    await editPhoneBtn.click();
    await page.getByTestId('phone-input').fill('+91 99999 88888');
    await page.getByTestId('save-phone-button').click();
    await expect(page.getByText('+91 99999 88888')).toBeVisible();

    await expectNoHorizontalScroll(page);
  });

  // --- 9 Reference Viewports Audit ---
  for (const [width, height, label] of REFERENCE_VIEWPORTS) {
    test(`Responsive Audit: ${width}x${height} (${label}) - Employee Directory`, async ({
      page,
    }, testInfo) => {
      test.skip(
        testInfo.project.name !== 'desktop',
        'reference viewports driven from desktop project',
      );

      await page.setViewportSize({ width, height });
      await setupEmployeeLifecycleMockRoutes(page);
      await page.addInitScript(() => {
        window.localStorage.setItem('maxr_auth_session', 'admin');
      });

      await page.goto('/employees');
      await expect(page.locator('h1, h2').first()).toBeVisible();
      await expectNoHorizontalScroll(page);

      await page.screenshot({
        path: `${SCREENSHOT_DIR}/directory-${width}x${height}-${label}.png`,
        fullPage: true,
      });
    });

    test(`Responsive Audit: ${width}x${height} (${label}) - Onboarding Dashboard`, async ({
      page,
    }, testInfo) => {
      test.skip(
        testInfo.project.name !== 'desktop',
        'reference viewports driven from desktop project',
      );

      await page.setViewportSize({ width, height });
      await setupEmployeeLifecycleMockRoutes(page);
      await page.addInitScript(() => {
        window.localStorage.setItem('maxr_auth_session', 'admin');
      });

      await page.goto('/onboarding');
      await expect(page.getByTestId('onboarding-page')).toBeVisible();
      await expectNoHorizontalScroll(page);

      await page.screenshot({
        path: `${SCREENSHOT_DIR}/onboarding-${width}x${height}-${label}.png`,
        fullPage: true,
      });
    });

    test(`Responsive Audit: ${width}x${height} (${label}) - My Profile`, async ({
      page,
    }, testInfo) => {
      test.skip(
        testInfo.project.name !== 'desktop',
        'reference viewports driven from desktop project',
      );

      await page.setViewportSize({ width, height });
      await setupEmployeeLifecycleMockRoutes(page);
      await page.addInitScript(() => {
        window.localStorage.setItem('maxr_auth_session', 'staff');
      });

      await page.goto('/profile');
      await expect(page.getByTestId('my-profile-page')).toBeVisible();
      await expectNoHorizontalScroll(page);

      await page.screenshot({
        path: `${SCREENSHOT_DIR}/profile-${width}x${height}-${label}.png`,
        fullPage: true,
      });
    });

    test(`Responsive Audit: ${width}x${height} (${label}) - Deactivation View`, async ({
      page,
    }, testInfo) => {
      test.skip(
        testInfo.project.name !== 'desktop',
        'reference viewports driven from desktop project',
      );

      await page.setViewportSize({ width, height });
      await setupEmployeeLifecycleMockRoutes(page);
      await page.addInitScript(() => {
        window.localStorage.setItem('maxr_auth_session', 'admin');
      });

      await page.goto('/employees/emp-101/deactivate');
      await expect(page.getByTestId('employee-deactivation-page')).toBeVisible();
      await expectNoHorizontalScroll(page);

      await page.screenshot({
        path: `${SCREENSHOT_DIR}/deactivation-${width}x${height}-${label}.png`,
        fullPage: true,
      });
    });
  }
});
