import { useEffect, useState } from 'react';
import { Button } from '../../../components/ui/Button';
import { FormField } from '../../../components/ui/FormField';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { fetchDepartments } from '../../departments/api/departmentsApi';
import type { Department } from '../../departments/types';
import { fetchLeavePolicies } from '../../leave/api/leave';
import type { LeavePolicy } from '../../leave/types';
import { fetchProjects } from '../../projects/api/projectsApi';
import type { Project } from '../../projects/types';
import type { ReportFilters, ReportSummary } from '../types';

export interface ReportFilterBarProps {
  catalog: ReportSummary[];
  selectedReportName: string;
  onSelectReport: (name: string) => void;
  filters: ReportFilters;
  onFilterChange: (filters: ReportFilters) => void;
  onReset: () => void;
}

export function ReportFilterBar({
  catalog,
  selectedReportName,
  onSelectReport,
  filters,
  onFilterChange,
  onReset,
}: ReportFilterBarProps) {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [leavePolicies, setLeavePolicies] = useState<LeavePolicy[]>([]);
  const [isMobileFiltersOpen, setIsMobileFiltersOpen] = useState(false);

  useEffect(() => {
    void fetchDepartments({ pageSize: 100 })
      .then((res) => setDepartments(res.data))
      .catch(() => setDepartments([]));

    void fetchProjects({ pageSize: 100 })
      .then((res) => setProjects(res.data))
      .catch(() => setProjects([]));

    void fetchLeavePolicies()
      .then((res) => setLeavePolicies(res))
      .catch(() => setLeavePolicies([]));
  }, []);

  const updateField = (key: keyof ReportFilters, value: unknown) => {
    onFilterChange({
      ...filters,
      [key]: value === '' ? undefined : value,
    });
  };

  const isAttendance = selectedReportName === 'attendance-summary';
  const isLeave = selectedReportName === 'leave-usage';
  const isTask = selectedReportName === 'task-status';
  const isProject = selectedReportName === 'project-status';
  const isHeadcount = selectedReportName === 'employee-headcount';

  return (
    <div
      className="p-4 sm:p-5 bg-surface border border-border rounded-card shadow-card space-y-4"
      data-testid="report-filter-bar"
    >
      {/* Report Switcher & Mobile Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex-1 max-w-md">
          <label className="block text-xs font-semibold text-text uppercase tracking-wider mb-1.5">
            Select Report
          </label>
          <Select
            value={selectedReportName}
            onChange={(e) => onSelectReport(e.target.value)}
            options={catalog.map((r) => ({
              value: r.name,
              label: `${r.title} (${r.module})`,
            }))}
            data-testid="report-selector"
          />
        </div>

        <button
          type="button"
          onClick={() => setIsMobileFiltersOpen((prev) => !prev)}
          className="sm:hidden flex items-center justify-between px-3 py-2 text-xs font-semibold text-primary-deep bg-primary-soft rounded-tile border border-border min-h-[44px]"
          aria-expanded={isMobileFiltersOpen}
        >
          <span>{isMobileFiltersOpen ? 'Hide Filters' : 'Show Report Filters'}</span>
          <span>{isMobileFiltersOpen ? '▲' : '▼'}</span>
        </button>
      </div>

      {/* Dynamic Filter Controls (Collapsible on mobile) */}
      <div
        className={`grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 pt-3 border-t border-border ${
          isMobileFiltersOpen ? 'block' : 'hidden sm:grid'
        }`}
      >
        {/* Attendance Filters */}
        {isAttendance && (
          <>
            <FormField label="Date From">
              <Input
                type="date"
                value={filters.from ?? ''}
                onChange={(e) => updateField('from', e.target.value)}
                data-testid="filter-date-from"
              />
            </FormField>

            <FormField label="Date To">
              <Input
                type="date"
                value={filters.to ?? ''}
                onChange={(e) => updateField('to', e.target.value)}
                data-testid="filter-date-to"
              />
            </FormField>

            <FormField label="Department">
              <Select
                value={filters.departmentId ?? ''}
                onChange={(e) => updateField('departmentId', e.target.value)}
                options={[
                  { value: '', label: 'All Departments' },
                  ...departments.map((d) => ({ value: d.id, label: d.name })),
                ]}
                data-testid="filter-department"
              />
            </FormField>
          </>
        )}

        {/* Leave Usage Filters */}
        {isLeave && (
          <>
            <FormField label="Year">
              <Input
                type="number"
                min={2000}
                max={2100}
                value={filters.year ?? new Date().getFullYear()}
                onChange={(e) => updateField('year', Number(e.target.value))}
                data-testid="filter-year"
              />
            </FormField>

            <FormField label="Leave Type">
              <Select
                value={filters.leaveTypeId ?? ''}
                onChange={(e) => updateField('leaveTypeId', e.target.value)}
                options={[
                  { value: '', label: 'All Leave Types' },
                  ...leavePolicies.map((p) => ({ value: p.id, label: p.name })),
                ]}
                data-testid="filter-leave-type"
              />
            </FormField>

            <FormField label="Department">
              <Select
                value={filters.departmentId ?? ''}
                onChange={(e) => updateField('departmentId', e.target.value)}
                options={[
                  { value: '', label: 'All Departments' },
                  ...departments.map((d) => ({ value: d.id, label: d.name })),
                ]}
                data-testid="filter-department"
              />
            </FormField>
          </>
        )}

        {/* Task Status Filters */}
        {isTask && (
          <>
            <FormField label="Project">
              <Select
                value={filters.projectId ?? ''}
                onChange={(e) => updateField('projectId', e.target.value)}
                options={[
                  { value: '', label: 'All Projects' },
                  ...projects.map((p) => ({ value: p.id, label: p.name })),
                ]}
                data-testid="filter-project"
              />
            </FormField>

            <FormField label="Due From">
              <Input
                type="date"
                value={filters.dueFrom ?? ''}
                onChange={(e) => updateField('dueFrom', e.target.value)}
                data-testid="filter-due-from"
              />
            </FormField>

            <FormField label="Due To">
              <Input
                type="date"
                value={filters.dueTo ?? ''}
                onChange={(e) => updateField('dueTo', e.target.value)}
                data-testid="filter-due-to"
              />
            </FormField>
          </>
        )}

        {/* Project Status Filters */}
        {isProject && (
          <FormField label="Project Status">
            <Select
              value={filters.status ?? ''}
              onChange={(e) => updateField('status', e.target.value)}
              options={[
                { value: '', label: 'All Statuses' },
                { value: 'active', label: 'Active Projects' },
                { value: 'archived', label: 'Archived Projects' },
              ]}
              data-testid="filter-project-status"
            />
          </FormField>
        )}

        {/* Employee Headcount Filters */}
        {isHeadcount && (
          <>
            <FormField label="Group By">
              <Select
                value={filters.groupBy ?? 'department'}
                onChange={(e) => updateField('groupBy', e.target.value)}
                options={[
                  { value: 'department', label: 'Department' },
                  { value: 'designation', label: 'Designation' },
                ]}
                data-testid="filter-group-by"
              />
            </FormField>

            <FormField label="Department">
              <Select
                value={filters.departmentId ?? ''}
                onChange={(e) => updateField('departmentId', e.target.value)}
                options={[
                  { value: '', label: 'All Departments' },
                  ...departments.map((d) => ({ value: d.id, label: d.name })),
                ]}
                data-testid="filter-department"
              />
            </FormField>
          </>
        )}

        {/* Reset Actions */}
        <div className="flex items-end">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onReset}
            className="min-h-[44px] text-xs text-text-muted hover:text-text w-full sm:w-auto"
            data-testid="reset-filters-btn"
          >
            Reset Filters
          </Button>
        </div>
      </div>
    </div>
  );
}
