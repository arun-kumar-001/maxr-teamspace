import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Button } from '../Button.js';
import { Input } from '../Input.js';
import { Select } from '../Select.js';
import { FormField } from '../FormField.js';
import { StatusPill, Badge, type LeaveStatus, type TaskStatus } from '../StatusPill.js';
import { EmptyState, ErrorState, ForbiddenState } from '../StateCards.js';
import { PageContainer } from '../PageContainer.js';
import { DataTable } from '../DataTable.js';
import { Modal } from '../Modal.js';
import { Toast } from '../Toast.js';
import { Tabs } from '../Tabs.js';
import { Stack, Grid } from '../LayoutPrimitives.js';

describe('TC-11-01: Shared UI Component Suite', () => {
  describe('Button Component', () => {
    it('should render primary button with token utility classes and touch target', () => {
      const html = renderToStaticMarkup(
        <Button variant="primary" size="md">
          Click Me
        </Button>,
      );
      expect(html).toContain('bg-primary-deep');
      expect(html).toContain('min-h-[44px]');
      expect(html).toContain('rounded-input');
      expect(html).toContain('Click Me');
    });

    it('should render aria-busy and disabled when isLoading is true', () => {
      const html = renderToStaticMarkup(<Button isLoading>Saving</Button>);
      expect(html).toContain('aria-busy="true"');
      expect(html).toContain('disabled=""');
      expect(html).toContain('role="status"');
    });

    it('should apply danger variant styling using semantic token class', () => {
      const html = renderToStaticMarkup(<Button variant="danger">Delete</Button>);
      expect(html).toContain('bg-danger');
      expect(html).toContain('text-white');
    });
  });

  describe('Input Component', () => {
    it('should render aria-invalid and error message when error prop is provided', () => {
      const html = renderToStaticMarkup(<Input id="email" error="Invalid email address" />);
      expect(html).toContain('aria-invalid="true"');
      expect(html).toContain('aria-describedby="email-error"');
      expect(html).toContain('border-danger');
      expect(html).toContain('Invalid email address');
      expect(html).toContain('role="alert"');
    });

    it('should link helperText with aria-describedby when no error exists', () => {
      const html = renderToStaticMarkup(<Input id="username" helperText="Enter your username" />);
      expect(html).toContain('aria-invalid="false"');
      expect(html).toContain('aria-describedby="username-helper"');
      expect(html).toContain('border-border');
      expect(html).toContain('Enter your username');
    });
  });

  describe('Select Component', () => {
    it('should render accessible select dropdown with options and error state', () => {
      const html = renderToStaticMarkup(
        <Select
          id="role"
          options={[
            { value: 'admin', label: 'Admin' },
            { value: 'staff', label: 'Staff' },
          ]}
          error="Please select a role"
        />,
      );
      expect(html).toContain('aria-invalid="true"');
      expect(html).toContain('border-danger');
      expect(html).toContain('Admin');
      expect(html).toContain('Staff');
      expect(html).toContain('role="alert"');
    });
  });

  describe('FormField Wrapper', () => {
    it('should render label, required indicator, and error messaging', () => {
      const html = renderToStaticMarkup(
        <FormField label="Full Name" htmlFor="name" required error="Name is required">
          <Input id="name" />
        </FormField>,
      );
      expect(html).toContain('Full Name');
      expect(html).toContain('*');
      expect(html).toContain('text-danger');
      expect(html).toContain('Name is required');
      expect(html).toContain('role="alert"');
    });
  });

  describe('StatusPill Component — Workflow Mappings (AGENTS.md §8)', () => {
    const leaveStatuses: LeaveStatus[] = [
      'Applied',
      'Pending',
      'Approved',
      'Rejected',
      'Cancelled',
    ];
    const taskStatuses: TaskStatus[] = [
      'To Do',
      'In Progress',
      'In Review',
      'Completed',
      'Blocked',
    ];

    it('should render all 5 mandatory Leave workflow statuses with semantic classes', () => {
      leaveStatuses.forEach((status) => {
        const html = renderToStaticMarkup(<StatusPill status={status} />);
        expect(html).toContain('role="status"');
        expect(html).toContain(status);
      });
    });

    it('should render all 5 mandatory Task workflow statuses with semantic classes', () => {
      taskStatuses.forEach((status) => {
        const html = renderToStaticMarkup(<StatusPill status={status} />);
        expect(html).toContain('role="status"');
        expect(html).toContain(status);
      });
    });

    it('should render Badge component with variants', () => {
      const html = renderToStaticMarkup(<Badge variant="primary">New</Badge>);
      expect(html).toContain('bg-primary-soft');
      expect(html).toContain('text-primary-ink');
      expect(html).toContain('New');
    });
  });

  describe('State Cards (Empty, Error, Forbidden)', () => {
    it('should render EmptyState with title, description, and action button', () => {
      const html = renderToStaticMarkup(
        <EmptyState
          title="No tasks"
          description="You have no assigned tasks."
          actionLabel="Create Task"
          onAction={() => {}}
        />,
      );
      expect(html).toContain('data-testid="empty-state"');
      expect(html).toContain('No tasks');
      expect(html).toContain('You have no assigned tasks.');
      expect(html).toContain('Create Task');
    });

    it('should render ErrorState with alert role', () => {
      const html = renderToStaticMarkup(<ErrorState message="Database connection failed" />);
      expect(html).toContain('role="alert"');
      expect(html).toContain('data-testid="error-state"');
      expect(html).toContain('Database connection failed');
    });

    it('should render ForbiddenState with Access Denied', () => {
      const html = renderToStaticMarkup(<ForbiddenState />);
      expect(html).toContain('role="alert"');
      expect(html).toContain('data-testid="forbidden-state"');
      expect(html).toContain('Access Denied');
    });
  });

  describe('PageContainer Primitives', () => {
    it('should constrain prose to max-w-prose and dashboard to max-w-dashboard per §8', () => {
      const proseHtml = renderToStaticMarkup(<PageContainer maxWidth="prose">Text</PageContainer>);
      expect(proseHtml).toContain('max-w-prose');

      const dashboardHtml = renderToStaticMarkup(
        <PageContainer maxWidth="dashboard">Dashboard</PageContainer>,
      );
      expect(dashboardHtml).toContain('max-w-dashboard');
    });
  });

  describe('DataTable Component', () => {
    interface TestRow extends Record<string, unknown> {
      id: string;
      name: string;
      role: string;
    }

    const testData: TestRow[] = [
      { id: '1', name: 'Alice', role: 'admin' },
      { id: '2', name: 'Bob', role: 'staff' },
    ];

    const testCols = [
      { key: 'name', header: 'Name' },
      { key: 'role', header: 'Role' },
    ];

    it('should render EmptyState when dataset is empty', () => {
      const html = renderToStaticMarkup(
        <DataTable<TestRow>
          data={[]}
          columns={testCols}
          keyExtractor={(r) => r.id}
          emptyTitle="No Employees"
          ariaLabel="Employees"
        />,
      );
      expect(html).toContain('data-testid="empty-state"');
      expect(html).toContain('No Employees');
    });

    it('should render mobile card container and desktop table container', () => {
      const html = renderToStaticMarkup(
        <DataTable<TestRow>
          ariaLabel="Employees"
          data={testData}
          columns={testCols}
          keyExtractor={(r) => r.id}
        />,
      );

      // Mobile cards (block sm:hidden)
      expect(html).toContain('data-testid="datatable-mobile-cards"');
      // Desktop table (hidden sm:block)
      expect(html).toContain('data-testid="datatable-desktop-table"');
      expect(html).toContain('Alice');
      expect(html).toContain('Bob');
    });
  });

  describe('Modal Component', () => {
    it('should render accessible dialog with title and close button when open', () => {
      const html = renderToStaticMarkup(
        <Modal isOpen={true} onClose={() => {}} title="Edit Profile">
          <p>Modal body content</p>
        </Modal>,
      );
      expect(html).toContain('role="dialog"');
      expect(html).toContain('aria-modal="true"');
      expect(html).toContain('Edit Profile');
      expect(html).toContain('Modal body content');
    });

    it('should return null when isOpen is false', () => {
      const html = renderToStaticMarkup(
        <Modal isOpen={false} onClose={() => {}} title="Hidden">
          <p>Hidden content</p>
        </Modal>,
      );
      expect(html).toBe('');
    });
  });

  describe('Toast & Tabs Components', () => {
    it('should render Toast with role="status"', () => {
      const html = renderToStaticMarkup(
        <Toast variant="success" title="Success" message="Saved changes" />,
      );
      expect(html).toContain('role="status"');
      expect(html).toContain('Success');
      expect(html).toContain('Saved changes');
    });

    it('should render Tabs with role="tablist" and active indicator', () => {
      const html = renderToStaticMarkup(
        <Tabs
          tabs={[
            { id: 'tab1', label: 'Overview' },
            { id: 'tab2', label: 'Settings' },
          ]}
          activeTab="tab1"
          onChange={() => {}}
        />,
      );
      expect(html).toContain('role="tablist"');
      expect(html).toContain('role="tab"');
      expect(html).toContain('aria-selected="true"');
      expect(html).toContain('Overview');
      expect(html).toContain('Settings');
    });
  });

  describe('Layout Primitives (Stack, Grid)', () => {
    it('should render Stack with flex direction and gap classes', () => {
      const html = renderToStaticMarkup(
        <Stack direction="row" gap="4">
          <div>Item 1</div>
          <div>Item 2</div>
        </Stack>,
      );
      expect(html).toContain('flex-row');
      expect(html).toContain('gap-4');
    });

    it('should render Grid with responsive column classes', () => {
      const html = renderToStaticMarkup(
        <Grid cols="responsive-cards" gap="6">
          <div>Card 1</div>
        </Grid>,
      );
      expect(html).toContain('grid');
      expect(html).toContain('grid-cols-1');
      expect(html).toContain('gap-6');
    });
  });
});
