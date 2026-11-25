/** The rule the API enforces on a leave type code (createLeavePolicySchema): kept identical here. */
export const LEAVE_CODE_PATTERN = /^[A-Z][A-Z0-9_]{1,29}$/;

export const LEAVE_CODE_RULE =
  'A leave code needs 2 to 30 characters: letters, digits and underscores, starting with a letter';

export type LeaveCodeResult = { ok: true; value: string } | { ok: false; error: string };

/** A code the admin typed is checked as typed (upper-cased); nothing is silently rewritten. */
export function validateLeaveCode(raw: string): LeaveCodeResult {
  const value = raw.trim().toUpperCase();
  return LEAVE_CODE_PATTERN.test(value)
    ? { ok: true, value }
    : { ok: false, error: `"${raw.trim()}" is not a valid code. ${LEAVE_CODE_RULE}.` };
}

/** A code made from a name when none was typed: spaces become "_", other symbols are dropped. */
export function leaveCodeFromName(name: string): LeaveCodeResult {
  const derived = name
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, '_')
    .replace(/[^A-Z0-9_]/g, '')
    .replace(/^[^A-Z]+/, '')
    .slice(0, 30);
  return LEAVE_CODE_PATTERN.test(derived)
    ? { ok: true, value: derived }
    : {
        ok: false,
        error: `A code could not be made from "${name.trim()}". Enter one yourself. ${LEAVE_CODE_RULE}.`,
      };
}
