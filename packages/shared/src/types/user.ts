import { Role, RecordScope } from '../constants/roles';

export interface UserSummary {
  id: string;
  email: string;
  role: Role;
  employeeId?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AuthSession {
  userId: string;
  email: string;
  role: Role;
  employeeId?: string;
  scope: RecordScope;
  sessionId: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface LoginResponse {
  user: UserSummary;
  session: {
    expiresAt: string;
  };
}
