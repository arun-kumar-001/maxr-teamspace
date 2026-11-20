import type { LeavePolicy, LeaveBalance } from '../types';

export const CONFIG_STORAGE_KEY = 'maxr_company_config';

export interface StoredCustomLeaveType {
  id?: string;
  name: string;
  code?: string;
  category?: 'general' | 'medical' | 'parental' | 'permission' | 'special' | string;
  quota?: number;
  frequency?: 'yearly' | 'monthly' | 'lifetime' | string;
  accrualMethod?: 'yearly' | 'monthly' | 'manual' | string;
  isPaid?: boolean;
  carryForwardEnabled?: boolean;
  carryForwardMax?: number;
  encashmentEnabled?: boolean;
  encashmentMax?: number;
  isActive?: boolean;
  description?: string;
  allowHalfDay?: boolean;
  maxBackdateDays?: number;
}

export function getConfiguredLeavePolicies(): LeavePolicy[] | null {
  try {
    const raw = typeof window !== 'undefined' ? localStorage.getItem(CONFIG_STORAGE_KEY) : null;
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed.customLeaveTypes) && parsed.customLeaveTypes.length > 0) {
        return parsed.customLeaveTypes
          .filter((t: StoredCustomLeaveType) => t.isActive !== false)
          .map((t: StoredCustomLeaveType) => {
            const isPerm =
              t.category === 'permission' ||
              t.code === 'PM' ||
              t.code === 'PERMISSION' ||
              t.name.toLowerCase().includes('permission');
            const hasBal = isPerm ? false : (t.isPaid ?? true);
            const annualDays = hasBal ? t.quota || 0 : 0;
            const carryForwardMax = hasBal && t.carryForwardEnabled ? t.carryForwardMax || 0 : 0;
            const rawCode =
              (t.code || t.name.slice(0, 4))
                .trim()
                .toUpperCase()
                .replace(/[^A-Z0-9_]/g, '') || 'LV';
            const cleanCode = rawCode.length >= 2 ? rawCode : `${rawCode}X`;

            return {
              id: t.id || `pol-${cleanCode.toLowerCase()}`,
              code: cleanCode,
              name: t.name,
              hasBalance: hasBal,
              isActive: t.isActive ?? true,
              annualDays,
              carryForwardMax,
              allowHalfDay: isPerm ? false : (t.allowHalfDay ?? true),
              maxBackdateDays: t.maxBackdateDays ?? (isPerm ? 2 : 0),
              version: 1,
              updatedAt: new Date().toISOString(),
            };
          });
      }
    }
  } catch {
    // Browser storage unavailable
  }
  return null;
}

export function getConfiguredLeaveBalances(
  configuredPolicies: LeavePolicy[],
  year?: number,
): LeaveBalance[] {
  return configuredPolicies.map((p) => ({
    leaveTypeId: p.id,
    code: p.code,
    name: p.name,
    year: year || new Date().getFullYear(),
    allotted: p.annualDays,
    carriedForward: 0,
    used: 0,
    remaining: p.annualDays,
  }));
}
