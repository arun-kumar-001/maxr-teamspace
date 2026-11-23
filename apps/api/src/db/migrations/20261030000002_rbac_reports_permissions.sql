-- RBAC reference data for the reports framework (#15). Mirrors modules/rbac/permission-catalog.ts;
-- rbac-reference-data.test.ts fails when they differ.
-- Idempotent.

INSERT INTO permissions (id, key, module, action, description) VALUES
  ('20000000-0000-0000-0000-000000000041', 'reports.read', 'reports', 'read', 'View reports the role may run'),
  ('20000000-0000-0000-0000-000000000042', 'reports.export', 'reports', 'export', 'Export report results to CSV')
ON CONFLICT (key) DO UPDATE SET
  description = EXCLUDED.description;

-- Admin receives all permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT '10000000-0000-0000-0000-000000000001', id FROM permissions
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- HR Manager
INSERT INTO role_permissions (role_id, permission_id)
SELECT '10000000-0000-0000-0000-000000000002', id FROM permissions
WHERE key IN ('reports.read', 'reports.export')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Team Lead
INSERT INTO role_permissions (role_id, permission_id)
SELECT '10000000-0000-0000-0000-000000000003', id FROM permissions
WHERE key IN ('reports.read', 'reports.export')
ON CONFLICT (role_id, permission_id) DO NOTHING;
