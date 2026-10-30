import type { ReactNode } from 'react';
import { useAuth } from '../auth/AuthContext';
import { isPathAuthorizedForRole } from './navigation';
import { LoginPage } from '../auth/LoginPage';
import { ForbiddenState } from '../components/ui';

export interface RouteGuardProps {
  currentPath: string;
  onNavigate: (path: string) => void;
  children: ReactNode;
}

export function RouteGuard({ currentPath, onNavigate, children }: RouteGuardProps) {
  const { isAuthenticated, role, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-muted">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-slate-600 font-medium">Validating session...</p>
        </div>
      </div>
    );
  }

  // Not authenticated -> Show login screen
  if (!isAuthenticated || !role) {
    return <LoginPage onSuccess={() => onNavigate('/dashboard')} />;
  }

  // Check role authorization for the requested path
  const isAuthorized = isPathAuthorizedForRole(currentPath, role);

  if (!isAuthorized) {
    return (
      <div className="p-6 md:p-12 max-w-2xl mx-auto" data-testid="forbidden-route-container">
        <ForbiddenState
          message={`Your role (${role}) is not authorized to view the requested resource: ${currentPath}.`}
          actionLabel="Back to Dashboard"
          onAction={() => onNavigate('/dashboard')}
        />
      </div>
    );
  }

  return <>{children}</>;
}
