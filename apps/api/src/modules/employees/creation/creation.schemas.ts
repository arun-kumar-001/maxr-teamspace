import { ROLES, uuidString, type Role } from '@maxr/shared';
import { z } from 'zod';

const MAX_DAYS_AHEAD = 365;
const roleKey = z.enum(Object.values(ROLES) as [Role, ...Role[]]);

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD')
  .refine((value) => {
    const parsed = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(value);
  }, 'Not a real calendar date')
  .refine((value) => {
    const limit = Date.now() + MAX_DAYS_AHEAD * 24 * 60 * 60 * 1000;
    return new Date(`${value}T00:00:00Z`).getTime() <= limit;
  }, `Joining date is more than ${MAX_DAYS_AHEAD} days away`);

const name = z.string().trim().min(1).max(100);

/** Body for `POST /employees`. Unknown keys are rejected: nothing like `status` or `isActive` can be sent. */
export const createEmployeeSchema = z
  .object({
    employeeCode: z
      .string()
      .trim()
      .regex(/^[A-Za-z0-9][A-Za-z0-9_-]{1,49}$/, 'Letters, digits, - and _ (2 to 50 characters)'),
    firstName: name,
    lastName: name,
    email: z.string().trim().toLowerCase().email().max(255),
    phone: z
      .string()
      .trim()
      .regex(/^[0-9+()\-\s]{6,50}$/, 'Digits, spaces, + ( ) and - only')
      .optional(),
    departmentId: uuidString,
    designationId: uuidString,
    managerId: uuidString.optional(),
    joiningDate: isoDate,
    role: roleKey.default(ROLES.STAFF),
    additionalEmails: z.array(z.string().trim().toLowerCase().email().max(255)).max(5).optional(),
    additionalPhones: z
      .array(
        z
          .string()
          .trim()
          .regex(/^[0-9+()\-\s]{6,50}$/, 'Digits, spaces, + ( ) and - only'),
      )
      .max(5)
      .optional(),
    permanentAddress: z.string().trim().max(500).optional(),
    currentAddress: z.string().trim().max(500).optional(),
    bloodGroup: z.enum(['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-']).optional(),
    panNumber: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z]{5}[0-9]{4}[A-Z]$/, 'Use 10-character PAN format (e.g. ABCDE1234F)')
      .optional(),
    aadhaarNumber: z
      .string()
      .trim()
      .regex(/^\d{12}$/, 'Aadhaar number must be 12 digits')
      .optional(),
  })
  .strict();

export const createdEmployeeSchema = z
  .object({
    id: uuidString,
    userId: uuidString,
    employeeCode: z.string(),
    firstName: z.string(),
    lastName: z.string(),
    email: z.string().email(),
    phone: z.string().nullable(),
    departmentId: uuidString,
    designationId: uuidString,
    managerId: uuidString.nullable(),
    status: z.literal('pending'),
    role: roleKey,
    joiningDate: z.string(),
    createdAt: z.string().datetime(),
  })
  .meta({ id: 'CreatedEmployee' });
