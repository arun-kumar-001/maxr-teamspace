import { useEffect, useState } from 'react';
import { Button, FormField, Input, Modal, Select } from '../../../components/ui';
import type { DepartmentItem, DesignationItem, EmployeeDirectoryItem } from '../types';
import type { ContractType, CreateRoleOpeningInput, WorkMode } from '../types/hiring';

export interface OpenRoleModalProps {
  isOpen: boolean;
  onClose: () => void;
  departments: DepartmentItem[];
  designations: DesignationItem[];
  employees: EmployeeDirectoryItem[];
  onSubmit: (input: CreateRoleOpeningInput) => void;
}

const FALLBACK_DEPARTMENTS: DepartmentItem[] = [
  { id: '30000000-0000-0000-0000-000000000001', name: 'Engineering', code: 'ENG' },
  { id: '30000000-0000-0000-0000-000000000002', name: 'Human Resources', code: 'HR' },
  { id: '30000000-0000-0000-0000-000000000003', name: 'Operations', code: 'OPS' },
];

export function OpenRoleModal({
  isOpen,
  onClose,
  departments,
  designations,
  employees,
  onSubmit,
}: OpenRoleModalProps) {
  const deptList = departments.length > 0 ? departments : FALLBACK_DEPARTMENTS;

  const [title, setTitle] = useState('');
  const [departmentId, setDepartmentId] = useState(deptList[0]?.id ?? '');
  const [designationId, setDesignationId] = useState('');
  const [contractType, setContractType] = useState<ContractType>('Full-time');
  const [workMode, setWorkMode] = useState<WorkMode>('Hybrid');
  const [compensation, setCompensation] = useState('₹14L – ₹20L');
  const [hiresNeeded, setHiresNeeded] = useState('1');
  const [hiringManagerId, setHiringManagerId] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setTitle('');
    setDepartmentId(deptList[0]?.id ?? '');
    setDesignationId('');
    setContractType('Full-time');
    setWorkMode('Hybrid');
    setCompensation('₹14L – ₹20L');
    setHiresNeeded('1');
    setHiringManagerId(employees[0]?.id ?? '');
    setError(null);
  }, [isOpen, deptList, employees]);

  const handleDesignationSelect = (id: string) => {
    setDesignationId(id);
    const desig = designations.find((d) => d.id === id);
    if (desig && !title.trim()) {
      setTitle(desig.title);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Role title is required.');
      return;
    }

    const dept = deptList.find((d) => d.id === departmentId) ?? deptList[0];
    const mgr = employees.find((emp) => emp.id === hiringManagerId);

    onSubmit({
      title: title.trim(),
      departmentId: dept?.id ?? departmentId,
      departmentName: dept?.name ?? 'Engineering',
      designationId: designationId || undefined,
      contractType,
      workMode,
      compensation: compensation.trim() || 'Competitive',
      hiresNeeded: Math.max(1, Number(hiresNeeded) || 1),
      hiringManagerId: mgr?.id,
      hiringManagerName: mgr ? `${mgr.firstName} ${mgr.lastName}` : 'Priya Sharma',
    });
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Open a role"
      subtitle="Publish a new requisition to track candidates and onboarding readiness."
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4" data-testid="open-role-form">
        {error && (
          <div className="p-2.5 rounded-tile bg-rose-50 border border-rose-200 text-xs text-danger font-medium">
            {error}
          </div>
        )}

        {designations.length > 0 && (
          <FormField label="CRM Designation (optional shortcut)">
            <Select
              value={designationId}
              onChange={(e) => handleDesignationSelect(e.target.value)}
              options={[
                { value: '', label: 'Custom or select a CRM designation...' },
                ...designations.map((d) => ({ value: d.id, label: d.title })),
              ]}
            />
          </FormField>
        )}

        <FormField label="Role title" required>
          <Input
            placeholder="e.g. Senior Frontend Engineer"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
        </FormField>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FormField label="Department">
            <Select
              value={departmentId}
              onChange={(e) => setDepartmentId(e.target.value)}
              options={deptList.map((d) => ({ value: d.id, label: d.name }))}
            />
          </FormField>
          <FormField label="Work mode">
            <Select
              value={workMode}
              onChange={(e) => setWorkMode(e.target.value as WorkMode)}
              options={[
                { value: 'Hybrid', label: 'Hybrid' },
                { value: 'Remote', label: 'Remote' },
                { value: 'On-site', label: 'On-site' },
              ]}
            />
          </FormField>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <FormField label="Contract">
            <Select
              value={contractType}
              onChange={(e) => setContractType(e.target.value as ContractType)}
              options={[
                { value: 'Full-time', label: 'Full-time' },
                { value: 'Part-time', label: 'Part-time' },
                { value: 'Contract', label: 'Contract' },
              ]}
            />
          </FormField>
          <FormField label="Compensation">
            <Input
              placeholder="₹14L – ₹20L"
              value={compensation}
              onChange={(e) => setCompensation(e.target.value)}
            />
          </FormField>
          <FormField label="Hires needed">
            <Input
              type="number"
              min={1}
              max={20}
              value={hiresNeeded}
              onChange={(e) => setHiresNeeded(e.target.value)}
            />
          </FormField>
        </div>

        <FormField label="Hiring manager">
          <Select
            value={hiringManagerId}
            onChange={(e) => setHiringManagerId(e.target.value)}
            options={
              employees.length > 0
                ? employees.map((emp) => ({
                    value: emp.id,
                    label: `${emp.firstName} ${emp.lastName} (${emp.designation?.title ?? emp.department?.name ?? 'Team'})`,
                  }))
                : [
                    { value: 'mgr-priya', label: 'Priya Sharma (HR Manager)' },
                    { value: 'mgr-rajesh', label: 'Rajesh Patel (Staff Engineer)' },
                    { value: 'mgr-arun', label: 'Arun Kumar (Engineering Director)' },
                  ]
            }
          />
        </FormField>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" data-testid="submit-open-role-btn">
            Publish role
          </Button>
        </div>
      </form>
    </Modal>
  );
}
