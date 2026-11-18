import { z } from 'zod';
import { registerRoute } from '../../openapi/registry';
import { checkInSchema, checkOutSchema, teamCalendarQuerySchema } from './attendance.schemas';

const tags = ['Attendance'];

const AttendanceRecordSchema = z
  .object({
    id: z.string().uuid(),
    employeeId: z.string().uuid(),
    workDate: z.string(),
    checkInTime: z.string().datetime(),
    checkOutTime: z.string().datetime().nullable(),
    durationMinutes: z.number().int().nullable(),
    breaks: z
      .array(
        z.object({
          startTime: z.string().datetime(),
          endTime: z.string().datetime().nullable(),
        }),
      )
      .optional(),
    breakMinutes: z.number().int().optional(),
    status: z.enum(['present', 'absent', 'half_day', 'late', 'on_leave', 'holiday', 'weekend']),
    location: z
      .object({
        latitude: z.number().optional(),
        longitude: z.number().optional(),
        address: z.string().optional(),
        workMode: z.enum(['office', 'remote']).optional(),
      })
      .nullable(),
    notes: z.string().nullable(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .meta({ id: 'AttendanceRecord' });

const TodaySummarySchema = z
  .object({
    workDate: z.string(),
    totalDurationMinutes: z.number().int(),
    sessionsCount: z.number().int(),
    activeSession: AttendanceRecordSchema.nullable(),
    sessions: z.array(AttendanceRecordSchema),
  })
  .meta({ id: 'TodayAttendanceSummary' });

registerRoute({
  method: 'post',
  path: '/attendance/check-in',
  tags,
  summary: 'Check in for work session',
  permission: 'attendance.check_in',
  body: checkInSchema,
  extraResponses: {
    403: 'Deactivated employee',
    409: 'An open session already exists',
  },
  success: {
    status: 201,
    description: 'Attendance session created',
    schema: z.object({ data: AttendanceRecordSchema }),
  },
});

registerRoute({
  method: 'post',
  path: '/attendance/check-out',
  tags,
  summary: 'Check out of active work session',
  permission: 'attendance.check_out',
  body: checkOutSchema,
  extraResponses: {
    400: 'No active session found',
    403: 'Deactivated employee',
  },
  success: {
    status: 200,
    description: 'Attendance session closed',
    schema: z.object({ data: AttendanceRecordSchema }),
  },
});

registerRoute({
  method: 'get',
  path: '/attendance/active',
  tags,
  summary: 'Get caller active attendance session',
  permission: 'attendance.read_own',
  success: {
    status: 200,
    description: 'Active attendance session or null',
    schema: z.object({ data: AttendanceRecordSchema.nullable() }),
  },
});

registerRoute({
  method: 'get',
  path: '/attendance/today',
  tags,
  summary: 'Get caller today attendance summary',
  permission: 'attendance.read_own',
  success: {
    status: 200,
    description: 'Today summary with sessions',
    schema: z.object({ data: TodaySummarySchema }),
  },
});

registerRoute({
  method: 'get',
  path: '/attendance/me',
  tags,
  summary: 'Get caller own attendance history (paginated)',
  permission: 'attendance.read_own',
  query: z.object({
    page: z.number().int().min(1).optional(),
    pageSize: z.number().int().min(1).max(100).optional(),
    sort: z.enum(['workDate', 'checkInTime', 'createdAt']).optional(),
    order: z.enum(['asc', 'desc']).optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    status: z.string().optional(),
  }),
  success: {
    status: 200,
    description: 'Paginated attendance history of caller',
    schema: z.object({
      data: z.array(AttendanceRecordSchema),
      meta: z.object({
        page: z.number().int(),
        pageSize: z.number().int(),
        total: z.number().int(),
        totalPages: z.number().int(),
      }),
    }),
  },
});

registerRoute({
  method: 'get',
  path: '/attendance',
  tags,
  summary: 'List attendance records in caller record scope (paginated)',
  permission: 'attendance.list',
  query: z.object({
    page: z.number().int().min(1).optional(),
    pageSize: z.number().int().min(1).max(100).optional(),
    sort: z.enum(['workDate', 'checkInTime', 'createdAt']).optional(),
    order: z.enum(['asc', 'desc']).optional(),
    employeeId: z.string().uuid().optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    status: z.string().optional(),
  }),
  extraResponses: {
    403: 'Caller lacks attendance.list permission (e.g. Staff)',
  },
  success: {
    status: 200,
    description: 'Paginated attendance records within scope',
    schema: z.object({
      data: z.array(AttendanceRecordSchema),
      meta: z.object({
        page: z.number().int(),
        pageSize: z.number().int(),
        total: z.number().int(),
        totalPages: z.number().int(),
      }),
    }),
  },
});

registerRoute({
  method: 'post',
  path: '/attendance/break-start',
  tags,
  summary: 'Start a break on the active attendance session',
  permission: 'attendance.check_in',
  extraResponses: {
    400: 'Not checked in',
    409: 'Break already in progress',
  },
  success: {
    status: 200,
    description: 'Attendance session updated with active break',
    schema: z.object({ data: AttendanceRecordSchema }),
  },
});

registerRoute({
  method: 'post',
  path: '/attendance/break-end',
  tags,
  summary: 'End the ongoing break on the active attendance session',
  permission: 'attendance.check_in',
  extraResponses: { 400: 'No active session or break found' },
  success: {
    status: 200,
    description: 'Attendance session updated with completed break',
    schema: z.object({ data: AttendanceRecordSchema }),
  },
});

registerRoute({
  method: 'get',
  path: '/attendance/team-calendar',
  tags,
  summary: 'Get scoped team attendance, leave, and holiday calendar entries',
  permission: 'attendance.read_own',
  query: teamCalendarQuerySchema,
  success: {
    status: 200,
    description: 'Team calendar payload',
    schema: z.object({
      data: z.object({
        employees: z.array(z.any()),
        departments: z.array(z.any()),
        holidays: z.array(z.any()),
        entries: z.array(z.any()),
      }),
    }),
  },
});
