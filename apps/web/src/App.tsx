import type { ReactNode } from 'react';
import {
  BrowserRouter,
  MemoryRouter,
  Routes,
  Route,
  useNavigate,
  useLocation,
  Navigate,
} from 'react-router-dom';
import type { Role } from '@maxr/shared';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { LoginPage } from './auth/LoginPage';
import { AppShell } from './shell/AppShell';
import { RouteGuard } from './shell/RouteGuard';
import { DashboardRouter } from './dashboards/DashboardRouter';
import { NotFoundPage } from './shell/NotFoundPage';
import { ComponentGalleryPage } from './components/ui/gallery/ComponentGalleryPage';
import {
  EmployeeDeactivationPage,
  EmployeeDirectoryPage,
  EmployeeDocumentsPage,
  MyOnboardingPage,
  OnboardingPage,
  SetPasswordPage,
} from './features/employees';
import { DepartmentsPage } from './features/departments';
import { DesignationsPage } from './features/designations';
import { AttendancePage } from './features/attendance';
import { ApprovalsInboxPage } from './features/approvals';
import { ShiftsAndPoliciesPage } from './features/shifts';
import { LeaveManagementPage } from './features/leave';
import { UsersPage } from './features/users';

// The gallery is a developer tool; it must not ship to production.
const SHOW_GALLERY = import.meta.env.DEV;

export interface AppProps {
  initialRole?: Role;
  initialPath?: string;
  persistSession?: boolean;
}

function ShellLayout({ children }: { children: ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <RouteGuard currentPath={location.pathname} onNavigate={(path) => navigate(path)}>
      <AppShell currentPath={location.pathname} onNavigate={(path) => navigate(path)}>
        {children}
      </AppShell>
    </RouteGuard>
  );
}

function AppRoutes() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

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

      {/* Designations Management Routes (Issue #18) */}
      <Route
        path="/designations"
        element={
          <ShellLayout>
            <DesignationsPage />
          </ShellLayout>
        }
      />
      <Route
        path="/admin/designations"
        element={
          <ShellLayout>
            <DesignationsPage />
          </ShellLayout>
        }
      />
      <Route
        path="/hr/designations"
        element={
          <ShellLayout>
            <DesignationsPage />
          </ShellLayout>
        }
      />

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
            <AttendancePage />
          </ShellLayout>
        }
      />
      <Route
        path="/staff/attendance"
        element={
          <ShellLayout>
            <AttendancePage />
          </ShellLayout>
        }
      />
      <Route
        path="/lead/attendance"
        element={
          <ShellLayout>
            <AttendancePage />
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
        path="/lead/approvals"
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
            <LeaveManagementPage initialTab="balances" />
          </ShellLayout>
        }
      />
      <Route
        path="/leave"
        element={
          <ShellLayout>
            <LeaveManagementPage initialTab="balances" />
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
        path="/leave/holidays"
        element={
          <ShellLayout>
            <LeaveManagementPage initialTab="holidays" />
          </ShellLayout>
        }
      />
      <Route
        path="/leave/policies"
        element={
          <ShellLayout>
            <LeaveManagementPage initialTab="policies" />
          </ShellLayout>
        }
      />
      <Route
        path="/hr/leave"
        element={
          <ShellLayout>
            <LeaveManagementPage initialTab="policies" />
          </ShellLayout>
        }
      />
      <Route
        path="/hr/holidays"
        element={
          <ShellLayout>
            <LeaveManagementPage initialTab="holidays" />
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

      {/* Staff Member Protected Routes */}
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
