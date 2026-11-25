import { lazy, Suspense, useContext, type ReactNode } from 'react';
import {
  BrowserRouter,
  MemoryRouter,
  Routes,
  Route,
  useNavigate,
  useLocation,
  useParams,
  Navigate,
} from 'react-router-dom';
import type { Role } from '@maxr/shared';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { ForcedPasswordChangePage } from './auth/ForcedPasswordChangePage';
import { LoginPage } from './auth/LoginPage';
import { AppShell } from './shell/AppShell';
import { RouteGuard } from './shell/RouteGuard';
import {
  NavigationBlockerProvider,
  NavigationBlockerContext,
} from './shell/NavigationBlockerContext';
import { DashboardRouter } from './dashboards/DashboardRouter';
import { NotFoundPage } from './shell/NotFoundPage';
import { SetPasswordPage } from './features/employees';

// Each screen is its own chunk, loaded when first visited, so the first load stays small.
const ComponentGalleryPage = lazy(() =>
  import('./components/ui/gallery/ComponentGalleryPage').then((m) => ({
    default: m.ComponentGalleryPage,
  })),
);
const CreateEmployeePage = lazy(() =>
  import('./features/employees').then((m) => ({ default: m.CreateEmployeePage })),
);
const EmployeeDeactivationPage = lazy(() =>
  import('./features/employees').then((m) => ({ default: m.EmployeeDeactivationPage })),
);
const EmployeeDetailPage = lazy(() =>
  import('./features/employees').then((m) => ({ default: m.EmployeeDetailPage })),
);
const EmployeeDirectoryPage = lazy(() =>
  import('./features/employees').then((m) => ({ default: m.EmployeeDirectoryPage })),
);
const EmployeeDocumentsPage = lazy(() =>
  import('./features/employees').then((m) => ({ default: m.EmployeeDocumentsPage })),
);
const MyOnboardingPage = lazy(() =>
  import('./features/employees').then((m) => ({ default: m.MyOnboardingPage })),
);
const OnboardingPage = lazy(() =>
  import('./features/employees').then((m) => ({ default: m.OnboardingPage })),
);
const OrgChartPage = lazy(() =>
  import('./features/employees').then((m) => ({ default: m.OrgChartPage })),
);
const DepartmentsPage = lazy(() =>
  import('./features/departments').then((m) => ({ default: m.DepartmentsPage })),
);
const MyProfilePage = lazy(() =>
  import('./features/profile').then((m) => ({ default: m.MyProfilePage })),
);
const ProfilePortalPage = lazy(() =>
  import('./features/profile').then((m) => ({ default: m.ProfilePortalPage })),
);
const AttendancePage = lazy(() =>
  import('./features/attendance').then((m) => ({ default: m.AttendancePage })),
);
const ApprovalsInboxPage = lazy(() =>
  import('./features/approvals').then((m) => ({ default: m.ApprovalsInboxPage })),
);
const ShiftsAndPoliciesPage = lazy(() =>
  import('./features/shifts').then((m) => ({ default: m.ShiftsAndPoliciesPage })),
);
const LeaveManagementPage = lazy(() =>
  import('./features/leave').then((m) => ({ default: m.LeaveManagementPage })),
);
const UsersPage = lazy(() => import('./features/users').then((m) => ({ default: m.UsersPage })));
const NotificationsInboxPage = lazy(() =>
  import('./features/notifications').then((m) => ({ default: m.NotificationsInboxPage })),
);
const AuditLogsPage = lazy(() =>
  import('./features/audit-logs').then((m) => ({ default: m.AuditLogsPage })),
);
const ProjectsListPage = lazy(() =>
  import('./features/projects').then((m) => ({ default: m.ProjectsListPage })),
);
const ProjectDetailPage = lazy(() =>
  import('./features/projects').then((m) => ({ default: m.ProjectDetailPage })),
);
const TasksPage = lazy(() => import('./features/tasks').then((m) => ({ default: m.TasksPage })));
const CompanySettingsPage = lazy(() =>
  import('./features/settings').then((m) => ({ default: m.CompanySettingsPage })),
);
const ExpensesPage = lazy(() =>
  import('./features/expenses').then((m) => ({ default: m.ExpensesPage })),
);
const PayslipsPage = lazy(() =>
  import('./features/payslips').then((m) => ({ default: m.PayslipsPage })),
);
const ReportsPage = lazy(() =>
  import('./features/reports').then((m) => ({ default: m.ReportsPage })),
);

// The gallery is a developer tool; it must not ship to production.
const SHOW_GALLERY = import.meta.env.DEV;

export interface AppProps {
  initialRole?: Role;
  initialPath?: string;
  persistSession?: boolean;
}

/**
 * An employee's page is the My Profile page (/profile/details): your own record at
 * /profile/details, anybody else's at /profile/details/:id. Older /employees/:id links land here.
 */
function EmployeeProfileRedirect() {
  const { id } = useParams<{ id: string }>();
  const { search } = useLocation();
  const { user } = useAuth();
  const target = id && id !== user?.employeeId ? `/profile/details/${id}` : '/profile/details';
  return <Navigate to={`${target}${search}`} replace />;
}

function ShellLayoutInner({ children }: { children: ReactNode }) {
  const location = useLocation();
  const blockerCtx = useContext(NavigationBlockerContext);
  const navigate = useNavigate();
  const handleNav = blockerCtx ? blockerCtx.navigateWithBlockCheck : navigate;

  return (
    <RouteGuard currentPath={location.pathname} onNavigate={handleNav}>
      <AppShell currentPath={location.pathname} onNavigate={handleNav}>
        <Suspense
          fallback={
            <div role="status" aria-live="polite" className="p-8 text-sm text-text-muted">
              Loading…
            </div>
          }
        >
          {children}
        </Suspense>
      </AppShell>
    </RouteGuard>
  );
}

function ShellLayout({ children }: { children: ReactNode }) {
  const navigate = useNavigate();

  return (
    <NavigationBlockerProvider onNavigate={(path) => navigate(path)}>
      <ShellLayoutInner>{children}</ShellLayoutInner>
    </NavigationBlockerProvider>
  );
}

function AppRoutes() {
  const { isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // A password someone else set must be replaced first; the server refuses everything else anyway.
  if (isAuthenticated && user?.mustChangePassword) return <ForcedPasswordChangePage />;

  return (
    <Routes>
      {/* Public Login Route */}
      <Route
        path="/login"
        element={
          isAuthenticated ? (
            <Navigate to="/dashboard" replace />
          ) : (
            <LoginPage onSuccess={() => navigate('/dashboard')} />
          )
        }
      />

      {/* Public Set-Password Route (Onboarding Claim) */}
      <Route path="/set-password" element={<SetPasswordPage />} />

      {/* Root redirects to dashboard */}
      <Route
        path="/"
        element={
          <ShellLayout>
            <DashboardRouter />
          </ShellLayout>
        }
      />

      {/* Unified Dashboard Route */}
      <Route
        path="/dashboard"
        element={
          <ShellLayout>
            <DashboardRouter />
          </ShellLayout>
        }
      />

      {/* User and Role Administration Routes (Issue #27) */}
      <Route
        path="/admin/users"
        element={
          <ShellLayout>
            <UsersPage />
          </ShellLayout>
        }
      />

      {/* Audit Log Viewer Routes (Issue #28) */}
      <Route
        path="/admin/audit"
        element={
          <ShellLayout>
            <AuditLogsPage />
          </ShellLayout>
        }
      />
      <Route
        path="/admin/audit-logs"
        element={
          <ShellLayout>
            <AuditLogsPage />
          </ShellLayout>
        }
      />

      {/* Company Settings Routes (Issue #30) */}
      <Route
        path="/admin/settings"
        element={
          <ShellLayout>
            <CompanySettingsPage />
          </ShellLayout>
        }
      />
      <Route
        path="/settings"
        element={
          <ShellLayout>
            <CompanySettingsPage />
          </ShellLayout>
        }
      />

      {/* Employee Directory Routes (Issue #19) */}
      <Route
        path="/employees"
        element={
          <ShellLayout>
            <EmployeeDirectoryPage />
          </ShellLayout>
        }
      />
      <Route
        path="/admin/employees"
        element={
          <ShellLayout>
            <EmployeeDirectoryPage />
          </ShellLayout>
        }
      />
      <Route
        path="/hr/employees"
        element={
          <ShellLayout>
            <EmployeeDirectoryPage />
          </ShellLayout>
        }
      />
      <Route
        path="/lead/team"
        element={
          <ShellLayout>
            <EmployeeDirectoryPage />
          </ShellLayout>
        }
      />

      {/* Employee Creation Routes (Issue #20) */}
      <Route
        path="/employees/new"
        element={
          <ShellLayout>
            <CreateEmployeePage />
          </ShellLayout>
        }
      />
      <Route
        path="/admin/employees/new"
        element={
          <ShellLayout>
            <CreateEmployeePage />
          </ShellLayout>
        }
      />
      <Route
        path="/hr/employees/new"
        element={
          <ShellLayout>
            <CreateEmployeePage />
          </ShellLayout>
        }
      />

      {/* Employee Org Chart Routes (Issue #23) */}
      <Route
        path="/employees/org-chart"
        element={
          <ShellLayout>
            <OrgChartPage />
          </ShellLayout>
        }
      />
      <Route
        path="/admin/org-chart"
        element={
          <ShellLayout>
            <OrgChartPage />
          </ShellLayout>
        }
      />
      <Route
        path="/hr/org-chart"
        element={
          <ShellLayout>
            <OrgChartPage />
          </ShellLayout>
        }
      />

      {/* Employee Detail & Edit Routes (Issue #21) */}
      <Route path="/employees/:id" element={<EmployeeProfileRedirect />} />
      <Route path="/admin/employees/:id" element={<EmployeeProfileRedirect />} />
      <Route path="/hr/employees/:id" element={<EmployeeProfileRedirect />} />

      {/* Departments Management Routes (Issue #18) */}
      <Route
        path="/departments"
        element={
          <ShellLayout>
            <DepartmentsPage />
          </ShellLayout>
        }
      />
      <Route
        path="/admin/departments"
        element={
          <ShellLayout>
            <DepartmentsPage />
          </ShellLayout>
        }
      />
      <Route
        path="/hr/departments"
        element={
          <ShellLayout>
            <DepartmentsPage />
          </ShellLayout>
        }
      />

      {/* Designations Management Routes Redirect to Departments */}
      <Route path="/designations" element={<Navigate to="/departments" replace />} />
      <Route path="/admin/designations" element={<Navigate to="/admin/departments" replace />} />
      <Route path="/hr/designations" element={<Navigate to="/hr/departments" replace />} />

      {/* My Profile Portal & Personal Details Routes */}
      <Route
        path="/profile"
        element={
          <ShellLayout>
            <ProfilePortalPage />
          </ShellLayout>
        }
      />
      <Route
        path="/profile/details/:id"
        element={
          <ShellLayout>
            <EmployeeDetailPage />
          </ShellLayout>
        }
      />
      <Route
        path="/profile/details"
        element={
          <ShellLayout>
            <MyProfilePage />
          </ShellLayout>
        }
      />
      {/* Legacy /staff/profile compatibility redirect (Issue #22) */}
      <Route path="/staff/profile" element={<Navigate to="/profile" replace />} />

      {/* Employee Documents Routes (Issue #25) */}
      <Route
        path="/employees/:id/documents"
        element={
          <ShellLayout>
            <EmployeeDocumentsPage />
          </ShellLayout>
        }
      />
      {/* Employee Deactivation Routes (Issue #26) */}
      <Route
        path="/admin/employees/:id/deactivate"
        element={
          <ShellLayout>
            <EmployeeDeactivationPage />
          </ShellLayout>
        }
      />
      <Route
        path="/employees/:id/deactivate"
        element={
          <ShellLayout>
            <EmployeeDeactivationPage />
          </ShellLayout>
        }
      />
      <Route
        path="/hr/employees/:id/documents"
        element={
          <ShellLayout>
            <EmployeeDocumentsPage />
          </ShellLayout>
        }
      />
      <Route
        path="/admin/employees/:id/documents"
        element={
          <ShellLayout>
            <EmployeeDocumentsPage />
          </ShellLayout>
        }
      />
      <Route
        path="/staff/documents"
        element={
          <ShellLayout>
            <EmployeeDocumentsPage />
          </ShellLayout>
        }
      />

      {/* Onboarding Routes */}
      <Route
        path="/hr/lifecycle"
        element={
          <ShellLayout>
            <OnboardingPage />
          </ShellLayout>
        }
      />
      <Route
        path="/hr/onboarding"
        element={
          <ShellLayout>
            <OnboardingPage />
          </ShellLayout>
        }
      />
      <Route
        path="/hr/onboarding/:id"
        element={
          <ShellLayout>
            <OnboardingPage />
          </ShellLayout>
        }
      />
      <Route
        path="/onboarding"
        element={
          <ShellLayout>
            <OnboardingPage />
          </ShellLayout>
        }
      />
      <Route
        path="/staff/onboarding"
        element={
          <ShellLayout>
            <MyOnboardingPage />
          </ShellLayout>
        }
      />

      {/* Attendance Routes */}
      <Route
        path="/attendance"
        element={
          <ShellLayout>
            <AttendancePage initialTab="on-duty" />
          </ShellLayout>
        }
      />
      <Route
        path="/attendance/on-duty"
        element={
          <ShellLayout>
            <AttendancePage initialTab="on-duty" />
          </ShellLayout>
        }
      />
      <Route
        path="/attendance/roster"
        element={
          <ShellLayout>
            <AttendancePage initialTab="roster" />
          </ShellLayout>
        }
      />
      <Route
        path="/attendance/timesheets"
        element={
          <ShellLayout>
            <AttendancePage initialTab="timesheets" />
          </ShellLayout>
        }
      />
      <Route
        path="/attendance/check-in-out"
        element={
          <ShellLayout>
            <AttendancePage initialTab="check-in-out" />
          </ShellLayout>
        }
      />
      <Route
        path="/staff/attendance"
        element={
          <ShellLayout>
            <AttendancePage initialTab="my-attendance" />
          </ShellLayout>
        }
      />
      <Route
        path="/lead/attendance"
        element={
          <ShellLayout>
            <AttendancePage initialTab="on-duty" />
          </ShellLayout>
        }
      />

      {/* Approvals Routes */}
      <Route
        path="/approvals"
        element={
          <ShellLayout>
            <ApprovalsInboxPage />
          </ShellLayout>
        }
      />
      <Route
        path="/approvals/:id"
        element={
          <ShellLayout>
            <ApprovalsInboxPage />
          </ShellLayout>
        }
      />
      <Route
        path="/lead/approvals"
        element={
          <ShellLayout>
            <ApprovalsInboxPage />
          </ShellLayout>
        }
      />
      <Route
        path="/lead/approvals/:id"
        element={
          <ShellLayout>
            <ApprovalsInboxPage />
          </ShellLayout>
        }
      />
      <Route
        path="/hr/approvals"
        element={
          <ShellLayout>
            <ApprovalsInboxPage />
          </ShellLayout>
        }
      />
      <Route
        path="/hr/approvals/:id"
        element={
          <ShellLayout>
            <ApprovalsInboxPage />
          </ShellLayout>
        }
      />

      {/* Notifications Routes */}
      <Route
        path="/notifications"
        element={
          <ShellLayout>
            <NotificationsInboxPage />
          </ShellLayout>
        }
      />

      {/* Projects Routes (Issue #42) */}
      <Route
        path="/projects"
        element={
          <ShellLayout>
            <ProjectsListPage />
          </ShellLayout>
        }
      />
      <Route
        path="/projects/:id"
        element={
          <ShellLayout>
            <ProjectDetailPage />
          </ShellLayout>
        }
      />
      <Route
        path="/admin/projects"
        element={
          <ShellLayout>
            <ProjectsListPage />
          </ShellLayout>
        }
      />
      <Route
        path="/lead/projects"
        element={
          <ShellLayout>
            <ProjectsListPage />
          </ShellLayout>
        }
      />
      <Route
        path="/staff/projects"
        element={
          <ShellLayout>
            <ProjectsListPage />
          </ShellLayout>
        }
      />

      {/* Tasks Routes (Issue #43) */}
      <Route
        path="/tasks"
        element={
          <ShellLayout>
            <TasksPage />
          </ShellLayout>
        }
      />
      <Route
        path="/tasks/:id"
        element={
          <ShellLayout>
            <TasksPage />
          </ShellLayout>
        }
      />
      <Route
        path="/staff/tasks"
        element={
          <ShellLayout>
            <TasksPage initialScope="mine" />
          </ShellLayout>
        }
      />
      <Route
        path="/staff/tasks/:id"
        element={
          <ShellLayout>
            <TasksPage initialScope="mine" />
          </ShellLayout>
        }
      />
      <Route
        path="/lead/tasks"
        element={
          <ShellLayout>
            <TasksPage initialScope="team" />
          </ShellLayout>
        }
      />
      <Route
        path="/lead/tasks/:id"
        element={
          <ShellLayout>
            <TasksPage initialScope="team" />
          </ShellLayout>
        }
      />
      <Route
        path="/admin/tasks"
        element={
          <ShellLayout>
            <TasksPage initialScope="team" />
          </ShellLayout>
        }
      />
      <Route
        path="/admin/tasks/:id"
        element={
          <ShellLayout>
            <TasksPage initialScope="team" />
          </ShellLayout>
        }
      />

      {/* Meetings Routes (Removed per user request - Redirect to dashboard) */}
      <Route path="/meetings" element={<Navigate to="/dashboard" replace />} />
      <Route path="/staff/meetings" element={<Navigate to="/dashboard" replace />} />
      <Route path="/lead/meetings" element={<Navigate to="/dashboard" replace />} />
      <Route path="/admin/meetings" element={<Navigate to="/dashboard" replace />} />

      {/* Expenses Routes (Issue #29) */}
      <Route
        path="/expenses"
        element={
          <ShellLayout>
            <ExpensesPage />
          </ShellLayout>
        }
      />
      {/* Reports Routes (Issue #15 & #47) */}
      <Route
        path="/reports"
        element={
          <ShellLayout>
            <ReportsPage />
          </ShellLayout>
        }
      />
      <Route
        path="/staff/expenses"
        element={
          <ShellLayout>
            <ExpensesPage />
          </ShellLayout>
        }
      />
      <Route
        path="/admin/reports"
        element={
          <ShellLayout>
            <ReportsPage />
          </ShellLayout>
        }
      />
      <Route
        path="/lead/expenses"
        element={
          <ShellLayout>
            <ExpensesPage />
          </ShellLayout>
        }
      />
      <Route
        path="/hr/reports"
        element={
          <ShellLayout>
            <ReportsPage />
          </ShellLayout>
        }
      />
      <Route
        path="/hr/expenses"
        element={
          <ShellLayout>
            <ExpensesPage />
          </ShellLayout>
        }
      />
      <Route
        path="/admin/expenses"
        element={
          <ShellLayout>
            <ExpensesPage />
          </ShellLayout>
        }
      />
      <Route
        path="/lead/reports"
        element={
          <ShellLayout>
            <ReportsPage />
          </ShellLayout>
        }
      />

      {/* Shifts & Policies Routes */}
      <Route
        path="/hr/policies"
        element={
          <ShellLayout>
            <ShiftsAndPoliciesPage />
          </ShellLayout>
        }
      />
      <Route
        path="/shifts"
        element={
          <ShellLayout>
            <ShiftsAndPoliciesPage />
          </ShellLayout>
        }
      />

      {/* Leave & Holiday Routes */}
      <Route
        path="/staff/leave"
        element={
          <ShellLayout>
            <LeaveManagementPage initialTab="requests" />
          </ShellLayout>
        }
      />
      <Route
        path="/leave"
        element={
          <ShellLayout>
            <LeaveManagementPage initialTab="requests" />
          </ShellLayout>
        }
      />
      <Route
        path="/leave/requests"
        element={
          <ShellLayout>
            <LeaveManagementPage initialTab="requests" />
          </ShellLayout>
        }
      />
      <Route
        path="/leave/approvals"
        element={
          <ShellLayout>
            <LeaveManagementPage initialTab="approvals" />
          </ShellLayout>
        }
      />
      <Route
        path="/leave/balances"
        element={
          <ShellLayout>
            <LeaveManagementPage initialTab="balances" />
          </ShellLayout>
        }
      />
      <Route
        path="/leave/calendar"
        element={
          <ShellLayout>
            <LeaveManagementPage initialTab="calendar" />
          </ShellLayout>
        }
      />
      <Route
        path="/leave/holidays"
        element={
          <ShellLayout>
            <LeaveManagementPage initialTab="holidays" />
          </ShellLayout>
        }
      />
      <Route path="/leave/policies" element={<Navigate to="/admin/settings?tab=leave" replace />} />
      <Route path="/hr/leave" element={<Navigate to="/admin/settings?tab=leave" replace />} />
      <Route
        path="/hr/holidays"
        element={
          <ShellLayout>
            <LeaveManagementPage initialTab="holidays" />
          </ShellLayout>
        }
      />
      <Route
        path="/leave/:id"
        element={
          <ShellLayout>
            <LeaveManagementPage initialTab="requests" />
          </ShellLayout>
        }
      />

      {/* Admin Protected Routes */}
      <Route
        path="/admin/*"
        element={
          <ShellLayout>
            <DashboardRouter />
          </ShellLayout>
        }
      />

      {/* HR Manager Protected Routes */}
      <Route
        path="/hr/*"
        element={
          <ShellLayout>
            <DashboardRouter />
          </ShellLayout>
        }
      />

      {/* Team Lead Protected Routes */}
      <Route
        path="/lead/*"
        element={
          <ShellLayout>
            <DashboardRouter />
          </ShellLayout>
        }
      />

      {/* Payslips Routes */}
      <Route
        path="/staff/payslips"
        element={
          <ShellLayout>
            <PayslipsPage />
          </ShellLayout>
        }
      />
      <Route
        path="/payslips"
        element={
          <ShellLayout>
            <PayslipsPage />
          </ShellLayout>
        }
      />
      <Route
        path="/hr/payslips"
        element={
          <ShellLayout>
            <PayslipsPage />
          </ShellLayout>
        }
      />
      <Route
        path="/admin/payslips"
        element={
          <ShellLayout>
            <PayslipsPage />
          </ShellLayout>
        }
      />

      {/* Staff Member Protected Routes */}
      <Route
        path="/staff/payslips"
        element={
          <ShellLayout>
            <PayslipsPage />
          </ShellLayout>
        }
      />
      <Route
        path="/payslips"
        element={
          <ShellLayout>
            <PayslipsPage />
          </ShellLayout>
        }
      />
      <Route
        path="/hr/payslips"
        element={
          <ShellLayout>
            <PayslipsPage />
          </ShellLayout>
        }
      />
      <Route
        path="/admin/payslips"
        element={
          <ShellLayout>
            <PayslipsPage />
          </ShellLayout>
        }
      />
      <Route
        path="/staff/*"
        element={
          <ShellLayout>
            <DashboardRouter />
          </ShellLayout>
        }
      />

      {/* Shared UI Components Gallery (Dev only) */}
      {SHOW_GALLERY && <Route path="/components" element={<ComponentGalleryPage />} />}

      {/* 404 Catch-All */}
      <Route
        path="*"
        element={
          <ShellLayout>
            <NotFoundPage
              path={location.pathname}
              onBackToDashboard={() => navigate('/dashboard')}
            />
          </ShellLayout>
        }
      />
    </Routes>
  );
}

export function App({ initialRole, initialPath = '/dashboard', persistSession = true }: AppProps) {
  const isBrowser = typeof window !== 'undefined' && typeof document !== 'undefined';
  const RouterComponent = isBrowser ? BrowserRouter : MemoryRouter;
  const routerProps = isBrowser ? {} : { initialEntries: [initialPath] };

  return (
    <AuthProvider initialRole={initialRole} persistSession={persistSession}>
      <RouterComponent {...routerProps}>
        <AppRoutes />
      </RouterComponent>
    </AuthProvider>
  );
}

export default App;
