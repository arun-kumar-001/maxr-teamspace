import { useAuth } from '../auth/AuthContext';
import { AdminDashboard } from './AdminDashboard';
import { HRDashboard } from './HRDashboard';
import { TeamLeadDashboard } from './TeamLeadDashboard';
import { StaffDashboard } from './StaffDashboard';
import { ROLES } from '@maxr/shared';

export function DashboardRouter() {
  const { role } = useAuth();

  switch (role) {
    case ROLES.ADMIN:
      return <AdminDashboard />;
    case ROLES.HR_MANAGER:
      return <HRDashboard />;
    case ROLES.TEAM_LEAD:
      return <TeamLeadDashboard />;
    case ROLES.STAFF:
    default:
      return <StaffDashboard />;
  }
}
