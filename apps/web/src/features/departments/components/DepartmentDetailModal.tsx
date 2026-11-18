import { Button } from '../../../components/ui/Button';
import { KpiCard } from '../../../components/ui/KpiCard';
import { Modal } from '../../../components/ui/Modal';
import { Badge } from '../../../components/ui/StatusPill';
import { getAvatarTone, getInitials } from '../../employees/components/hiringUtils';
import type { EmployeeDirectoryItem } from '../../employees/types';
import type { Designation } from '../../designations/types';
import type { Department } from '../types';

export interface DepartmentDetailModalProps {
  isOpen: boolean;
  department: Department | null;
  onClose: () => void;
  members?: EmployeeDirectoryItem[];
  designations?: Designation[];
  onNavigateEmployee?: (employeeId: string) => void;
  onAddDesignation?: () => void;
}

export function DepartmentDetailModal({
  isOpen,
  department,
  onClose,
  members = [],
  designations = [],
  onNavigateEmployee,
  onAddDesignation,
}: DepartmentDetailModalProps) {
  if (!department) return null;

  const activeCount = members.filter((member) => member.status === 'active').length;
  const onboardingCount = members.filter((member) => member.status === 'pending').length;
  const formatDate = (value?: string) =>
    value
      ? new Date(value).toLocaleDateString(undefined, {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        })
      : '—';

  return (
    <div
      data-testid="department-detail-panel"
      className="[&_[tabindex]]:rounded-none [&_[tabindex]]:h-dvh [&_[tabindex]]:mt-0 [&_[tabindex]>div:first-child]:hidden [&_[role=dialog]]:backdrop-blur-none"
    >
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title="Department Details"
        position="drawer"
        maxWidth="md"
      >
        <div className="space-y-5 text-sm" data-testid="department-detail-content">
          <section className="border-b border-border pb-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="mt-1 text-lg font-semibold text-text break-words">
                  {department.name}
                </h3>
              </div>
              <Badge variant={department.isActive ? 'success' : 'neutral'}>
                {department.isActive ? 'Active' : 'Inactive'}
              </Badge>
            </div>
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <KpiCard
                label="Active staff"
                value={activeCount}
                icon={
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                    />
                  </svg>
                }
                variant="emerald"
                className="p-3"
              />
              <KpiCard
                label="Onboarding"
                value={onboardingCount}
                icon={
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"
                    />
                  </svg>
                }
                variant="amber"
                className="p-3"
              />
              <KpiCard
                label="Designations"
                value={designations.length}
                icon={
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"
                    />
                  </svg>
                }
                variant="teal"
                className="p-3"
              />
            </div>
          </section>

          <section
            className="border-b border-border pb-4"
            aria-labelledby="department-designations-title"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <h3 id="department-designations-title" className="text-sm font-semibold text-text">
                Designations{' '}
                <span className="text-text-muted text-sm">({designations.length})</span>
              </h3>
              {onAddDesignation && (
                <Button
                  variant="outline"
                  size="sm"
                  className="shadow-none"
                  onClick={onAddDesignation}
                >
                  Add Designation
                </Button>
              )}
            </div>
            {designations.length === 0 ? (
              <div className="py-3">
                <p className="text-sm text-text-muted">No designations yet</p>
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {designations
                  .slice()
                  .sort((a, b) => a.title.localeCompare(b.title))
                  .map((designation) => (
                    <li
                      key={designation.id}
                      className="flex items-center justify-between gap-3 py-3"
                    >
                      <div className="min-w-0">
                        <p className="font-semibold text-sm text-text break-words">
                          {designation.title}
                        </p>
                      </div>
                      <Badge variant={designation.isActive ? 'success' : 'neutral'}>
                        {designation.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </li>
                  ))}
              </ul>
            )}
          </section>

          <section
            className="border-b border-border pb-4"
            aria-labelledby="department-members-title"
          >
            <h3 id="department-members-title" className="mb-2 text-sm font-semibold text-text">
              Team members <span className="text-text-muted text-sm">({members.length})</span>
            </h3>
            {members.length === 0 ? (
              <div className="py-3">
                <p className="text-sm text-text-muted">No team members yet</p>
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {members.map((employee) => {
                  const name = `${employee.firstName} ${employee.lastName}`.trim();
                  return (
                    <li key={employee.id}>
                      <a
                        href={`/employees/${employee.id}`}
                        onClick={(event) => {
                          if (onNavigateEmployee) {
                            event.preventDefault();
                            onNavigateEmployee(employee.id);
                          }
                        }}
                        className="flex min-h-[44px] items-center justify-between gap-3 py-3 hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-strong"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span
                            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${getAvatarTone(name)}`}
                            aria-hidden="true"
                          >
                            {getInitials(employee.firstName, employee.lastName)}
                          </span>
                          <div className="min-w-0">
                            <p className="font-semibold text-sm text-text break-words">{name}</p>
                            <p className="text-xs text-text-muted break-words">
                              {employee.designation?.title ?? employee.employeeCode}
                            </p>
                          </div>
                        </div>
                        <Badge variant={employee.status === 'active' ? 'success' : 'neutral'}>
                          {employee.status === 'pending' ? 'Onboarding' : employee.status}
                        </Badge>
                      </a>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <dl className="grid grid-cols-2 gap-4 text-xs">
            <div>
              <dt className="text-text-subtle">Created</dt>
              <dd className="mt-1 text-text-muted">{formatDate(department.createdAt)}</dd>
            </div>
            <div>
              <dt className="text-text-subtle">Last updated</dt>
              <dd className="mt-1 text-text-muted">{formatDate(department.updatedAt)}</dd>
            </div>
          </dl>
        </div>
      </Modal>
    </div>
  );
}
