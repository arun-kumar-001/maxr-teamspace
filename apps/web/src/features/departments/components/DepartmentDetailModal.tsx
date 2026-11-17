import { Button } from '../../../components/ui/Button';
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
            <dl className="mt-4 flex flex-wrap gap-x-5 gap-y-2">
              {[
                { label: 'Active staff', value: activeCount },
                { label: 'Onboarding', value: onboardingCount },
                { label: 'Designations', value: designations.length },
              ].map((stat) => (
                <div key={stat.label} className="min-w-0">
                  <dd className="text-sm font-semibold tabular-nums text-text">{stat.value}</dd>
                  <dt className="text-xs text-text-muted break-words">{stat.label}</dt>
                </div>
              ))}
            </dl>
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
