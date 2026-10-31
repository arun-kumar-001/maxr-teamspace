import { z } from 'zod';
import { registerRoute } from '../../openapi/registry';
import {
  assignShiftSchema,
  attendancePolicySchema,
  createShiftSchema,
  employeeIdParamsSchema,
  listShiftsQuerySchema,
  shiftAssignmentSchema,
  shiftIdParamsSchema,
  shiftSchema,
  updatePolicySchema,
  updateShiftSchema,
} from './shifts.schemas';

const tags = ['Shifts and attendance policy'];

registerRoute({
  method: 'get',
  path: '/shifts',
  tags,
  summary: 'List shift definitions (every signed-in role)',
  permission: 'shifts.list',
  query: listShiftsQuerySchema,
  success: {
    status: 200,
    description: 'Shifts, earliest start first',
    schema: z.object({ data: z.array(shiftSchema) }),
  },
});

registerRoute({
  method: 'post',
  path: '/shifts',
  tags,
  summary:
    'Create a shift (Admin, HR Manager). Times are company-local HH:MM; an end not after the start means the shift runs past midnight and belongs to the date it starts',
  permission: 'shifts.create',
  idempotent: true,
  body: createShiftSchema,
  extraResponses: { 409: 'The shift code is already used' },
  success: { status: 201, description: 'The new shift', schema: z.object({ data: shiftSchema }) },
});

registerRoute({
  method: 'get',
  path: '/shifts/{id}',
  tags,
  summary: 'One shift',
  permission: 'shifts.list',
  params: shiftIdParamsSchema,
  success: { status: 200, description: 'The shift', schema: z.object({ data: shiftSchema }) },
});

registerRoute({
  method: 'put',
  path: '/shifts/{id}',
  tags,
  summary:
    'Change a shift (Admin, HR Manager). The code never changes. A shift that is the policy default or has assignments in force cannot be deactivated',
  permission: 'shifts.update',
  params: shiftIdParamsSchema,
  body: updateShiftSchema,
  extraResponses: {
    422: 'Same start and end time, or the shift is in use and cannot be deactivated',
  },
  success: {
    status: 200,
    description: 'The shift after the change',
    schema: z.object({ data: shiftSchema }),
  },
});

registerRoute({
  method: 'get',
  path: '/shifts/assignments/{employeeId}',
  tags,
  summary:
    'The shift assignments of one employee, latest first. Admin and HR any employee, a Team Lead their team, anyone their own',
  permission: 'shifts.read_assignment',
  params: employeeIdParamsSchema,
  success: {
    status: 200,
    description: 'Assignments',
    schema: z.object({ data: z.array(shiftAssignmentSchema) }),
  },
});

registerRoute({
  method: 'post',
  path: '/shifts/assignments',
  tags,
  summary:
    'Give an employee a shift from a date (Admin, HR Manager). A new open-ended assignment ends the current open-ended one the day before; any other overlap is a 409',
  permission: 'shifts.assign',
  idempotent: true,
  body: assignShiftSchema,
  extraResponses: {
    409: 'The employee already has a shift on some of these dates',
    422: 'The employee is deactivated, or the shift is missing or inactive',
  },
  success: {
    status: 201,
    description: 'The new assignment',
    schema: z.object({ data: shiftAssignmentSchema }),
  },
});

registerRoute({
  method: 'get',
  path: '/attendance/policies',
  tags,
  summary:
    'The attendance policy: full and half day minutes, the default shift, and the company timezone and work week it works in (every signed-in role)',
  permission: 'attendance_policies.read',
  success: {
    status: 200,
    description: 'The policy',
    schema: z.object({ data: attendancePolicySchema }),
  },
});

registerRoute({
  method: 'put',
  path: '/attendance/policies',
  tags,
  summary:
    'Change the attendance policy (Admin, HR Manager; audited). The timezone and work week are company settings and are changed there',
  permission: 'attendance_policies.update',
  body: updatePolicySchema,
  extraResponses: {
    422: 'A half day is not shorter than a full day, or the default shift is missing or inactive',
  },
  success: {
    status: 200,
    description: 'The policy after the change',
    schema: z.object({ data: attendancePolicySchema }),
  },
});
