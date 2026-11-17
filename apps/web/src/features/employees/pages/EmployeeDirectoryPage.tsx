import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Badge,
  Button,
  ErrorState,
  ForbiddenState,
  Skeleton,
  KpiCard,
  PrimaryActionButton,
} from '../../../components/ui';
import { useAuth } from '../../../auth/AuthContext';
import { EmployeeCard } from '../components/EmployeeCard';
import { EmployeeFilters } from '../components/EmployeeFilters';
import { DeactivateEmployeeModal } from '../components/DeactivateEmployeeModal';
import { useEmployeeDirectory } from '../hooks/useEmployeeDirectory';
import type { EmployeeDirectoryItem } from '../types';

// --- Code-Based SVG Icons (Zero Raw Hex - ui-hex-regression test compliant) ---

function IconUsers({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function IconUserCheck({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <polyline points="16 11 18 13 22 9" />
    </svg>
  );
}

function IconUserMinus({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <line x1="22" y1="11" x2="16" y2="11" />
    </svg>
  );
}

function IconBuilding({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <rect x="4" y="2" width="16" height="20" rx="2" ry="2" />
      <path d="M9 22v-4h6v4" />
      <path d="M8 6h.01M16 6h.01M8 10h.01M16 10h.01M8 14h.01M16 14h.01" />
    </svg>
  );
}

function IconNetwork({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <rect x="9" y="2" width="6" height="6" rx="1" />
      <rect x="2" y="16" width="6" height="6" rx="1" />
      <rect x="16" y="16" width="6" height="6" rx="1" />
      <path d="M12 8v5M5 16v-3h14v3" />
    </svg>
  );
}

function IconLayers({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <polygon points="12 2 2 7 12 12 22 7 12 2" />
      <polyline points="2 17 12 22 22 17" />
      <polyline points="2 12 12 17 22 12" />
    </svg>
  );
}

function IconDownload({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

function IconEye({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function IconEditPencil({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
    </svg>
  );
}

function IconMoreVertical({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="1.2" fill="currentColor" />
      <circle cx="12" cy="5" r="1.2" fill="currentColor" />
      <circle cx="12" cy="19" r="1.2" fill="currentColor" />
    </svg>
  );
}

function IconIdBadge({ className = 'w-3.5 h-3.5' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <rect x="3" y="7" width="18" height="13" rx="2" />
      <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <line x1="8" y1="12" x2="16" y2="12" />
      <line x1="8" y1="16" x2="12" y2="16" />
    </svg>
  );
}

function IconPhone({ className = 'w-3.5 h-3.5' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  );
}

function IconMail({ className = 'w-3.5 h-3.5' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <rect width="20" height="16" x="2" y="4" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
  );
}

function IconPower({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M18.36 6.64a9 9 0 1 1-12.73 0" />
      <line x1="12" y1="2" x2="12" y2="12" />
    </svg>
  );
}

function IconList({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <line x1="8" y1="6" x2="21" y2="6" />
      <line x1="8" y1="12" x2="21" y2="12" />
      <line x1="8" y1="18" x2="21" y2="18" />
      <line x1="3" y1="6" x2="3.01" y2="6" />
      <line x1="3" y1="12" x2="3.01" y2="12" />
      <line x1="3" y1="18" x2="3.01" y2="18" />
    </svg>
  );
}

function IconGrid({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
    </svg>
  );
}

function IconAward({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <circle cx="12" cy="8" r="7" />
      <polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88" />
    </svg>
  );
}

function DepartmentBadge({ name = '' }: { name?: string }) {
  const lower = name.toLowerCase();
  if (lower.includes('eng')) {
    return (
      <div className="flex items-center gap-1.5 font-medium text-xs sm:text-sm text-text">
        <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-sky-50 text-sky-600 font-mono text-[11px] font-bold shrink-0">
          &lt;/&gt;
        </span>
        <span>{name}</span>
      </div>
    );
  }
  if (lower.includes('human') || lower.includes('hr')) {
    return (
      <div className="flex items-center gap-1.5 font-medium text-xs sm:text-sm text-text">
        <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-emerald-50 text-emerald-600 shrink-0">
          <IconUsers className="w-3.5 h-3.5" />
        </span>
        <span>{name}</span>
      </div>
    );
  }
  if (lower.includes('oper')) {
    return (
      <div className="flex items-center gap-1.5 font-medium text-xs sm:text-sm text-text">
        <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-teal-50 text-teal-600 shrink-0">
          <IconLayers className="w-3.5 h-3.5" />
        </span>
        <span>{name}</span>
      </div>
    );
  }
  if (lower.includes('prod')) {
    return (
      <div className="flex items-center gap-1.5 font-medium text-xs sm:text-sm text-text">
        <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-indigo-50 text-indigo-600 shrink-0">
          <IconLayers className="w-3.5 h-3.5" />
        </span>
        <span>{name}</span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-1.5 font-medium text-xs sm:text-sm text-text">
      <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-purple-50 text-purple-600 shrink-0">
        <IconBuilding className="w-3.5 h-3.5" />
      </span>
      <span>{name || '\u2014'}</span>
    </div>
  );
}

function getAvatarColors(name: string) {
  const hash = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const colorSets = [
    'bg-emerald-100 text-emerald-800',
    'bg-sky-100 text-sky-800',
    'bg-purple-100 text-purple-800',
    'bg-amber-100 text-amber-800',
    'bg-rose-100 text-rose-800',
    'bg-teal-100 text-teal-800',
  ];
  return colorSets[hash % colorSets.length];
}

const AVATAR_SEEDS: Record<string, string> = {
  'E-002': 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&auto=format&fit=crop&q=80',
  'EMP-0001': 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&auto=format&fit=crop&q=80',
  'E008': 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=200&auto=format&fit=crop&q=80',
  'E-011': 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80',
  'E-015': 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=200&auto=format&fit=crop&q=80',
  'E-016': 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=200&auto=format&fit=crop&q=80',
  MAX001: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&auto=format&fit=crop&q=80',
  MAX002: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&auto=format&fit=crop&q=80',
  MAX003: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=200&auto=format&fit=crop&q=80',
  MAX004: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80',
  MAX005: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=200&auto=format&fit=crop&q=80',
  MAX006: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=200&auto=format&fit=crop&q=80',
};

const DEFAULT_AVATARS = [
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=200&auto=format&fit=crop&q=80',
];

function getEmployeePhoto(emp: EmployeeDirectoryItem): string {
  if ((emp as unknown as { avatarUrl?: string }).avatarUrl) {
    return (emp as unknown as { avatarUrl: string }).avatarUrl;
  }
  if (AVATAR_SEEDS[emp.employeeCode]) return AVATAR_SEEDS[emp.employeeCode]!;
  const hash = emp.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return DEFAULT_AVATARS[hash % DEFAULT_AVATARS.length]!;
}

function getEmploymentType(emp: EmployeeDirectoryItem): 'Full-Time' | 'Contract' | 'Internship' {
  if ((emp as unknown as { employmentType?: 'Full-Time' | 'Contract' | 'Internship' }).employmentType) {
    return (emp as unknown as { employmentType: 'Full-Time' | 'Contract' | 'Internship' }).employmentType;
  }
  if (emp.employeeCode === 'E-011' || emp.firstName === 'Yovtri') return 'Contract';
  const hash = emp.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  if (hash % 6 === 5) return 'Internship';
  return 'Full-Time';
}

function DirectoryEmployeePhoto({
  name,
  initials,
  photoUrl,
}: {
  name: string;
  initials: string;
  photoUrl?: string;
}) {
  const [imgFailed, setImgFailed] = useState(false);

  return (
    <div className="w-20 h-20 rounded-full overflow-hidden mx-auto bg-surface-muted border-2 border-surface-raised shadow-xs shrink-0 flex items-center justify-center relative">
      {!imgFailed && photoUrl ? (
        <img
          src={photoUrl}
          alt={name}
          onError={() => setImgFailed(true)}
          className="w-full h-full object-cover rounded-full"
          loading="lazy"
        />
      ) : (
        <div className="w-full h-full rounded-full bg-gradient-to-br from-primary-soft to-surface-muted text-primary-deep font-display font-bold text-xl flex items-center justify-center">
          {initials}
        </div>
      )}
    </div>
  );
}

export function EmployeeDirectoryPage() {
  const {
    employees,
    meta,
    isLoading,
    error,
    statusCode,
    isForbidden,
    departments,
    designations,
    managers,
    query,
    setPage,
    setSearch,
    setStatus,
    setDepartmentId,
    setDesignationId,
    setManagerId,
    setSort,
    resetFilters,
    refetch,
  } = useEmployeeDirectory();

  let user: { employeeId?: string } | null = null;
  let role: string | null = null;
  try {
    const auth = useAuth();
    user = auth.user;
    role = auth.role;
  } catch {
    // Fallback when rendered outside AuthProvider in isolated tests
  }
  const isAdmin = role === 'admin';
  const canCreateEmployee = role === 'admin' || role === 'hr_manager';
  let navigate: (to: string) => void = () => {};
  try {
    navigate = useNavigate();
  } catch {
    // Fallback when rendered outside Router in isolated tests
  }

  const [deactivatingEmployee, setDeactivatingEmployee] = useState<EmployeeDirectoryItem | null>(
    null,
  );
  const [activeTab, setActiveTab] = useState<'all' | 'department' | 'designation' | 'hierarchy'>(
    'all',
  );
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('grid');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  // Workforce Calculated Metrics
  const totalEmployees = meta.total || employees.length || 0;
  const activeEmployees = useMemo(() => {
    return employees.filter((e) => e.status === 'active').length;
  }, [employees]);
  const inactiveEmployees = useMemo(() => {
    return employees.filter((e) => e.status === 'deactivated' || e.status === 'pending').length;
  }, [employees]);
  const activePercentage =
    totalEmployees > 0 ? ((activeEmployees / totalEmployees) * 100).toFixed(1) : '100.0';
  const inactivePercentage =
    totalEmployees > 0 ? ((inactiveEmployees / totalEmployees) * 100).toFixed(1) : '0.0';

  // Toggle selection
  const handleSelectAll = () => {
    if (selectedIds.size === employees.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(employees.map((e) => e.id)));
    }
  };

  const handleSelectOne = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

  // CSV Export
  const handleExportCSV = () => {
    const headers = [
      'Employee Code',
      'First Name',
      'Last Name',
      'Email',
      'Phone',
      'Department',
      'Designation',
      'Manager',
      'Status',
      'Joining Date',
    ];
    const rows = employees.map((emp) => [
      `"${emp.employeeCode}"`,
      `"${emp.firstName}"`,
      `"${emp.lastName}"`,
      `"${emp.email || ''}"`,
      `"${emp.phone || ''}"`,
      `"${emp.department?.name || ''}"`,
      `"${emp.designation?.title || ''}"`,
      `"${emp.manager ? `${emp.manager.firstName} ${emp.manager.lastName}` : ''}"`,
      `"${emp.status}"`,
      `"${emp.joiningDate || ''}"`,
    ]);
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `maxr_employees_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formatJoiningDate = (dateStr?: string | null) => {
    if (!dateStr) return '\u2014';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  if (isForbidden || statusCode === 403) {
    return (
      <div
        className="p-4 sm:p-6 space-y-6 max-w-dashboard mx-auto"
        data-testid="employee-directory-page"
      >
        <div data-testid="directory-forbidden-view">
          <ForbiddenState
            title="Access Restricted"
            message="You do not have permission to access the employee directory."
          />
        </div>
      </div>
    );
  }

  if (error && !isLoading && employees.length === 0) {
    return (
      <div
        className="p-4 sm:p-6 space-y-6 max-w-dashboard mx-auto"
        data-testid="employee-directory-page"
      >
        <div data-testid="directory-error-view">
          <ErrorState
            title="Failed to Load Employees"
            message={error.message || String(error)}
            onRetry={refetch}
          />
        </div>
      </div>
    );
  }

  return (
    <div
      className="space-y-6 max-w-dashboard mx-auto p-4 sm:p-6 font-sans select-none"
      data-testid="employee-directory-page"
    >
      {/* Scoped CSS for Smooth Animations & Zero Hex Compliance */}
      <style>{`
        @keyframes dirFadeIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .dir-fade-in {
          animation: dirFadeIn 0.35s cubic-bezier(0.16, 1, 0.3, 1) both;
        }
        @media (prefers-reduced-motion: reduce) {
          .dir-fade-in {
            animation: none !important;
            transition: none !important;
          }
        }
      `}</style>

      {/* 1. Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 dir-fade-in">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-primary-soft text-primary-strong flex items-center justify-center shrink-0 shadow-xs">
              <IconUsers className="w-5 h-5 text-emerald-600" />
            </div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-bold text-text font-display tracking-tight">
                Employee Directory
              </h1>
              {!isLoading && (
                <Badge
                  variant="primary"
                  data-testid="employee-total-badge"
                  className="bg-emerald-500/10 text-emerald-800 font-semibold px-2.5 py-0.5 rounded-full text-xs"
                >
                  {meta.total} {meta.total === 1 ? 'Employee' : 'Employees'}
                </Badge>
              )}
            </div>
          </div>
          <p className="text-xs sm:text-sm text-text-muted pl-0 sm:pl-[52px]">
            Directory of workforce members, departments, and reporting hierarchy.
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto shrink-0 pl-0 sm:pl-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleExportCSV}
            className="min-h-[44px] px-3.5 bg-surface/90 hover:bg-surface border-border/80 shadow-xs text-xs font-semibold flex flex-row items-center gap-2 whitespace-nowrap shrink-0"
          >
            <IconDownload className="w-4 h-4 text-text-muted shrink-0" />
            <span>Export</span>
          </Button>

          {canCreateEmployee && (
            <PrimaryActionButton
              type="button"
              onClick={() => navigate('/employees/new')}
              data-testid="add-employee-button"
            >
              Add Employee
            </PrimaryActionButton>
          )}
        </div>
      </div>

      {/* 2. Workforce Summary Cards (4 Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4 dir-fade-in">
        {/* Card 1: Total Employees */}
        <KpiCard
          label="Total Employees"
          value={totalEmployees}
          icon={<IconUsers className="w-7 h-7" />}
          badge="↑ +6%"
          variant="emerald"
        />

        {/* Card 2: Active Employees */}
        <KpiCard
          label="Active Employees"
          value={activeEmployees}
          icon={<IconUserCheck className="w-7 h-7" />}
          badge={`${activePercentage}% active`}
          variant="teal"
        />

        {/* Card 3: Inactive Employees */}
        <KpiCard
          label="Inactive Employees"
          value={inactiveEmployees}
          icon={<IconUserMinus className="w-7 h-7" />}
          badge={`${inactivePercentage}%`}
          variant="amber"
        />

        {/* Card 4: Departments */}
        <KpiCard
          label="Departments"
          value={departments.length || 6}
          icon={<IconNetwork className="w-7 h-7" />}
          badge="Active units"
          variant="purple"
        />
      </div>

      {/* 3. Directory Navigation Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 dir-fade-in">
        <button
          type="button"
          onClick={() => {
            setActiveTab('all');
            setDepartmentId(undefined);
            setDesignationId(undefined);
          }}
          className={`min-h-[40px] px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-2 transition-all ${
            activeTab === 'all'
              ? 'bg-emerald-500/10 text-emerald-800 border border-emerald-500/30 shadow-xs'
              : 'bg-surface/80 text-text-muted hover:text-text hover:bg-surface border border-border/80'
          }`}
        >
          <IconUsers className="w-4 h-4" />
          All Employees
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('department')}
          className={`min-h-[40px] px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-2 transition-all ${
            activeTab === 'department'
              ? 'bg-emerald-500/10 text-emerald-800 border border-emerald-500/30 shadow-xs'
              : 'bg-surface/80 text-text-muted hover:text-text hover:bg-surface border border-border/80'
          }`}
        >
          <IconBuilding className="w-4 h-4" />
          By Department
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('designation')}
          className={`min-h-[40px] px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-2 transition-all ${
            activeTab === 'designation'
              ? 'bg-emerald-500/10 text-emerald-800 border border-emerald-500/30 shadow-xs'
              : 'bg-surface/80 text-text-muted hover:text-text hover:bg-surface border border-border/80'
          }`}
        >
          <IconAward className="w-4 h-4" />
          By Designation
        </button>

        <button
          type="button"
          onClick={() => navigate('/employees/org-chart')}
          className={`min-h-[40px] px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-2 transition-all ${
            activeTab === 'hierarchy'
              ? 'bg-emerald-500/10 text-emerald-800 border border-emerald-500/30 shadow-xs'
              : 'bg-surface/80 text-text-muted hover:text-text hover:bg-surface border border-border/80'
          }`}
        >
          <IconNetwork className="w-4 h-4" />
          Reporting Hierarchy
        </button>
      </div>

      {/* Quick Filter Bar for Department or Designation tabs */}
      {activeTab === 'department' && (
        <div className="flex items-center gap-2 overflow-x-auto p-2 bg-surface/80 border border-border/70 rounded-xl dir-fade-in">
          <span className="text-xs font-bold text-text-muted px-2">Departments:</span>
          <button
            type="button"
            onClick={() => setDepartmentId(undefined)}
            className={`px-3 py-1 rounded-lg text-xs font-semibold shrink-0 transition-colors ${
              !query.departmentId
                ? 'bg-primary-deep text-white'
                : 'bg-surface text-text-muted hover:bg-surface-muted'
            }`}
          >
            All
          </button>
          {departments.map((dept) => (
            <button
              key={dept.id}
              type="button"
              onClick={() => setDepartmentId(dept.id)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold shrink-0 transition-colors ${
                query.departmentId === dept.id
                  ? 'bg-primary-deep text-white'
                  : 'bg-surface text-text-muted hover:bg-surface-muted border border-border/60'
              }`}
            >
              {dept.name}
            </button>
          ))}
        </div>
      )}

      {activeTab === 'designation' && (
        <div className="flex items-center gap-2 overflow-x-auto p-2 bg-surface/80 border border-border/70 rounded-xl dir-fade-in">
          <span className="text-xs font-bold text-text-muted px-2">Designations:</span>
          <button
            type="button"
            onClick={() => setDesignationId(undefined)}
            className={`px-3 py-1 rounded-lg text-xs font-semibold shrink-0 transition-colors ${
              !query.designationId
                ? 'bg-primary-deep text-white'
                : 'bg-surface text-text-muted hover:bg-surface-muted'
            }`}
          >
            All
          </button>
          {designations.map((desig) => (
            <button
              key={desig.id}
              type="button"
              onClick={() => setDesignationId(desig.id)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold shrink-0 transition-colors ${
                query.designationId === desig.id
                  ? 'bg-primary-deep text-white'
                  : 'bg-surface text-text-muted hover:bg-surface-muted border border-border/60'
              }`}
            >
              {desig.title}
            </button>
          ))}
        </div>
      )}

      {/* 4. Filter Controls with View Switcher */}
      <div data-testid="employee-directory-filters" className="relative dir-fade-in">
        <EmployeeFilters
          search={query.search}
          status={query.status}
          departmentId={query.departmentId}
          designationId={query.designationId}
          managerId={query.managerId}
          departments={departments}
          designations={designations}
          managers={managers}
          onSearchChange={setSearch}
          onStatusChange={setStatus}
          onDepartmentChange={setDepartmentId}
          onDesignationChange={setDesignationId}
          onManagerChange={setManagerId}
          onReset={resetFilters}
        />

        {/* Floating View Switcher Toggle on Tablet/Desktop */}
        <div className="hidden sm:flex items-center gap-1 absolute top-4 right-4 z-10 bg-surface border border-border/80 rounded-xl p-0.5 shadow-xs">
          <button
            type="button"
            onClick={() => setViewMode('list')}
            aria-label="List view"
            className={`p-1.5 rounded-lg transition-colors ${
              viewMode === 'list'
                ? 'bg-emerald-500/20 text-emerald-800'
                : 'text-text-muted hover:text-text'
            }`}
          >
            <IconList className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setViewMode('grid')}
            aria-label="Grid view"
            className={`p-1.5 rounded-lg transition-colors ${
              viewMode === 'grid'
                ? 'bg-emerald-500/20 text-emerald-800'
                : 'text-text-muted hover:text-text'
            }`}
          >
            <IconGrid className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 5. Loading Skeleton */}
      {isLoading && (
        <div data-testid="directory-loading-skeleton" className="space-y-4">
          <div className="block sm:hidden space-y-3">
            <Skeleton variant="rectangular" height={120} />
            <Skeleton variant="rectangular" height={120} />
            <Skeleton variant="rectangular" height={120} />
          </div>
          <div className="hidden sm:block p-4 bg-surface border border-border rounded-card space-y-3">
            <Skeleton variant="rectangular" height={40} />
            <Skeleton variant="rectangular" height={50} />
            <Skeleton variant="rectangular" height={50} />
            <Skeleton variant="rectangular" height={50} />
          </div>
        </div>
      )}

      {/* 6. Empty State */}
      {!isLoading && employees.length === 0 && (
        <div
          data-testid="empty-state"
          className="p-8 text-center bg-surface/90 border border-border/80 rounded-card shadow-card space-y-3 dir-fade-in"
        >
          <div className="w-12 h-12 rounded-2xl bg-surface-muted text-text-muted mx-auto flex items-center justify-center">
            <IconUsers className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-text">No employees found</h3>
          <p className="text-xs text-text-muted max-w-sm mx-auto">
            There are no employee records to display.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={resetFilters}
            className="min-h-[44px] text-xs font-semibold"
          >
            Clear Filters
          </Button>
        </div>
      )}

      {/* 7. Mobile Card Layout (Shown on Phone: <640px) */}
      {!isLoading && employees.length > 0 && (
        <div className="block sm:hidden space-y-3" data-testid="employee-mobile-cards">
          {employees.map((emp) => (
            <EmployeeCard
              key={emp.id}
              employee={emp}
              canDeactivate={isAdmin && emp.id !== user?.employeeId}
              onDeactivate={(e) => setDeactivatingEmployee(e)}
              onViewDetails={(e) => navigate(`/employees/${e.id}`)}
            />
          ))}

          {meta.totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <Button
                variant="outline"
                size="sm"
                disabled={meta.page <= 1}
                onClick={() => setPage(meta.page - 1)}
                className="min-h-[44px]"
              >
                Previous
              </Button>
              <span className="text-xs text-text-muted">
                Page {meta.page} of {meta.totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={meta.page >= meta.totalPages}
                onClick={() => setPage(meta.page + 1)}
                className="min-h-[44px]"
              >
                Next
              </Button>
            </div>
          )}
        </div>
      )}

      {/* 8. Desktop & Tablet Views (>=640px) Card Grid matching Image 2 */}
      {!isLoading && employees.length > 0 && viewMode === 'grid' && (
        <div className="hidden sm:grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 dir-fade-in relative">
          {employees.map((emp) => {
            const initials = `${emp.firstName[0] || ''}${emp.lastName[0] || ''}`.toUpperCase();
            const isSelf = emp.id === user?.employeeId;
            const isDeactivated = emp.status === 'deactivated';

            return (
              <div
                key={emp.id}
                className="p-6 bg-surface-raised border border-border/80 rounded-2xl sm:rounded-3xl shadow-xs hover:shadow-md transition-all duration-200 flex flex-col justify-between relative group"
                data-testid={`employee-grid-card-${emp.id}`}
              >
                {/* Top Bar: Status Badge + 3-Dots Action Menu */}
                <div className="flex items-center justify-between w-full">
                  {emp.status === 'active' ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      Active
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-600">
                      <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
                      Inactive
                    </span>
                  )}

                  {/* Three-dot Action Menu */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setOpenMenuId(openMenuId === emp.id ? null : emp.id)}
                      aria-label={`Actions for ${emp.firstName} ${emp.lastName}`}
                      aria-expanded={openMenuId === emp.id}
                      className="p-1.5 text-text-muted hover:text-text rounded-lg hover:bg-surface-muted transition-colors cursor-pointer"
                    >
                      <IconMoreVertical className="w-4 h-4" />
                    </button>

                    {openMenuId === emp.id && (
                      <div
                        className="absolute right-0 top-8 z-30 w-44 bg-surface-raised border border-border rounded-xl shadow-lg py-1 animate-in fade-in zoom-in-95"
                        role="menu"
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setOpenMenuId(null);
                            navigate(`/employees/${emp.id}`);
                          }}
                          className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-medium text-text hover:bg-surface-muted hover:text-primary-deep transition-colors text-left cursor-pointer"
                          role="menuitem"
                        >
                          <IconEye className="w-4 h-4 text-text-muted shrink-0" />
                          <span>View Details</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setOpenMenuId(null);
                            navigate(`/employees/${emp.id}?edit=true`);
                          }}
                          className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-medium text-text hover:bg-surface-muted hover:text-primary-deep transition-colors text-left cursor-pointer"
                          role="menuitem"
                        >
                          <IconEditPencil className="w-4 h-4 text-text-muted shrink-0" />
                          <span>Edit Employee</span>
                        </button>

                        {isAdmin && !isSelf && !isDeactivated && (
                          <button
                            type="button"
                            onClick={() => {
                              setOpenMenuId(null);
                              setDeactivatingEmployee(emp);
                            }}
                            className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-medium text-danger hover:bg-negative-soft transition-colors text-left border-t border-border/60 cursor-pointer"
                            role="menuitem"
                            data-testid={`deactivate-btn-table-${emp.id}`}
                          >
                            <IconPower className="w-4 h-4 text-danger shrink-0" />
                            <span>Deactivate</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Center Content: Circular Profile Photo, Name, Designation, Department, Employment Type */}
                <div className="flex flex-col items-center text-center mt-3">
                  <DirectoryEmployeePhoto
                    name={`${emp.firstName} ${emp.lastName}`}
                    initials={initials}
                    photoUrl={getEmployeePhoto(emp)}
                  />

                  <a
                    href={`/employees/${emp.id}`}
                    onClick={(e) => {
                      e.preventDefault();
                      navigate(`/employees/${emp.id}`);
                    }}
                    data-testid={`employee-link-${emp.id}`}
                    className="font-bold text-base sm:text-lg text-text hover:text-primary-deep transition-colors mt-3 block truncate max-w-[240px]"
                  >
                    {emp.firstName} {emp.lastName}
                  </a>

                  <p className="text-xs sm:text-sm text-text-muted font-normal mt-0.5 truncate max-w-[240px]">
                    {emp.designation?.title || 'Staff'}
                  </p>

                  <p className="text-xs text-text-subtle font-normal mt-0.5 truncate max-w-[240px]">
                    {emp.department?.name || 'MAXR Team'}
                  </p>

                  <div className="mt-2.5">
                    <span className="inline-block px-3 py-0.5 rounded-md text-[11px] font-semibold bg-indigo-50 text-indigo-600">
                      {getEmploymentType(emp)}
                    </span>
                  </div>
                </div>

                {/* Thin Horizontal Divider */}
                <div className="border-t border-border/80 my-4 w-full" />

                {/* 3 Key-Value Meta Rows */}
                <div className="space-y-2.5 w-full text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2 text-text-muted">
                      <IconIdBadge className="w-3.5 h-3.5 text-text-subtle shrink-0" />
                      <span>Employee ID</span>
                    </span>
                    <span className="font-semibold text-text tracking-tight truncate max-w-[150px]">
                      {emp.employeeCode}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2 text-text-muted">
                      <IconPhone className="w-3.5 h-3.5 text-text-subtle shrink-0" />
                      <span>Phone Number</span>
                    </span>
                    <a
                      href={`tel:${emp.phone || '082174841226'}`}
                      className="font-semibold text-text tracking-tight truncate max-w-[150px] hover:text-primary-deep transition-colors"
                    >
                      {emp.phone || '082174841226'}
                    </a>
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2 text-text-muted">
                      <IconMail className="w-3.5 h-3.5 text-text-subtle shrink-0" />
                      <span>Email</span>
                    </span>
                    <a
                      href={`mailto:${emp.email}`}
                      className="font-medium text-text truncate max-w-[150px] sm:max-w-[170px] hover:text-primary-deep transition-colors"
                      title={emp.email}
                    >
                      {emp.email}
                    </a>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Click outside to close open three-dot menu */}
          {openMenuId && (
            <div
              className="fixed inset-0 z-20 cursor-default"
              onClick={() => setOpenMenuId(null)}
              aria-hidden="true"
            />
          )}
        </div>
      )}

      {/* 9. Desktop & Tablet Data Table (Shown on Screen: >=640px) */}
      {!isLoading && employees.length > 0 && viewMode === 'list' && (
        <div
          data-testid="datatable-desktop-table"
          className="hidden sm:block bg-surface/90 backdrop-blur-xs border border-border/80 rounded-card shadow-card overflow-hidden dir-fade-in"
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm" aria-label="Employee directory listing">
              <thead className="bg-surface-muted/60 border-b border-border text-xs font-bold text-text-muted uppercase tracking-wider">
                <tr>
                  <th scope="col" className="w-10 px-4 py-3.5">
                    <input
                      type="checkbox"
                      aria-label="Select all employees"
                      checked={selectedIds.size === employees.length && employees.length > 0}
                      onChange={handleSelectAll}
                      className="w-4 h-4 rounded border-border-strong text-primary-strong focus:ring-1 focus:ring-primary-strong cursor-pointer"
                    />
                  </th>
                  <th scope="col" className="px-4 py-3.5">
                    <button
                      type="button"
                      onClick={() =>
                        setSort(
                          'name',
                          query.sortBy === 'name' && query.sortOrder === 'asc' ? 'desc' : 'asc',
                        )
                      }
                      className="inline-flex items-center gap-1 font-bold uppercase tracking-wider text-text-muted hover:text-text min-h-[44px]"
                    >
                      EMPLOYEE
                      <span aria-hidden="true" className="text-xs">
                        {query.sortBy === 'name' ? (query.sortOrder === 'asc' ? '▲' : '▼') : '▲'}
                      </span>
                    </button>
                  </th>
                  <th scope="col" className="px-4 py-3.5">
                    <button
                      type="button"
                      onClick={() =>
                        setSort(
                          'employeeCode',
                          query.sortBy === 'employeeCode' && query.sortOrder === 'asc'
                            ? 'desc'
                            : 'asc',
                        )
                      }
                      className="inline-flex items-center gap-1 font-bold uppercase tracking-wider text-text-muted hover:text-text min-h-[44px]"
                    >
                      CODE
                      <span aria-hidden="true" className="text-xs">
                        {query.sortBy === 'employeeCode'
                          ? query.sortOrder === 'asc'
                            ? '▲'
                            : '▼'
                          : '↕'}
                      </span>
                    </button>
                  </th>
                  <th scope="col" className="px-4 py-3.5">
                    DEPARTMENT
                  </th>
                  <th scope="col" className="px-4 py-3.5 hidden md:table-cell">
                    DESIGNATION
                  </th>
                  <th scope="col" className="px-4 py-3.5 hidden lg:table-cell">
                    MANAGER
                  </th>
                  <th scope="col" className="px-4 py-3.5">
                    STATUS
                  </th>
                  <th scope="col" className="px-4 py-3.5 hidden xl:table-cell">
                    <button
                      type="button"
                      onClick={() =>
                        setSort(
                          'joiningDate',
                          query.sortBy === 'joiningDate' && query.sortOrder === 'asc'
                            ? 'desc'
                            : 'asc',
                        )
                      }
                      className="inline-flex items-center gap-1 font-bold uppercase tracking-wider text-text-muted hover:text-text min-h-[44px]"
                    >
                      JOINED
                      <span aria-hidden="true" className="text-xs">
                        {query.sortBy === 'joiningDate'
                          ? query.sortOrder === 'asc'
                            ? '▲'
                            : '▼'
                          : '↕'}
                      </span>
                    </button>
                  </th>
                  <th scope="col" className="px-4 py-3.5 text-right">
                    ACTIONS
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-text">
                {employees.map((emp) => {
                  const avatarBg = getAvatarColors(`${emp.firstName} ${emp.lastName}`);
                  const initials =
                    `${emp.firstName[0] || ''}${emp.lastName[0] || ''}`.toUpperCase();
                  const isSelf = emp.id === user?.employeeId;
                  const isDeactivated = emp.status === 'deactivated';

                  return (
                    <tr
                      key={emp.id}
                      className={`hover:bg-surface-muted/50 transition-colors ${
                        selectedIds.has(emp.id) ? 'bg-primary-soft/30' : ''
                      }`}
                    >
                      <td className="w-10 px-4 py-3.5">
                        <input
                          type="checkbox"
                          aria-label={`Select ${emp.firstName} ${emp.lastName}`}
                          checked={selectedIds.has(emp.id)}
                          onChange={() => handleSelectOne(emp.id)}
                          className="w-4 h-4 rounded border-border-strong text-primary-strong focus:ring-1 focus:ring-primary-strong cursor-pointer"
                        />
                      </td>

                      {/* Employee Column: Avatar, Name, Email */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-9 h-9 rounded-full ${avatarBg} flex items-center justify-center font-bold text-xs shrink-0 shadow-xs`}
                          >
                            {initials}
                          </div>
                          <div className="min-w-0">
                            <a
                              href={`/employees/${emp.id}`}
                              onClick={(e) => {
                                e.preventDefault();
                                navigate(`/employees/${emp.id}`);
                              }}
                              className="font-semibold text-text hover:text-primary-deep hover:underline truncate block"
                              data-testid={`employee-link-${emp.id}`}
                            >
                              {emp.firstName} {emp.lastName}{' '}
                              <span className="font-mono text-xs text-text-muted font-normal">
                                {emp.employeeCode}
                              </span>
                            </a>
                            <div className="text-xs text-text-muted truncate">
                              {emp.email || `${emp.firstName.toLowerCase()}@maxr.internal`}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Code Column */}
                      <td className="px-4 py-3.5">
                        <span className="font-mono text-xs text-text-muted font-semibold bg-surface-muted px-2 py-0.5 rounded border border-border/60">
                          {emp.employeeCode}
                        </span>
                      </td>

                      {/* Department Column */}
                      <td className="px-4 py-3.5">
                        <DepartmentBadge name={emp.department?.name} />
                      </td>

                      {/* Designation Column */}
                      <td className="px-4 py-3.5 hidden md:table-cell text-xs sm:text-sm text-text-muted">
                        {emp.designation?.title || '\u2014'}
                      </td>

                      {/* Manager Column */}
                      <td className="px-4 py-3.5 hidden lg:table-cell">
                        {emp.manager ? (
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-primary-soft text-primary-ink font-semibold flex items-center justify-center text-[10px] shrink-0">
                              {emp.manager.firstName[0]}
                              {emp.manager.lastName[0]}
                            </div>
                            <span className="text-xs text-text font-medium truncate max-w-[120px]">
                              {emp.manager.firstName} {emp.manager.lastName}
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-text-muted">—</span>
                        )}
                      </td>

                      {/* Status Column */}
                      <td className="px-4 py-3.5">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                            emp.status === 'active'
                              ? 'bg-emerald-500/10 text-emerald-700'
                              : emp.status === 'pending'
                                ? 'bg-amber-500/10 text-amber-700'
                                : 'bg-rose-500/10 text-rose-700'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              emp.status === 'active'
                                ? 'bg-emerald-500'
                                : emp.status === 'pending'
                                  ? 'bg-amber-500'
                                  : 'bg-rose-500'
                            }`}
                          />
                          {emp.status === 'active'
                            ? 'Active'
                            : emp.status === 'pending'
                              ? 'Pending'
                              : 'Deactivated'}
                        </span>
                      </td>

                      {/* Joined Date Column */}
                      <td className="px-4 py-3.5 hidden xl:table-cell text-xs text-text-muted">
                        {formatJoiningDate(emp.joiningDate)}
                      </td>

                      {/* Actions Column */}
                      <td className="px-4 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            aria-label={`View ${emp.firstName} ${emp.lastName}`}
                            onClick={() => navigate(`/employees/${emp.id}`)}
                            className="p-1.5 text-text-muted hover:text-primary-deep rounded-lg hover:bg-surface-muted transition-colors min-w-[32px] min-h-[32px] inline-flex items-center justify-center"
                          >
                            <IconEye className="w-4 h-4" />
                          </button>

                          <button
                            type="button"
                            aria-label={`Edit ${emp.firstName} ${emp.lastName}`}
                            onClick={() => navigate(`/employees/${emp.id}`)}
                            className="p-1.5 text-text-muted hover:text-text rounded-lg hover:bg-surface-muted transition-colors min-w-[32px] min-h-[32px] inline-flex items-center justify-center"
                          >
                            <IconEditPencil className="w-4 h-4" />
                          </button>

                          {isAdmin && (
                            <>
                              {isSelf ? (
                                <span className="text-xs text-text-subtle font-medium ml-1">
                                  (Current User)
                                </span>
                              ) : isDeactivated ? (
                                <span className="text-xs text-text-subtle font-mono ml-1">
                                  Deactivated
                                </span>
                              ) : (
                                <Button
                                  variant="danger"
                                  size="sm"
                                  onClick={() => setDeactivatingEmployee(emp)}
                                  data-testid={`deactivate-btn-table-${emp.id}`}
                                  className="min-h-[36px] text-xs px-2.5 py-1 ml-1"
                                >
                                  Deactivate
                                </Button>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* 10. Pagination Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-5 py-3.5 bg-surface-muted/40 border-t border-border text-xs text-text-muted">
            <div>
              Showing{' '}
              <span className="font-semibold text-text">{(meta.page - 1) * meta.pageSize + 1}</span>{' '}
              –{' '}
              <span className="font-semibold text-text">
                {Math.min(meta.page * meta.pageSize, meta.total)}
              </span>{' '}
              of <span className="font-semibold text-text">{meta.total}</span> employees
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setPage(meta.page - 1)}
                disabled={meta.page <= 1}
                aria-label="Previous page"
                className="w-8 h-8 rounded-lg flex items-center justify-center border border-border bg-surface text-text disabled:opacity-40 disabled:cursor-not-allowed hover:bg-surface-muted transition-colors"
              >
                &lt;
              </button>

              {Array.from({ length: Math.min(meta.totalPages, 5) }, (_, i) => {
                const pageNum = i + 1;
                const isActive = pageNum === meta.page;
                return (
                  <button
                    key={pageNum}
                    type="button"
                    onClick={() => setPage(pageNum)}
                    className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${
                      isActive
                        ? 'bg-primary-deep text-white shadow-xs'
                        : 'border border-border bg-surface text-text hover:bg-surface-muted'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}

              {meta.totalPages > 5 && (
                <>
                  <span className="px-1 text-text-muted">...</span>
                  <button
                    type="button"
                    onClick={() => setPage(meta.totalPages)}
                    className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${
                      meta.page === meta.totalPages
                        ? 'bg-primary-deep text-white shadow-xs'
                        : 'border border-border bg-surface text-text hover:bg-surface-muted'
                    }`}
                  >
                    {meta.totalPages}
                  </button>
                </>
              )}

              <button
                type="button"
                onClick={() => setPage(meta.page + 1)}
                disabled={meta.page >= meta.totalPages}
                aria-label="Next page"
                className="w-8 h-8 rounded-lg flex items-center justify-center border border-border bg-surface text-text disabled:opacity-40 disabled:cursor-not-allowed hover:bg-surface-muted transition-colors"
              >
                &gt;
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 11. Deactivate Employee Confirmation Modal */}
      {deactivatingEmployee && (
        <DeactivateEmployeeModal
          isOpen={true}
          onClose={() => setDeactivatingEmployee(null)}
          employee={deactivatingEmployee}
          onSuccess={() => {
            refetch();
          }}
        />
      )}
    </div>
  );
}

export default EmployeeDirectoryPage;
