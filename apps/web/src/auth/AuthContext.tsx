import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { ROLES, type Role } from '@maxr/shared';
import { MOCK_USERS, type MockUser } from './mockUsers';

export interface AuthContextValue {
  user: MockUser | null;
  role: Role | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password?: string) => Promise<boolean>;
  logout: () => void;
  switchRole: (newRole: Role) => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const AUTH_STORAGE_KEY = 'maxr_auth_session';

export interface AuthProviderProps {
  children: ReactNode;
  initialRole?: Role;
  persistSession?: boolean;
}

export function AuthProvider({ children, initialRole, persistSession = true }: AuthProviderProps) {
  const [user, setUser] = useState<MockUser | null>(() => {
    // Explicit initialRole (e.g. for testing)
    if (initialRole && MOCK_USERS[initialRole]) {
      return MOCK_USERS[initialRole];
    }
    // In production: strictly unauthenticated by default (B1 fix: deny by default in production)
    if (!import.meta.env.DEV) {
      return null;
    }
    // In development only: check localStorage or fallback to seeded mock session (TL-10 until #7 merges)
    if (persistSession && typeof window !== 'undefined' && window.localStorage) {
      try {
        const storedRole = localStorage.getItem(AUTH_STORAGE_KEY) as Role | null;
        if (storedRole && MOCK_USERS[storedRole]) {
          return MOCK_USERS[storedRole];
        }
      } catch {
        // Fallback gracefully on storage access errors
      }
    }
    return MOCK_USERS[ROLES.STAFF];
  });

  const [isLoading, setIsLoading] = useState(false);

  // Check backend session on mount (authoritative backend session per B1 / TL-05)
  useEffect(() => {
    let isMounted = true;
    if (typeof window !== 'undefined' && typeof window.fetch === 'function' && !user) {
      setIsLoading(true);
      fetch('/api/v1/auth/me', {
        headers: { Accept: 'application/json' },
        credentials: 'include',
      })
        .then(async (res) => {
          if (!isMounted) return;
          if (res.ok) {
            const data = await res.json();
            const sessionUser = data?.user ?? data?.data;
            if (sessionUser && sessionUser.role && MOCK_USERS[sessionUser.role as Role]) {
              setUser({
                ...MOCK_USERS[sessionUser.role as Role],
                name: sessionUser.name ?? MOCK_USERS[sessionUser.role as Role].name,
                email: sessionUser.email ?? MOCK_USERS[sessionUser.role as Role].email,
              });
            }
          }
        })
        .catch(() => {
          // Network error or dev server offline - keep unauthenticated
        })
        .finally(() => {
          if (isMounted) setIsLoading(false);
        });
    }

    return () => {
      isMounted = false;
    };
  }, []);

  // Sync dev session storage
  useEffect(() => {
    if (
      import.meta.env.DEV &&
      persistSession &&
      typeof window !== 'undefined' &&
      window.localStorage
    ) {
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
  }, [user, persistSession]);

  const login = async (email: string, password = ''): Promise<boolean> => {
    setIsLoading(true);
    const cleanEmail = email.toLowerCase().trim();

    // 1. Attempt authoritative backend authentication first
    try {
      const response = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: cleanEmail, password }),
      });

      if (response.ok) {
        const payload = await response.json();
        const userData = payload?.user ?? payload?.data;
        if (userData && userData.role) {
          const baseMock = MOCK_USERS[userData.role as Role] ?? MOCK_USERS[ROLES.STAFF];
          setUser({
            ...baseMock,
            name: userData.name ?? baseMock.name,
            email: userData.email ?? cleanEmail,
            role: userData.role as Role,
          });
          setIsLoading(false);
          return true;
        }
      }
    } catch {
      // Backend not running or unreachable
    }

    // 2. In DEV mode only: allow exact-match fallback for canonical demo accounts
    if (import.meta.env.DEV) {
      let matchedUser: MockUser | undefined;
      if (cleanEmail === 'admin@maxr.com') {
        matchedUser = MOCK_USERS[ROLES.ADMIN];
      } else if (cleanEmail === 'hr@maxr.com') {
        matchedUser = MOCK_USERS[ROLES.HR_MANAGER];
      } else if (cleanEmail === 'lead@maxr.com') {
        matchedUser = MOCK_USERS[ROLES.TEAM_LEAD];
      } else if (cleanEmail === 'staff@maxr.com') {
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
      fetch('/api/v1/auth/logout', {
        method: 'POST',
        credentials: 'include',
      }).catch(() => {});
    }
    setUser(null);
  };

  const switchRole = (newRole: Role) => {
    // Dev only switcher
    if (import.meta.env.DEV && MOCK_USERS[newRole]) {
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
