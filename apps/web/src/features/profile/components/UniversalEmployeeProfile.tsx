import { Button } from '../../../components/ui/Button';
import { EmployeeDocumentsCard } from '../../employees/components/EmployeeDocumentsCard';
import type { EmployeeDetail } from '../../employees/types';
import type { EmployeeProfile } from '../types';
import { AccountInformation } from './AccountInformation';
import { ContactAndBankDetails } from './ContactAndBankDetails';
import { EmploymentInformation } from './EmploymentInformation';
import { PersonalInformation, type PhoneEditState } from './PersonalInformation';
import { ProfileHeader, type PhotoControls } from './ProfileHeader';

/** What the viewer may do here. Each entry is given only when it is allowed; the layout never changes. */
export interface ProfileActions {
  onEdit?: () => void;
  onChangeManager?: () => void;
  onDeactivate?: () => void;
  onOrgChart?: () => void;
}

export interface UniversalEmployeeProfileProps {
  employee: EmployeeDetail;
  actions?: ProfileActions;
  /** Given on your own profile: the phone is yours to edit. */
  phone?: PhoneEditState;
  /** Given when the viewer may change this person's photo. */
  photo?: PhotoControls;
}

/** The profile fields every card shares, taken from the full record. */
function toProfile(employee: EmployeeDetail): EmployeeProfile {
  return {
    photoUrl: employee.photoUrl,
    id: employee.id,
    employeeCode: employee.employeeCode,
    firstName: employee.firstName,
    lastName: employee.lastName,
    email: employee.email,
    phone: employee.phone ?? null,
    department: employee.department,
    designation: employee.designation,
    manager: employee.manager ?? null,
    status: employee.status,
    joiningDate: employee.joiningDate,
    createdAt: employee.createdAt,
    updatedAt: employee.updatedAt,
    version: employee.version,
    account: employee.account,
  };
}

/**
 * The one employee profile: your own at /profile/details and anyone's at /profile/details/:id use
 * this same layout (header, Personal Information, Employment Details, Account & System Access,
 * contact and bank details, documents). Only the data, and which actions and fields the viewer is
 * allowed, differ.
 */
export function UniversalEmployeeProfile({
  employee,
  actions = {},
  phone,
  photo,
}: UniversalEmployeeProfileProps) {
  const profile = toProfile(employee);
  const { onEdit, onChangeManager, onDeactivate, onOrgChart } = actions;
  const hasActions = Boolean(onEdit || onDeactivate || onOrgChart);

  return (
    <div className="space-y-6 w-full min-w-0" data-testid="universal-employee-profile">
      <ProfileHeader
        profile={profile}
        photo={photo}
        actions={
          hasActions ? (
            <div className="flex flex-wrap items-center gap-3 shrink-0">
              {onEdit && (
                <Button
                  variant="primary"
                  onClick={onEdit}
                  className="min-h-[44px]"
                  data-testid="edit-employee-btn"
                >
                  <svg
                    className="w-4 h-4 mr-1.5 stroke-current stroke-2 fill-none"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                  Edit Employee
                </Button>
              )}
              {onOrgChart && (
                <Button
                  variant="outline"
                  onClick={onOrgChart}
                  className="min-h-[44px]"
                  data-testid="view-org-chart-btn"
                >
                  Org Chart
                </Button>
              )}
              {onDeactivate && (
                <Button
                  variant="danger"
                  onClick={onDeactivate}
                  className="min-h-[44px]"
                  data-testid="deactivate-employee-btn"
                >
                  Deactivate
                </Button>
              )}
            </div>
          ) : undefined
        }
      />

      {employee.status === 'deactivated' && (
        <div
          className="p-4 bg-surface-muted border border-border rounded-input text-sm text-text-muted flex items-center gap-3"
          data-testid="deactivated-notice"
        >
          <svg
            className="w-5 h-5 text-text-subtle shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <span>
            This employee has been deactivated. Record details are locked in read-only mode.
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start" data-testid="tab-overview">
        <PersonalInformation profile={profile} phone={phone} />
        <EmploymentInformation profile={profile} onChangeManager={onChangeManager} />
      </div>

      {/* Only Admin and HR receive the account block from the API */}
      {employee.account && <AccountInformation account={employee.account} />}

      <ContactAndBankDetails employee={employee} />

      <EmployeeDocumentsCard employeeId={employee.id} />
    </div>
  );
}
