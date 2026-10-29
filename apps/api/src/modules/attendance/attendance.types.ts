import { z } from 'zod';
import {
  attendanceRecordSchema,
  attendanceStatusSchema,
  checkInSchema,
  checkOutSchema,
  listAttendanceQuerySchema,
  locationSchema,
} from './attendance.schemas';

export type AttendanceRecord = z.infer<typeof attendanceRecordSchema>;
export type AttendanceStatus = z.infer<typeof attendanceStatusSchema>;
export type AttendanceLocation = z.infer<typeof locationSchema>;
export type CheckInDto = z.infer<typeof checkInSchema>;
export type CheckOutDto = z.infer<typeof checkOutSchema>;
export type ListAttendanceQuery = z.infer<typeof listAttendanceQuerySchema>;

export interface TodayAttendanceSummary {
  date: string;
  activeSession: AttendanceRecord | null;
  completedSessions: AttendanceRecord[];
  totalWorkedMinutes: number;
  status: AttendanceStatus;
}
