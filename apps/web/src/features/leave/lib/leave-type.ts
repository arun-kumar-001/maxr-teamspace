/**
 * A short-absence type (a few hours, not whole days of leave): the code or the name says so. The
 * same test Leave Setup and the API use, so a permission never counts as a day off.
 */
export function isPermissionLeave(type: { code: string; name: string }): boolean {
  return (
    type.code === 'PM' ||
    type.code === 'PERMISSION' ||
    type.name.toLowerCase().includes('permission')
  );
}
