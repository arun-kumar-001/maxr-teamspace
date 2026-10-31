import { z } from 'zod';

const name = z.string().trim().min(1).max(100);

/** Digits, spaces, + ( ) and -: shared by the HR edit and the employee's own profile. */
export const phoneSchema = z
  .string()
  .trim()
  .regex(/^[0-9+()\-\s]{6,50}$/, 'Digits, spaces, + ( ) and - only');

/**
 * Body for `PUT /employees/{id}`: only the fields to change, plus the `version` that was read.
 * Unknown keys are rejected, so `status`, `managerId`, a role or a user id can never be sent here.
 */
export const updateEmployeeSchema = z
  .object({
    version: z.number().int().min(1),
    employeeCode: z
      .string()
      .trim()
      .regex(/^[A-Za-z0-9][A-Za-z0-9_-]{1,49}$/, 'Letters, digits, - and _ (2 to 50 characters)')
      .optional(),
    firstName: name.optional(),
    lastName: name.optional(),
    email: z.string().trim().toLowerCase().email().max(255).optional(),
    phone: phoneSchema.nullable().optional(),
    departmentId: z.string().uuid().optional(),
    designationId: z.string().uuid().optional(),
    joiningDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD')
      .refine((value) => {
        const parsed = new Date(`${value}T00:00:00Z`);
        return !Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(value);
      }, 'Not a real calendar date')
      .optional(),
  })
  .strict()
  .refine((body) => Object.keys(body).some((key) => key !== 'version'), {
    message: 'Send at least one field to change',
  });

export const employeeDetailSchema = z
  .object({
    id: z.string().uuid(),
    employeeCode: z.string(),
    firstName: z.string(),
    lastName: z.string(),
    email: z.string().email(),
    phone: z.string().nullable(),
    department: z.object({ id: z.string().uuid(), name: z.string(), code: z.string() }),
    designation: z.object({ id: z.string().uuid(), title: z.string(), code: z.string() }),
    manager: z
      .object({
        id: z.string().uuid(),
        firstName: z.string(),
        lastName: z.string(),
        employeeCode: z.string(),
      })
      .nullable(),
    status: z.enum(['active', 'pending', 'deactivated']),
    joiningDate: z.string(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
    version: z.number().int(),
    account: z
      .object({
        userId: z.string().uuid().nullable(),
        isActive: z.boolean(),
        lastLoginAt: z.string().datetime().nullable(),
        roles: z.array(z.string()),
      })
      .optional(),
  })
  .meta({ id: 'EmployeeDetail' });
