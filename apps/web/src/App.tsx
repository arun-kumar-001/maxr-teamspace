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
      {SHOW_GALLERY && (
        <Route
          path="/components"
          element={
            <ShellLayout>
              <ComponentGalleryPage />
            </ShellLayout>
          }
        />
      )}

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
