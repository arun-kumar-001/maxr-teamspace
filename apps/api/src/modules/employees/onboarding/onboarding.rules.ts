import { OnboardingItem, OnboardingStep } from './onboarding.types';

export interface DefaultItemDef {
  step: 'hr' | 'system' | 'it_admin' | 'employee';
  itemKey: string;
  title: string;
  description: string;
  autoVerified?: boolean;
}

/**
 * Standard 4-step onboarding checklist definitions per D-20 (report T§4.1).
 */
export const DEFAULT_ONBOARDING_ITEMS: readonly DefaultItemDef[] = [
  // 1. HR Manager Step
  {
    step: 'hr',
    itemKey: 'id_proof',
    title: 'ID proof collected and verified',
    description: 'Government photo ID collected, reviewed and stored per compliance guidelines.',
  },
  {
    step: 'hr',
    itemKey: 'address_proof',
    title: 'Address proof collected and verified',
    description: 'Residential address proof document collected and verified.',
  },
  {
    step: 'hr',
    itemKey: 'signed_offer',
    title: 'Signed offer letter received',
    description: 'Offer letter signed by candidate received and filed.',
  },
  {
    step: 'hr',
    itemKey: 'profile_confirmed',
    title: 'Employee code, department, designation, manager and joining date confirmed',
    description: 'HR confirms initial placement details are accurate.',
  },

  // 2. System Step (automatic upon employee creation)
  {
    step: 'system',
    itemKey: 'account_created',
    title: 'Sign-in account created in pending status',
    description: 'User credential created in pending inactive state.',
    autoVerified: true,
  },
  {
    step: 'system',
    itemKey: 'role_assigned',
    title: 'System role assigned',
    description: 'Role permissions provisioned.',
    autoVerified: true,
  },
  {
    step: 'system',
    itemKey: 'leave_balances',
    title: 'Default leave balances initialized',
    description: 'Yearly statutory leave quotas assigned.',
    autoVerified: true,
  },
  {
    step: 'system',
    itemKey: 'default_shift',
    title: 'Default work shift assigned',
    description: 'Standard working hours and policy attached.',
    autoVerified: true,
  },
  {
    step: 'system',
    itemKey: 'welcome_email',
    title: 'Welcome email queued',
    description: 'Initial welcome notification sent to corporate email.',
    autoVerified: true,
  },

  // 3. IT/Admin Step
  {
    step: 'it_admin',
    itemKey: 'work_email',
    title: 'Corporate email and tool access provisioned',
    description: 'Workspace login, email address, and collaboration tools access activated.',
  },
  {
    step: 'it_admin',
    itemKey: 'equipment_issued',
    title: 'Workstation and IT equipment issued',
    description: 'Hardware, laptop, and security accessories provisioned to the employee.',
  },

  // 4. Employee Step
  {
    step: 'employee',
    itemKey: 'password_set',
    title: 'Initial password set via secure claim link',
    description: 'Employee opened 72h single-use link and set account password.',
  },
  {
    step: 'employee',
    itemKey: 'profile_reviewed',
    title: 'Employee profile details reviewed and confirmed',
    description: 'Employee verified personal contact info and Emergency details.',
  },
  {
    step: 'employee',
    itemKey: 'policies_acknowledged',
    title: 'Company policies and code of conduct acknowledged',
    description: 'Employee read and agreed to information security and workplace conduct.',
  },
];

export const STEP_ORDER: readonly OnboardingStep[] = [
  'hr',
  'system',
  'it_admin',
  'employee',
  'completed',
];

/**
 * Calculates current step based on item verifications.
 */
export function deriveCurrentStep(items: readonly OnboardingItem[]): OnboardingStep {
  const isStepComplete = (step: 'hr' | 'system' | 'it_admin' | 'employee') => {
    const stepItems = items.filter((i) => i.step === step);
    return stepItems.length > 0 && stepItems.every((i) => i.isVerified);
  };

  if (!isStepComplete('hr')) return 'hr';
  if (!isStepComplete('system')) return 'system';
  if (!isStepComplete('it_admin')) return 'it_admin';
  if (!isStepComplete('employee')) return 'employee';
  return 'completed';
}

/**
 * Validates step sequence: an item in a later step cannot be verified before
 * preceding steps are fully complete.
 */
export function canVerifyItem(
  targetItem: OnboardingItem,
  allItems: readonly OnboardingItem[],
): { allowed: boolean; reason?: string } {
  const isStepComplete = (step: 'hr' | 'system' | 'it_admin' | 'employee') => {
    const stepItems = allItems.filter((i) => i.step === step);
    return stepItems.length > 0 && stepItems.every((i) => i.isVerified);
  };

  if (targetItem.step === 'hr' || targetItem.step === 'system') {
    return { allowed: true };
  }

  if (targetItem.step === 'it_admin') {
    if (!isStepComplete('hr')) {
      return { allowed: false, reason: 'HR verification step must be completed first' };
    }
    if (!isStepComplete('system')) {
      return { allowed: false, reason: 'System provisioning step must be completed first' };
    }
    return { allowed: true };
  }

  if (targetItem.step === 'employee') {
    if (!isStepComplete('hr') || !isStepComplete('system')) {
      return { allowed: false, reason: 'HR and System steps must be completed first' };
    }
    if (!isStepComplete('it_admin')) {
      return { allowed: false, reason: 'IT provisioning step must be completed first' };
    }
    return { allowed: true };
  }

  return { allowed: true };
}

/**
 * Validates activation readiness: every item must be verified.
 */
export function checkActivationReadiness(items: readonly OnboardingItem[]): {
  ready: boolean;
  unverifiedItems: string[];
} {
  const unverified = items.filter((i) => !i.isVerified);
  return {
    ready: unverified.length === 0,
    unverifiedItems: unverified.map((i) => `${i.step}.${i.itemKey}`),
  };
}
