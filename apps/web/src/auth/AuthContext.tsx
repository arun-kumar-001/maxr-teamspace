import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { ROLES, type Role } from '@maxr/shared';
import { apiFetch, setCsrfToken } from '../api/client';
import { MOCK_USERS } from './mockUsers';
import { AuthUser } from './types';

export { type AuthUser } from './types';

export interface AuthContextValue {
  user: AuthUser | null;
  role: Role | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password?: string) => Promise<boolean>;
  logout: () => void;
  switchRole: (newRole: Role) => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const AUTH_STORAGE_KEY = 'maxr_auth_session';

const ROLE_DISPLAY_NAMES: Record<Role, string> = {
  [ROLES.ADMIN]: 'System Administrator',
  [ROLES.HR_MANAGER]: 'HR Manager',
  [ROLES.TEAM_LEAD]: 'Team Lead',
  [ROLES.STAFF]: 'Staff Member',
};

export function computeInitials(name?: string, email?: string): string {
  if (name) {
    const parts = name.trim().split(/\s+/);
    const first = parts[0];
    const last = parts[parts.length - 1];
    if (parts.length >= 2 && first && last && first[0] && last[0]) {
      return (first[0] + last[0]).toUpperCase();
    }
    if (parts.length === 1 && first && first.length > 0) {
      return first.slice(0, 2).toUpperCase();
    }
  }
  if (email && email.length >= 2) {
    return email.slice(0, 2).toUpperCase();
  }
  return 'U';
}

export function buildUserFromApi(apiUser: Record<string, unknown>): AuthUser {
  const role = (apiUser.role as Role) || ROLES.STAFF;
  const roles = Array.isArray(apiUser.roles) ? (apiUser.roles as Role[]) : [role];
  const permissions = Array.isArray(apiUser.permissions) ? (apiUser.permissions as string[]) : [];

  const firstName = typeof apiUser.firstName === 'string' ? apiUser.firstName : '';
  const lastName = typeof apiUser.lastName === 'string' ? apiUser.lastName : '';
  const fullName =
    `${firstName} ${lastName}`.trim() ||
    (apiUser.name as string) ||
    (apiUser.email as string) ||
    'User';

  return {
    id: (apiUser.id as string) || '',
    employeeId: apiUser.employeeId as string | undefined,
    email: (apiUser.email as string) || '',
    name: fullName,
    firstName: firstName || undefined,
    lastName: lastName || undefined,
    role,
    roles,
    permissions,
    title: (apiUser.title as string) || ROLE_DISPLAY_NAMES[role] || role,
    department: (apiUser.department as string) || undefined,
    avatarInitials: computeInitials(fullName, apiUser.email as string),
  };
}

export interface AuthProviderProps {
  children: ReactNode;
  initialRole?: Role;
  persistSession?: boolean;
}

export function AuthProvider({ children, initialRole, persistSession = true }: AuthProviderProps) {
  // Opt-in development mock authentication flag (defaults to false per TL review)
  const isDevMockAuth = import.meta.env.DEV && import.meta.env.VITE_DEV_MOCK_AUTH === 'true';

  const [user, setUser] = useState<AuthUser | null>(() => {
    // 1. Explicit initialRole (used by unit tests)
    if (initialRole && MOCK_USERS[initialRole]) {
      return MOCK_USERS[initialRole];
    }
    // 2. In DEV mode with explicit VITE_DEV_MOCK_AUTH opt-in: check storage or fallback
    if (isDevMockAuth && persistSession && typeof window !== 'undefined' && window.localStorage) {
      try {
        const storedRole = localStorage.getItem(AUTH_STORAGE_KEY) as Role | null;
        if (storedRole && MOCK_USERS[storedRole]) {
          return MOCK_USERS[storedRole];
        }
      } catch {
        // Fallback gracefully on storage access errors
      }
      return MOCK_USERS[ROLES.STAFF];
    }
    // 3. Default: unauthenticated (deny by default)
    return null;
  });

  const [isLoading, setIsLoading] = useState(false);

  // Check backend session on mount (authoritative backend session per B1 / TL-05)
  useEffect(() => {
    let isMounted = true;
    if (typeof window !== 'undefined' && typeof window.fetch === 'function' && !user) {
      setIsLoading(true);
      apiFetch('/api/v1/auth/me')
        .then(async (res) => {
          if (!isMounted) return;
          if (res.ok) {
            const json = await res.json();
            const apiData = json?.data;
            if (apiData?.csrfToken) {
              setCsrfToken(apiData.csrfToken);
            }
            if (apiData?.user) {
              const serverUser = buildUserFromApi(apiData.user);
              setUser(serverUser);
            }
          }
        })
        .catch(() => {
          // Network error or backend offline - stay unauthenticated
        })
        .finally(() => {
          if (isMounted) setIsLoading(false);
        });
    }

    return () => {
      isMounted = false;
    };
  }, []);

  // Sync dev session storage only when mock auth is enabled
  useEffect(() => {
    if (isDevMockAuth && persistSession && typeof window !== 'undefined' && window.localStorage) {
      try {
        if (user) {
          localStorage.setItem(AUTH_STORAGE_KEY, user.role);
        } else {
          localStorage.removeItem(AUTH_STORAGE_KEY);
        }
      } catch {
        // Ignore storage errors in test / private mode
      }
    }
  }, [user, persistSession, isDevMockAuth]);

  const login = async (email: string, password = ''): Promise<boolean> => {
    setIsLoading(true);
    const cleanEmail = email.toLowerCase().trim();

    // 1. Authoritative backend authentication
    try {
      const response = await apiFetch('/api/v1/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: cleanEmail, password }),
      });

      if (response.ok) {
        const json = await response.json();
        const apiData = json?.data;
        if (apiData?.csrfToken) {
          setCsrfToken(apiData.csrfToken);
        }
        if (apiData?.user) {
          const serverUser = buildUserFromApi(apiData.user);
          setUser(serverUser);
          setIsLoading(false);
          return true;
        }
      }
    } catch {
      // Backend not running or unreachable
    }

    // 2. In DEV mode with explicit VITE_DEV_MOCK_AUTH flag: fallback demo matching
    if (isDevMockAuth) {
      let matchedUser: AuthUser | undefined;
      if (cleanEmail === 'admin@maxr.com' || cleanEmail === 'admin@maxr.internal') {
        matchedUser = MOCK_USERS[ROLES.ADMIN];
      } else if (cleanEmail === 'hr@maxr.com' || cleanEmail === 'hr@maxr.internal') {
        matchedUser = MOCK_USERS[ROLES.HR_MANAGER];
      } else if (cleanEmail === 'lead@maxr.com' || cleanEmail === 'teamlead@maxr.internal') {
        matchedUser = MOCK_USERS[ROLES.TEAM_LEAD];
      } else if (cleanEmail === 'staff@maxr.com' || cleanEmail === 'staff@maxr.internal') {
        matchedUser = MOCK_USERS[ROLES.STAFF];
      }

      if (matchedUser) {
        setUser(matchedUser);
        setIsLoading(false);
        return true;
      }
    }

    setIsLoading(false);
    return false;
  };

  const logout = () => {
    if (typeof window !== 'undefined' && typeof window.fetch === 'function') {
      apiFetch('/api/v1/auth/logout', { method: 'POST' }).catch(() => {});
    }
    setCsrfToken(null);
    setUser(null);
  };

  const switchRole = (newRole: Role) => {
    if (isDevMockAuth && MOCK_USERS[newRole]) {
      setUser(MOCK_USERS[newRole]);
    }
  };

  const value: AuthContextValue = {
    user,
    role: user ? user.role : null,
    isAuthenticated: user !== null,
    isLoading,
    login,
    logout,
    switchRole,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
