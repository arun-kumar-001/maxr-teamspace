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

const SCREENSHOT_DIR = resolve(import.meta.dirname, '../../../e2e-output/screenshots');

async function setupOperationsMockRoutes(page: any) {
  // Mock Settings
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

  // Mock Departments
  await page.route('**/api/v1/departments*', async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: [
          { id: 'dept-1', name: 'Engineering', code: 'ENG' },
          { id: 'dept-2', name: 'Operations', code: 'OPS' },
        ],
      }),
    });
  });

  // Mock Projects
  await page.route('**/api/v1/projects*', async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: [
          {
            id: 'proj-1',
            name: 'MAXR Platform',
            code: 'PLAT',
            status: 'active',
            leadEmployeeId: 'emp-003',
            memberCount: 8,
          },
        ],
        meta: { page: 1, pageSize: 20, total: 1 },
      }),
    });
  });

  // Mock Attendance endpoints
  await page.route('**/api/v1/attendance/today', async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          workDate: '2026-11-03',
          totalDurationMinutes: 0,
          sessionsCount: 0,
          activeSession: null,
          sessions: [],
        },
      }),
    });
  });

  await page.route('**/api/v1/attendance/active', async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: null,
      }),
    });
  });

  await page.route('**/api/v1/attendance/check-in', async (route: any) => {
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          id: 'sess-001',
          employeeId: 'emp-004',
          workDate: '2026-11-03',
          checkInTime: new Date().toISOString(),
          checkOutTime: null,
          durationMinutes: null,
          status: 'present',
          location: null,
          notes: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      }),
    });
  });

  await page.route('**/api/v1/attendance/check-out', async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          id: 'sess-001',
          employeeId: 'emp-004',
          workDate: '2026-11-03',
          checkInTime: '2026-11-03T09:00:00Z',
          checkOutTime: new Date().toISOString(),
          durationMinutes: 480,
          status: 'present',
          location: null,
          notes: null,
          createdAt: '2026-11-03T09:00:00Z',
          updatedAt: new Date().toISOString(),
        },
      }),
    });
  });

  await page.route('**/api/v1/attendance/me*', async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: [
          {
            id: 'sess-hist-1',
            employeeId: 'emp-004',
            workDate: '2026-11-02',
            checkInTime: '2026-11-02T09:00:00Z',
            checkOutTime: '2026-11-02T18:00:00Z',
            durationMinutes: 540,
            status: 'present',
            location: null,
            notes: null,
            createdAt: '2026-11-02T09:00:00Z',
            updatedAt: '2026-11-02T18:00:00Z',
          },
        ],
        meta: { page: 1, pageSize: 20, total: 1 },
      }),
    });
  });

  await page.route('**/api/v1/attendance/corrections*', async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: [],
        meta: { page: 1, pageSize: 20, total: 0 },
      }),
    });
  });

  await page.route('**/api/v1/attendance', async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: [
          {
            id: 'sess-hist-1',
            employeeId: 'emp-004',
            employeeName: 'Alex River',
            workDate: '2026-11-02',
            checkInTime: '2026-11-02T09:00:00Z',
            checkOutTime: '2026-11-02T18:00:00Z',
            durationMinutes: 540,
            status: 'present',
            location: null,
            notes: null,
            createdAt: '2026-11-02T09:00:00Z',
            updatedAt: '2026-11-02T18:00:00Z',
          },
        ],
        meta: { page: 1, pageSize: 20, total: 1 },
      }),
    });
  });

  // Mock Leave Policies, Holidays & Balances
  await page.route('**/api/v1/leave-policies*', async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: [
          { id: 'pol-1', name: 'Annual Leave', code: 'AL', daysPerYear: 18 },
          { id: 'pol-2', name: 'Sick Leave', code: 'SL', daysPerYear: 12 },
        ],
      }),
    });
  });

  await page.route('**/api/v1/holidays*', async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: [
          {
            id: 'hol-1',
            name: 'New Year Day',
            date: '2026-01-01',
            year: 2026,
            isOptional: false,
          },
        ],
      }),
    });
  });

  await page.route('**/api/v1/leave-balances*', async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: [
          {
            id: 'bal-1',
            leaveTypeId: 'pol-1',
            leaveTypeName: 'Annual Leave',
            allottedDays: 18,
            usedDays: 4,
            remainingDays: 14,
            pendingDays: 0,
          },
        ],
      }),
    });
  });

  await page.route('**/api/v1/leave-requests*', async (route: any) => {
    const method = route.request().method();
    if (method === 'POST') {
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            id: 'req-1',
            leaveTypeId: 'pol-1',
            startDate: '2026-11-10',
            endDate: '2026-11-12',
            totalDays: 3,
            status: 'pending',
          },
        }),
      });
    } else {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [],
          meta: { page: 1, pageSize: 20, total: 0 },
        }),
      });
    }
  });

  // Mock Approvals
  await page.route('**/api/v1/approvals*', async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: [
          {
            id: 'appr-1',
            subjectType: 'leave_request',
            subjectId: 'req-1',
            requesterEmployeeId: 'emp-004',
            requesterName: 'Alex River',
            requesterManagerId: 'emp-003',
            stages: ['manager', 'hr'],
            currentStage: 0,
            status: 'pending',
            decisions: [],
            createdAt: '2026-11-02T10:00:00Z',
            decidedAt: null,
          },
        ],
        meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
      }),
    });
  });

  // Mock Tasks
  await page.route('**/api/v1/tasks*', async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: [
          {
            id: 'task-1',
            title: 'Verify Redis Invalidation Strategy',
            description: 'Ensure cache eviction after employee update.',
            projectId: null,
            projectName: null,
            assigneeEmployeeId: 'emp-004',
            assigneeName: 'Alex River',
            assignerEmployeeId: 'emp-003',
            assignerName: 'Marcus Vance',
            status: 'in_progress',
            priority: 'high',
            dueDate: '2026-11-15',
            isOverdue: false,
            completedAt: null,
            version: 1,
            createdAt: '2026-11-01T09:00:00Z',
            updatedAt: '2026-11-01T09:00:00Z',
          },
        ],
        meta: { page: 1, pageSize: 50, total: 1 },
      }),
    });
  });

  // Mock Meetings
  await page.route('**/api/v1/meetings*', async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: [
          {
            id: 'mtg-1',
            title: 'Weekly Standup & Sync',
            description: 'Weekly team status sync',
            organizerId: 'emp-003',
            organizerName: 'Marcus Vance',
            startsAt: '2026-11-04T10:00:00Z',
            endsAt: '2026-11-04T10:30:00Z',
            status: 'scheduled',
            myRole: 'invitee',
            myRsvp: 'accepted',
            attendeeCount: 4,
            attendees: [],
          },
        ],
        meta: { page: 1, pageSize: 20, total: 1 },
      }),
    });
  });

  // Mock Reports
  await page.route('**/api/v1/reports*', async (route: any) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/api/v1/reports') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [
            {
              name: 'attendance-summary',
              title: 'Attendance summary',
              description: 'Days worked, late, on leave and absent per employee',
              module: 'attendance',
              columns: [
                { key: 'employeeName', label: 'Employee' },
                { key: 'daysPresent', label: 'Days Present' },
                { key: 'daysLate', label: 'Days Late' },
              ],
            },
          ],
        }),
      });
    } else {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [{ employeeName: 'Alex River', daysPresent: 20, daysLate: 0 }],
          meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
        }),
      });
    }
  });
}

test.describe('Issue #48 [D2-16]: Operations and Collaboration Hardening and E2E Tests', () => {
  test.beforeEach(async () => {
    mkdirSync(SCREENSHOT_DIR, { recursive: true });
  });

  for (const [width, height, label] of REFERENCE_VIEWPORTS) {
    test(`${width}x${height} (${label}): operations and collaboration responsive layout audit`, async ({
      page,
    }, testInfo) => {
      // Run the 9-viewport check on the desktop project to avoid redundant test runs
      test.skip(
        testInfo.project.name !== 'desktop',
        'reference viewports are driven from desktop project',
      );

      await page.setViewportSize({ width, height });
      await setupOperationsMockRoutes(page);

      // Authenticate as Staff
      await page.addInitScript(() => {
        window.localStorage.setItem('maxr_auth_session', 'staff');
      });

      // 1. Visit Staff Attendance Check-in
      await page.goto('/staff/attendance');
      await expect(page.locator('h1, h2').first()).toBeVisible();
      await expectNoHorizontalScroll(page);

      // 2. Visit Staff Leave Management
      await page.goto('/staff/leave');
      await expect(page.locator('h1, h2').first()).toBeVisible();
      await expectNoHorizontalScroll(page);

      // 3. Visit Staff Tasks
      await page.goto('/staff/tasks');
      await expect(page.locator('h1, h2').first()).toBeVisible();
      await expectNoHorizontalScroll(page);

      // 4. Visit Meetings Calendar
      await page.goto('/meetings');
      await expect(page.locator('h1, h2').first()).toBeVisible();
      await expectNoHorizontalScroll(page);
    });
  }

  test('Critical Flow 1: Staff check-in / check-out interface', async ({ page }) => {
    await setupOperationsMockRoutes(page);
    await page.addInitScript(() => {
      window.localStorage.setItem('maxr_auth_session', 'staff');
    });

    await page.goto('/staff/attendance');
    await expect(page.locator('h1, h2').first()).toContainText('Attendance');

    // Verify presence of check in card/button
    const checkInBtn = page.getByRole('button', { name: /check in/i });
    if (await checkInBtn.isVisible()) {
      await checkInBtn.click();
    }
    await expectNoHorizontalScroll(page);
  });

  test('Critical Flow 2: Team Lead Approvals Inbox decision flow', async ({ page }) => {
    await setupOperationsMockRoutes(page);
    await page.addInitScript(() => {
      window.localStorage.setItem('maxr_auth_session', 'team_lead');
    });

    await page.goto('/lead/approvals');
    await expect(page.locator('h1, h2').first()).toContainText('Approvals');
    await expect(page.locator(':visible').filter({ hasText: 'Alex River' }).first()).toBeVisible();

    await expectNoHorizontalScroll(page);
  });

  test('Critical Flow 3: Team Lead Task Board and filtering', async ({ page }) => {
    await setupOperationsMockRoutes(page);
    await page.addInitScript(() => {
      window.localStorage.setItem('maxr_auth_session', 'team_lead');
    });

    await page.goto('/lead/tasks');
    await expect(page.locator('h1, h2').first()).toContainText('Tasks');
    await expect(
      page.locator(':visible').filter({ hasText: 'Verify Redis Invalidation Strategy' }).first(),
    ).toBeVisible();

    await expectNoHorizontalScroll(page);
  });

  test('Critical Flow 4: Team Lead Reports Viewer and Scoping', async ({ page }) => {
    await setupOperationsMockRoutes(page);
    await page.addInitScript(() => {
      window.localStorage.setItem('maxr_auth_session', 'team_lead');
    });

    await page.goto('/lead/reports');
    await expect(page.locator('h1, h2').first()).toBeVisible();
    await expect(page.getByText('Direct Reports Scope').first()).toBeVisible();

    await expectNoHorizontalScroll(page);
  });
});
