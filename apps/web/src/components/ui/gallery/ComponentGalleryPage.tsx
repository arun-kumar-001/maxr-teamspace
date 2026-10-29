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
  StatCard,
  SegmentedControl,
  PageContainer,
  Stack,
  Grid,
} from '../index.js';

// Simple outline icons for the samples (the icon library is still an open decision).
function Icon({ path }: { path: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="w-5 h-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={path} />
    </svg>
  );
}

const ICONS = {
  people:
    'M16 19v-1a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v1M10 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6M20 19v-1a3 3 0 0 0-2-2.8M15.5 4.2a3 3 0 0 1 0 5.6',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18M12 7v5l3 2',
  calendar:
    'M8 3v3M16 3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1',
  check: 'M20 6 9 17l-5-5',
  tasks: 'M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01',
  pulse: 'M3 12h4l3-8 4 16 3-8h4',
};

// Sample numbers for the design reference only (labelled as such on screen).
const SAMPLE_KPIS = [
  { label: 'Active Employees', value: '124', caption: 'Across 6 departments', icon: ICONS.people },
  { label: 'Present Today', value: '108', caption: 'Checked in by 10:00', icon: ICONS.clock },
  { label: 'On Leave', value: '7', caption: 'Approved for today', icon: ICONS.calendar },
  { label: 'Pending Approvals', value: '12', caption: 'Leave and corrections', icon: ICONS.check },
  { label: 'Open Tasks', value: '46', caption: 'Due this week', icon: ICONS.tasks },
  { label: 'Attendance Rate', value: '94.2%', caption: 'Last 30 days', icon: ICONS.pulse },
];

const SAMPLE_PIPELINE = [
  { stage: 'Applied', count: 9, fill: 'bg-chart-1', ink: 'text-chart-ink-1' },
  { stage: 'Pending', count: 12, fill: 'bg-chart-5', ink: 'text-chart-ink-5' },
  { stage: 'Approved', count: 31, fill: 'bg-chart-6', ink: 'text-chart-ink-6' },
  { stage: 'Rejected', count: 3, fill: 'bg-chart-7', ink: 'text-chart-ink-7' },
  { stage: 'Cancelled', count: 2, fill: 'bg-chart-4', ink: 'text-chart-ink-4' },
];

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
  const [range, setRange] = useState('7');
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
    { id: 'dashboard', label: 'Dashboard Patterns' },
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
        {activeTab === 'dashboard' && (
          <Stack gap="6">
            <div>
              <Badge variant="neutral">Sample data for the design reference</Badge>
            </div>

            {/* Welcome panel */}
            <section className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-5 sm:p-7 rounded-panel border border-hero-border bg-gradient-to-r from-hero-from to-hero-to">
              <div className="space-y-2 min-w-0">
                <Badge variant="outline">MAXR Teamspace Workforce Overview</Badge>
                <h2 className="font-display text-2xl sm:text-3xl font-bold text-text">
                  Welcome back, Admin
                </h2>
                <p className="text-sm text-text-muted">
                  Company-wide attendance, leave and task activity.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <SegmentedControl
                  ariaLabel="Date range"
                  value={range}
                  onChange={setRange}
                  options={[
                    { value: '7', label: '7 Days' },
                    { value: '30', label: '30 Days' },
                    { value: '90', label: '90 Days' },
                  ]}
                />
                <Button variant="secondary">New Announcement</Button>
              </div>
            </section>

            {/* KPI cards */}
            <section className="space-y-4">
              <div>
                <h2 className="font-display text-xl sm:text-2xl font-bold text-text">
                  Today&apos;s Overview
                </h2>
                <p className="text-sm text-text-subtle">Priorities and daily workforce metrics</p>
              </div>
              <div className="grid grid-cols-1 xs:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6 gap-4">
                {SAMPLE_KPIS.map((kpi) => (
                  <StatCard
                    key={kpi.label}
                    label={kpi.label}
                    value={kpi.value}
                    caption={kpi.caption}
                    icon={<Icon path={kpi.icon} />}
                  />
                ))}
              </div>
            </section>

            {/* Pipeline */}
            <section className="p-5 sm:p-6 bg-surface border border-border rounded-card shadow-card space-y-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-text">Leave Requests Pipeline</h2>
                  <p className="text-sm text-text-subtle">Requests by stage this month</p>
                </div>
                <Badge variant="primary">Total 57 requests</Badge>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3">
                {SAMPLE_PIPELINE.map((item) => (
                  <div
                    key={item.stage}
                    className="flex flex-col items-center gap-2 pt-4 px-3 pb-0 bg-surface-muted border border-border rounded-card overflow-hidden"
                  >
                    <p className="text-sm font-medium text-text-subtle">{item.stage}</p>
                    <p className={`font-display text-2xl font-bold tabular-nums ${item.ink}`}>
                      {item.count}
                    </p>
                    <span
                      className={`block h-1 w-full rounded-full ${item.fill}`}
                      aria-hidden="true"
                    />
                  </div>
                ))}
              </div>
            </section>
          </Stack>
        )}
      </div>
    </PageContainer>
  );
}
