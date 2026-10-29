import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { ROLES, type Role } from '@maxr/shared';
import { MOCK_USERS, type MockUser } from './mockUsers';

export interface AuthContextValue {
  user: MockUser | null;
  role: Role | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (emailOrRole: string, password?: string) => Promise<boolean>;
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
    if (initialRole && MOCK_USERS[initialRole]) {
      return MOCK_USERS[initialRole];
    }
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
    // Default seeded session: Staff
    return MOCK_USERS[ROLES.STAFF];
  });

  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (persistSession && typeof window !== 'undefined' && window.localStorage) {
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

  const login = async (emailOrRole: string): Promise<boolean> => {
    setIsLoading(true);
    // Simulate async network request
    await new Promise((resolve) => setTimeout(resolve, 80));

    const cleanInput = emailOrRole.toLowerCase().trim();
    let matchedUser: MockUser | undefined;

    // Match by direct role name or by email
    if (cleanInput === 'admin' || cleanInput.includes('admin@')) {
      matchedUser = MOCK_USERS[ROLES.ADMIN];
    } else if (cleanInput === 'hr_manager' || cleanInput === 'hr' || cleanInput.includes('hr@')) {
      matchedUser = MOCK_USERS[ROLES.HR_MANAGER];
    } else if (
      cleanInput === 'team_lead' ||
      cleanInput === 'lead' ||
      cleanInput.includes('lead@')
    ) {
      matchedUser = MOCK_USERS[ROLES.TEAM_LEAD];
    } else if (cleanInput === 'staff' || cleanInput.includes('staff@')) {
      matchedUser = MOCK_USERS[ROLES.STAFF];
    }

    if (matchedUser) {
      setUser(matchedUser);
      setIsLoading(false);
      return true;
    }

    setIsLoading(false);
    return false;
  };

  const logout = () => {
    setUser(null);
  };

  const switchRole = (newRole: Role) => {
    if (MOCK_USERS[newRole]) {
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
