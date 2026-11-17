# Designation contract

Designations contain `id`, `departmentId`, `title`, `code`, `isActive`, `createdAt` and `updatedAt`. Hierarchy level was removed in migration `20261117000001_remove_designation_level.sql`. Creation and update schemas reject the removed `level` property. List sorting supports `title` (default), `code` and `createdAt`.

Employee creation uses an active `departmentId` and an active `designationId` belonging to that department. Onboarding reads the employee relationships to show department and designation. Reporting hierarchy uses `managerId` and authorization uses roles and record scope.

Apply the new migration before starting the updated API. Previously applied migrations remain immutable. Development seeds omit level and can run after a clean migration. Dropped level values cannot be reconstructed by an automatic down migration. Restore them from a pre-migration database backup if rollback is required.
