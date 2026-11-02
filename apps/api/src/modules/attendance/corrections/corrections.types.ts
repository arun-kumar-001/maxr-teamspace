import type { ApprovalTx } from '../../approvals';

/** The approvals subject type of a correction. */
export const CORRECTION_SUBJECT = 'attendance_correction';

/** A record can be corrected for this many days after its work date (D-13). */
export const CORRECTION_WINDOW_DAYS = 30;

/** A corrected session cannot be longer than a day. */
export const MAX_CORRECTED_SESSION_MINUTES = 24 * 60;

export type CorrectionStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

export type CorrectionTx = ApprovalTx;

export interface AttendanceCorrection {
  id: string;
  attendanceRecordId: string;
  employeeId: string;
  workDate: string;
  originalCheckIn: string;
  originalCheckOut: string | null;
  requestedCheckIn: string;
  requestedCheckOut: string;
  reason: string;
  status: CorrectionStatus;
  /** The approval that decides it; the inbox at /approvals lists it for the approvers. */
  approvalId: string | null;
  createdAt: string;
  updatedAt: string;
}

/** The part of an attendance record a correction reads and overwrites. */
export interface CorrectableRecord {
  id: string;
  employeeId: string;
  workDate: string;
  checkIn: string;
  checkOut: string | null;
  durationMinutes: number | null;
  status: string;
}

export interface NewCorrection {
  attendanceRecordId: string;
  employeeId: string;
  originalCheckIn: string;
  originalCheckOut: string | null;
  requestedCheckIn: string;
  requestedCheckOut: string;
  reason: string;
}

export interface RecordTimes {
  checkIn: string;
  checkOut: string;
  durationMinutes: number;
  status: string;
}
