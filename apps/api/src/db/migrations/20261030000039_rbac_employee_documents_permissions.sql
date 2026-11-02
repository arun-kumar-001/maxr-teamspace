-- RBAC reference data for employee documents (#25, D-10, D-25).
-- Mirrors modules/rbac/permission-catalog.ts; rbac-reference-data.test.ts fails when they differ. Idempotent.

INSERT INTO permissions (id, key, module, action, description) VALUES
  ('20000000-0000-0000-0000-000000000078', 'documents.read', 'documents', 'read', 'View employee document list and metadata'),
  ('20000000-0000-0000-0000-000000000079', 'documents.upload', 'documents', 'upload', 'Upload an employee document'),
  ('20000000-0000-0000-0000-00000000007a', 'documents.download', 'documents', 'download', 'Generate signed download link for an employee document'),
  ('20000000-0000-0000-0000-00000000007b', 'documents.delete', 'documents', 'delete', 'Soft delete an employee document')
ON CONFLICT (key) DO UPDATE SET
  description = EXCLUDED.description;

-- Admin receives all permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT '10000000-0000-0000-0000-000000000001', id FROM permissions
WHERE key IN (
  'documents.read',
  'documents.upload',
  'documents.download',
  'documents.delete'
)
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- HR Manager can read, upload, download, and delete
INSERT INTO role_permissions (role_id, permission_id)
SELECT '10000000-0000-0000-0000-000000000002', id FROM permissions
WHERE key IN (
  'documents.read',
  'documents.upload',
  'documents.download',
  'documents.delete'
)
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Team Lead: Denied by default (no employee document permissions)

-- Staff can read, upload, and download their own documents only
INSERT INTO role_permissions (role_id, permission_id)
SELECT '10000000-0000-0000-0000-000000000004', id FROM permissions
WHERE key IN (
  'documents.read',
  'documents.upload',
  'documents.download'
)
ON CONFLICT (role_id, permission_id) DO NOTHING;
