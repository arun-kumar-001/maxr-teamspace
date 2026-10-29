import { useState } from 'react';
import {
  Button,
  Input,
  Select,
  FormField,
  StatusPill,
  Badge,
  EmptyState,
  ErrorState,
  ForbiddenState,
  Skeleton,
  Modal,
  DataTable,
  type SortDirection,
  Toast,
  Tabs,
  PageContainer,
  Stack,
  Grid,
} from '../index.js';

interface EmployeeSample extends Record<string, unknown> {
  id: string;
  name: string;
  role: string;
  department: string;
  status: 'Approved' | 'Pending' | 'Applied';
}

const SAMPLE_EMPLOYEES: EmployeeSample[] = [
  {
    id: '1',
    name: 'Alice Smith',
    role: 'Engineering Lead',
    department: 'Technology',
    status: 'Approved',
  },
  {
    id: '2',
    name: 'Bob Jones',
    role: 'HR Specialist',
    department: 'Human Resources',
    status: 'Approved',
  },
  {
    id: '3',
    name: 'Carol White',
    role: 'Staff Designer',
    department: 'Product',
    status: 'Pending',
  },
  {
    id: '4',
    name: 'David Lee',
    role: 'Support Analyst',
    department: 'Operations',
    status: 'Applied',
  },
];

export function ComponentGalleryPage() {
  const [activeTab, setActiveTab] = useState('buttons');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<{ key: string; direction: SortDirection }>({
    key: 'name',
    direction: 'asc',
  });
  const sortedEmployees = [...SAMPLE_EMPLOYEES].sort((a, b) => {
    const order = a.name.localeCompare(b.name);
    return sort.direction === 'asc' ? order : -order;
  });

  const tabs = [
    { id: 'buttons', label: 'Buttons & Badges' },
    { id: 'forms', label: 'Form Controls' },
    { id: 'status', label: 'Status & State Cards' },
    { id: 'table', label: 'DataTable & Modal' },
    { id: 'layout', label: 'Layout & Feedback' },
  ];

  return (
    <PageContainer maxWidth="dashboard" className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-text">Shared UI Component Library (TL-09)</h1>
        <p className="text-sm text-text-muted mt-1">
          Accessible, mobile-first design system components conforming strictly to AGENTS.md §8
          design tokens.
        </p>
      </div>

      <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

      <div role="tabpanel" id={`panel-${activeTab}`} aria-labelledby={`tab-${activeTab}`}>
        {activeTab === 'buttons' && (
          <Stack gap="6">
            <div className="bg-surface p-6 rounded-card border border-border space-y-4">
              <h2 className="text-lg font-semibold text-text">Button Variants & Sizes</h2>
              <div className="flex flex-wrap items-center gap-3">
                <Button variant="primary">Primary Action</Button>
                <Button variant="secondary">Secondary Action</Button>
                <Button variant="outline">Outline</Button>
                <Button variant="ghost">Ghost</Button>
                <Button variant="danger">Danger</Button>
                <Button variant="primary" isLoading>
                  Loading...
                </Button>
              </div>
              <div className="flex flex-wrap items-center gap-3 pt-2">
                <Button size="sm">Small (32px)</Button>
                <Button size="md">Medium (44px touch)</Button>
                <Button size="lg">Large (48px)</Button>
              </div>
            </div>

            <div className="bg-surface p-6 rounded-card border border-border space-y-4">
              <h2 className="text-lg font-semibold text-text">Badges</h2>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="primary">Primary Teal</Badge>
                <Badge variant="secondary">Navy 900</Badge>
                <Badge variant="outline">Outline</Badge>
                <Badge variant="neutral">Neutral Slate</Badge>
                <Badge variant="success">Success</Badge>
                <Badge variant="warning">Warning</Badge>
                <Badge variant="danger">Danger</Badge>
              </div>
            </div>
          </Stack>
        )}

        {activeTab === 'forms' && (
          <div className="bg-surface p-6 rounded-card border border-border max-w-form mx-auto">
            <h2 className="text-lg font-semibold text-text mb-4">Form Controls & Validation</h2>
            <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
              <FormField label="Full Name" htmlFor="fullName" required>
                <Input id="fullName" placeholder="e.g. Jane Doe" />
              </FormField>

              <FormField
                label="Work Email"
                htmlFor="email"
                required
                error="Please enter a valid work email."
              >
                <Input
                  id="email"
                  defaultValue="invalid-email"
                  error="Please enter a valid work email."
                />
              </FormField>

              <FormField
                label="Department Role"
                htmlFor="department"
                helperText="Select employee primary assignment."
              >
                <Select
                  id="department"
                  options={[
                    { value: 'tech', label: 'Technology / Engineering' },
                    { value: 'hr', label: 'Human Resources' },
                    { value: 'ops', label: 'Operations' },
                  ]}
                />
              </FormField>

              <Button variant="primary" type="submit">
                Submit Form
              </Button>
            </form>
          </div>
        )}

        {activeTab === 'status' && (
          <Stack gap="6">
            <div className="bg-surface p-6 rounded-card border border-border space-y-4">
              <h2 className="text-lg font-semibold text-text">
                Leave Workflow Statuses (AGENTS.md §8)
              </h2>
              <div className="flex flex-wrap items-center gap-2">
                <StatusPill status="Applied" />
                <StatusPill status="Pending" />
                <StatusPill status="Approved" />
                <StatusPill status="Rejected" />
                <StatusPill status="Cancelled" />
              </div>
            </div>

            <div className="bg-surface p-6 rounded-card border border-border space-y-4">
              <h2 className="text-lg font-semibold text-text">
                Task Workflow Statuses (AGENTS.md §8)
              </h2>
              <div className="flex flex-wrap items-center gap-2">
                <StatusPill status="To Do" />
                <StatusPill status="In Progress" />
                <StatusPill status="In Review" />
                <StatusPill status="Completed" />
                <StatusPill status="Blocked" />
              </div>
            </div>

            <Grid cols="3" gap="6">
              <EmptyState
                title="No Pending Requests"
                description="All leave and attendance approval requests are cleared."
                actionLabel="Refresh List"
                onAction={() => {}}
              />
              <ErrorState
                title="Service Timeout"
                message="The server took too long to respond. Please retry."
                onRetry={() => {}}
              />
              <ForbiddenState
                title="Access Denied"
                message="You require HR Manager privileges to access this record."
                actionLabel="Go to Dashboard"
                onAction={() => {}}
              />
            </Grid>
          </Stack>
        )}

        {activeTab === 'table' && (
          <Stack gap="6">
            <div className="bg-surface p-6 rounded-card border border-border space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-text">Responsive DataTable</h2>
                  <p className="text-xs text-text-muted">
                    Transforms into stacked cards on phones (&lt; 640px) and full table on desktop.
                  </p>
                </div>
                <Button variant="secondary" size="sm" onClick={() => setIsModalOpen(true)}>
                  Open Modal Sheet
                </Button>
              </div>

              <DataTable<EmployeeSample>
                ariaLabel="Sample employees"
                sortKey={sort.key}
                sortDirection={sort.direction}
                onSortChange={(key, direction) => setSort({ key, direction })}
                data={sortedEmployees}
                keyExtractor={(r) => r.id}
                columns={[
                  { key: 'name', header: 'Employee Name', sortable: true },
                  { key: 'role', header: 'Designation' },
                  { key: 'department', header: 'Department', priority: 'low' },
                  {
                    key: 'status',
                    header: 'Status',
                    render: (r) => <StatusPill status={r.status} size="sm" />,
                  },
                ]}
                page={page}
                pageSize={2}
                total={SAMPLE_EMPLOYEES.length}
                onPageChange={setPage}
              />
            </div>

            <Modal
              isOpen={isModalOpen}
              onClose={() => setIsModalOpen(false)}
              title="Employee Details"
              footer={
                <>
                  <Button variant="outline" onClick={() => setIsModalOpen(false)}>
                    Cancel
                  </Button>
                  <Button variant="primary" onClick={() => setIsModalOpen(false)}>
                    Save Changes
                  </Button>
                </>
              }
            >
              <p className="text-sm text-text-muted">
                This modal dialog is centered on desktop displays and converts into a swipeable
                bottom sheet on mobile devices (&lt; 640px).
              </p>
            </Modal>
          </Stack>
        )}

        {activeTab === 'layout' && (
          <Stack gap="6">
            <div className="bg-surface p-6 rounded-card border border-border space-y-4">
              <h2 className="text-lg font-semibold text-text">Feedback Toasts</h2>
              <div className="flex flex-col gap-3">
                <Toast
                  variant="success"
                  title="Profile Saved"
                  message="Your changes have been updated successfully."
                  onClose={() => {}}
                />
                <Toast
                  variant="warning"
                  title="Pending Approval"
                  message="Shift swap request requires manager review."
                  onClose={() => {}}
                />
                <Toast
                  variant="danger"
                  title="Validation Error"
                  message="Mandatory national ID documents are missing."
                  onClose={() => {}}
                />
                <Toast
                  variant="info"
                  title="System Maintenance"
                  message="Scheduled maintenance today at 11:00 PM UTC."
                  onClose={() => {}}
                />
              </div>
            </div>

            <div className="bg-surface p-6 rounded-card border border-border space-y-4">
              <h2 className="text-lg font-semibold text-text">Skeleton Loading States</h2>
              <div className="space-y-3">
                <Skeleton variant="text" width="60%" />
                <Skeleton variant="rectangular" height={44} />
                <Skeleton variant="rectangular" height={100} />
              </div>
            </div>
          </Stack>
        )}
      </div>
    </PageContainer>
  );
}
