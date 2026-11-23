-- Role assignment is Admin only (issue #27: "HR denied"). Mirrors modules/rbac/permission-catalog.ts;
-- rbac-reference-data.test.ts fails when they differ. Idempotent.

DELETE FROM role_permissions
WHERE role_id = '10000000-0000-0000-0000-000000000002'
  AND permission_id IN (SELECT id FROM permissions WHERE key IN ('users.assign_role'));
