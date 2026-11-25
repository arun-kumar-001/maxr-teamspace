// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HRDashboard } from '../HRDashboard';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const today = (() => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
})();
const nextMonthDay = (() => {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
})();

const emp = (id: string, department: string, joiningDate: string) => ({
  id,
  employeeCode: id,
  firstName: id,
  lastName: 'Tester',
  department: { id: department, name: department },
  designation: { id: 'g', title: 'Staff' },
  joiningDate,
});

describe('HRDashboard', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/v1/onboarding')) {
        return json({
          data: [
            { id: 'o1', currentStep: 'hr' },
            { id: 'o2', currentStep: 'hr' },
            { id: 'o3', currentStep: 'it_admin' },
          ],
          meta: { total: 3 },
        });
      }
      if (url.includes('/api/v1/approvals')) {
        return json({ data: [], meta: { total: 5 } });
      }
      if (url.includes('/leave-requests/calendar')) {
        return json({
          data: [
            {
              requestId: 'l1',
              employeeId: 'a',
              employeeName: 'Asha Rao',
              leaveTypeCode: 'AL',
              leaveTypeName: 'Annual Leave',
              startDate: today,
              endDate: today,
              halfDay: false,
              days: 1,
              status: 'approved',
            },
          ],
        });
      }
      if (url.includes('/api/v1/holidays')) {
        return json({ data: [{ id: 'h1', date: nextMonthDay, name: 'Founders Day' }] });
      }
      if (url.includes('/api/v1/attendance')) {
        return json({
          data: [
            { id: 'r1', employeeId: 'a', workDate: today, checkInTime: `${today}T09:00:00Z` },
            { id: 'r2', employeeId: 'b', workDate: today, checkInTime: `${today}T09:05:00Z` },
          ],
          meta: { total: 2 },
        });
      }
      if (url.includes('/api/v1/employees')) {
        return json({
          data: [
            emp('a', 'Engineering', '2020-01-01'),
            emp('b', 'Engineering', '2020-01-01'),
            emp('c', 'Design', '2020-01-01'),
          ],
          meta: { page: 1, pageSize: 100, total: 3, totalPages: 1 },
        });
      }
      return json({ data: [] });
    }) as unknown as typeof fetch;
  });
  afterEach(() => {
    cleanup();
    globalThis.fetch = originalFetch;
  });

  it('shows the workforce numbers the server returned, and nothing made up', async () => {
    const { container } = render(<HRDashboard />);

    // Today's attendance: 2 of the 3 employees checked in.
    await waitFor(() => expect(screen.getByText('67% present')).toBeInTheDocument());
    expect(screen.getByText('Total Headcount').closest('div')).toBeTruthy();
    expect(container.textContent).not.toContain('124');
    expect(container.textContent).not.toContain('Aarav Patel');
    expect(container.textContent).not.toContain('Diwali');

    // Departments with who is in today
    const departments = within(screen.getByTestId('hr-departments'));
    expect(departments.getByText('Engineering')).toBeInTheDocument();
    expect(departments.getByText(/2 people · 2 in today/)).toBeInTheDocument();
    expect(departments.getByText(/1 person · 0 in today/)).toBeInTheDocument();

    // Onboarding by step
    expect(screen.getByText('1. HR Check').previousSibling).toHaveTextContent('2');
    expect(screen.getByText('3. IT / Admin').previousSibling).toHaveTextContent('1');

    // Out of office, approvals and the next holiday
    expect(screen.getByText('Asha Rao')).toBeInTheDocument();
    expect(screen.getByText('Founders Day')).toBeInTheDocument();
    expect(screen.getAllByText('5').length).toBeGreaterThanOrEqual(2);
  });

  it('says so instead of showing numbers when the employee list cannot be loaded', async () => {
    globalThis.fetch = vi.fn(async () =>
      json({ error: { message: 'no' } }, 500),
    ) as unknown as typeof fetch;
    render(<HRDashboard />);
    expect(await screen.findByRole('alert')).toHaveTextContent(/could not be loaded/);
  });
});
